// Edge Function: admin-spaces
// GET /admin-spaces           → 스페이스 목록 (view_spaces 권한)
// GET /admin-spaces?space_id= → 스페이스 상세 + 기록 (read_space_content 권한)

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

// photos[] 항목에서 썸네일 URL 추출
// JSON 객체 문자열 / 레거시 Storage URL / base64 모두 처리
function getFirstThumb(
  photos: string[] | null | undefined,
  photo:  string  | null | undefined,
): string | null {
  const entries = photos?.length ? photos : (photo ? [photo] : [])
  for (const entry of entries) {
    if (!entry || entry.startsWith('data:')) continue  // base64 제외
    try {
      const parsed = JSON.parse(entry)
      if (parsed.thumb) return parsed.thumb
      if (parsed.original) return parsed.original
    } catch {
      if (entry.startsWith('http')) return entry
    }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  if (!ADMIN_SESSION_SECRET) {
    console.error('[admin-spaces] ADMIN_SESSION_SECRET 미설정')
    return json({ error: '서버 설정 오류' }, 500)
  }

  // 관리자 세션 토큰 (x-admin-token 우선, Authorization fallback)
  const sessionToken =
    req.headers.get('x-admin-token') ??
    (() => {
      const h = req.headers.get('authorization') ?? ''
      return h.startsWith('Bearer ') ? h.slice(7).trim() : null
    })()
  if (!sessionToken) return json({ error: '토큰이 없습니다' }, 401)

  let adminPayload
  try {
    adminPayload = await verifyToken(sessionToken, ADMIN_SESSION_SECRET)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '토큰 오류' }, 401)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const url      = new URL(req.url)
  const spaceId  = url.searchParams.get('space_id')

  // ── 스페이스 상세 (read_space_content) ─────────────────────────
  if (spaceId) {
    if (!hasPermission(adminPayload, 'read_space_content')) {
      return json({ error: 'read_space_content 권한이 없습니다' }, 403)
    }

    try {
      // space_members를 전체 조회 후 JS에서 필터링
      // — 목록과 동일한 방식: DB `.eq()` 필터 대신 JS 비교로 일관성 보장
      const [spaceRes, allMembersRes, totalMealsRes, mealsRes] = await Promise.all([
        supabase.from('spaces').select('id, name, emoji, code, created_at').eq('id', spaceId).single(),
        supabase.from('space_members').select('space_id, user_id, created_at'),
        supabase.from('meals').select('id', { count: 'exact', head: true }).eq('space_id', spaceId),
        supabase.from('meals')
          .select('id, date, title, restaurant_name, tag, meal_time, rating, review, user_id, photos, photo, created_at')
          .eq('space_id', spaceId)
          .order('date', { ascending: false })
          .limit(30),
      ])

      if (spaceRes.error || !spaceRes.data) {
        return json({ error: '스페이스를 찾을 수 없습니다' }, 404)
      }

      // space_members 에러 로그 (data는 [] 폴백으로 계속 진행)
      if (allMembersRes.error) {
        console.error('[admin-spaces] space_members 조회 오류:', allMembersRes.error.message)
      }

      // JS에서 해당 스페이스 멤버만 필터 (목록 방식과 동일)
      const spaceMembers = (allMembersRes.data ?? []).filter(m => m.space_id === spaceId)
      console.log(`[admin-spaces] 상세 space_id=${spaceId}: 전체 멤버 rows=${allMembersRes.data?.length ?? 0}, 이 스페이스 멤버=${spaceMembers.length}`)

      // 멤버 표시이름 조회 (auth.admin)
      const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 500 })
      const userMap: Record<string, string> = {}
      for (const u of authData?.users ?? []) {
        const meta = (u.user_metadata ?? {}) as Record<string, string>
        userMap[u.id] = meta.full_name || meta.name || meta.nickname ||
          (u.email ? u.email.split('@')[0] : `user_${u.id.slice(0, 8)}`)
      }

      // user_id null-safe 매핑: 매핑 실패해도 멤버 누락 없이 표시
      const members = spaceMembers.map(m => {
        const uid = m.user_id ?? ''
        return {
          user_id:      uid,
          display_name: userMap[uid] ?? (uid ? `user_${uid.slice(0, 8)}` : '(알 수 없음)'),
          joined_at:    m.created_at,
        }
      })

      const meals = (mealsRes.data ?? []).map(m => ({
        id:              m.id,
        date:            m.date,
        title:           m.title,
        restaurant_name: m.restaurant_name,
        tag:             m.tag,
        meal_time:       m.meal_time,
        rating:          m.rating,
        review:          m.review,
        author:          userMap[m.user_id] ?? `user_${(m.user_id ?? '').slice(0, 8)}`,
        thumb:           getFirstThumb(m.photos as string[], m.photo as string),
      }))

      return json({
        space:       spaceRes.data,
        members,
        meals,
        total_meals: totalMealsRes.count ?? 0,
      })

    } catch (e) {
      console.error('[admin-spaces] 상세 오류:', e instanceof Error ? e.message : e)
      return json({ error: '서버 오류가 발생했어요' }, 500)
    }
  }

  // ── 스페이스 목록 (view_spaces) ────────────────────────────────
  if (!hasPermission(adminPayload, 'view_spaces')) {
    return json({ error: 'view_spaces 권한이 없습니다' }, 403)
  }

  try {
    const [spacesRes, membersRes, mealsRes] = await Promise.all([
      supabase.from('spaces').select('id, name, emoji, code, created_at').order('created_at', { ascending: false }),
      supabase.from('space_members').select('space_id'),
      supabase.from('meals').select('space_id, date').order('date', { ascending: false }),
    ])

    const memberCountMap: Record<string, number> = {}
    for (const row of membersRes.data ?? []) {
      memberCountMap[row.space_id] = (memberCountMap[row.space_id] ?? 0) + 1
    }

    const mealCountMap:  Record<string, number> = {}
    const lastMealMap:   Record<string, string> = {}
    for (const row of mealsRes.data ?? []) {
      mealCountMap[row.space_id] = (mealCountMap[row.space_id] ?? 0) + 1
      if (!lastMealMap[row.space_id]) lastMealMap[row.space_id] = row.date
    }

    const spaces = (spacesRes.data ?? [])
      .map(s => ({
        id:             s.id,
        name:           s.name,
        emoji:          s.emoji,
        code:           s.code,
        created_at:     s.created_at,
        member_count:   memberCountMap[s.id] ?? 0,
        meal_count:     mealCountMap[s.id]   ?? 0,
        last_meal_date: lastMealMap[s.id]    ?? null,
      }))
      // 기록 수 많은 순 정렬
      .sort((a, b) => b.meal_count - a.meal_count)

    return json({ spaces, total: spaces.length })

  } catch (e) {
    console.error('[admin-spaces] 목록 오류:', e instanceof Error ? e.message : e)
    return json({ error: '서버 오류가 발생했어요' }, 500)
  }
})
