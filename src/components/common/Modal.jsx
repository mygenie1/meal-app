import { useEffect, useRef } from 'react'

export default function Modal({ isOpen, onClose, title, children }) {
  // onClose ref — popstate 핸들러가 stale closure를 참조하지 않도록
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  const contentRef = useRef()

  // 모달 열릴 때 내부 스크롤 맨 위로
  useEffect(() => {
    if (isOpen && contentRef.current) contentRef.current.scrollTop = 0
  }, [isOpen])

  // iOS body scroll lock
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY
      document.body.style.position = 'fixed'
      document.body.style.top = `-${scrollY}px`
      document.body.style.width = '100%'
    } else {
      const scrollY = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      if (scrollY) window.scrollTo(0, parseInt(scrollY) * -1)
    }
    return () => {
      const scrollY = document.body.style.top
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      if (scrollY) window.scrollTo(0, parseInt(scrollY) * -1)
    }
  }, [isOpen])

  // 휴대폰 뒤로가기 버튼으로 모달 닫기
  useEffect(() => {
    if (!isOpen) return

    // 모달 열릴 때 히스토리 엔트리 추가 (URL 변경 없음)
    window.history.pushState({ modal: true }, '')

    function handlePopState() {
      onCloseRef.current()
    }

    window.addEventListener('popstate', handlePopState)

    return () => {
      window.removeEventListener('popstate', handlePopState)
      // 뒤로가기가 아닌 정상 닫기의 경우: 쌓인 히스토리 엔트리 제거
      if (window.history.state?.modal) {
        window.history.back()
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        ref={contentRef}
        className="relative z-10 w-full max-w-lg bg-cream-50 rounded-t-2xl sm:rounded-2xl shadow-xl overflow-y-auto"
        style={{ maxHeight: '90dvh', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-cream-200">
            <h2 className="text-base font-semibold text-warm-dark">{title}</h2>
            <button
              onClick={onClose}
              className="text-cream-400 hover:text-warm-brown text-xl leading-none"
            >
              ×
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
