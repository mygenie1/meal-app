import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import BottomNav from './components/common/BottomNav'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import MapPage from './pages/MapPage'
import IngredientsPage from './pages/IngredientsPage'
import SpacesPage from './pages/SpacesPage'
import LoginPage from './pages/LoginPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import TutorialFlow from './components/Tutorial/TutorialFlow'
import InstallBanner from './components/common/InstallBanner'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'

function OfflineBanner() {
  return (
    <div className="min-h-svh flex flex-col items-center justify-center bg-cream-50 px-8 text-center">
      <div className="w-20 h-20 rounded-full bg-cream-200 flex items-center justify-center mb-6">
        <svg width="36" height="36" fill="none" stroke="#a07850" strokeWidth="1.6"
          strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
          <path d="M1 6C5 2 10.5 1 15 2.5M19 5c1 .9 1.9 2 2.5 3.2"/>
          <path d="M5 10c1.8-1.8 4.2-2.8 6.8-2.8M17 9.5c.6.5 1.2 1.1 1.6 1.8"/>
          <path d="M9 14a4 4 0 0 1 5.3-.5"/>
          <circle cx="12" cy="18" r="1" fill="#a07850" stroke="none"/>
          <line x1="3" y1="3" x2="21" y2="21" stroke="#d9c4a8" strokeWidth="1.4"/>
        </svg>
      </div>
      <h2 className="text-lg font-bold text-warm-dark mb-2">인터넷 연결을 확인해주세요</h2>
      <p className="text-sm text-warm-light leading-relaxed mb-6">
        네트워크에 연결되어 있지 않아요.<br />연결 후 다시 시도해주세요.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="bg-warm-brown text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-warm-dark transition-colors active:scale-95"
      >
        다시 시도
      </button>
    </div>
  )
}

function ConnectErrorBanner({ message, onRetry, onDismiss }) {
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center gap-3">
      <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <p className="text-xs text-amber-700 flex-1">Supabase 연결 실패 — 데이터 없이 시작합니다</p>
      <button
        onClick={onRetry}
        className="text-xs text-amber-700 font-medium underline hover:no-underline shrink-0"
      >
        재시도
      </button>
      <button onClick={onDismiss} className="text-amber-400 hover:text-amber-600 shrink-0 ml-1">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

function UpdateBanner({ onReload }) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[90] max-w-lg mx-auto px-0 pointer-events-none"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="bg-warm-brown text-white px-4 py-3 flex items-center justify-between shadow-lg pointer-events-auto">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm font-medium">새 버전이 있어요</span>
        </div>
        <button
          onClick={onReload}
          className="text-sm font-semibold underline underline-offset-2 active:opacity-75 transition-opacity"
        >
          새로고침
        </button>
      </div>
    </div>
  )
}

