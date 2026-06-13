// Supabase Edge Function — FCM 푸시 알림 발송
// notifications 테이블에 row 삽입 시 Supabase Database Webhook으로 호출됩니다.
//
// 필요한 환경변수 (Supabase Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL             (자동 제공)
//   SUPABASE_SERVICE_ROLE_KEY (자동 제공)
//   FCM_SERVICE_ACCOUNT_KEY  Firebase 서비스 계정 JSON 전체를 한 줄 문자열로

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FCM_SA_KEY = Deno.env.get('FCM_SERVICE_ACCOUNT_KEY')!

// PEM private key → ArrayBuffer
function pemToBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf.buffer
}

// base64url 인코딩
function toBase64Url(input: string | ArrayBuffer): string {
  const str = typeof input === 'string'
    ? btoa(input)
    : btoa(String.fromCharCode(...new Uint8Array(input)))
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// 서비스 계정 JSON → OAuth2 access token
async function getAccessToken(sa: {
  client_email: string
  private_key: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = toBase64Url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))
  const sigInput = `${header}.${payload}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBuffer(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(sigInput),
  )
  const jwt = `${sigInput}.${toBase64Url(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`OAuth 실패: ${JSON.stringify(data)}`)
  return data.access_token
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  let body: { record?: Record<string, unknown>; type?: string }
  try {
    body = await req.json()
  } catch {
    return new Response('Bad JSON', { status: 400 })
  }

  // Supabase Webhook payload: { type: "INSERT", record: {...} }
  const record = body.record
  if (!record?.user_id) {
    return new Response(JSON.stringify({ ok: true, skip: 'no user_id' }), { status: 200 })
  }

  // FCM_SERVICE_ACCOUNT_KEY 없으면 gracefully skip
  if (!FCM_SA_KEY) {
    console.warn('[send-push] FCM_SERVICE_ACCOUNT_KEY 미설정, 스킵')
    return new Response(JSON.stringify({ ok: true, skip: 'no fcm key' }), { status: 200 })
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 대상 유저의 FCM 토큰 조회
  const { data: tokenRows, error: tokenErr } = await supabase
    .from('fcm_tokens')
    .select('token')
    .eq('user_id', record.user_id as string)

  if (tokenErr) {
    console.error('[send-push] 토큰 조회 실패:', tokenErr)
    return new Response(JSON.stringify({ ok: false, error: tokenErr.message }), { status: 500 })
  }

  if (!tokenRows?.length) {
    return new Response(JSON.stringify({ ok: true, skip: 'no tokens' }), { status: 200 })
  }

  let sa: { client_email: string; private_key: string; project_id: string }
  try {
    sa = JSON.parse(FCM_SA_KEY)
  } catch {
    return new Response('FCM_SERVICE_ACCOUNT_KEY JSON 파싱 실패', { status: 500 })
  }

  const accessToken = await getAccessToken(sa)

  const typeLabel: Record<string, string> = {
    new_meal: '새 식사 기록이 추가됐어요',
    comment: '댓글이 달렸어요',
    rating: '별점을 받았어요',
  }
  const notifTitle = '식탁일기'
  const notifBody = (record.message as string) || typeLabel[record.type as string] || '알림이 도착했어요'

  const results = await Promise.allSettled(
    tokenRows.map(({ token }: { token: string }) =>
      fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: notifTitle, body: notifBody },
            webpush: {
              notification: {
                icon: '/icon-192x192.png',
                badge: '/icon-192x192.png',
                requireInteraction: false,
                vibrate: [200, 100, 200],
              },
              fcm_options: { link: '/' },
            },
            data: {
              meal_id: String(record.meal_id ?? ''),
              type: String(record.type ?? ''),
              space_id: String(record.space_id ?? ''),
            },
          },
        }),
      }).then(r => r.json())
    )
  )

  // 만료된 토큰 자동 정리
  const expiredTokens: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      const res = r.value
      if (res.error?.code === 404 || res.error?.details?.some(
        (d: { errorCode: string }) => d.errorCode === 'UNREGISTERED'
      )) {
        expiredTokens.push(tokenRows[i].token)
      }
    }
  })
  if (expiredTokens.length > 0) {
    await supabase.from('fcm_tokens').delete().in('token', expiredTokens)
    console.log(`[send-push] 만료 토큰 ${expiredTokens.length}개 삭제`)
  }

  console.log(`[send-push] ${tokenRows.length}개 기기에 발송 완료`)
  return new Response(
    JSON.stringify({ ok: true, sent: tokenRows.length }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
