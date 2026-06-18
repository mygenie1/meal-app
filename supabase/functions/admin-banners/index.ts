// Edge Function: admin-banners
// POST { action, ...payload } — super 전용
//
// actions:
//   list            → 전체 배너 목록 (비활성 포함)
//   create          → 새 배너 { slot, type, title?, body?, image_url?, link_url? }
//   update          → 배너 수정 { id, type?, title?, body?, image_url?, link_url? }
//   delete          → 배너 삭제 { id }
//   toggle_active   → 활성/비활성 { id } — 활성 시 같은 slot 기존 배너 자동 비활성화
//   get_upload_url  → 이미지 서명 업로드 URL 발급 { filename }

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

const VALID_SLOTS = ['calendar_top', 'ingredients_bottom']
const VALID_TYPES = ['info', 'image']

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })

  if (!ADMIN_SESSION_SECRET) {
    console.error('[admin-banners] ADMIN_SESSION_SECRET 미설정')
    return json({ error: '서버 설정 오류' }, 500)
  }

  const sessionToken =
    req.headers.get('x-admin-token') ??
    (() => {
      const h = req.headers.get('authorization') ?? ''
      return h.startsWith('Bearer ') ? h.slice(7).trim() : null
    })()
  if (!sessionToken) return json({ error: '토큰이 없습니다' }, 401)

  try {
    const p = await verifyToken(sessionToken, ADMIN_SESSION_SECRET)
    if (!hasPermission(p, 'manage_banners')) {
      return json({ error: 'manage_banners 권한이 없습니다' }, 403)
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '토큰 오류' }, 401)
  }

  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405)

  let reqBody: Record<string, unknown>
  try { reqBody = await req.json() } catch { return json({ error: '요청 파싱 실패' }, 400) }

  const { action } = reqBody
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // ── list ─────────────────────────────────────────────────────
  if (action === 'list') {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[admin-banners] list 오류:', error.message)
      return json({ error: '목록 조회 실패' }, 500)
    }
    return json({ banners: data ?? [] })
  }

  // ── create ───────────────────────────────────────────────────
  if (action === 'create') {
    const { slot, type, title, body: bannerBody, image_url, link_url } = reqBody as Record<string, string>
    if (!slot || !VALID_SLOTS.includes(slot)) return json({ error: '유효하지 않은 slot' }, 400)
    if (!type || !VALID_TYPES.includes(type)) return json({ error: '유효하지 않은 type' }, 400)

    const { data, error } = await supabase
      .from('banners')
      .insert({
        slot, type,
        title:     title      || null,
        body:      bannerBody || null,
        image_url: image_url  || null,
        link_url:  link_url   || null,
        is_active: false,
      })
      .select()
      .single()

    if (error) {
      console.error('[admin-banners] create 오류:', error.message)
      return json({ error: '배너 생성 실패' }, 500)
    }
    console.log(`[admin-banners] 배너 생성: ${data.id} (slot=${slot})`)
    return json({ banner: data })
  }

  // ── update ───────────────────────────────────────────────────
  if (action === 'update') {
    const { id, type, title, body: bannerBody, image_url, link_url } = reqBody as Record<string, string>
    if (!id) return json({ error: 'id 필수' }, 400)

    const updates: Record<string, unknown> = {}
    if ('type' in reqBody)      { if (VALID_TYPES.includes(type)) updates.type = type }
    if ('title' in reqBody)     updates.title     = title      || null
    if ('body' in reqBody)      updates.body      = bannerBody || null
    if ('image_url' in reqBody) updates.image_url = image_url  || null
    if ('link_url' in reqBody)  updates.link_url  = link_url   || null
    if (Object.keys(updates).length === 0) return json({ error: '수정할 항목 없음' }, 400)

    const { data, error } = await supabase
      .from('banners').update(updates).eq('id', id).select().single()
    if (error) {
      console.error('[admin-banners] update 오류:', error.message)
      return json({ error: '배너 수정 실패' }, 500)
    }
    console.log(`[admin-banners] 배너 수정: ${id}`)
    return json({ banner: data })
  }

  // ── delete ───────────────────────────────────────────────────
  if (action === 'delete') {
    const { id } = reqBody as { id?: string }
    if (!id) return json({ error: 'id 필수' }, 400)

    const { error } = await supabase.from('banners').delete().eq('id', id)
    if (error) {
      console.error('[admin-banners] delete 오류:', error.message)
      return json({ error: '배너 삭제 실패' }, 500)
    }
    console.log(`[admin-banners] 배너 삭제: ${id}`)
    return json({ ok: true })
  }

  // ── toggle_active ────────────────────────────────────────────
  if (action === 'toggle_active') {
    const { id } = reqBody as { id?: string }
    if (!id) return json({ error: 'id 필수' }, 400)

    const { data: banner, error: fetchErr } = await supabase
      .from('banners').select('*').eq('id', id).single()
    if (fetchErr || !banner) return json({ error: '배너를 찾을 수 없어요' }, 404)

    const newActive = !banner.is_active

    // 활성화 시: 같은 slot의 다른 활성 배너 비활성화 (slot당 1개 보장)
    if (newActive) {
      await supabase.from('banners')
        .update({ is_active: false })
        .eq('slot', banner.slot)
        .neq('id', id)
    }

    const { data: updated, error } = await supabase
      .from('banners').update({ is_active: newActive }).eq('id', id).select().single()
    if (error) {
      console.error('[admin-banners] toggle 오류:', error.message)
      return json({ error: '상태 변경 실패' }, 500)
    }
    console.log(`[admin-banners] 배너 토글: ${id} → ${newActive}`)
    return json({ banner: updated })
  }

  // ── get_upload_url ───────────────────────────────────────────
  if (action === 'get_upload_url') {
    const { filename } = reqBody as { filename?: string }
    if (!filename || typeof filename !== 'string') return json({ error: 'filename 필수' }, 400)

    const ext  = (filename.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, 'jpg')
    const path = `admin/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`

    const { data, error } = await supabase.storage
      .from('banners')
      .createSignedUploadUrl(path)

    if (error) {
      console.error('[admin-banners] 서명 URL 생성 오류:', error.message)
      return json({ error: '업로드 URL 생성 실패 — banners 버킷이 존재하는지 확인해주세요' }, 500)
    }

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/banners/${path}`
    console.log(`[admin-banners] 서명 URL 발급: ${path}`)
    return json({ path, token: data.token, signed_url: data.signedUrl, public_url: publicUrl })
  }

  return json({ error: `알 수 없는 action: ${action}` }, 400)
})
