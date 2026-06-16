import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// 환경변수 로드 확인
console.log('[delete-account] SUPABASE_URL 앞 30자:', SUPABASE_URL.slice(0, 30))
console.log('[delete-account] SERVICE_ROLE_KEY 앞 20자:', SERVICE_ROLE_KEY.slice(0, 20))

// 모듈 레벨 초기화 — 매 요청마다 재생성하지 않음
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  console.log('[delete-account] Auth header:', authHeader ? '있음' : '없음')
  console.log('[delete-account] Token 앞 27자:', authHeader?.slice(0, 27))

  if (!authHeader) {
    return new Response(JSON.stringify({ error: '인증 토큰이 없습니다' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // JWT 검증 → 요청자 식별
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) {
    console.error('[delete-account] 인증 실패:', JSON.stringify(userError))
    return new Response(JSON.stringify({ error: '인증 실패' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userId = user.id
  console.log(`[delete-account] 탈퇴 요청: ${userId}`)

  // space_members 삭제
  const { error: memberErr } = await supabaseAdmin
    .from('space_members')
    .delete()
    .eq('user_id', userId)
  if (memberErr) console.warn('[delete-account] space_members 삭제 경고:', memberErr.message)

  // FCM 토큰 삭제
  const { error: fcmErr } = await supabaseAdmin
    .from('fcm_tokens')
    .delete()
    .eq('user_id', userId)
  if (fcmErr) console.warn('[delete-account] fcm_tokens 삭제 경고:', fcmErr.message)

  // auth.users 삭제
  console.log(`[delete-account] deleteUser 호출: ${userId}`)
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
  if (deleteError) {
    console.error('[delete-account] 삭제 실패 전체:', JSON.stringify(deleteError))
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log(`[delete-account] 탈퇴 완료: ${userId}`)
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
