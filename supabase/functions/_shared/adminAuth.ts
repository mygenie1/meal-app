// 관리자 세션 토큰 공용 로직 — admin-auth / admin-verify 에서 임포트
// HS256 JWT 직접 구현 (Deno crypto.subtle)

export interface AdminTokenPayload {
  id: string
  username: string
  role: 'super' | 'sub'
  permissions: Record<string, boolean>
  exp: number
}

const EXPIRY_SECONDS = 2 * 60 * 60 // 2시간

// ── Base64url 유틸 ─────────────────────────────────────────

function toBase64Url(input: string | ArrayBuffer): string {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : new Uint8Array(input)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)))
}

// ── HMAC-SHA256 키 ─────────────────────────────────────────

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

// ── JWT 서명 ───────────────────────────────────────────────

export async function signToken(
  payload: AdminTokenPayload,
  secret: string,
): Promise<string> {
  const header  = toBase64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body    = toBase64Url(JSON.stringify(payload))
  const sigInput = `${header}.${body}`

  const key = await getKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigInput))

  return `${sigInput}.${toBase64Url(sig)}`
}

// ── JWT 검증 (서명 + 만료) ────────────────────────────────

export async function verifyToken(
  token: string,
  secret: string,
): Promise<AdminTokenPayload> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('토큰 형식 오류')

  const [headerB64, bodyB64, sigB64] = parts
  const sigInput = `${headerB64}.${bodyB64}`

  const key   = await getKey(secret)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    fromBase64Url(sigB64),
    new TextEncoder().encode(sigInput),
  )
  if (!valid) throw new Error('서명 검증 실패')

  const payload: AdminTokenPayload = JSON.parse(
    new TextDecoder().decode(fromBase64Url(bodyB64)),
  )

  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('토큰 만료')

  return payload
}

// ── 권한 확인 ──────────────────────────────────────────────

export function hasPermission(
  payload: AdminTokenPayload,
  key: string,
): boolean {
  if (payload.role === 'super') return true
  return payload.permissions?.[key] === true
}

// ── 페이로드 생성 헬퍼 ────────────────────────────────────

export function makeTokenPayload(account: {
  id: string
  username: string
  role: string
  permissions: Record<string, boolean>
}): AdminTokenPayload {
  return {
    id:          account.id,
    username:    account.username,
    role:        account.role as 'super' | 'sub',
    permissions: account.permissions ?? {},
    exp:         Math.floor(Date.now() / 1000) + EXPIRY_SECONDS,
  }
}

// ── CORS 헤더 (관리자 함수 공통) ─────────────────────────

export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin':  '*',
  // x-admin-token: 관리자 세션 토큰 전용 헤더 (Authorization은 게이트웨이 통과용 anon key에 사용)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-admin-token',
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
