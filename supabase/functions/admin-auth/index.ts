// Edge Function: admin-auth
// POST { username, password } → 세션 토큰 발급
//
// 필요한 Supabase Secret:
//   ADMIN_SESSION_SECRET  (Supabase Dashboard → Edge Functions → Secrets)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  signToken,
  makeTokenPayload,
  CORS_HEADERS,
  json,
} from '../_shared/adminAuth.ts'

const SUPABASE_URL             = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ADMIN_SESSION_SECRET      = Deno.env.get('ADMIN_SESSION_SECRET')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405)
  }

  if (!ADMIN_SESSION_SECRET) {
    console.error('[admin-auth] ADMIN_SESSION_SECRET 미설정')
    return json({ error: '서버 설정 오류' }, 500)
  }

  let body: { username?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: '잘못된 요청 형식' }, 400)
  }

  const { username, password } = body
  if (!username || !password) {
    return json({ error: '아이디와 비밀번호를 입력해주세요' }, 400)
  }

  // 무차별 대입 방어: 500~800ms 지연 (성공/실패 무관하게 동일 타이밍)
  const t0 = Date.now()
  const minDelay = 500 + Math.random() * 300

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // pgcrypto crypt()로 비밀번호 검증 (DB 안에서만 해시 비교)
  // verify_admin_password RPC: is_active=true + username + crypt 일치 시에만 행 반환
  const { data: rows, error } = await supabase.rpc('verify_admin_password', {
    p_username: username,
    p_password: password,
  })

  // 최소 지연 충족
  const elapsed = Date.now() - t0
  if (elapsed < minDelay) {
    await new Promise(r => setTimeout(r, minDelay - elapsed))
  }

  if (error) {
    console.error('[admin-auth] RPC 오류:', error.message)
    return json({ error: '서버 오류가 발생했어요' }, 500)
  }

  if (!rows?.length) {
    console.warn('[admin-auth] 로그인 실패:', username)
    return json({ error: '아이디 또는 비밀번호가 올바르지 않습니다' }, 401)
  }

  const account = rows[0] as {
    id: string
    username: string
    role: string
    permissions: Record<string, boolean>
  }

  const payload = makeTokenPayload(account)
  const token   = await signToken(payload, ADMIN_SESSION_SECRET)

  console.log(`[admin-auth] 로그인 성공: ${account.username} (${account.role})`)

  return json({
    token,
    username: account.username,
    role:     account.role,
    permissions: account.permissions,
  })
})
