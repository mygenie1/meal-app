// Edge Function: admin-push-stats
// GET → FCM 토큰 현황 (총 토큰 수, 활성 사용자 수, 전체 사용자 수)
// fcm_tokens 테이블: user_id, token 컬럼만 존재 — platform 분류 불가
// send-push 는 발송 로그를 저장하지 않으므로 성공/실패 집계 불가 (향후 과제)

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
    console.error('[admin-push-stats] ADMIN_SESSION_SECRET 미설정')
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
    const [tokensCountRes, tokenUsersRes, authRes] = await Promise.all([
      // 전체 토큰 수
      supabase.from('fcm_tokens').select('id', { count: 'exact', head: true }),
      // 토큰 보유 user_id 목록 (unique 집계용)
      supabase.from('fcm_tokens').select('user_id'),
      // 전체 사용자 수
      supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ])

    if (tokensCountRes.error) throw tokensCountRes.error
    if (tokenUsersRes.error) throw tokenUsersRes.error
    if (authRes.error) throw authRes.error

    const uniqueUsers = new Set(
      (tokenUsersRes.data ?? []).map((r: { user_id: string }) => r.user_id)
    ).size

    const totalTokens = tokensCountRes.count ?? 0
    const totalUsers  = authRes.data.users.length

    console.log(`[admin-push-stats] 토큰 ${totalTokens}개, 알림 사용자 ${uniqueUsers}/${totalUsers}명`)

    return json({
      total_tokens:      totalTokens,
      users_with_tokens: uniqueUsers,
      total_users:       totalUsers,
      // platform 컬럼 없음 — 분류 불가
      platform_note: 'fcm_tokens 테이블에 platform 컬럼 없음',
      // 발송 로그 없음
      send_log_note: 'send-push 함수는 발송 로그를 저장하지 않아 성공/실패 집계 불가',
    })
  } catch (e) {
    console.error('[admin-push-stats] 오류:', e instanceof Error ? e.message : e)
    return json({ error: '서버 오류가 발생했어요' }, 500)
  }
})
