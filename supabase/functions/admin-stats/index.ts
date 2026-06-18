// Edge Function: admin-stats
// 최근 30일 일별 신규 가입·기록·활성 사용자 집계 반환
// 권한: view_users

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
    console.error('[admin-stats] ADMIN_SESSION_SECRET 미설정')
    return json({ error: '서버 설정 오류' }, 500)
  }

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
    return json({ error: e instanceof Error ? e.message : '토큰 오류' }, 401)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  try {
    // 30일 범위 (UTC 기준)
    const now   = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - 29)
    start.setHours(0, 0, 0, 0)

    const startIso = start.toISOString()
    const fmt      = (d: Date) => d.toISOString().slice(0, 10)

    // 30일치 버킷 초기화 (데이터 없는 날 0으로 채움)
    type Bucket = { signups: number; meals: number; activeSet: Set<string> }
    const buckets: Record<string, Bucket> = {}
    for (let i = 0; i < 30; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      buckets[fmt(d)] = { signups: 0, meals: 0, activeSet: new Set() }
    }

    // 병렬 조회
    const [usersRes, mealsRes] = await Promise.all([
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabase
        .from('meals')
        .select('created_at, user_id')
        .gte('created_at', startIso),
    ])

    if (usersRes.error) throw usersRes.error
    if (mealsRes.error) throw mealsRes.error

    // 신규 가입 집계 (JS 필터 — auth API는 날짜 필터 미지원)
    for (const u of usersRes.data.users) {
      const k = u.created_at.slice(0, 10)
      if (buckets[k]) buckets[k].signups++
    }

    // 신규 기록 + 활성 사용자 집계
    for (const m of (mealsRes.data ?? [])) {
      const k = (m.created_at as string).slice(0, 10)
      if (buckets[k]) {
        buckets[k].meals++
        if (m.user_id) buckets[k].activeSet.add(m.user_id as string)
      }
    }

    const trend = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({
        date,
        signups:      b.signups,
        meals:        b.meals,
        active_users: b.activeSet.size,
      }))

    return json({ trend })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '알 수 없는 오류'
    console.error('[admin-stats] 오류:', msg)
    return json({ error: '서버 오류가 발생했어요' }, 500)
  }
})
