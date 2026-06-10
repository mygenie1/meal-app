import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import BottomNav from './components/common/BottomNav'
import HomePage from './pages/HomePage'
import CalendarPage from './pages/CalendarPage'
import MapPage from './pages/MapPage'
import IngredientsPage from './pages/IngredientsPage'
import SpacesPage from './pages/SpacesPage'

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

function AppContent() {
  const { loading, loadError, retryAttempt, reload } = useApp()
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

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

  if (isOffline) return <OfflineBanner />

  if (loading) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center bg-cream-50 gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-cream-300 border-t-warm-brown animate-spin" />
        <div className="text-center">
          <p className="text-sm font-medium text-warm-dark">
            {retryAttempt === 0 ? '연결 중...' : `재시도 중... (${retryAttempt + 1}/3)`}
          </p>
          {retryAttempt > 0 && (
            <p className="text-xs text-warm-light mt-1">Supabase 서버에 재연결하고 있어요</p>
          )}
        </div>
        {/* 재시도 진행 도트 */}
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
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center bg-cream-50 px-8 text-center">
        <div className="w-16 h-16 rounded-full bg-cream-200 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-warm-light" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>
        <p className="font-semibold text-warm-dark mb-2">연결에 실패했어요</p>
        <p className="text-xs text-warm-light mb-1 leading-relaxed">3회 재시도 후에도 연결되지 않았어요.</p>
        <p className="text-[11px] text-cream-400 mb-6 font-mono bg-cream-100 px-3 py-2 rounded-xl max-w-xs break-all">{loadError}</p>
        <button
          onClick={reload}
          className="bg-warm-brown text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-warm-dark transition-colors active:scale-95"
        >
          다시 시도
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-svh max-w-lg mx-auto flex flex-col bg-cream-50">
      <main className="flex-1 flex flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/ingredients" element={<IngredientsPage />} />
          <Route path="/spaces" element={<SpacesPage />} />
        </Routes>
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AppProvider>
  )
}
