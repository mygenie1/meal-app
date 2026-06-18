import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminGuard, { clearAdminToken, getAdminToken } from './AdminGuard'

const ADMIN_USERS_URL       = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`
const ADMIN_USER_DELETE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-user-delete`
const SUPABASE_ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

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

  // 유저 액션 상태
  const [actionUser, setActionUser]     = useState(null)   // { id, display_name, is_banned }
  const [actionType, setActionType]     = useState(null)   // 'deactivate'|'reactivate'|'delete'
  const [confirmName, setConfirmName]   = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError]   = useState(null)

  // delete_users 권한 또는 super이면 비활성화/복구 가능
  const canDelete = payload.role === 'super' || payload.permissions?.delete_users === true

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

  function openAction(type, user) {
    setActionType(type)
    setActionUser(user)
    setConfirmName('')
    setActionError(null)
  }
  function closeAction() {
    setActionType(null)
    setActionUser(null)
    setConfirmName('')
    setActionError(null)
  }

  async function userDeleteFetch(body) {
    return fetch(ADMIN_USER_DELETE_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey':        SUPABASE_ANON_KEY,
        'x-admin-token': getAdminToken(),
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(body),
    })
  }

  async function handleDeactivate() {
    setActionLoading(true)
    setActionError(null)
    try {
      const res  = await userDeleteFetch({ action: 'deactivate', user_id: actionUser.id })
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 401) { navigate('/admin/login', { replace: true }); return }
        setActionError(body.error || '비활성화 실패')
        return
      }
      setData(prev => ({
        ...prev,
        users: prev.users.map(u => u.id === actionUser.id ? { ...u, is_banned: true } : u),
      }))
      closeAction()
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
      const res  = await userDeleteFetch({ action: 'reactivate', user_id: actionUser.id })
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 401) { navigate('/admin/login', { replace: true }); return }
        setActionError(body.error || '활성화 실패')
        return
      }
      setData(prev => ({
        ...prev,
        users: prev.users.map(u => u.id === actionUser.id ? { ...u, is_banned: false } : u),
      }))
      closeAction()
    } catch {
      setActionError('네트워크 오류 — 다시 시도해주세요')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleHardDelete() {
    if (confirmName.trim() !== actionUser.display_name) return
    setActionLoading(true)
    setActionError(null)
    try {
      const res  = await userDeleteFetch({
        action:       'hard_delete',
        user_id:      actionUser.id,
        confirm_name: confirmName.trim(),
      })
      const body = await res.json()
      if (!res.ok) {
        if (res.status === 401) { navigate('/admin/login', { replace: true }); return }
        setActionError(body.error || '영구 삭제 실패')
        return
      }
      setData(prev => ({
        ...prev,
        users:   prev.users.filter(u => u.id !== actionUser.id),
        summary: { ...prev.summary, total_users: prev.summary.total_users - 1 },
      }))
      closeAction()
    } catch {
      setActionError('네트워크 오류 — 다시 시도해주세요')
    } finally {
      setActionLoading(false)
    }
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
                    <li key={user.id} className="px-4 pr-5 py-3.5 flex items-center gap-3">
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
                          {user.is_banned && (
                            <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full
                              font-medium bg-red-50 text-red-500">
                              비활성
                            </span>
                          )}
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

                      {/* 액션 버튼 (권한 있을 때만) */}
                      {canDelete && (
                        <div className="shrink-0 flex items-center gap-2 ml-2">
                          {/* 비활성화 / 복구 토글 */}
                          <button
                            title={user.is_banned ? '계정 복구' : '계정 비활성화'}
                            onClick={() => openAction(user.is_banned ? 'reactivate' : 'deactivate', user)}
                            className={`w-10 h-5 rounded-full relative transition-colors shrink-0 ${
                              user.is_banned ? 'bg-stone-300' : 'bg-green-400'
                            }`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow
                              transition-transform ${user.is_banned ? 'translate-x-0.5' : 'translate-x-5'}`}/>
                          </button>
                          {/* 영구삭제 (super 전용) */}
                          {payload.role === 'super' && (
                            <button
                              title="영구 삭제"
                              onClick={() => openAction('delete', user)}
                              className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <svg width="14" height="14" fill="none" stroke="currentColor"
                                strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
                                viewBox="0 0 24 24">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6M14 11v6"/>
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
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

      {/* ── 비활성화 확인 모달 ─────────────────────────── */}
      {actionType === 'deactivate' && actionUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
          onClick={closeAction}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-warm-dark mb-2">계정 비활성화</h3>
            <p className="text-sm text-warm-light mb-1">
              <span className="font-medium text-warm-dark">{actionUser.display_name}</span> 님의
              로그인을 차단합니다.
            </p>
            <p className="text-xs text-cream-400 mb-5">
              데이터는 보존됩니다. 나중에 복구할 수 있습니다.
            </p>
            {actionError && (
              <p className="text-xs text-red-500 mb-3 p-2 bg-red-50 rounded-lg">{actionError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={closeAction}
                className="flex-1 py-2.5 rounded-xl border border-cream-300 text-sm text-warm-light
                  hover:text-warm-dark transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDeactivate}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-stone-600 text-white text-sm font-medium
                  hover:bg-stone-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? '처리 중…' : '비활성화'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 복구 확인 모달 ────────────────────────────── */}
      {actionType === 'reactivate' && actionUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
          onClick={closeAction}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-warm-dark mb-2">계정 복구</h3>
            <p className="text-sm text-warm-light mb-5">
              <span className="font-medium text-warm-dark">{actionUser.display_name}</span> 님의
              계정을 다시 활성화합니다.
            </p>
            {actionError && (
              <p className="text-xs text-red-500 mb-3 p-2 bg-red-50 rounded-lg">{actionError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={closeAction}
                className="flex-1 py-2.5 rounded-xl border border-cream-300 text-sm text-warm-light
                  hover:text-warm-dark transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleReactivate}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium
                  hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {actionLoading ? '처리 중…' : '복구'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 영구 삭제 확인 모달 ───────────────────────── */}
      {actionType === 'delete' && actionUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4"
          onClick={closeAction}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <svg width="14" height="14" fill="none" stroke="#ef4444" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-red-600">계정 영구 삭제</h3>
            </div>
            <p className="text-sm text-warm-light mb-1">
              <span className="font-medium text-warm-dark">{actionUser.display_name}</span> 님의
              계정을 영구적으로 삭제합니다.
            </p>
            <p className="text-xs text-red-400 mb-4">
              auth 계정·멤버십·알림이 삭제됩니다. 식사 기록·댓글·별점은 스페이스에 보존됩니다.
              <br />이 작업은 되돌릴 수 없습니다.
            </p>
            <p className="text-xs text-warm-dark font-medium mb-1.5">
              확인을 위해 사용자 이름 <span className="font-bold">{actionUser.display_name}</span>을 입력하세요
            </p>
            <input
              type="text"
              value={confirmName}
              onChange={e => setConfirmName(e.target.value)}
              placeholder={actionUser.display_name}
              className="w-full px-3 py-2 rounded-xl bg-cream-100 border border-cream-300 text-sm
                text-warm-dark placeholder-cream-400 focus:outline-none focus:ring-2
                focus:ring-red-300 focus:border-red-400 mb-4"
            />
            {actionError && (
              <p className="text-xs text-red-500 mb-3 p-2 bg-red-50 rounded-lg">{actionError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={closeAction}
                className="flex-1 py-2.5 rounded-xl border border-cream-300 text-sm text-warm-light
                  hover:text-warm-dark transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleHardDelete}
                disabled={actionLoading || confirmName.trim() !== actionUser.display_name}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium
                  hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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

export default function AdminUsersPage() {
  return (
    <AdminGuard>
      {(payload) => <UsersPage payload={payload} />}
    </AdminGuard>
  )
}
