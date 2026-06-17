import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminGuard, { clearAdminToken, getAdminToken } from './AdminGuard'

const ADMIN_SPACES_URL  = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-spaces`
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

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
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

const TAG_STYLES = {
  집밥: 'bg-green-50 text-green-700',
  외식: 'bg-amber-50 text-amber-700',
  카페: 'bg-pink-50 text-pink-700',
  배달: 'bg-blue-50 text-blue-600',
}

function StarRow({ rating }) {
  if (!rating) return null
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="10" height="10" viewBox="0 0 24 24"
          fill={i <= rating ? '#c4a882' : 'none'}
          stroke={i <= rating ? '#c4a882' : '#d9c4a8'}
          strokeWidth="1.5">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      ))}
    </div>
  )
}

function SpaceDetailContent({ payload }) {
  const { id }          = useParams()
  const navigate        = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res  = await adminFetch(`${ADMIN_SPACES_URL}?space_id=${id}`, getAdminToken())
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 401) { navigate('/admin/login', { replace: true }); return }
        setError(body.error || '불러오기 실패')
        return
      }
      setData(body)
    } catch {
      setError('네트워크 오류 — 다시 시도해주세요')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    clearAdminToken()
    navigate('/admin/login', { replace: true })
  }

  const space = data?.space

  return (
    <div className="min-h-svh bg-stone-100">

      {/* 헤더 */}
      <header className="bg-warm-brown text-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/spaces')}
            className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors"
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            <span className="text-sm">스페이스 목록</span>
          </button>
          {space && (
            <>
              <span className="text-white/30">|</span>
              <span className="text-sm font-semibold truncate max-w-32">
                {space.emoji} {space.name}
              </span>
            </>
          )}
        </div>
        <button onClick={handleLogout} className="text-xs text-white/70 hover:text-white transition-colors">
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

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">

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
            <button onClick={load} className="text-xs text-warm-brown underline">다시 시도</button>
          </div>
        )}

        {data && (
          <>
            {/* 스페이스 기본 정보 */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-cream-100 flex items-center justify-center text-3xl shrink-0">
                  {space.emoji || '🍽️'}
                </div>
                <div>
                  <h1 className="text-lg font-bold text-warm-dark">{space.name}</h1>
                  <div className="flex items-center gap-3 mt-1 text-xs text-warm-light">
                    <span>초대 코드 <span className="font-mono font-semibold text-warm-dark">{space.code}</span></span>
                    <span>·</span>
                    <span>생성 {formatDate(space.created_at)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-cream-100 grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xl font-bold text-warm-dark">{data.members.length}</p>
                  <p className="text-[11px] text-warm-light mt-0.5">멤버</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-warm-dark">{data.total_meals}</p>
                  <p className="text-[11px] text-warm-light mt-0.5">기록</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-warm-dark">
                    {data.meals[0]?.date ? formatDate(data.meals[0].date).replace(/\d{4}년 /, '') : '—'}
                  </p>
                  <p className="text-[11px] text-warm-light mt-0.5">최근 기록</p>
                </div>
              </div>
            </div>

            {/* 멤버 목록 */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold text-warm-dark mb-3">
                멤버 <span className="font-normal text-warm-light">{data.members.length}명</span>
              </h2>
              <div className="space-y-2">
                {data.members.map((m, i) => (
                  <div key={m.user_id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-warm-brown/10 flex items-center justify-center
                      text-warm-brown text-xs font-semibold shrink-0">
                      {m.display_name[0]?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-sm text-warm-dark">{m.display_name}</span>
                    <span className="ml-auto text-[11px] text-cream-400">{formatDate(m.joined_at)} 참가</span>
                  </div>
                ))}
                {data.members.length === 0 && (
                  <p className="text-sm text-warm-light">멤버 정보 없음</p>
                )}
              </div>
            </div>

            {/* 기록 목록 */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-cream-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-warm-dark">
                  기록 목록
                  <span className="ml-2 font-normal text-warm-light">
                    {data.total_meals > 30
                      ? `최근 30개 (전체 ${data.total_meals}개)`
                      : `${data.total_meals}개`}
                  </span>
                </h2>
              </div>

              {data.meals.length === 0 ? (
                <p className="text-center text-sm text-warm-light py-10">기록이 없어요</p>
              ) : (
                <ul className="divide-y divide-cream-100">
                  {data.meals.map(meal => (
                    <li key={meal.id} className="flex items-start gap-3 px-5 py-4">
                      {/* 썸네일 */}
                      <div className="w-14 h-14 rounded-xl bg-cream-100 shrink-0 overflow-hidden">
                        {meal.thumb ? (
                          <img
                            src={meal.thumb}
                            alt=""
                            className="w-full h-full object-cover cursor-pointer"
                            onClick={() => setLightbox(meal.thumb)}
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <svg width="18" height="18" fill="none" stroke="#d9c4a8" strokeWidth="1.5"
                              strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                              <rect x="3" y="3" width="18" height="18" rx="3"/>
                              <circle cx="8.5" cy="8.5" r="1.5"/>
                              <polyline points="21 15 16 10 5 21"/>
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-warm-dark truncate">
                              {meal.title || meal.restaurant_name || '제목 없음'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-[11px] text-warm-light">{formatDate(meal.date)}</span>
                              {meal.meal_time && (
                                <span className="text-[11px] text-cream-400">{meal.meal_time}</span>
                              )}
                            </div>
                          </div>
                          {meal.tag && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                              TAG_STYLES[meal.tag] ?? 'bg-stone-100 text-stone-600'
                            }`}>
                              {meal.tag}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          <StarRow rating={meal.rating} />
                          <span className="text-[11px] text-cream-400 ml-auto">{meal.author}</span>
                        </div>
                        {meal.review && (
                          <p className="text-[11px] text-warm-light mt-1 line-clamp-1">{meal.review}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default function AdminSpaceDetailPage() {
  return (
    <AdminGuard>
      {(payload) => <SpaceDetailContent payload={payload} />}
    </AdminGuard>
  )
}
