import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminGuard, { clearAdminToken, getAdminToken } from './AdminGuard'

const ADMIN_FEEDBACK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-feedback`
const SUPABASE_ANON_KEY  = import.meta.env.VITE_SUPABASE_ANON_KEY

function adminFetch(url, token) {
  return fetch(url, {
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey':        SUPABASE_ANON_KEY,
      'x-admin-token': token,
      'Content-Type':  'application/json',
    },
  })
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) + ' ' + d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

const TYPE_INFO = {
  bug:        { label: '버그',  cls: 'bg-red-50 text-red-600' },
  suggestion: { label: '제안',  cls: 'bg-blue-50 text-blue-600' },
  praise:     { label: '칭찬',  cls: 'bg-green-50 text-green-700' },
  etc:        { label: '기타',  cls: 'bg-stone-100 text-stone-500' },
}

function TypeBadge({ type }) {
  const info = TYPE_INFO[type] ?? { label: type, cls: 'bg-stone-100 text-stone-500' }
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${info.cls}`}>
      {info.label}
    </span>
  )
}

function FeedbackContent({ payload }) {
  const navigate = useNavigate()
  const [items, setItems]     = useState([])
  const [total, setTotal]     = useState(0)
  const [offset, setOffset]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError]     = useState(null)
  const [lightbox, setLightbox] = useState(null)

  const LIMIT = 30

  useEffect(() => { load(0) }, [])

  async function load(off) {
    const isInitial = off === 0
    if (isInitial) setLoading(true)
    else           setLoadingMore(true)
    setError(null)
    try {
      const res  = await adminFetch(
        `${ADMIN_FEEDBACK_URL}?limit=${LIMIT}&offset=${off}`,
        getAdminToken(),
      )
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 401) { navigate('/admin/login', { replace: true }); return }
        setError(body.error || '불러오기 실패')
        return
      }
      setItems(prev => isInitial ? body.items : [...prev, ...body.items])
      setTotal(body.total)
      setOffset(off + body.items.length)
    } catch {
      setError('네트워크 오류 — 다시 시도해주세요')
    } finally {
      if (isInitial) setLoading(false)
      else           setLoadingMore(false)
    }
  }

  function handleLogout() {
    clearAdminToken()
    navigate('/admin/login', { replace: true })
  }

  const hasMore = items.length < total

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
            <button onClick={() => load(0)} className="text-xs text-warm-brown underline">다시 시도</button>
          </div>
        )}

        {/* 목록 헤더 */}
        {!loading && !error && (
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-semibold text-warm-dark">
              피드백
              <span className="ml-2 font-normal text-warm-light">{total}건</span>
            </h2>
            <span className="text-[11px] text-warm-light">최신순</span>
          </div>
        )}

        {/* 피드백 카드 목록 */}
        {items.map(item => (
          <div key={item.id} className="bg-white rounded-2xl shadow-sm p-5">

            {/* 헤더 행: 유형 + 날짜 */}
            <div className="flex items-center justify-between mb-3">
              <TypeBadge type={item.type} />
              <span className="text-[11px] text-cream-400">{formatDate(item.created_at)}</span>
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

            {/* 작성자 */}
            <div className="mt-3 pt-3 border-t border-cream-100 flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-warm-brown/10 flex items-center justify-center
                text-warm-brown text-[10px] font-semibold shrink-0">
                {(item.author[0] ?? '?').toUpperCase()}
              </div>
              <span className="text-xs text-warm-light">{item.author}</span>
            </div>
          </div>
        ))}

        {/* 빈 상태 */}
        {!loading && !error && items.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
            <p className="text-sm text-warm-light">피드백이 없어요</p>
          </div>
        )}

        {/* 더보기 */}
        {hasMore && !loading && (
          <div className="flex justify-center pt-2">
            <button
              onClick={() => load(offset)}
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
