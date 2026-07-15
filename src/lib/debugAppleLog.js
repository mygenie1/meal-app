// DEBUG-APPLE — 임시 디버그 로거. Mac 없이 iOS 실기기에서 signInApple() 흐름을 화면으로 확인하기 위한 장치.
// 제거 시: 이 파일 + components/common/DebugAppleOverlay.jsx 삭제, App.jsx의 <DebugAppleOverlay /> 렌더 제거,
// AppContext.jsx 안의 logApple(...) 호출부(// DEBUG-APPLE 마커) 전부 삭제하면 원상복구됨.
import { isNative } from './platform'

// DEBUG-APPLE: false로 바꾸면 오버레이가 즉시 렌더되지 않음(로그 dispatch도 no-op)
export const DEBUG_APPLE_OVERLAY_ENABLED = true

const EVENT_NAME = 'debug-apple-log'

// 네이티브가 아니면 완전히 no-op — 웹/안드로이드 번들 동작에 영향 없음
export function logApple(msg) {
  if (!DEBUG_APPLE_OVERLAY_ENABLED || !isNative()) return
  const time = new Date().toLocaleTimeString('ko-KR', { hour12: false })
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: `${time} ${msg}` }))
}

export function subscribeAppleLog(cb) {
  const handler = (e) => cb(e.detail)
  window.addEventListener(EVENT_NAME, handler)
  return () => window.removeEventListener(EVENT_NAME, handler)
}
