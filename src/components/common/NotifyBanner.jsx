import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'

// 배너 B — 설치한 PWA(standalone) 사용자에게 알림 켜기 유도.
// 배너 A(InstallBanner)는 not-standalone에서만 뜨므로 standalone 분기로 서로 배타.
const DISMISS_UNTIL_KEY = 'notify_banner_dismissed_until'   // 재노출 억제 만료 timestamp(ms)
const SUPPRESS_DAYS = 7

function isStandalone() {
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
}

export default function NotifyBanner() {
  const { user, registerFCMToken } = useApp()
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    if (!isStandalone()) return                                   // standalone에서만 (배너 A와 배타)
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return  // 푸시 지원 환경만
    if (Notification.permission !== 'default') return             // granted/denied면 안 뜸
    const until = Number(localStorage.getItem(DISMISS_UNTIL_KEY) || 0)
    if (Date.now() < until) return                                // 억제 기간 내면 숨김
    setShow(true)
  }, [])

  function suppress() {
    localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + SUPPRESS_DAYS * 24 * 60 * 60 * 1000))
  }

  // 거절/닫기 → 안내 문구 잠깐 표시 후 닫기 + 7일 억제
  function handleDismiss() {
    suppress()
    setToast('나중에 설정 > 알림 받기에서 켤 수 있어요')
    setTimeout(() => setShow(false), 2200)
  }

  async function handleEnable() {
    if (!user) return
    setBusy(true)
    const res = await registerFCMToken(user.id, { prompt: true })   // ★ 제스처 컨텍스트(권한/토큰 등록 재사용)
    setBusy(false)
    if (res?.ok) {
      setShow(false)                                                 // 성공 → 배너 사라짐
    } else {
      suppress()
      setToast('나중에 설정 > 알림 받기에서 켤 수 있어요')           // 거부/실패 안내
      setTimeout(() => setShow(false), 2200)
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-[4.5rem] left-0 right-0 z-[80] flex justify-center px-4 pointer-events-none">
      <div className="bg-warm-dark text-white rounded-2xl shadow-lg px-4 py-3 max-w-sm w-full pointer-events-auto">
        {toast ? (
          <p className="text-xs text-cream-200 leading-relaxed py-0.5">{toast}</p>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-warm-brown flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">알림 받기</p>
                <p className="text-xs text-cream-300 mt-0.5 leading-relaxed">새 댓글·기록·별점 알림을 받아보세요</p>
              </div>
              <button
                onClick={handleDismiss}
                className="text-cream-400 hover:text-white transition-colors shrink-0 mt-0.5"
                aria-label="닫기"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <button
              onClick={handleEnable}
              disabled={busy}
              className="mt-2.5 w-full bg-warm-brown text-white text-sm font-semibold py-2 rounded-xl hover:bg-warm-light transition-colors active:scale-95 disabled:opacity-60"
            >
              {busy ? '요청 중...' : '알림 켜기'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
