// Edge Function: admin-feedback
// GET  ?limit=30&offset=0&status=all|new|checked|done → 피드백 목록
// POST { action: 'update_status', feedback_id, status } → 상태 변경

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

  // ── POST: 상태 변경 ───────────────────────────────────────────
  if (req.method === 'POST') {
    let body: { action?: string; feedback_id?: string; status?: string }
    try { body = await req.json() } catch { return json({ error: '요청 파싱 실패' }, 400) }

    if (body.action !== 'update_status') return json({ error: '알 수 없는 action' }, 400)
    if (!body.feedback_id || !body.status) return json({ error: 'feedback_id, status 필수' }, 400)

    const VALID_STATUSES = ['new', 'checked', 'done']
    if (!VALID_STATUSES.includes(body.status)) return json({ error: '유효하지 않은 상태값' }, 400)

    const { error } = await supabase
      .from('feedback')
      .update({
        status:     body.status,
        handled_by: adminPayload.username,
        handled_at: new Date().toISOString(),
      })
      .eq('id', body.feedback_id)

    if (error) {
      console.error('[admin-feedback] 상태 변경 실패:', error.message)
      return json({ error: '상태 변경 실패' }, 500)
    }

    console.log(`[admin-feedback] ${body.feedback_id} → ${body.status} by ${adminPayload.username}`)
    return json({ ok: true })
  }

  // ── GET: 목록 조회 ────────────────────────────────────────────
  if (req.method !== 'GET') return json({ error: 'Method Not Allowed' }, 405)


  const url     = new URL(req.url)
  const limit   = Math.min(parseInt(url.searchParams.get('limit')  ?? '30'), 100)
  const offset  = Math.max(parseInt(url.searchParams.get('offset') ?? '0'),  0)
  const statusQ = url.searchParams.get('status') ?? 'all'  // 'all'|'new'|'checked'|'done'

  try {
    let feedbackQ = supabase
      .from('feedback')
      .select('id, user_id, nickname, type, content, screenshot_url, created_at, status, handled_by, handled_at')
      .order('created_at', { ascending: false })

    let countQ = supabase.from('feedback').select('id', { count: 'exact', head: true })

    if (statusQ !== 'all') {
      feedbackQ = feedbackQ.eq('status', statusQ)
      countQ    = countQ.eq('status', statusQ)
    }

    feedbackQ = feedbackQ.range(offset, offset + limit - 1)

    const [feedbackRes, countRes, authRes] = await Promise.all([
      feedbackQ,
      countQ,
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

    const items = (feedbackRes.data ?? []).map((f: Record<string, unknown>) => ({
      id:       f.id,
      author:   (f.user_id ? (userMap[f.user_id as string] ?? null) : null) || f.nickname || '익명',
      type:     f.type,
      content:  f.content,
      screenshot_url: (f.screenshot_url && (f.screenshot_url as string).startsWith('http'))
        ? f.screenshot_url
        : null,
      created_at: f.created_at,
      status:     (f.status as string) ?? 'new',
      handled_by: (f.handled_by as string | null) ?? null,
      handled_at: (f.handled_at as string | null) ?? null,
    }))

    console.log(`[admin-feedback] 조회 완료: ${items.length}건 (전체 ${countRes.count ?? 0}건)`)

    return json({ items, total: countRes.count ?? 0, offset, limit })

  } catch (e) {
    console.error('[admin-feedback] 오류:', e instanceof Error ? e.message : e)
    return json({ error: '서버 오류가 발생했어요' }, 500)
  }
})
