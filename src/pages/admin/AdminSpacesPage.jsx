import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

function SpacesContent({ payload }) {
  const navigate = useNavigate()
  const [spaces, setSpaces]         = useState(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [memberFilter, setMemberFilter] = useState('all')    // 'all' | 'empty'
  const [statusFilter, setStatusFilter] = useState('all')    // 'all' | 'active' | 'inactive'
  const [sortBy, setSortBy]             = useState('meal_desc') // 'meal_desc'|'created_desc'|'member_desc'

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res  = await adminFetch(ADMIN_SPACES_URL, getAdminToken())
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 401) { navigate('/admin/login', { replace: true }); return }
        setError(body.error || '불러오기 실패')
        return
      }
      setSpaces(body.spaces)
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
          <span className="text-sm font-semibold">스페이스 관리</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-white/70 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </header>

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
            <button onClick={load} className="text-xs text-warm-brown underline">다시 시도</button>
          </div>
        )}

        {/* 필터 탭 + 목록 헤더 */}
        {spaces && (() => {
          const emptyCount    = spaces.filter(s => s.member_count === 0).length
          const inactiveCount = spaces.filter(s => s.is_active === false).length

          let visibleSpaces = [...spaces]
          if (memberFilter === 'empty')    visibleSpaces = visibleSpaces.filter(s => s.member_count === 0)
          if (statusFilter === 'active')   visibleSpaces = visibleSpaces.filter(s => s.is_active !== false)
          if (statusFilter === 'inactive') visibleSpaces = visibleSpaces.filter(s => s.is_active === false)
          visibleSpaces.sort((a, b) => {
            if (sortBy === 'created_desc') return (b.created_at ?? '').localeCompare(a.created_at ?? '')
            if (sortBy === 'member_desc')  return b.member_count - a.member_count
            return b.meal_count - a.meal_count  // meal_desc (기본)
          })

          return (
            <>
              {/* 필터 탭 + 정렬 */}
              <div className="flex flex-col gap-2 px-1">
                {/* 상태 필터 + 정렬 select */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { v: 'all',      label: `전체 ${spaces.length}` },
                    { v: 'active',   label: `활성 ${spaces.length - inactiveCount}` },
                    { v: 'inactive', label: `비활성 ${inactiveCount}` },
                  ].map(({ v, label }) => (
                    <button key={v}
                      onClick={() => setStatusFilter(v)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                        statusFilter === v
                          ? v === 'inactive' ? 'bg-red-500 text-white' : 'bg-warm-brown text-white'
                          : 'bg-white text-warm-light hover:text-warm-dark border border-cream-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="ml-auto text-xs text-warm-dark bg-white border border-cream-200
                      rounded-lg px-2 py-1.5 focus:outline-none focus:border-warm-brown"
                  >
                    <option value="meal_desc">기록 많은순</option>
                    <option value="created_desc">최신 생성순</option>
                    <option value="member_desc">멤버 많은순</option>
                  </select>
                </div>
                {/* 멤버 0명 필터 */}
                <div>
                  <button
                    onClick={() => setMemberFilter(memberFilter === 'empty' ? 'all' : 'empty')}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                      memberFilter === 'empty'
                        ? 'bg-stone-600 text-white'
                        : 'bg-white text-warm-light hover:text-warm-dark border border-cream-200'
                    }`}
                  >
                    멤버 0명
                    {emptyCount > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                        memberFilter === 'empty'
                          ? 'bg-white/20 text-white'
                          : 'bg-stone-100 text-stone-600'
                      }`}>
                        {emptyCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* 목록 헤더 */}
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-warm-dark">
                  {memberFilter === 'empty' && statusFilter === 'all'
                    ? '멤버 없는 스페이스'
                    : statusFilter === 'inactive' ? '비활성 스페이스'
                    : statusFilter === 'active'   ? '활성 스페이스'
                    : '전체 스페이스'
                  }
                  <span className="ml-2 font-normal text-warm-light">{visibleSpaces.length}개</span>
                </h2>
              </div>

              {/* 스페이스 카드 목록 */}
              {visibleSpaces.map(space => (
          <button
            key={space.id}
            onClick={() => navigate(`/admin/spaces/${space.id}`)}
            className={`w-full bg-white rounded-2xl shadow-sm p-5 text-left
              hover:bg-cream-50 active:scale-[0.99] transition-all ${
              !space.is_active ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-start gap-3">
              {/* 이모지 */}
              <div className="w-10 h-10 rounded-xl bg-cream-100 flex items-center justify-center
                text-xl shrink-0">
                {space.emoji || '🍽️'}
              </div>

              {/* 정보 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-warm-dark text-sm truncate">{space.name}</span>
                  <span className="text-[10px] text-cream-400 font-mono shrink-0">#{space.code}</span>
                  {!space.is_active && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full
                      bg-red-50 text-red-500 font-medium">
                      비활성
                    </span>
                  )}
                  {space.member_count === 0 && (
                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full
                      bg-stone-100 text-stone-500 font-medium">
                      멤버 없음
                    </span>
                  )}
                </div>

                {/* 통계 배지 */}
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-[11px] text-warm-light">
                    <svg width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    {space.member_count}명
                  </span>
                  <span className="text-cream-300">·</span>
                  <span className="text-[11px] text-warm-light">기록 {space.meal_count}개</span>
                  {space.last_meal_date && (
                    <>
                      <span className="text-cream-300">·</span>
                      <span className="text-[11px] text-warm-light">
                        최근 {formatDate(space.last_meal_date)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* 화살표 */}
              <svg width="16" height="16" fill="none" stroke="#d9c4a8" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" className="shrink-0 mt-1">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </div>

            <div className="mt-3 pt-3 border-t border-cream-100 flex items-center justify-between">
              <span className="text-[11px] text-cream-400">
                생성 {formatDate(space.created_at)}
              </span>
            </div>
          </button>
        ))}

              {visibleSpaces.length === 0 && (
                <div className="bg-white rounded-2xl shadow-sm p-10 text-center">
                  <p className="text-sm text-warm-light">
                    {memberFilter === 'empty'
                      ? '멤버 없는 스페이스가 없어요'
                      : statusFilter === 'inactive'
                      ? '비활성 스페이스가 없어요'
                      : statusFilter === 'active'
                      ? '활성 스페이스가 없어요'
                      : '스페이스가 없어요'}
                  </p>
                </div>
              )}
            </>
          )
        })()}

      </main>
    </div>
  )
}

export default function AdminSpacesPage() {
  return (
    <AdminGuard>
      {(payload) => <SpacesContent payload={payload} />}
    </AdminGuard>
  )
}
