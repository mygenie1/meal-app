import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminGuard, { clearAdminToken, getAdminToken } from './AdminGuard'

const ADMIN_FEEDBACK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-feedback`
const SUPABASE_ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY

const ADMIN_HEADERS = {
  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  'apikey':        SUPABASE_ANON_KEY,
  'Content-Type':  'application/json',
}

function adminGet(url) {
  return fetch(url, { headers: { ...ADMIN_HEADERS, 'x-admin-token': getAdminToken() } })
}

function adminPatch(url, body) {
  return fetch(url, {
    method: 'PATCH',
    headers: { ...ADMIN_HEADERS, 'x-admin-token': getAdminToken() },
    body: JSON.stringify(body),
  })
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

const TYPE_INFO = {
  bug:        { label: '버그',  cls: 'bg-red-50 text-red-600' },
  suggestion: { label: '제안',  cls: 'bg-blue-50 text-blue-600' },
  praise:     { label: '칭찬',  cls: 'bg-green-50 text-green-700' },
  etc:        { label: '기타',  cls: 'bg-stone-100 text-stone-500' },
}

const STATUS_INFO = {
  new:     { label: '신규',    cls: 'bg-blue-50 text-blue-600' },
  checked: { label: '확인함',  cls: 'bg-amber-50 text-amber-600' },
  done:    { label: '처리완료', cls: 'bg-green-50 text-green-700' },
}

function TypeBadge({ type }) {
  const info = TYPE_INFO[type] ?? { label: type, cls: 'bg-stone-100 text-stone-500' }
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${info.cls}`}>
      {info.label}
    </span>
  )
}

