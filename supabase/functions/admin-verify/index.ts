// Edge Function: admin-verify
// 세션 토큰 유효성 검증 + 역할/권한 반환
// 이후 모든 관리자 함수가 이 로직을 재사용
//
// GET/POST  Authorization: Bearer <token>
// → { valid: true, id, username, role, permissions }
// → { valid: false, error: '...' }

import {
  verifyToken,
  hasPermission,
  CORS_HEADERS,
  json,
} from '../_shared/adminAuth.ts'

const ADMIN_SESSION_SECRET = Deno.env.get('ADMIN_SESSION_SECRET')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  if (!ADMIN_SESSION_SECRET) {
    console.error('[admin-verify] ADMIN_SESSION_SECRET 미설정')
    return json({ valid: false, error: '서버 설정 오류' }, 500)
  }

  const authHeader = req.headers.get('authorization') ?? ''
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null

  if (!token) {
    return json({ valid: false, error: '토큰이 없습니다' }, 401)
  }

  try {
    const payload = await verifyToken(token, ADMIN_SESSION_SECRET)

    // 요청 바디에 permission 키가 있으면 권한도 함께 체크
    let permissionKey: string | null = null
    try {
      const body = await req.json().catch(() => null)
      permissionKey = body?.permission ?? null
    } catch { /* body 없음 — 무시 */ }

    const permResult = permissionKey
      ? { [permissionKey]: hasPermission(payload, permissionKey) }
      : {}

    return json({
      valid:       true,
      id:          payload.id,
      username:    payload.username,
      role:        payload.role,
      permissions: payload.permissions,
      exp:         payload.exp,
      ...permResult,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '토큰 오류'
    return json({ valid: false, error: msg }, 401)
  }
})
