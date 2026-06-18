import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminGuard, { clearAdminToken, getAdminToken } from './AdminGuard'

const ADMIN_VERIFY_URL    = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-verify`
const ADMIN_PUSH_STATS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-push-stats`
const SUPABASE_ANON_KEY   = import.meta.env.VITE_SUPABASE_ANON_KEY

const PERMISSION_LABELS = {
  view_users:         '사용자 목록 조회',
  delete_users:       '사용자 삭제',
  view_spaces:        '스페이스 목록 조회',
  read_space_content: '스페이스 콘텐츠 조회',
  view_feedback:      '피드백 조회',
  manage_admins:      '관리자 관리',
}

function Dashboard({ payload }) {
  const navigate  = useNavigate()
  const isSuper   = payload.role === 'super'
  const expDate   = new Date(payload.exp * 1000)
  const canViewUsers = isSuper || payload.permissions?.view_users === true

  const [pushStats, setPushStats]         = useState(null)
  const [pushStatsLoading, setPushStatsLoading] = useState(false)
  const [pushStatsError, setPushStatsError]     = useState(null)

  useEffect(() => {
    if (!canViewUsers) return
    setPushStatsLoading(true)
    fetch(ADMIN_PUSH_STATS_URL, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey':        SUPABASE_ANON_KEY,
        'x-admin-token': getAdminToken(),
      },
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) setPushStatsError(d.error)
        else setPushStats(d)
      })
      .catch(() => setPushStatsError('불러오기 실패'))
      .finally(() => setPushStatsLoading(false))
  }, [])

  function handleLogout() {
    clearAdminToken()
    navigate('/admin/login', { replace: true })
  }

  async function handleVerify() {
    const token = getAdminToken()
    try {
      const res  = await fetch(ADMIN_VERIFY_URL, {
        method:  'POST',
        headers: {
          // 게이트웨이 통과: anon key (유효한 Supabase JWT)
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'apikey':        SUPABASE_ANON_KEY,
          // 함수 인증: 관리자 세션 토큰 (커스텀 헤더로 분리)
          'x-admin-token': token,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ permission: 'view_users' }),
      })
      const data = await res.json()
      alert(JSON.stringify(data, null, 2))
    } catch (e) {
      alert('검증 요청 실패: ' + e.message)
    }
  }

  return (
    <div className="min-h-svh bg-stone-100">

      {/* 상단 헤더 */}
      <header className="bg-warm-brown text-white px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <svg width="20" height="20" fill="none" stroke="white" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span className="font-semibold text-sm">식탁일기 관리자</span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs text-white/70 hover:text-white transition-colors"
        >
          로그아웃
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* 관리자 정보 카드 */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-warm-brown flex items-center justify-center text-white font-bold text-sm">
              {payload.username[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-warm-dark">{payload.username}</p>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mt-0.5 ${
                isSuper
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-stone-100 text-stone-600'
              }`}>
                {isSuper ? '총괄 관리자' : '서브 관리자'}
              </span>
            </div>
          </div>

          <div className="border-t border-cream-200 pt-4 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-warm-light">세션 만료</span>
              <span className="text-warm-dark font-medium">
                {expDate.toLocaleString('ko-KR')}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-warm-light">관리자 ID</span>
              <span className="text-warm-dark font-mono text-[10px]">{payload.id}</span>
            </div>
          </div>
        </div>

        {/* 권한 목록 */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-warm-dark mb-3">부여된 권한</h2>
          <div className="space-y-2">
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
              const granted = isSuper || payload.permissions?.[key] === true
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-xs text-warm-dark">{label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    granted
                      ? 'bg-green-50 text-green-700'
                      : 'bg-stone-100 text-stone-400'
                  }`}>
                    {granted ? '허용' : '없음'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 대시보드 기능 */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-warm-dark mb-3">관리 기능</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '사용자 관리', icon: '👤', key: 'view_users', path: '/admin/users' },
              { label: '스페이스 관리', icon: '🏠', key: 'view_spaces', path: '/admin/spaces' },
              { label: '피드백', icon: '💬', key: 'view_feedback', path: '/admin/feedback' },
              { label: '관리자 관리', icon: '🔑', key: 'manage_admins', path: '/admin/admins' },
              { label: '배너 관리',   icon: '🎨', key: 'manage_banners', path: '/admin/banners' },
            ].map(({ label, icon, key, path }) => {
              const available  = key === 'manage_banners'
                ? isSuper
                : (isSuper || payload.permissions?.[key] === true)
              const actionable = available && path
              const Tag        = actionable ? 'button' : 'div'
              return (
                <Tag
                  key={key}
                  {...(actionable ? { onClick: () => navigate(path) } : {})}
                  className={`p-4 rounded-xl border text-center transition-all ${
                    actionable
                      ? 'border-warm-brown/30 bg-cream-50 text-warm-dark hover:bg-cream-100 active:scale-95 cursor-pointer'
                      : available
                        ? 'border-cream-300 bg-cream-50 text-warm-dark'
                        : 'border-stone-100 bg-stone-50 text-stone-300'
                  }`}
                >
                  <div className="text-xl mb-1">{icon}</div>
                  <p className="text-xs font-medium">{label}</p>
                  {!actionable && (
                    <p className="text-[10px] mt-0.5 text-current opacity-60">준비중</p>
                  )}
                </Tag>
              )
            })}
          </div>
        </div>

        {/* 푸시 알림 현황 */}
        {canViewUsers && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="text-sm font-semibold text-warm-dark mb-3">푸시 알림 현황</h2>
            {pushStatsLoading && (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 rounded-full border-2 border-stone-200 border-t-stone-400 animate-spin" />
              </div>
            )}
            {pushStatsError && !pushStatsLoading && (
              <p className="text-xs text-red-500">{pushStatsError}</p>
            )}
            {pushStats && !pushStatsLoading && (() => {
              const { total_tokens, users_with_tokens, total_users } = pushStats
              const pct = total_users > 0
                ? Math.round((users_with_tokens / total_users) * 100)
                : 0
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: '등록 토큰', value: total_tokens, unit: '개' },
                      { label: '알림 활성 사용자', value: users_with_tokens, unit: '명' },
                      { label: '커버리지', value: pct, unit: '%' },
                    ].map(({ label, value, unit }) => (
                      <div key={label} className="bg-cream-50 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-warm-light mb-1">{label}</p>
                        <p className="text-lg font-bold text-warm-dark leading-none">
                          {value.toLocaleString()}
                          <span className="text-xs font-normal text-warm-light ml-0.5">{unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {/* 커버리지 바 */}
                    <div className="h-2 bg-cream-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-warm-brown rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-cream-400">
                      전체 {total_users}명 중 {users_with_tokens}명이 알림을 켰어요
                      {total_tokens > users_with_tokens && ` · 1인 다기기 포함 (토큰 ${total_tokens}개)`}
                    </p>
                  </div>
                  <p className="text-[10px] text-cream-400 border-t border-cream-100 pt-2">
                    플랫폼 분류 · 발송 성공/실패 로그는 현재 미저장 (향후 과제)
                  </p>
                </div>
              )
            })()}
          </div>
        )}

        {/* 인증 검증 테스트 (개발용) */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="text-sm font-semibold text-warm-dark mb-1">토큰 검증 테스트</h2>
          <p className="text-xs text-warm-light mb-3">
            admin-verify Edge Function 호출 — view_users 권한 포함 응답 확인
          </p>
          <button
            onClick={handleVerify}
            className="px-4 py-2 text-xs font-medium bg-stone-100 text-stone-700
              rounded-lg hover:bg-stone-200 transition-colors active:scale-95"
          >
            검증 요청
          </button>
        </div>

      </main>
    </div>
  )
}

export default function AdminDashboardPage() {
  return (
    <AdminGuard>
      {(payload) => <Dashboard payload={payload} />}
    </AdminGuard>
  )
}
