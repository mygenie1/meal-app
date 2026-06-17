import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminGuard, { clearAdminToken, getAdminToken } from './AdminGuard'

const ADMIN_USERS_URL   = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function ProviderBadge({ provider }) {
  const map = {
    kakao:  { label: '카카오', cls: 'bg-yellow-50 text-yellow-700' },
    email:  { label: '이메일', cls: 'bg-blue-50 text-blue-600' },
    google: { label: '구글',   cls: 'bg-red-50 text-red-600' },
  }
  const { label, cls } = map[provider] ?? { label: provider, cls: 'bg-stone-100 text-stone-600' }
  return (
    <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  )
}

function StatCard({ value, label, sub }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 text-center min-w-0">
      <p className="text-2xl font-bold text-warm-dark tabular-nums">{value.toLocaleString()}</p>
      <p className="text-xs text-warm-light mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-cream-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function UsersPage({ payload }) {
  const navigate = useNavigate()
  const [data, setData]       = useState(null)
  const [error, setError]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const token = getAdminToken()
    try {
      const res = await fetch(ADMIN_USERS_URL, {
        headers: {
          // 게이트웨이 통과: anon key (유효한 Supabase JWT)
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey':        SUPABASE_ANON_KEY,
          // 함수 인증: 관리자 세션 토큰 (커스텀 헤더로 분리)
          'x-admin-token': token,
          'Content-Type':  'application/json',
        },
      })
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

  const filteredUsers = data?.users.filter(u => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      u.display_name.toLowerCase().includes(q) ||
      (u.masked_email ?? '').toLowerCase().includes(q)
    )
  }) ?? []

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
          <span className="text-sm font-semibold">사용자 관리</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-white/70 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* 요약 통계 */}
        {data?.summary && (
          <div className="grid grid-cols-4 gap-3">
            <StatCard value={data.summary.total_users}  label="총 회원" />
            <StatCard value={data.summary.total_spaces} label="스페이스" />
            <StatCard value={data.summary.total_meals}  label="기록" />
            <StatCard value={data.summary.new_users_7d} label="신규(7일)" />
          </div>
        )}

        {/* 유저 목록 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* 목록 헤더 */}
          <div className="px-5 py-4 border-b border-cream-200 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-warm-dark shrink-0">
              회원 목록
              {data && (
                <span className="ml-2 text-xs font-normal text-warm-light">
                  {data.users.length}명
                </span>
              )}
            </h2>
            {/* 이름/이메일 검색 */}
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름 또는 이메일 검색"
              className="flex-1 max-w-52 px-3 py-1.5 rounded-lg bg-cream-100 border border-cream-300
                text-xs text-warm-dark placeholder-cream-400
                focus:outline-none focus:ring-2 focus:ring-warm-brown/30 focus:border-warm-brown"
            />
          </div>

          {/* 로딩 */}
          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-stone-200 border-t-stone-500 animate-spin" />
            </div>
          )}

          {/* 에러 */}
          {error && !loading && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-red-500 mb-3">{error}</p>
              <button
                onClick={load}
                className="text-xs text-warm-brown underline hover:no-underline"
              >
                다시 시도
              </button>
            </div>
          )}

          {/* 목록 */}
          {!loading && !error && (
            <>
              {filteredUsers.length === 0 ? (
                <p className="text-center text-sm text-warm-light py-10">
                  {search ? '검색 결과가 없어요' : '등록된 회원이 없어요'}
                </p>
              ) : (
                <ul className="divide-y divide-cream-100">
                  {filteredUsers.map((user, idx) => (
                    <li key={user.id} className="px-5 py-3.5 flex items-center gap-4">
                      {/* 순번 */}
                      <span className="text-xs text-cream-400 tabular-nums w-5 shrink-0 text-right">
                        {idx + 1}
                      </span>

                      {/* 아바타 이니셜 */}
                      <div className="w-8 h-8 rounded-full bg-warm-brown/10 flex items-center
                        justify-center text-warm-brown text-xs font-semibold shrink-0">
                        {user.display_name[0]?.toUpperCase() ?? '?'}
                      </div>

                      {/* 정보 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-warm-dark truncate">
                            {user.display_name}
                          </span>
                          <ProviderBadge provider={user.provider} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 text-[11px] text-warm-light">
                          {user.masked_email && <span>{user.masked_email}</span>}
                          <span>{formatDate(user.created_at)}</span>
                        </div>
                      </div>

                      {/* 스페이스·기록 카운트 */}
                      <div className="text-right shrink-0">
                        <div className="text-xs text-warm-dark font-medium tabular-nums">
                          {user.space_count}
                          <span className="text-cream-400 font-normal">개</span>
                        </div>
                        <div className="text-[11px] text-warm-light tabular-nums">
                          {user.meal_count}건
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* 컬럼 범례 */}
        {!loading && !error && data && (
          <p className="text-[10px] text-stone-400 text-center">
            이름 · 로그인 방식 · 이메일 · 가입일 / 스페이스 수 · 기록 수
          </p>
        )}

      </main>
    </div>
  )
}

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      {(payload) => <UsersPage payload={payload} />}
    </AdminGuard>
  )
}
