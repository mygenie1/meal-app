import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminGuard, { clearAdminToken, getAdminToken } from './AdminGuard'
import { supabase as storageClient } from '../../lib/supabase'

const ADMIN_BANNERS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-banners`
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function adminPost(body) {
  return fetch(ADMIN_BANNERS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey':        SUPABASE_ANON_KEY,
      'x-admin-token': getAdminToken(),
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  }).then(r => r.json())
}

const SLOT_LABELS = {
  calendar_top:       '달력 상단',
  ingredients_bottom: '재료 하단',
}

const TYPE_INFO = {
  info:  { label: '정보',   cls: 'bg-blue-50 text-blue-600' },
  image: { label: '이미지', cls: 'bg-purple-50 text-purple-600' },
}

const EMPTY_FORM = { type: 'info', title: '', body: '', image_url: '', link_url: '', disclosure: '' }

// ──────────────────────────────────────────────────────────────────────────────
// 모듈 레벨 컴포넌트
//
// BannersContent 내부에 정의하면 매 렌더(setForm 등)마다 새로운 컴포넌트 타입이 되어
// React가 unmount → mount 반복 → 입력창이 포커스를 잃는다.
// 모듈 레벨로 올리면 컴포넌트 타입이 안정되어 리렌더 시에도 재사용된다.
// ──────────────────────────────────────────────────────────────────────────────

function FormPanel({ form, setForm, editingId, saving, onSave, onCancel }) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  async function handleImageUpload(file) {
    if (!file) return
    setUploading(true)
    try {
      const data = await adminPost({ action: 'get_upload_url', filename: file.name })
      if (data.error) { alert(`이미지 업로드 실패: ${data.error}`); return }

      const { path, token, public_url } = data
      const { error: uploadErr } = await storageClient.storage
        .from('banners')
        .uploadToSignedUrl(path, token, file, { contentType: file.type, upsert: true })

      if (uploadErr) { alert(`이미지 업로드 실패: ${uploadErr.message}`); return }
      setForm(prev => ({ ...prev, image_url: public_url }))
    } catch {
      alert('이미지 업로드 중 오류가 발생했어요')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="bg-cream-50 rounded-2xl border border-cream-200 p-4 mt-3">
      <h3 className="text-sm font-semibold text-warm-dark mb-3">
        {editingId ? '배너 수정' : '새 배너 추가'}
      </h3>

      {/* 타입 선택 */}
      <div className="mb-4">
        <p className="text-xs text-warm-light mb-2">타입</p>
        <div className="flex gap-2">
          {['info', 'image'].map(t => (
            <button
              key={t}
              onClick={() => setForm(prev => ({ ...prev, type: t, image_url: '', body: '' }))}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                form.type === t
                  ? 'bg-warm-brown text-white'
                  : 'bg-white text-warm-light border border-cream-200 hover:text-warm-dark'
              }`}
            >
              {TYPE_INFO[t].label}
            </button>
          ))}
        </div>
      </div>

      {/* 제목 */}
      <div className="mb-3">
        <p className="text-xs text-warm-light mb-1.5">
          제목{form.type === 'info' ? ' (필수)' : ' (선택)'}
        </p>
        <input
          type="text"
          value={form.title}
          onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
          placeholder={form.type === 'info' ? '예: 이번 달 기록 캠페인 🌱' : '배너 설명 (선택)'}
          className="w-full text-sm bg-white border border-cream-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-warm-brown text-warm-dark placeholder-cream-400"
        />
      </div>

      {/* 본문 (info 타입만) */}
      {form.type === 'info' && (
        <div className="mb-3">
          <p className="text-xs text-warm-light mb-1.5">본문</p>
          <textarea
            value={form.body}
            onChange={e => setForm(prev => ({ ...prev, body: e.target.value }))}
            placeholder="예: 10번 이상 기록하면 배지 지급!"
            rows={2}
            className="w-full text-sm bg-white border border-cream-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-warm-brown text-warm-dark placeholder-cream-400 resize-none"
          />
        </div>
      )}

      {/* 이미지 (image 타입) */}
      {form.type === 'image' && (
        <div className="mb-3">
          <p className="text-xs text-warm-light mb-1.5">이미지 (필수)</p>
          {form.image_url ? (
            <div className="flex items-center gap-3">
              <img
                src={form.image_url}
                alt=""
                className="h-14 w-28 object-cover rounded-xl border border-cream-200 shrink-0"
              />
              <button
                onClick={() => setForm(prev => ({ ...prev, image_url: '' }))}
                className="text-xs text-red-500 hover:text-red-700"
              >
                제거
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-dashed border-cream-300 rounded-xl text-xs text-warm-light hover:text-warm-dark hover:border-cream-400 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-stone-500 rounded-full animate-spin" />
                  업로드 중...
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  이미지 업로드
                </>
              )}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { if (e.target.files?.[0]) handleImageUpload(e.target.files[0]) }}
          />
        </div>
      )}

      {/* 링크 URL (image 타입, 선택) */}
      {form.type === 'image' && (
        <div className="mb-3">
          <p className="text-xs text-warm-light mb-1.5">링크 URL (선택 — 클릭 시 새 탭으로 이동)</p>
          <input
            type="url"
            value={form.link_url}
            onChange={e => setForm(prev => ({ ...prev, link_url: e.target.value }))}
            placeholder="https://example.com"
            className="w-full text-sm bg-white border border-cream-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-warm-brown text-warm-dark placeholder-cream-400"
          />
        </div>
      )}

      {/* 광고 고지 문구 (image 타입, 선택) */}
      {form.type === 'image' && (
        <div className="mb-3">
          <p className="text-xs text-warm-light mb-1">
            광고 고지 문구 <span className="text-cream-400">(선택)</span>
          </p>
          <p className="text-[10px] text-cream-400 mb-1.5">
            쿠팡 파트너스 등 제휴 광고는 고지 문구를 반드시 표시해야 해요.
          </p>
          <textarea
            value={form.disclosure}
            onChange={e => setForm(prev => ({ ...prev, disclosure: e.target.value }))}
            placeholder="이 배너는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."
            rows={2}
            className="w-full text-sm bg-white border border-cream-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-warm-brown text-warm-dark placeholder-cream-400 resize-none"
          />
          {!form.disclosure && (
            <button
              type="button"
              onClick={() => setForm(prev => ({
                ...prev,
                disclosure: '이 배너는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.',
              }))}
              className="mt-1 text-[11px] text-warm-brown hover:text-warm-dark transition-colors"
            >
              + 쿠팡 파트너스 문구 채우기
            </button>
          )}
        </div>
      )}

      {/* 미리보기 */}
      {(form.title || form.body || form.image_url) && (
        <div className="mb-3">
          <p className="text-xs text-warm-light mb-1.5">미리보기</p>
          <div className="border border-cream-200 rounded-xl overflow-hidden">
            {form.type === 'info' ? (
              <div className="px-4 py-3.5 bg-cream-100">
                {form.title && <p className="text-sm font-semibold text-warm-dark">{form.title}</p>}
                {form.body  && <p className="text-sm text-warm-light leading-snug mt-0.5">{form.body}</p>}
              </div>
            ) : form.image_url ? (
              <div className="relative bg-cream-100">
                <img src={form.image_url} alt="" className="w-full object-cover" style={{ maxHeight: '100px' }} />
              </div>
            ) : null}
          </div>
          {form.disclosure && (
            <p className="text-[10px] text-warm-light mt-1.5 px-1 leading-snug">{form.disclosure}</p>
          )}
        </div>
      )}

      {/* 저장/취소 */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={onSave}
          disabled={saving || uploading}
          className="flex-1 py-2.5 bg-warm-brown text-white text-sm font-medium rounded-xl hover:bg-warm-dark transition-colors disabled:opacity-50"
        >
          {saving ? '저장 중...' : '저장'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2.5 bg-white text-warm-dark text-sm rounded-xl border border-cream-200 hover:bg-cream-50 transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  )
}

