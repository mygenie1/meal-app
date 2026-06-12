import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function FullscreenViewer({ photos, initialIndex = 0, onClose }) {
  const [idx, setIdx] = useState(initialIndex)
  const [scale, setScale] = useState(1)
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 })
  const containerRef = useRef()

  // stateRef: 이벤트 핸들러에서 최신 상태 접근 (클로저 stale 방지)
  const st = useRef({ idx: initialIndex, scale: 1, offset: { x: 0, y: 0 } })

  // body 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // ESC 키 닫기
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function goTo(newIdx) {
    if (newIdx < 0 || newIdx >= photos.length) return
    st.current = { idx: newIdx, scale: 1, offset: { x: 0, y: 0 } }
    setIdx(newIdx)
    setScale(1)
    setImgOffset({ x: 0, y: 0 })
  }

  // 터치 이벤트 등록 (touchmove non-passive for e.preventDefault)
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const touch = {
      startX: null,
      startY: null,
      startOffset: { x: 0, y: 0 },
      pinchDist: null,
      startScale: 1,
      fingerCount: 0,
      lastTap: 0,
    }

    function pinchDist(touches) {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    }

    function onStart(e) {
      touch.fingerCount = e.touches.length
      if (e.touches.length === 1) {
        touch.startX = e.touches[0].clientX
        touch.startY = e.touches[0].clientY
        touch.startOffset = { ...st.current.offset }
        touch.pinchDist = null

        // 더블탭 줌 토글
        const now = Date.now()
        if (now - touch.lastTap < 280) {
          if (st.current.scale > 1) {
            st.current.scale = 1
            st.current.offset = { x: 0, y: 0 }
            setScale(1)
            setImgOffset({ x: 0, y: 0 })
          } else {
            st.current.scale = 2.5
            setScale(2.5)
          }
          touch.lastTap = 0
        } else {
          touch.lastTap = now
        }
      } else if (e.touches.length === 2) {
        touch.pinchDist = pinchDist(e.touches)
        touch.startScale = st.current.scale
        touch.startX = null
      }
    }

    function onMove(e) {
      e.preventDefault()
      if (e.touches.length === 2 && touch.pinchDist != null) {
        // 핀치 줌
        const newDist = pinchDist(e.touches)
        const newScale = Math.max(1, Math.min(4, touch.startScale * (newDist / touch.pinchDist)))
        st.current.scale = newScale
        setScale(newScale)
      } else if (e.touches.length === 1 && st.current.scale > 1 && touch.startX != null) {
        // 패닝 (확대 시)
        const dx = e.touches[0].clientX - touch.startX
        const dy = e.touches[0].clientY - touch.startY
        const newOffset = { x: touch.startOffset.x + dx, y: touch.startOffset.y + dy }
        st.current.offset = newOffset
        setImgOffset(newOffset)
      }
    }

    function onEnd(e) {
      // 스와이프 네비게이션 (scale = 1 일 때만)
      if (touch.fingerCount === 1 && touch.startX !== null && st.current.scale <= 1) {
        const dx = e.changedTouches[0].clientX - touch.startX
        if (Math.abs(dx) > 50) {
          const cur = st.current.idx
          if (dx < 0 && cur < photos.length - 1) {
            const next = cur + 1
            st.current = { idx: next, scale: 1, offset: { x: 0, y: 0 } }
            setIdx(next)
            setScale(1)
            setImgOffset({ x: 0, y: 0 })
          } else if (dx > 0 && cur > 0) {
            const next = cur - 1
            st.current = { idx: next, scale: 1, offset: { x: 0, y: 0 } }
            setIdx(next)
            setScale(1)
            setImgOffset({ x: 0, y: 0 })
          }
        }
      }
      if (e.touches.length < 2) {
        touch.pinchDist = null
        touch.startScale = st.current.scale
      }
    }

    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
    }
  }, [photos.length])

  const count = photos.length

  return createPortal(
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* 상단 바: 번호 + 닫기 */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        zIndex: 10,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        paddingTop: 'max(12px, env(safe-area-inset-top))',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.88)', fontSize: '14px', fontWeight: 500 }}>
          {idx + 1} / {count}
        </span>
        <button
          onClick={onClose}
          style={{
            color: '#fff',
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: '50%',
            width: 36, height: 36,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)',
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 이미지 */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <img
          key={idx}
          src={photos[idx]}
          alt={`사진 ${idx + 1}`}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `scale(${scale}) translate(${imgOffset.x / scale}px, ${imgOffset.y / scale}px)`,
            transition: scale === 1 ? 'transform 0.22s ease' : 'none',
            display: 'block',
            pointerEvents: 'none',
            WebkitUserDrag: 'none',
          }}
        />
      </div>

      {/* 하단 도트 인디케이터 */}
      {count > 1 && (
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          padding: '16px',
          paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)',
        }}>
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              style={{
                width: i === idx ? '20px' : '6px',
                height: '6px',
                borderRadius: '9999px',
                background: i === idx ? '#fff' : 'rgba(255,255,255,0.38)',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            />
          ))}
        </div>
      )}
    </div>,
    document.body
  )
}
