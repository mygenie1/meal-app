import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: '인증 토큰이 없습니다' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // JWT 검증 → 요청자 식별
  const token = authHeader.replace('Bearer ', '')
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: '유효하지 않은 토큰' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userId = user.id
  console.log(`[delete-account] 탈퇴 요청: ${userId}`)

  try {
    // space_members 삭제 (FK CASCADE 여부와 무관하게 명시적 처리)
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

    // auth.users 삭제 → FK ON DELETE SET NULL / CASCADE 자동 처리
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    if (deleteError) throw deleteError

    console.log(`[delete-account] 탈퇴 완료: ${userId}`)
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[delete-account] 오류:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