function StatusBadge({ status }) {
  const s = status ?? 'new'
  const info = STATUS_INFO[s] ?? STATUS_INFO.new
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${info.cls}`}>
      {info.label}
    </span>
  )
}

function FeedbackContent({ payload }) {
  const navigate = useNavigate()
  const [items, setItems]         = useState([])
  const [total, setTotal]         = useState(0)
  const [offset, setOffset]       = useState(0)
  const [loading, setLoading]     = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]         = useState(null)
  const [lightbox, setLightbox]   = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')  // 'all'|'new'|'checked'|'done'
  const [updatingId, setUpdatingId]     = useState(null)
  const [updateError, setUpdateError]   = useState(null)

  const LIMIT = 30

  // statusFilter 변경 시 목록 초기화 + 재조회
  useEffect(() => { load(0, statusFilter) }, [statusFilter])

  async function load(off, sf) {
    const isInitial = off === 0
    if (isInitial) setLoading(true)
    else           setLoadingMore(true)
    setError(null)
    try {
      const res  = await adminGet(
        `${ADMIN_FEEDBACK_URL}?limit=${LIMIT}&offset=${off}&status=${sf}`,
      )
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 401) { navigate('/admin/login', { replace: true }); return }
        setError(body.error || '불러오기 실패')
        return
      }
      if (isInitial) setItems(body.items)
      else           setItems(prev => [...prev, ...body.items])
      setTotal(body.total)
      setOffset(off + body.items.length)
    } catch {
      setError('네트워크 오류 — 다시 시도해주세요')
    } finally {
      if (isInitial) setLoading(false)
      else           setLoadingMore(false)
    }
  }

  async function updateStatus(feedbackId, newStatus) {
    setUpdatingId(feedbackId)
    setUpdateError(null)
    try {
      const res  = await adminPatch(ADMIN_FEEDBACK_URL, {
        action:      'update_status',
        feedback_id: feedbackId,
        status:      newStatus,
      })
      const body = await res.json()
      if (!res.ok) {
        setUpdateError(body.error || '상태 변경 실패')
        return
      }
      // 낙관적 업데이트: 로컬 state 즉시 반영
      setItems(prev => prev.map(i =>
        i.id === feedbackId
          ? { ...i, status: newStatus, handled_at: new Date().toISOString() }
          : i
      ))
    } catch {
      setUpdateError('네트워크 오류 — 다시 시도해주세요')
    } finally {
      setUpdatingId(null)
    }
  }

  function handleLogout() {
    clearAdminToken()
    navigate('/admin/login', { replace: true })
  }

  const hasMore    = items.length < total
  const canManage  = payload.role === 'super' || payload.permissions?.view_feedback === true

  // 상태별 카운트 (로드된 items 기준 — 전체 집계 아님, 필터 없는 상태에서만 의미있음)
  const newCount = statusFilter === 'all' ? null : null  // 전체 집계는 서버에만 있으므로 미표시

  return (
    <div className="min-h-svh bg-stone-100">

      {/* 헤더 */}
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
          <span className="text-sm font-semibold">피드백</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-white/70 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </header>

      {/* 사진 라이트박스 */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center
              text-white hover:bg-white/20 transition-colors"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>
      )}

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-3">

        {/* 상태 필터 */}
        <div className="flex items-center gap-1.5 flex-wrap px-1">
          {[
            { v: 'all',     label: '전체' },
            { v: 'new',     label: '신규' },
            { v: 'checked', label: '확인함' },
            { v: 'done',    label: '처리완료' },
          ].map(({ v, label }) => (
            <button key={v}
              onClick={() => setStatusFilter(v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                statusFilter === v
                  ? v === 'new'     ? 'bg-blue-500 text-white'
                  : v === 'checked' ? 'bg-amber-500 text-white'
                  : v === 'done'    ? 'bg-green-600 text-white'
                  :                   'bg-warm-brown text-white'
                  : 'bg-white text-warm-light hover:text-warm-dark border border-cream-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 상태 변경 오류 */}
        {updateError && (
          <div className="bg-red-50 rounded-xl px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs text-red-600">{updateError}</span>
            <button onClick={() => setUpdateError(null)} className="text-red-400 hover:text-red-600 ml-3">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeLinecap="round" viewBox="0 0 24 24">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-stone-500 animate-spin" />
          </div>
        )}

        {/* 에러 */}
        {error && !loading && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-sm text-red-500 mb-3">{error}</p>
            <button onClick={() => load(0, statusFilter)} className="text-xs text-warm-brown underline">
              다시 시도
            </button>
          </div>
        )}

        {/* 목록 헤더 */}
        {!loading && !error && (
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-warm-dark">
              {statusFilter === 'all'     ? '전체 피드백'
               : statusFilter === 'new'     ? '신규 피드백'
               : statusFilter === 'checked' ? '확인한 피드백'
               : '처리 완료'}
              <span className="ml-2 font-normal text-warm-light">{total}건</span>
            </h2>
            <span className="text-[11px] text-warm-light">최신순</span>
          </div>
        )}

        {/* 피드백 카드 목록 */}
        {items.map(item => {
          const isUpdating = updatingId === item.id
          const curStatus  = item.status ?? 'new'

          return (
            <div key={item.id} className="bg-white rounded-2xl shadow-sm p-5">

              {/* 헤더 행: 유형뱃지 + 상태뱃지 + 날짜 */}
              <div className="flex items-center gap-2 mb-3">
                <TypeBadge type={item.type} />
                <StatusBadge status={curStatus} />
                <span className="text-[11px] text-cream-400 ml-auto">{formatDate(item.created_at)}</span>
              </div>

              {/* 내용 */}
              <p className="text-sm text-warm-dark leading-relaxed whitespace-pre-wrap break-words">
                {item.content}
              </p>

              {/* 스크린샷 */}
              {item.screenshot_url && (
                <div className="mt-3">
                  <img
                    src={item.screenshot_url}
                    alt="스크린샷"
                    className="w-24 h-24 rounded-xl object-cover border border-cream-200 cursor-pointer
                      hover:opacity-80 transition-opacity active:scale-95"
                    onClick={() => setLightbox(item.screenshot_url)}
                    loading="lazy"
                  />
                </div>
              )}

              {/* 작성자 + 처리 이력 */}
              <div className="mt-3 pt-3 border-t border-cream-100">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-5 h-5 rounded-full bg-warm-brown/10 flex items-center justify-center
                    text-warm-brown text-[10px] font-semibold shrink-0">
                    {(item.author[0] ?? '?').toUpperCase()}
                  </div>
                  <span className="text-xs text-warm-light">{item.author}</span>
                  {item.handled_by && (
                    <span className="text-[11px] text-cream-400 ml-auto">
                      {item.handled_by} 처리
                      {item.handled_at ? ` · ${formatDate(item.handled_at)}` : ''}
                    </span>
                  )}
                </div>

                {/* 상태 변경 버튼 — view_feedback 권한 보유 시 표시 */}
                {canManage && (
                  <div className="flex gap-1.5">
                    {[
                      { v: 'new',     label: '신규',     activeCls: 'bg-blue-500 text-white', inactiveCls: 'bg-blue-50 text-blue-500 hover:bg-blue-100' },
                      { v: 'checked', label: '확인함',   activeCls: 'bg-amber-500 text-white', inactiveCls: 'bg-amber-50 text-amber-600 hover:bg-amber-100' },
                      { v: 'done',    label: '처리완료', activeCls: 'bg-green-600 text-white', inactiveCls: 'bg-green-50 text-green-700 hover:bg-green-100' },
                    ].map(({ v, label, activeCls, inactiveCls }) => (
                      <button
                        key={v}
                        disabled={isUpdating || curStatus === v}
                        onClick={() => updateStatus(item.id, v)}
                        className={`flex-1 py-1.5 text-[11px] font-medium rounded-lg transition-colors
                          disabled:cursor-not-allowed ${
                          curStatus === v ? `${activeCls} opacity-90` : inactiveCls
                        }`}
                      >
                        {isUpdating && curStatus !== v ? (
                          <span className="flex items-center justify-center gap-1">
                            <span className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" />
                          </span>
                        ) : label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* 빈 상태 */}
        {!loading && !error && items.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <p className="text-sm text-warm-light">
              {statusFilter === 'new'     ? '신규 피드백이 없어요'
               : statusFilter === 'checked' ? '확인한 피드백이 없어요'
               : statusFilter === 'done'    ? '처리 완료된 피드백이 없어요'
               : '피드백이 없어요'}
            </p>
          </div>
        )}

        {/* 더보기 */}
        {hasMore && !loading && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => load(offset, statusFilter)}
              disabled={loadingMore}
              className="px-6 py-2.5 rounded-full bg-white shadow-sm text-sm text-warm-dark
                hover:bg-cream-50 active:scale-95 transition-all disabled:opacity-50"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-stone-300 border-t-stone-500 rounded-full animate-spin" />
                  불러오는 중…
                </span>
              ) : `더보기 (${total - items.length}건 남음)`}
            </button>
          </div>
        )}

      </main>
    </div>
  )
}

export default function AdminFeedbackPage() {
  return (
    <AdminGuard>
      {(payload) => <FeedbackContent payload={payload} />}
    </AdminGuard>
  )
}
