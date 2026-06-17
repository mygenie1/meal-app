// Edge Function: admin-users
// 관리자 토큰 + view_users 권한 검증 후 유저 목록 + 요약 통계 반환
// 유저 소스: auth.users (Supabase auth admin API, service-role 필요)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  verifyToken,
  hasPermission,
  CORS_HEADERS,
  json,
} from '../_shared/adminAuth.ts'

const SUPABASE_URL              = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN_SESSION_SECRET      = Deno.env.get('ADMIN_SESSION_SECRET')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  if (!ADMIN_SESSION_SECRET) {
    console.error('[admin-users] ADMIN_SESSION_SECRET 미설정')
    return json({ error: '서버 설정 오류' }, 500)
  }

  // 관리자 세션 토큰 읽기
  // x-admin-token 헤더 우선 (게이트웨이 anon key와 충돌 방지)
  // fallback: Authorization: Bearer <token>
  const sessionToken =
    req.headers.get('x-admin-token') ??
    (() => {
      const h = req.headers.get('authorization') ?? ''
      return h.startsWith('Bearer ') ? h.slice(7).trim() : null
    })()
  if (!sessionToken) return json({ error: '토큰이 없습니다' }, 401)

  try {
    const payload = await verifyToken(sessionToken, ADMIN_SESSION_SECRET)
    if (!hasPermission(payload, 'view_users')) {
      return json({ error: 'view_users 권한이 없습니다' }, 403)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : '토큰 오류'
    return json({ error: msg }, 401)
  }

  // service-role 클라이언트 — RLS 우회, auth.admin API 접근 가능
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 1. 전체 유저 목록 (auth admin API)
    //    소규모 앱 기준 perPage=500으로 단일 페이지 조회
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 500,
    })
    if (authError) throw authError

    const allUsers = authData.users

    // 2. 요약 통계 병렬 조회
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const newUsers7d   = allUsers.filter(u => u.created_at > sevenDaysAgo).length

    const [spacesRes, mealsRes] = await Promise.all([
      supabase.from('spaces').select('id', { count: 'exact', head: true }),
      supabase.from('meals').select('id',  { count: 'exact', head: true }),
    ])

    // 3. 유저별 스페이스 수 + 기록 수 집계
    const userIds = allUsers.map(u => u.id)

    const [spaceMembersRes, mealCountsRes] = userIds.length > 0
      ? await Promise.all([
          supabase.from('space_members').select('user_id').in('user_id', userIds),
          supabase.from('meals').select('user_id').in('user_id', userIds),
        ])
      : [{ data: [] as { user_id: string }[] }, { data: [] as { user_id: string }[] }]

    const spaceCountMap: Record<string, number> = {}
    const mealCountMap:  Record<string, number> = {}

    for (const row of (spaceMembersRes.data ?? [])) {
      spaceCountMap[row.user_id] = (spaceCountMap[row.user_id] ?? 0) + 1
    }
    for (const row of (mealCountsRes.data ?? [])) {
      mealCountMap[row.user_id] = (mealCountMap[row.user_id] ?? 0) + 1
    }

    // 4. 유저 목록 포맷 — 민감 정보 최소화 (이메일 마스킹, 비번 등 제외)
    const userList = allUsers.map(u => {
      const meta = (u.user_metadata ?? {}) as Record<string, string>
      const displayName =
        meta.full_name || meta.name || meta.nickname ||
        (u.email ? u.email.split('@')[0] : `user_${u.id.slice(0, 8)}`)

      const provider = String(
        (u.app_metadata as Record<string, unknown>)?.provider ?? 'email'
      )

      // 이메일 첫 글자만 노출: abc@gmail.com → a**@gmail.com
      const maskedEmail = u.email
        ? `${u.email[0]}**@${u.email.split('@')[1]}`
        : null

      return {
        id:           u.id,
        display_name: displayName,
        masked_email: maskedEmail,
        provider,
        created_at:   u.created_at,
        space_count:  spaceCountMap[u.id] ?? 0,
        meal_count:   mealCountMap[u.id]  ?? 0,
      }
    })

    return json({
      summary: {
        total_users:  allUsers.length,
        total_spaces: spacesRes.count  ?? 0,
        total_meals:  mealsRes.count   ?? 0,
        new_users_7d: newUsers7d,
      },
      users: userList,
    })

  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    console.error('[admin-users] 오류:', msg)
    return json({ error: '서버 오류가 발생했어요' }, 500)
  }
})
