import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

console.log('[FCM] 초기화 시작')

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn('[FCM] 환경변수 미설정 — apiKey:', firebaseConfig.apiKey, 'projectId:', firebaseConfig.projectId)
}

const app = initializeApp(firebaseConfig)

let messaging = null
try {
  messaging = getMessaging(app)
  console.log('[FCM] messaging 초기화 완료')
} catch (e) {
  console.warn('[FCM] messaging 초기화 실패:', e.message)
}

export { messaging, onMessage }

// 푸시 알림 권한 요청 + FCM 토큰 반환
export async function requestFCMToken() {
  console.log('[FCM] requestFCMToken 호출')

  if (!messaging) {
    console.warn('[FCM] messaging이 null — Firebase 초기화 실패 상태')
    return null
  }
  if (!('Notification' in window)) {
    console.warn('[FCM] Notification API 미지원 브라우저')
    return null
  }
  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM] Service Worker 미지원 브라우저')
    return null
  }

  try {
    console.log('[FCM] 알림 권한 요청')
    const permission = await Notification.requestPermission()
    console.log(`[FCM] 권한 결과: ${permission}`)
    if (permission !== 'granted') return null

    // 기본 scope로 등록 — 커스텀 scope는 Service-Worker-Allowed 헤더가 없으면 실패함
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    await swReg.update()
    console.log('[FCM] SW 등록 완료, scope:', swReg.scope)

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })

    if (token) {
      console.log('[FCM] 토큰 발급 성공:', token.substring(0, 30) + '...')
    } else {
      console.warn('[FCM] 토큰이 빈 값 — VAPID 키 또는 SW 설정 확인 필요')
    }

    return token || null
  } catch (err) {
    console.error('[FCM] 토큰 등록 실패:', err)
    return null
  }
}
