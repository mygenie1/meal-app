// Edge Function: admin-user-delete
// POST { action, user_id, confirm_name? }
//
// 권한:
//   deactivate / reactivate → delete_users 권한
//   hard_delete             → super 전용 (비가역 작업이므로 추가 제한)
//
// actions:
//   deactivate  → auth ban (~100년) — 로그인 즉시 차단, 데이터 보존
//   reactivate  → auth unban — 복구
//   hard_delete → 영구삭제 (confirm_name=display_name 일치 필수)
//     삭제: wishlist_interests(본인 반응) + auth 계정
//       → auth.deleteUser() CASCADE로 자동 삭제: space_members, fcm_tokens,
//          notifications(inbox), ratings.user_id=NULL, comments.user_id=NULL
//     보존: meals, meal_photos, comments(내용), ratings(점수), wishlist 항목

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

/** admin-users와 동일한 display_name 계산 로직 */
function computeDisplayName(user: { user_metadata?: Record<string, string>; email?: string; id: string }): string {
  const meta = user.user_metadata ?? {}
  return (
    meta.full_name ||
    meta.name      ||
    meta.nickname  ||
    (user.email ? user.email.split('@')[0] : `user_${user.id.slice(0, 8)}`)
  )
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST')   return json({ error: 'Method Not Allowed' }, 405)

  if (!ADMIN_SESSION_SECRET) {
    console.error('[admin-user-delete] ADMIN_SESSION_SECRET 미설정')
    return json({ error: '서버 설정 오류' }, 500)
  }

  // 토큰 추출 (x-admin-token 우선)
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

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: '잘못된 요청 형식' }, 400)
  }

  const action  = typeof body.action  === 'string' ? body.action  : ''
  const user_id = typeof body.user_id === 'string' ? body.user_id.trim() : ''

  if (!action)  return json({ error: 'action 필수 (deactivate | reactivate | hard_delete)' }, 400)
  if (!user_id) return json({ error: 'user_id 필수' }, 400)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ── deactivate ────────────────────────────────────────────
  if (action === 'deactivate') {
    if (!hasPermission(adminPayload, 'delete_users')) {
      return json({ error: 'delete_users 권한이 필요합니다' }, 403)
    }

    const { data, error } = await supabase.auth.admin.updateUserById(user_id, {
      ban_duration: '876600h',  // ~100년 = 사실상 영구 정지
    })
    if (error || !data.user) {
      console.error('[admin-user-delete] deactivate 오류:', error?.message)
      return json({ error: '비활성화 실패' }, 500)
    }

    console.log(`[admin-user-delete] deactivated: ${user_id} by ${adminPayload.username}`)
    return json({ success: true })
  }

  // ── reactivate ────────────────────────────────────────────
  if (action === 'reactivate') {
    if (!hasPermission(adminPayload, 'delete_users')) {
      return json({ error: 'delete_users 권한이 필요합니다' }, 403)
    }

    const { data, error } = await supabase.auth.admin.updateUserById(user_id, {
      ban_duration: 'none',
    })
    if (error || !data.user) {
      console.error('[admin-user-delete] reactivate 오류:', error?.message)
      return json({ error: '활성화 실패' }, 500)
    }

    console.log(`[admin-user-delete] reactivated: ${user_id} by ${adminPayload.username}`)
    return json({ success: true })
  }

  // ── hard_delete ───────────────────────────────────────────
  if (action === 'hard_delete') {
    // ★ super 전용 — 비가역 작업
    if (adminPayload.role !== 'super') {
      return json({ error: '영구 삭제는 총괄 관리자(super)만 가능합니다' }, 403)
    }

    const confirm_name = typeof body.confirm_name === 'string' ? body.confirm_name.trim() : ''
    if (!confirm_name) return json({ error: '이름 확인(confirm_name) 필수' }, 400)

    // 대상 유저 조회 + display_name 검증
    const { data: userData, error: fetchErr } = await supabase.auth.admin.getUserById(user_id)
    if (fetchErr || !userData.user) {
      console.error('[admin-user-delete] 유저 조회 오류:', fetchErr?.message)
      return json({ error: '사용자를 찾을 수 없습니다' }, 404)
    }

    const targetUser = userData.user
    const displayName = computeDisplayName({
      user_metadata: targetUser.user_metadata as Record<string, string>,
      email:         targetUser.email,
      id:            targetUser.id,
    })

    if (confirm_name !== displayName) {
      return json({ error: '이름이 일치하지 않습니다' }, 400)
    }

    // ── 개인 데이터 먼저 정리 ─────────────────────────────
    // wishlist_interests: user_id가 auth.users FK 없어 CASCADE 안 됨 → 직접 삭제
    const { error: wiErr } = await supabase
      .from('wishlist_interests')
      .delete()
      .eq('user_id', user_id)
    if (wiErr) {
      console.error('[admin-user-delete] wishlist_interests 삭제 오류:', wiErr.message)
    }

    // ── auth 계정 삭제 ─────────────────────────────────────
    // deleteUser()가 아래를 자동 처리:
    //   CASCADE DELETE: space_members, fcm_tokens, notifications(user_id inbox)
    //   SET NULL:       meals.user_id, comments.user_id, ratings.user_id,
    //                   notifications.from_user_id
    // → 기록/댓글/별점은 user_id=NULL로 스페이스에 보존됨
    const { error: deleteErr } = await supabase.auth.admin.deleteUser(user_id)
    if (deleteErr) {
      console.error('[admin-user-delete] deleteUser 오류:', deleteErr.message)
      return json({ error: '계정 삭제 실패: ' + deleteErr.message }, 500)
    }

    console.log(
      `[admin-user-delete] HARD DELETED: "${displayName}" (${user_id}) by ${adminPayload.username}`,
    )
    return json({ success: true })
  }

  return json({ error: `알 수 없는 action: ${action}` }, 400)
})
