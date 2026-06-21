import { useState, useEffect } from 'react'

const DISMISS_UNTIL_KEY = 'install_banner_dismissed_until'   // 재노출 억제 만료 timestamp(ms)
const SUPPRESS_DAYS = 7

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function isIOSSafari() {
  const ua = navigator.userAgent
  return /iphone|ipad|ipod/i.test(ua) && !/crios|fxios|opios|mercury/i.test(ua)
}

export default function InstallBanner() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [prompt, setPrompt] = useState(null)

  useEffect(() => {
    if (isStandalone()) return
    if (Date.now() < Number(localStorage.getItem(DISMISS_UNTIL_KEY) || 0)) return

    if (isIOSSafari()) {
      setIsIOS(true)
      setShow(true)
      return
    }

    // Android Chrome 등: main.jsx에서 조기 캡처한 prompt 사용
    const captured = window.__installPrompt
    if (captured) {
      setPrompt(captured)
      setShow(true)
      return
    }

    // 아직 캡처 전이면 커스텀 이벤트로 대기 (드물지만 안전망)
    const handler = (e) => {
      e.preventDefault()
      window.__installPrompt = e
      setPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function handleDismiss() {
    setShow(false)
    localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + SUPPRESS_DAYS * 24 * 60 * 60 * 1000))
  }

  async function handleInstall() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setShow(false)
      window.__installPrompt = null
    }
    setPrompt(null)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-[4.5rem] left-0 right-0 z-[80] flex justify-center px-4 pointer-events-none">
      <div className="bg-warm-dark text-white rounded-2xl shadow-lg px-4 py-3 max-w-sm w-full pointer-events-auto">
        <div className="flex items-start gap-3">
          <img src="/icon-192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">식탁일기 앱 설치</p>
            {isIOS ? (
              <p className="text-xs text-cream-300 mt-0.5 leading-relaxed">
                Safari 하단{' '}
                <svg className="inline w-3.5 h-3.5 mb-0.5 align-middle" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {' '}→ <strong className="text-white">홈 화면에 추가</strong>
              </p>
            ) : (
              <p className="text-xs text-cream-300 mt-0.5">
                홈 화면에 추가하면 앱처럼 쓰고 알림도 받을 수 있어요
              </p>
            )}
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
        {!isIOS && prompt && (
          <button
            onClick={handleInstall}
            className="mt-2.5 w-full bg-warm-brown text-white text-sm font-semibold py-2 rounded-xl hover:bg-warm-light transition-colors active:scale-95"
          >
            설치하기
          </button>
        )}
      </div>
    </div>
  )
}
