import { useState, useEffect } from 'react'

const DISMISSED_KEY = 'install_banner_dismissed'

export default function InstallBanner() {
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    // 이미 설치됨 (standalone) 또는 사용자가 닫은 경우 → 표시 안 함
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      localStorage.getItem(DISMISSED_KEY) === 'true'
    ) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
    setIsIOS(ios)

    if (ios) {
      // iOS Safari: 홈화면에 추가 안내
      setShow(true)
    } else {
      // Android Chrome: beforeinstallprompt 이벤트
      const handler = e => {
        e.preventDefault()
        setDeferredPrompt(e)
        setShow(true)
      }
      window.addEventListener('beforeinstallprompt', handler)
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  function handleDismiss() {
    setShow(false)
    localStorage.setItem(DISMISSED_KEY, 'true')
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setDeferredPrompt(null)
  }

  if (!show) return null

  return (
    <div className="fixed bottom-[4.5rem] left-0 right-0 z-[80] flex justify-center px-4 pointer-events-none">
      <div className="bg-warm-dark text-white rounded-2xl shadow-lg px-4 py-3 max-w-sm w-full pointer-events-auto">
        <div className="flex items-start gap-3">
          <img src="/icon-192x192.png" alt="" className="w-10 h-10 rounded-xl shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-tight">식탁일기 앱 설치</p>
            {isIOS ? (
              <p className="text-xs text-cream-300 mt-0.5 leading-relaxed">
                Safari 하단의{' '}
                <svg className="inline w-3.5 h-3.5 mb-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                {' '}버튼 → <strong className="text-white">홈 화면에 추가</strong>
              </p>
            ) : (
              <p className="text-xs text-cream-300 mt-0.5">
                홈화면에 추가하면 앱처럼 사용할 수 있어요
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
        {!isIOS && deferredPrompt && (
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