function AppContent() {
  const { user, authLoading, loading, loadError, retryAttempt, reload, joinByCode } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [errorDismissed, setErrorDismissed] = useState(false)
  const [updateReady, setUpdateReady] = useState(false)
  const [tutorialCompleted, setTutorialCompleted] = useState(false)

  // 로그인한 user.id 기반으로 튜토리얼 완료 여부 확인
  useEffect(() => {
    if (user?.id) {
      setTutorialCompleted(!!localStorage.getItem(`tutorial_completed_${user.id}`))
    } else {
      setTutorialCompleted(false)
    }
  }, [user?.id])

  useEffect(() => {
    const goOnline  = () => setIsOffline(false)
    const goOffline = () => setIsOffline(true)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // 재시도 시 배너 다시 표시
  useEffect(() => {
    if (loadError) setErrorDismissed(false)
  }, [loadError])

  // Service Worker 업데이트 감지 (배너 방식)
  // VitePWA sw.js 업데이트만 감지. firebase-messaging-sw.js(FCM)가 같은 scope '/'를
  // 공유하므로 scriptURL로 필터링해 오탐을 근본 차단.
  // 배너 클릭 → SKIP_WAITING → controllerchange → 1회 reload (무한루프 가드 포함)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let isReloading = false

    // SKIP_WAITING 후 새 SW가 control을 잡으면 1회만 reload
    const handleControllerChange = () => {
      if (isReloading) return
      isReloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

    // VitePWA sw.js 인지 확인 — firebase-messaging-sw.js 오탐 방지
    // sw.scriptURL 예: "https://siktakilgi.com/sw.js"
    const isViteSW = (sw) => {
      const url = sw?.scriptURL || ''
      return url.endsWith('/sw.js') || url.includes('/sw.js?')
    }

    const attachUpdateListener = (reg) => {
      if (!reg) return
      // 앱 사용 중 새 SW가 실제로 설치되는 것을 목격했을 때만 배너 표시.
      // 페이지 로드 시점에 이미 존재하는 reg.waiting은 무시 — 즉시 체크 분기 없음.
      const handleUpdateFound = () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          // controller도 sw.js여야 진짜 업데이트 — FCM SW가 controller일 때 오탐 차단
          if (newWorker.state === 'installed'
              && isViteSW(navigator.serviceWorker.controller)
              && isViteSW(newWorker)) {
            setUpdateReady(true)
          }
        })
      }
      reg.addEventListener('updatefound', handleUpdateFound)
    }

    navigator.serviceWorker.ready.then(reg => {
      attachUpdateListener(reg)
    }).catch(() => {})

    // 포그라운드 복귀 시 업데이트 체크 — update()만 호출, waiting 즉시 체크 없음
    // (새 버전 감지는 updatefound → statechange 경로가 담당)
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      navigator.serviceWorker.getRegistration()
        .then(reg => reg?.update())
        .catch(() => {})
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  // /join?code=... 처리: 비로그인 시 코드 저장 → 로그인 후 자동 참가
  useEffect(() => {
    if (authLoading) return
    if (location.pathname !== '/join') return

    const code = new URLSearchParams(location.search).get('code')
    if (!code) {
      navigate('/', { replace: true })
      return
    }

    if (!user) {
      sessionStorage.setItem('pendingJoinCode', code)
      navigate('/', { replace: true })
      return
    }

    // 로그인 상태: URL 먼저 정리 후 자동 참가
    navigate('/', { replace: true })
    ;(async () => {
      try {
        const result = await joinByCode(code)
        if (result) navigate('/spaces', { replace: true })
      } catch {}
    })()
  }, [authLoading, user?.id, location.pathname])

  // 로그인 직후 대기 중인 초대 코드 처리
  useEffect(() => {
    if (!user) return
    const pendingCode = sessionStorage.getItem('pendingJoinCode')
    if (!pendingCode) return
    sessionStorage.removeItem('pendingJoinCode')
    ;(async () => {
      try {
        await joinByCode(pendingCode)
        navigate('/spaces', { replace: true })
      } catch {}
    })()
  }, [user?.id])

  // 배너 "새로고침" 클릭: waiting SW에 SKIP_WAITING → controllerchange → reload
  const handleUpdate = () => {
    setUpdateReady(false)
    navigator.serviceWorker.getRegistration()
      .then(reg => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        } else {
          window.location.reload()
        }
      })
      .catch(() => window.location.reload())
  }

  if (isOffline) return <OfflineBanner />

  if (authLoading || loading) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center bg-cream-50 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-cream-300 border-t-warm-brown animate-spin" />
        <div className="text-center">
          <p className="text-sm font-medium text-warm-dark">
            {authLoading ? '로그인 확인 중...' : retryAttempt === 0 ? '연결 중...' : `재시도 중... (${retryAttempt + 1}/3)`}
          </p>
          {!authLoading && retryAttempt > 0 && (
            <p className="text-xs text-warm-light mt-1">Supabase 서버에 재연결하고 있어요</p>
          )}
        </div>
        {!authLoading && (
          <div className="flex gap-1.5">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  i <= retryAttempt ? 'bg-warm-brown' : 'bg-cream-300'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!user) return <LoginPage />

  if (!tutorialCompleted) {
    return (
      <TutorialFlow
        onComplete={() => {
          localStorage.setItem(`tutorial_completed_${user.id}`, 'true')
          setTutorialCompleted(true)
        }}
      />
    )
  }

  return (
    <div className="min-h-svh max-w-lg mx-auto flex flex-col bg-cream-50">
      {updateReady && <UpdateBanner onReload={handleUpdate} />}

      {loadError && !errorDismissed && (
        <ConnectErrorBanner
          message={loadError}
          onRetry={() => { setErrorDismissed(true); reload() }}
          onDismiss={() => setErrorDismissed(true)}
        />
      )}
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/ingredients" element={<IngredientsPage />} />
          <Route path="/spaces" element={<SpacesPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </main>
      <BottomNav />
      <InstallBanner />
    </div>
  )
}

// /admin/* 경로는 AppProvider와 완전 분리 (일반 앱 상태 불필요)
function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin"       element={<AdminDashboardPage />} />
    </Routes>
  )
}

function RootRouter() {
  const location = useLocation()
  if (location.pathname.startsWith('/admin')) {
    return <AdminRoutes />
  }
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <RootRouter />
    </BrowserRouter>
  )
}
