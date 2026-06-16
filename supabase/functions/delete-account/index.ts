import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // JWT에서 유저 확인
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    const { data: { user }, error: userError } =
      await supabaseAdmin.auth.getUser(token ?? '')

    if (userError || !user) {
      console.error('[delete-account] 인증 실패:', userError)
      return new Response(
        JSON.stringify({ error: '인증 실패' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('[delete-account] 삭제 요청:', user.id)

    // space_members 먼저 삭제
    await supabaseAdmin
      .from('space_members')
      .delete()
      .eq('user_id', user.id)

    // fcm_tokens 삭제
    await supabaseAdmin
      .from('fcm_tokens')
      .delete()
      .eq('user_id', user.id)

    // notifications 삭제
    await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', user.id)

    // auth.users 삭제 — RPC 우선, 실패 시 admin API 폴백
    const { error: rpcError } = await supabaseAdmin.rpc(
      'delete_user_account',
      { user_id: user.id }
    )

    if (rpcError) {
      console.error('[delete-account] RPC 실패:', rpcError)
      const { error: adminError } =
        await supabaseAdmin.auth.admin.deleteUser(user.id)

      if (adminError) {
        console.error('[delete-account] admin 삭제 실패:', adminError)
        return new Response(
          JSON.stringify({ error: adminError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    console.log('[delete-account] 삭제 완료:', user.id)
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[delete-account] 예외:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
