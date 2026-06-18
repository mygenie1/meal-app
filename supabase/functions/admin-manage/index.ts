// Edge Function: admin-manage
// POST { action, ...params }
// 필요 권한: manage_admins
//
// actions:
//   list              → 관리자 목록 (password_hash 제외)
//   create            → 서브 관리자 생성 (role='sub' 고정)
//   toggle_active     → 활성/비활성 토글 (super 보호)
//   update_permissions → 권한 수정 (super 보호)

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
  if (req.method !== 'POST')   return json({ error: 'Method Not Allowed' }, 405)

  if (!ADMIN_SESSION_SECRET) {
    console.error('[admin-manage] ADMIN_SESSION_SECRET 미설정')
    return json({ error: '서버 설정 오류' }, 500)
  }

  // 토큰 추출 (x-admin-token 우선, Authorization fallback)
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

  if (!hasPermission(adminPayload, 'manage_admins')) {
    return json({ error: 'manage_admins 권한이 없습니다' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: '잘못된 요청 형식' }, 400)
  }

  const action   = typeof body.action === 'string' ? body.action : ''
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ── list ─────────────────────────────────────────────────
  if (action === 'list') {
    const { data, error } = await supabase
      .from('admin_accounts')
      .select('id, username, role, permissions, is_active, created_at, created_by')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[admin-manage] list 오류:', error.message)
      return json({ error: '목록 조회 실패' }, 500)
    }

    return json({ admins: data ?? [] })
  }

  // ── create ───────────────────────────────────────────────
  if (action === 'create') {
    const username    = typeof body.username === 'string' ? body.username.trim() : ''
    const password    = typeof body.password === 'string' ? body.password        : ''
    const permissions = (typeof body.permissions === 'object' && body.permissions !== null)
      ? (body.permissions as Record<string, boolean>)
      : {}

    if (!username)           return json({ error: '아이디는 필수입니다' }, 400)
    if (username.length < 2) return json({ error: '아이디는 2자 이상이어야 합니다' }, 400)
    if (!password)           return json({ error: '비밀번호는 필수입니다' }, 400)
    if (password.length < 6) return json({ error: '비밀번호는 6자 이상이어야 합니다' }, 400)

    // username 중복 체크
    const { data: existing } = await supabase
      .from('admin_accounts')
      .select('id')
      .eq('username', username)
      .maybeSingle()

    if (existing) return json({ error: '이미 사용 중인 아이디입니다' }, 409)

    // 비밀번호 bcrypt 해시: DB 내부 crypt() 처리 (평문이 함수 밖으로 나가지 않음)
    const { data: newId, error: rpcError } = await supabase.rpc('create_admin_account', {
      p_username:    username,
      p_password:    password,
      p_permissions: permissions,
      p_created_by:  adminPayload.id,
    })

    if (rpcError) {
      console.error('[admin-manage] create RPC 오류:', rpcError.message)
      return json({ error: '계정 생성 실패: ' + rpcError.message }, 500)
    }

    console.log(`[admin-manage] 서브 관리자 생성: ${username} by ${adminPayload.username}`)
    return json({ success: true, id: newId })
  }

  // ── toggle_active ─────────────────────────────────────────
  if (action === 'toggle_active') {
    const target_id = typeof body.target_id === 'string' ? body.target_id : ''
    if (!target_id) return json({ error: 'target_id 필수' }, 400)

    const { data: target, error: fetchErr } = await supabase
      .from('admin_accounts')
      .select('id, role, is_active')
      .eq('id', target_id)
      .maybeSingle()

    if (fetchErr || !target) return json({ error: '대상 계정을 찾을 수 없습니다' }, 404)
    if (target.role === 'super') return json({ error: 'super 계정은 수정할 수 없습니다' }, 403)

    const nextActive = !target.is_active
    const { error: updateErr } = await supabase
      .from('admin_accounts')
      .update({ is_active: nextActive })
      .eq('id', target_id)

    if (updateErr) {
      console.error('[admin-manage] toggle_active 오류:', updateErr.message)
      return json({ error: '수정 실패' }, 500)
    }

    console.log(`[admin-manage] toggle_active: ${target_id} → ${nextActive} by ${adminPayload.username}`)
    return json({ success: true, is_active: nextActive })
  }

  // ── update_permissions ────────────────────────────────────
  if (action === 'update_permissions') {
    const target_id   = typeof body.target_id === 'string' ? body.target_id : ''
    const permissions = (typeof body.permissions === 'object' && body.permissions !== null)
      ? (body.permissions as Record<string, boolean>)
      : null

    if (!target_id)   return json({ error: 'target_id 필수' }, 400)
    if (!permissions) return json({ error: 'permissions 필수' }, 400)

    const { data: target, error: fetchErr } = await supabase
      .from('admin_accounts')
      .select('id, role')
      .eq('id', target_id)
      .maybeSingle()

    if (fetchErr || !target) return json({ error: '대상 계정을 찾을 수 없습니다' }, 404)
    if (target.role === 'super') return json({ error: 'super 계정은 수정할 수 없습니다' }, 403)

    const { error: updateErr } = await supabase
      .from('admin_accounts')
      .update({ permissions })
      .eq('id', target_id)

    if (updateErr) {
      console.error('[admin-manage] update_permissions 오류:', updateErr.message)
      return json({ error: '수정 실패' }, 500)
    }

    console.log(`[admin-manage] update_permissions: ${target_id} by ${adminPayload.username}`)
    return json({ success: true })
  }

  return json({ error: `알 수 없는 action: ${action}` }, 400)
})
