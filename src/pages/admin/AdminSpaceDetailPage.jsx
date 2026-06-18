import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdminGuard, { clearAdminToken, getAdminToken } from './AdminGuard'

const ADMIN_SPACES_URL       = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-spaces`
const ADMIN_SPACE_DELETE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-space-delete`
const SUPABASE_ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY

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

function adminPost(body, token) {
  return fetch(ADMIN_SPACE_DELETE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey':        SUPABASE_ANON_KEY,
      'x-admin-token': token,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  })
}

function DangerRow({ title, desc, btnLabel, btnClass, onAction }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-warm-dark">{title}</p>
        <p className="text-xs text-warm-light mt-0.5 leading-relaxed">{desc}</p>
      </div>
      <button
        onClick={onAction}
        className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg
          transition-colors active:scale-95 ${btnClass}`}
      >
        {btnLabel}
      </button>
    </div>
  )
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

  // Danger Zone 상태
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [showReactivate, setShowReactivate] = useState(false)
  const [showDelete, setShowDelete]         = useState(false)
  const [confirmName, setConfirmName]       = useState('')
  const [actionLoading, setActionLoading]   = useState(false)
  const [actionError, setActionError]       = useState(null)

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

  async function handleDeactivate() {
    setActionLoading(true)
    setActionError(null)
    try {
      const res  = await adminPost({ action: 'deactivate', space_id: id }, getAdminToken())
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 401) { navigate('/admin/login', { replace: true }); return }
        setActionError(body.error || '비활성화 실패')
        return
      }
      setShowDeactivate(false)
      await load()
    } catch {
      setActionError('네트워크 오류 — 다시 시도해주세요')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReactivate() {
    setActionLoading(true)
    setActionError(null)
    try {
      const res  = await adminPost({ action: 'reactivate', space_id: id }, getAdminToken())
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 401) { navigate('/admin/login', { replace: true }); return }
        setActionError(body.error || '활성화 실패')
        return
      }
      setShowReactivate(false)
      await load()
    } catch {
      setActionError('네트워크 오류 — 다시 시도해주세요')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleHardDelete() {
    if (confirmName !== space?.name) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res  = await adminPost(
        { action: 'hard_delete', space_id: id, space_name: confirmName },
        getAdminToken(),
      )
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 401) { navigate('/admin/login', { replace: true }); return }
        setActionError(body.error || '영구 삭제 실패')
        return
      }
      navigate('/admin/spaces', { replace: true })
    } catch {
      setActionError('네트워크 오류 — 다시 시도해주세요')
    } finally {
      setActionLoading(false)
    }
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-bold text-warm-dark">{space.name}</h1>
                    {!space.is_active && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full
                        bg-red-50 text-red-500 font-medium">
                        비활성
                      </span>
                    )}
                  </div>
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
            {/* ── Danger Zone — super 전용 ──────────────────── */}
            {payload.role === 'super' && (
              <div className="border border-red-200 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 bg-red-50 border-b border-red-100 flex items-center gap-2">
                  <svg width="13" height="13" fill="none" stroke="#dc2626" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span className="text-sm font-semibold text-red-700">위험 영역</span>
                  <span className="text-[11px] text-red-400">— 총괄 관리자 전용</span>
                </div>

                <div className="bg-white p-5 space-y-4">
                  {actionError && (
                    <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{actionError}</p>
                  )}

                  {/* 비활성화 or 활성화 */}
                  {space.is_active ? (
                    <DangerRow
                      title="스페이스 비활성화"
                      desc="데이터를 보존한 채 일반 앱에서 숨깁니다. 멤버들이 접근할 수 없게 됩니다. 언제든 복구 가능합니다."
                      btnLabel="비활성화"
                      btnClass="text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100"
                      onAction={() => { setActionError(null); setShowDeactivate(true) }}
                    />
                  ) : (
                    <DangerRow
                      title="스페이스 활성화"
                      desc="비활성화된 스페이스를 복구합니다. 멤버들이 다시 접근할 수 있게 됩니다."
                      btnLabel="활성화"
                      btnClass="text-green-700 bg-green-50 border border-green-200 hover:bg-green-100"
                      onAction={() => { setActionError(null); setShowReactivate(true) }}
                    />
                  )}

                  <div className="border-t border-red-100" />

                  <DangerRow
                    title="영구 삭제"
                    desc="모든 기록, 사진, 멤버 데이터가 영구 삭제됩니다. 되돌릴 수 없습니다."
                    btnLabel="영구 삭제"
                    btnClass="text-white bg-red-500 hover:bg-red-600"
                    onAction={() => { setConfirmName(''); setActionError(null); setShowDelete(true) }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── 비활성화 확인 모달 ─────────────────────────────── */}
      {showDeactivate && space && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !actionLoading && setShowDeactivate(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-warm-dark mb-1">스페이스 비활성화</h3>
            <p className="text-sm text-warm-light mb-1">
              <span className="font-medium text-warm-dark">{space.name}</span> 스페이스를 비활성화합니다.
            </p>
            <p className="text-xs text-warm-light leading-relaxed mb-5">
              일반 앱에서 보이지 않게 됩니다. 데이터는 보존되므로 언제든 복구할 수 있습니다.
            </p>
            {actionError && <p className="text-xs text-red-500 mb-3">{actionError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeactivate(false)}
                disabled={actionLoading}
                className="flex-1 py-2.5 text-sm text-warm-light rounded-xl border border-cream-300
                  hover:bg-cream-50 disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeactivate}
                disabled={actionLoading}
                className="flex-1 py-2.5 text-sm font-medium text-amber-700 bg-amber-50
                  rounded-xl border border-amber-200 hover:bg-amber-100 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? '처리 중…' : '비활성화'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 활성화 확인 모달 ───────────────────────────────── */}
      {showReactivate && space && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !actionLoading && setShowReactivate(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-warm-dark mb-1">스페이스 활성화</h3>
            <p className="text-sm text-warm-light mb-5">
              <span className="font-medium text-warm-dark">{space.name}</span> 스페이스를
              다시 활성화합니다. 멤버들이 정상적으로 접근할 수 있게 됩니다.
            </p>
            {actionError && <p className="text-xs text-red-500 mb-3">{actionError}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setShowReactivate(false)}
                disabled={actionLoading}
                className="flex-1 py-2.5 text-sm text-warm-light rounded-xl border border-cream-300
                  hover:bg-cream-50 disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleReactivate}
                disabled={actionLoading}
                className="flex-1 py-2.5 text-sm font-medium text-green-700 bg-green-50
                  rounded-xl border border-green-200 hover:bg-green-100 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? '처리 중…' : '활성화'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 영구 삭제 확인 모달 (이름 직접 입력) ──────────── */}
      {showDelete && space && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => !actionLoading && (setShowDelete(false), setConfirmName(''))}
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <svg width="18" height="18" fill="none" stroke="#dc2626" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              <h3 className="font-semibold text-red-600">영구 삭제 확인</h3>
            </div>

            <p className="text-sm text-warm-light mb-1">
              이 작업은{' '}
              <span className="font-semibold text-red-600">되돌릴 수 없습니다.</span>
            </p>
            <p className="text-sm text-warm-light mb-4 leading-relaxed">
              <span className="font-medium text-warm-dark">{space.name}</span> 스페이스의
              모든 기록, 사진, 멤버 정보가 영구 삭제됩니다.
            </p>

            <p className="text-xs font-medium text-warm-dark mb-1.5">
              확인을 위해 스페이스 이름{' '}
              <span className="text-red-500 font-mono">"{space.name}"</span>
              을 입력하세요:
            </p>
            <input
              type="text"
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={space.name}
              autoFocus
              className="w-full px-3 py-2.5 text-sm rounded-xl border border-cream-300
                bg-cream-50 focus:outline-none focus:border-red-300 mb-4"
            />

            {actionError && <p className="text-xs text-red-500 mb-3">{actionError}</p>}

            <div className="flex gap-2">
              <button
                onClick={() => { setShowDelete(false); setConfirmName('') }}
                disabled={actionLoading}
                className="flex-1 py-2.5 text-sm text-warm-light rounded-xl border border-cream-300
                  hover:bg-cream-50 disabled:opacity-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleHardDelete}
                disabled={actionLoading || confirmName !== space.name}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500
                  rounded-xl hover:bg-red-600 disabled:opacity-40 active:scale-95 transition-all"
              >
                {actionLoading ? '삭제 중…' : '영구 삭제'}
              </button>
            </div>
          </div>
        </div>
      )}
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
