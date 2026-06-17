// Edge Function: admin-feedback
// GET /admin-feedback?limit=30&offset=0 → 피드백 목록 (view_feedback 권한)

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
    console.error('[admin-feedback] ADMIN_SESSION_SECRET 미설정')
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

  if (!hasPermission(adminPayload, 'view_feedback')) {
    return json({ error: 'view_feedback 권한이 없습니다' }, 403)
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const url    = new URL(req.url)
  const limit  = Math.min(parseInt(url.searchParams.get('limit')  ?? '30'), 100)
  const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0'),  0)

  try {
    // 피드백 목록 + 총 개수 + auth 유저 이름 병렬 조회
    const [feedbackRes, countRes, authRes] = await Promise.all([
      supabase
        .from('feedback')
        .select('id, user_id, nickname, type, content, screenshot_url, created_at')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from('feedback')
        .select('id', { count: 'exact', head: true }),
      supabase.auth.admin.listUsers({ page: 1, perPage: 500 }),
    ])

    if (feedbackRes.error) {
      console.error('[admin-feedback] 피드백 조회 오류:', feedbackRes.error.message)
      throw feedbackRes.error
    }

    // auth.users → 표시이름 맵
    const userMap: Record<string, string> = {}
    for (const u of authRes.data?.users ?? []) {
      const meta = (u.user_metadata ?? {}) as Record<string, string>
      userMap[u.id] = meta.full_name || meta.name || meta.nickname ||
        (u.email ? u.email.split('@')[0] : `user_${u.id.slice(0, 8)}`)
    }

    const items = (feedbackRes.data ?? []).map(f => ({
      id:       f.id,
      // 우선순위: auth 이름 → DB에 저장된 nickname → 익명
      author:   (f.user_id ? (userMap[f.user_id] ?? null) : null) || f.nickname || '익명',
      type:     f.type,
      content:  f.content,
      // http URL 아닌 경우(업로드 실패 잔재) 제외
      screenshot_url: (f.screenshot_url && f.screenshot_url.startsWith('http'))
        ? f.screenshot_url
        : null,
      created_at: f.created_at,
    }))

    console.log(`[admin-feedback] 조회 완료: ${items.length}건 (전체 ${countRes.count ?? 0}건)`)

    return json({
      items,
      total:  countRes.count ?? 0,
      offset,
      limit,
    })

  } catch (e) {
    console.error('[admin-feedback] 오류:', e instanceof Error ? e.message : e)
    return json({ error: '서버 오류가 발생했어요' }, 500)
  }
})
