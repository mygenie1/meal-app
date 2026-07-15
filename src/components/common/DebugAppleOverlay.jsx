import { useEffect, useState } from 'react'
import { isNative } from '../../lib/platform'
import { DEBUG_APPLE_OVERLAY_ENABLED, subscribeAppleLog } from '../../lib/debugAppleLog'

// DEBUG-APPLE — 임시 화면 로그 오버레이. Mac 없이 iOS 실기기에서 signInApple() 흐름을 눈으로 확인하기 위함.
// 제거 시: 이 파일 삭제 + App.jsx의 <DebugAppleOverlay /> 렌더 제거 + lib/debugAppleLog.js 삭제 +
// AppContext.jsx 안의 logApple(...) 호출부(// DEBUG-APPLE 마커) 삭제.
export default function DebugAppleOverlay() {
  const [lines, setLines] = useState([])

  useEffect(() => {
    if (!isNative() || !DEBUG_APPLE_OVERLAY_ENABLED) return
    return subscribeAppleLog((line) => {
      setLines(prev => [...prev.slice(-39), line])
    })
  }, [])

  if (!isNative() || !DEBUG_APPLE_OVERLAY_ENABLED) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        maxHeight: '42vh',
        overflowY: 'auto',
        background: 'rgba(0,0,0,0.85)',
        color: '#4ade80',
        fontSize: 10,
        lineHeight: 1.45,
        fontFamily: 'monospace',
        padding: '6px 8px',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
        zIndex: 999999,
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      <div style={{ color: '#facc15', marginBottom: 2 }}>[DEBUG-APPLE] 로그인 흐름 로그</div>
      {lines.length === 0
        ? <div style={{ color: '#9ca3af' }}>대기 중...</div>
        : lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  )
}