function BannerRow({ banner, editingId, onEdit, onCancelEdit, onToggle, onDelete, form, setForm, saving, onSave, onCancel }) {
  const isEditing = editingId === banner.id
  const tInfo = TYPE_INFO[banner.type] ?? TYPE_INFO.info

  return (
    <div>
      <div className={`bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3 ${
        banner.is_active ? 'ring-1 ring-warm-brown/30' : ''
      }`}>
        {/* 활성 토글 */}
        <button
          onClick={() => onToggle(banner.id)}
          title={banner.is_active ? '비활성화' : '활성화'}
          className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${
            banner.is_active ? 'bg-warm-brown' : 'bg-cream-300'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            banner.is_active ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </button>

        {/* 타입 뱃지 */}
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${tInfo.cls}`}>
          {tInfo.label}
        </span>

        {/* 콘텐츠 미리보기 */}
        <div className="flex-1 min-w-0">
          {banner.image_url ? (
            <div className="flex items-center gap-2">
              <img
                src={banner.image_url}
                alt=""
                className="h-8 w-14 object-cover rounded-lg border border-cream-100 shrink-0"
              />
              {banner.title && <span className="text-xs text-warm-dark truncate">{banner.title}</span>}
            </div>
          ) : (
            <>
              {banner.title && <p className="text-xs font-medium text-warm-dark truncate">{banner.title}</p>}
              {banner.body  && <p className="text-[11px] text-warm-light truncate mt-0.5">{banner.body}</p>}
              {!banner.title && !banner.body && (
                <p className="text-[11px] text-cream-400 italic">내용 없음</p>
              )}
            </>
          )}
        </div>

        {/* 액션 버튼 */}
        <div onClick={e => e.stopPropagation()} className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => isEditing ? onCancelEdit() : onEdit(banner)}
            className="text-xs text-warm-light hover:text-warm-dark px-2 py-1 rounded-lg hover:bg-cream-50 transition-colors"
          >
            {isEditing ? '닫기' : '편집'}
          </button>
          <button
            onClick={() => onDelete(banner.id)}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 인라인 편집 폼 */}
      {isEditing && (
        <FormPanel
          form={form}
          setForm={setForm}
          editingId={editingId}
          saving={saving}
          onSave={onSave}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}

function SlotSection({
  slotKey, banners, formSlot, editingId,
  onCreateNew, onCancelForm, onEdit, onToggle, onDelete,
  form, setForm, saving, onSave,
}) {
  const slotBanners = banners.filter(b => b.slot === slotKey)
  const active      = slotBanners.find(b => b.is_active)
  const isCreating  = !editingId && formSlot === slotKey

  return (
    <div className="space-y-2">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h2 className="text-sm font-semibold text-warm-dark">{SLOT_LABELS[slotKey]}</h2>
          <p className="text-[11px] text-warm-light mt-0.5">
            {active
              ? `활성: ${active.title || TYPE_INFO[active.type]?.label}`
              : '활성 배너 없음'}
          </p>
        </div>
        <button
          onClick={() => isCreating ? onCancelForm() : onCreateNew(slotKey)}
          className="flex items-center gap-1.5 text-xs font-medium text-warm-brown hover:text-warm-dark transition-colors"
        >
          {isCreating ? (
            '취소'
          ) : (
            <>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              새 배너
            </>
          )}
        </button>
      </div>

      {/* 신규 생성 폼 */}
      {isCreating && (
        <FormPanel
          form={form}
          setForm={setForm}
          editingId={null}
          saving={saving}
          onSave={onSave}
          onCancel={onCancelForm}
        />
      )}

      {/* 배너 없음 */}
      {slotBanners.length === 0 && !isCreating && (
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
          <p className="text-sm text-warm-light">배너가 없어요</p>
        </div>
      )}

      {/* 배너 목록 */}
      {slotBanners.map(b => (
        <BannerRow
          key={b.id}
          banner={b}
          editingId={editingId}
          onEdit={onEdit}
          onCancelEdit={onCancelForm}
          onToggle={onToggle}
          onDelete={onDelete}
          form={form}
          setForm={setForm}
          saving={saving}
          onSave={onSave}
          onCancel={onCancelForm}
        />
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────

function BannersContent({ payload }) {
  const navigate  = useNavigate()
  const [banners, setBanners]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [formSlot, setFormSlot]   = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const isSuper         = payload.role === 'super'
  const canManageBanners = isSuper || payload.permissions?.manage_banners === true

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await adminPost({ action: 'list' })
      if (data.error) { setError(data.error); return }
      setBanners(data.banners ?? [])
    } catch {
      setError('불러오기 실패 — 다시 시도해주세요')
    } finally {
      setLoading(false)
    }
  }

  function openCreate(slot) {
    setEditingId(null)
    setFormSlot(slot)
    setForm(EMPTY_FORM)
  }

  function openEdit(banner) {
    setEditingId(banner.id)
    setFormSlot(banner.slot)
    setForm({
      type:       banner.type,
      title:      banner.title      ?? '',
      body:       banner.body       ?? '',
      image_url:  banner.image_url  ?? '',
      link_url:   banner.link_url   ?? '',
      disclosure: banner.disclosure ?? '',
    })
  }

  function cancelForm() {
    setFormSlot(null)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleSave() {
    if (form.type === 'info' && !form.title && !form.body) {
      alert('제목 또는 본문을 입력해주세요')
      return
    }
    if (form.type === 'image' && !form.image_url) {
      alert('이미지를 업로드해주세요')
      return
    }
    setSaving(true)
    try {
      let data
      if (editingId) {
        data = await adminPost({
          action:     'update',
          id:         editingId,
          type:       form.type,
          title:      form.title      || null,
          body:       form.body       || null,
          image_url:  form.image_url  || null,
          link_url:   form.link_url   || null,
          disclosure: form.disclosure || null,
        })
      } else {
        data = await adminPost({
          action:     'create',
          slot:       formSlot,
          type:       form.type,
          title:      form.title      || null,
          body:       form.body       || null,
          image_url:  form.image_url  || null,
          link_url:   form.link_url   || null,
          disclosure: form.disclosure || null,
        })
      }
      if (data.error) { alert(data.error); return }
      cancelForm()
      await load()
    } catch {
      alert('저장에 실패했어요')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(id) {
    try {
      const data = await adminPost({ action: 'toggle_active', id })
      if (data.error) { alert(data.error); return }
      setBanners(prev => prev.map(b =>
        b.id === data.banner.id
          ? data.banner
          : b.slot === data.banner.slot && data.banner.is_active
            ? { ...b, is_active: false }
            : b
      ))
    } catch {
      alert('상태 변경에 실패했어요')
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('이 배너를 삭제하시겠어요?')) return
    try {
      const data = await adminPost({ action: 'delete', id })
      if (data.error) { alert(data.error); return }
      setBanners(prev => prev.filter(b => b.id !== id))
      if (editingId === id) cancelForm()
    } catch {
      alert('삭제에 실패했어요')
    }
  }

  function handleLogout() {
    clearAdminToken()
    navigate('/admin/login', { replace: true })
  }

  const slotSectionProps = {
    banners, formSlot, editingId,
    onCreateNew: openCreate,
    onCancelForm: cancelForm,
    onEdit: openEdit,
    onToggle: handleToggle,
    onDelete: handleDelete,
    form, setForm, saving, onSave: handleSave,
  }

  return (
    <div className="min-h-svh bg-stone-100">
      <header className="bg-warm-brown text-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            <span className="text-sm">대시보드</span>
          </button>
          <span className="text-white/30">|</span>
          <span className="text-sm font-semibold">배너 관리</span>
        </div>
        <button onClick={handleLogout} className="text-xs text-white/70 hover:text-white transition-colors">
          로그아웃
        </button>
      </header>

      {!canManageBanners ? (
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <p className="text-sm text-warm-light">배너 관리 권한이 없어요</p>
        </div>
      ) : (
        <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {loading && (
            <div className="flex justify-center py-16">
              <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-stone-500 animate-spin" />
            </div>
          )}
          {error && !loading && (
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <p className="text-sm text-red-500 mb-3">{error}</p>
              <button onClick={load} className="text-xs text-warm-brown underline">다시 시도</button>
            </div>
          )}
          {!loading && !error && (
            <>
              <SlotSection slotKey="calendar_top" {...slotSectionProps} />
              <div className="border-t border-stone-200" />
              <SlotSection slotKey="ingredients_bottom" {...slotSectionProps} />
            </>
          )}

          {/* 안내 */}
          <div className="bg-amber-50 rounded-2xl p-4 text-xs text-amber-800 space-y-1">
            <p className="font-medium">배너 관리 안내</p>
            <p>• <strong>정보</strong>: 달력의 "단골 멤버" 카드 대신 표시되는 텍스트 카드</p>
            <p>• <strong>이미지</strong>: 이미지 배너 — 링크 URL이 있으면 클릭 시 새 탭으로 이동</p>
            <p>• 같은 위치에 하나만 켤 수 있어요. 새 배너를 켜면 기존 배너가 자동으로 꺼집니다.</p>
            <p>• 배너를 끄면 앱에서 기존 통계 카드(달력) 또는 빈 공간(재료)으로 복귀합니다.</p>
            <p>• 이미지는 <strong>banners</strong> Storage 버킷에 저장됩니다 (권장 가로 최대 800px, 5MB 이하).</p>
          </div>
        </main>
      )}
    </div>
  )
}

export default function AdminBannersPage() {
  return (
    <AdminGuard>
      {(payload) => <BannersContent payload={payload} />}
    </AdminGuard>
  )
}
