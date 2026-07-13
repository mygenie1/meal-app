import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { trackPageView, sanitizePath } from './lib/analytics'
import { isNative } from './lib/platform'
import { supabase } from './lib/supabase'
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
import NotifyBanner from './components/common/NotifyBanner'
import MapEmbedRpcProvider from './components/common/MapEmbedRpcProvider'
import AdminLoginPage from './pages/admin/AdminLoginPage'
import AdminDashboardPage from './pages/admin/AdminDashboardPage'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminSpacesPage from './pages/admin/AdminSpacesPage'
import AdminSpaceDetailPage from './pages/admin/AdminSpaceDetailPage'
import AdminFeedbackPage from './pages/admin/AdminFeedbackPage'
import AdminAdminsPage from './pages/admin/AdminAdminsPage'
import AdminBannersPage from './pages/admin/AdminBannersPage'
import TermsPage from './pages/TermsPage'
import PrivacyPage from './pages/PrivacyPage'
import AccountDeletionPage from './pages/AccountDeletionPage'

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
  const [showGateRetry, setShowGateRetry] = useState(false)

  // 로그인 게이트 스피너가 5초 넘게 돌면 사용자가 직접 빠져나올 수단을 준다.
  // (AppContext 의 워치독이 자동 이탈을 보장하지만, 그전에도 손으로 재시도할 수 있게)
  useEffect(() => {
    if (!(authLoading || loading)) return
    const t = setTimeout(() => setShowGateRetry(true), 5000)
    return () => clearTimeout(t)
  }, [authLoading, loading])

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

  // 푸시 알림 클릭 → 게시글 열기 (warm): SW가 보낸 OPEN_MEAL 메시지를 받아 HomePage로 위임
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const onMsg = (e) => {
      if (e.data?.type === 'OPEN_MEAL' && e.data.mealId) {
        navigate('/', { state: { openMealId: e.data.mealId } })
      }
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [navigate])

  // 푸시 알림 클릭 → 게시글 열기 (cold): /?meal=<id> 콜드스타트 → 라우터 state로 변환 + URL 정리
  useEffect(() => {
    const mealId = new URLSearchParams(location.search).get('meal')
    if (mealId) navigate('/', { replace: true, state: { openMealId: mealId } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 푸시 알림 탭 → 게시글 열기 (네이티브): 웹의 SW notificationclick/postMessage/?meal= 경로가
  // 네이티브엔 없으므로 플러그인 notificationActionPerformed로 처리 (콜드/웜 공통, data.meal_id 딥링크).
  useEffect(() => {
    if (!isNative()) return
    let handle
    import('@capacitor-firebase/messaging').then(({ FirebaseMessaging }) => {
      FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        const mealId = event?.notification?.data?.meal_id
        if (mealId) navigate('/', { state: { openMealId: mealId } })
      }).then((h) => { handle = h })
    })
    return () => { if (handle) handle.remove() }
  }, [navigate])

  // 카카오 OAuth 딥링크 복귀 (네이티브): 커스텀 스킴(com.siktakilgi.app://login-callback)으로
  // 302된 해시 토큰(#access_token&refresh_token)을 파싱 → setSession → onAuthStateChange(SIGNED_IN)
  // → 기존 boot. 웹은 detectSessionInUrl이 처리하므로 이 리스너는 네이티브에서만 등록.
  useEffect(() => {
    if (!isNative()) return
    let handle
    import('@capacitor/app').then(({ App: CapApp }) => {
      CapApp.addListener('appUrlOpen', async ({ url }) => {
        if (!url || !url.startsWith('com.siktakilgi.app://')) return
        // in-app 브라우저 닫기 (실패해도 무시)
        try {
          const { Browser } = await import('@capacitor/browser')
          await Browser.close()
        } catch { /* ignore */ }
        // implicit flow: 토큰이 URL 해시로 실려 옴 (#access_token=...&refresh_token=...)
        const params = new URLSearchParams(url.split('#')[1] || '')
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token })
          if (error) console.error('[OAuth-native] setSession 실패:', error)
        } else {
          // 취소/에러 — 조용히 로그인 화면 유지 (무한 루프 방지). 이메일 로그인이 폴백.
          console.warn('[OAuth-native] 토큰 없음(취소/에러), 로그인 화면 유지')
        }
      }).then((h) => { handle = h })
    })
    return () => { if (handle) handle.remove() }
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

  // /admin 경로는 RootRouter가 처리해야 함.
  // SW 캐시로 이전 번들이 로드된 경우에도 관리자 페이지가 일반 앱 레이아웃에 중첩되지 않도록 방어.
  if (location.pathname.startsWith('/admin')) return null

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

        {/* 이탈 경로 — 스피너에 갇히지 않게 (앱스토어 2.1(a) 재발 방지) */}
        {showGateRetry && (
          <div className="flex flex-col items-center gap-3 mt-4">
            <p className="text-xs text-warm-light">연결이 오래 걸리고 있어요</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-warm-brown text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-warm-dark transition-colors active:scale-95"
            >
              다시 시도
            </button>
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
    <MapEmbedRpcProvider>
    <div className="h-[100svh] max-w-lg mx-auto flex flex-col bg-cream-50 overflow-hidden">
      {updateReady && <UpdateBanner onReload={handleUpdate} />}

      {loadError && !errorDismissed && (
        <ConnectErrorBanner
          message={loadError}
          onRetry={() => { setErrorDismissed(true); reload() }}
          onDismiss={() => setErrorDismissed(true)}
        />
      )}
      {/* 단일 내부 스크롤 컨테이너 — body 문서 스크롤 제거로 iOS 고정 네비바
          컴포지팅 드리프트를 전 탭에서 원천 차단(홈에서 검증된 패턴을 셸로 통일).
          웹/안드로이드엔 표준 내부 스크롤이라 무해. sticky 헤더/무한스크롤/portal 모달 호환. */}
      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col">
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
      {/* 배너 A(설치)는 not-standalone, 배너 B(알림)는 standalone에서만 → 동시 노출 안 됨 */}
      <InstallBanner />
      <NotifyBanner />
    </div>
    </MapEmbedRpcProvider>
  )
}

// /admin/* 경로는 AppProvider와 완전 분리 (일반 앱 상태 불필요)
function AdminRoutes() {
  return (
    <Routes>
      <Route path="/admin/login"         element={<AdminLoginPage />} />
      <Route path="/admin"               element={<AdminDashboardPage />} />
      <Route path="/admin/users"         element={<AdminUsersPage />} />
      <Route path="/admin/spaces"        element={<AdminSpacesPage />} />
      <Route path="/admin/spaces/:id"    element={<AdminSpaceDetailPage />} />
      <Route path="/admin/feedback"       element={<AdminFeedbackPage />} />
      <Route path="/admin/admins"           element={<AdminAdminsPage />} />
      <Route path="/admin/banners"         element={<AdminBannersPage />} />
    </Routes>
  )
}

// /terms, /privacy, /account-deletion 경로는 AppProvider·인증 불필요 (비로그인 접근 보장)
function PublicRoutes() {
  return (
    <Routes>
      <Route path="/terms"   element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/account-deletion" element={<AccountDeletionPage />} />
    </Routes>
  )
}

function RootRouter() {
  const location = useLocation()
  if (location.pathname.startsWith('/admin')) {
    return <AdminRoutes />
  }
  if (location.pathname === '/terms' || location.pathname === '/privacy' || location.pathname === '/account-deletion') {
    return <PublicRoutes />
  }
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}

// GA4 SPA 라우트 추적: location 변경마다 page_view 1건 전송.
// 최초 마운트 때도 1회 전송(초기 페이지뷰) + 정제 경로 기준 연속 중복 제거.
function GAListener() {
  const location = useLocation()
  const lastPath = useRef(null)
  useEffect(() => {
    const path = sanitizePath(location.pathname, location.search)
    if (path === lastPath.current) return // ?meal= 제거 후 동일 경로 재진입 등 연속 중복 차단
    lastPath.current = path
    trackPageView(location.pathname, location.search)
  }, [location.pathname, location.search])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <GAListener />
      <RootRouter />
    </BrowserRouter>
  )
}
