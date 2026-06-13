import { initializeApp } from 'firebase/app'
import { getMessaging, getToken, onMessage } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

let messaging = null
try {
  messaging = getMessaging(app)
} catch (e) {
  // 브라우저가 FCM을 지원하지 않는 경우 (Safari, 구형 브라우저 등)
}

export { messaging, onMessage }

// 푸시 알림 권한 요청 + FCM 토큰 반환
export async function requestFCMToken() {
  if (!messaging) return null
  if (!('Notification' in window)) return null

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    // firebase-messaging-sw.js를 직접 등록하여 Vite PWA의 SW와 충돌 방지
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    })

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })

    return token || null
  } catch (err) {
    console.error('[FCM] 토큰 등록 실패:', err)
    return null
  }
}
