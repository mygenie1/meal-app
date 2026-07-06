import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { isNative } from './lib/platform'
import './index.css'
import App from './App.jsx'

// Service Worker 등록 — 웹(브라우저/PWA)에서만. (vite.config.js injectRegister:null → 여기서 수동 등록)
// 네이티브(Capacitor)에서는 등록 스킵: capacitor://localhost에서 Workbox SW가 stale 프리캐시를
// 서빙하면 앱이 깨질 수 있고, SW/manifest 자체가 네이티브에선 무의미하기 때문.
// registerType:'prompt' — 업데이트 감지는 App.jsx가 자체 처리하므로 콜백은 비워 둠(기존 동작 유지).
if (!isNative()) {
  registerSW()
}

// React 마운트 전에 미리 캡처 — 컴포넌트 마운트 타이밍 레이스 방지
window.__installPrompt = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__installPrompt = e
})
window.addEventListener('appinstalled', () => {
  window.__installPrompt = null
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
