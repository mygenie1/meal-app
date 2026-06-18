// Edge Function: admin-space-delete
// POST { action, space_id, space_name? }
//
// 권한: super 전용 (서브 관리자 불가)
//
// actions:
//   deactivate  → is_active = false (데이터 보존, 복구 가능)
//   reactivate  → is_active = true  (복구)
//   hard_delete → 영구삭제 (space_name 이름 확인 필수 + Storage 정리)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  verifyToken,
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
    console.error('[admin-space-delete] ADMIN_SESSION_SECRET 미설정')
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

  // ★ super 전용 — 서브 관리자 거부
  if (adminPayload.role !== 'super') {
    return json({ error: '스페이스 삭제/비활성화는 총괄 관리자(super)만 가능합니다' }, 403)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: '잘못된 요청 형식' }, 400)
  }

  const action   = typeof body.action   === 'string' ? body.action   : ''
  const space_id = typeof body.space_id === 'string' ? body.space_id.trim() : ''

  if (!space_id) return json({ error: 'space_id 필수' }, 400)
  if (!action)   return json({ error: 'action 필수 (deactivate | reactivate | hard_delete)' }, 400)

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 스페이스 존재 + 이름 확인 (모든 action 공통)
  const { data: space, error: fetchErr } = await supabase
    .from('spaces')
    .select('id, name, is_active')
    .eq('id', space_id)
    .maybeSingle()

  if (fetchErr || !space) {
    console.error('[admin-space-delete] space 조회 오류:', fetchErr?.message)
    return json({ error: '스페이스를 찾을 수 없습니다' }, 404)
  }

  // ── deactivate ────────────────────────────────────────────
  if (action === 'deactivate') {
    const { error: updateErr } = await supabase
      .from('spaces')
      .update({ is_active: false })
      .eq('id', space_id)

    if (updateErr) {
      console.error('[admin-space-delete] deactivate 오류:', updateErr.message)
      return json({ error: '비활성화 실패' }, 500)
    }

    console.log(`[admin-space-delete] deactivated: "${space.name}" (${space_id}) by ${adminPayload.username}`)
    return json({ success: true })
  }

  // ── reactivate ────────────────────────────────────────────
  if (action === 'reactivate') {
    const { error: updateErr } = await supabase
      .from('spaces')
      .update({ is_active: true })
      .eq('id', space_id)

    if (updateErr) {
      console.error('[admin-space-delete] reactivate 오류:', updateErr.message)
      return json({ error: '활성화 실패' }, 500)
    }

    console.log(`[admin-space-delete] reactivated: "${space.name}" (${space_id}) by ${adminPayload.username}`)
    return json({ success: true })
  }

  // ── hard_delete ───────────────────────────────────────────
  if (action === 'hard_delete') {
    const space_name = typeof body.space_name === 'string' ? body.space_name.trim() : ''

    if (!space_name) {
      return json({ error: 'hard_delete는 space_name 이름 확인이 필수입니다' }, 400)
    }
    if (space_name !== space.name) {
      return json({ error: '스페이스 이름이 일치하지 않습니다' }, 400)
    }

    // Storage 파일 정리 (best-effort — 실패해도 DB 삭제는 계속)
    try {
      const { data: files } = await supabase.storage
        .from('meal-photos')
        .list(space_id, { limit: 1000 })

      if (files && files.length > 0) {
        const paths = files.map((f: { name: string }) => `${space_id}/${f.name}`)
        const { error: removeErr } = await supabase.storage
          .from('meal-photos')
          .remove(paths)
        if (removeErr) {
          console.error('[admin-space-delete] Storage remove 오류:', removeErr.message)
        } else {
          console.log(`[admin-space-delete] Storage cleaned: ${paths.length}개 파일 삭제`)
        }
      }
    } catch (storageErr) {
      console.error('[admin-space-delete] Storage 정리 실패 (DB 삭제 계속):', storageErr instanceof Error ? storageErr.message : storageErr)
    }

    // DB 영구삭제 — admin_hard_delete_space RPC (트랜잭션 보장)
    const { error: rpcErr } = await supabase.rpc('admin_hard_delete_space', {
      p_space_id: space_id,
    })

    if (rpcErr) {
      console.error('[admin-space-delete] hard_delete RPC 오류:', rpcErr.message)
      return json({ error: '영구 삭제 실패: ' + rpcErr.message }, 500)
    }

    console.log(`[admin-space-delete] HARD DELETED: "${space.name}" (${space_id}) by ${adminPayload.username}`)
    return json({ success: true })
  }

  return json({ error: `알 수 없는 action: ${action}` }, 400)
})
