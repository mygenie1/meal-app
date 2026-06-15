// firebase/messaging은 브라우저 런타임에서만 동적으로 import
// 모듈 최상위에서 즉시 실행하면 Vercel 빌드(Node.js 환경)에서 IndexedDB 등 충돌

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let _messaging = null
let _initDone = false

async function getMessagingInstance() {
  if (_initDone) return _messaging
  _initDone = true

  console.log('[FCM] 초기화 시작')

  if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('[FCM] 환경변수 미설정 — apiKey:', firebaseConfig.apiKey)
    return null
  }

  try {
    const { initializeApp } = await import('firebase/app')
    const { getMessaging } = await import('firebase/messaging')
    const app = initializeApp(firebaseConfig)
    _messaging = getMessaging(app)
    console.log('[FCM] messaging 초기화 완료')
  } catch (e) {
    console.warn('[FCM] messaging 초기화 실패:', e.message)
  }

  return _messaging
}

// 포그라운드 메시지 리스너 등록 (앱이 열려 있을 때)
export async function onFCMMessage(callback) {
  const messaging = await getMessagingInstance()
  if (!messaging) return
  const { onMessage } = await import('firebase/messaging')
  onMessage(messaging, callback)
}

// 푸시 알림 권한 요청 + FCM 토큰 반환
export async function requestFCMToken() {
  console.log('[FCM] requestFCMToken 호출')

  if (!('Notification' in window)) {
    console.warn('[FCM] Notification API 미지원 브라우저')
    return null
  }
  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM] Service Worker 미지원 브라우저')
    return null
  }

  const messaging = await getMessagingInstance()
  if (!messaging) {
    console.warn('[FCM] messaging이 null — 초기화 실패')
    return null
  }

  try {
    console.log('[FCM] 알림 권한 요청')
    const permission = await Notification.requestPermission()
    console.log(`[FCM] 권한 결과: ${permission}`)
    if (permission !== 'granted') return null

    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    await swReg.update()
    console.log('[FCM] SW 등록 완료, scope:', swReg.scope)

    const { getToken } = await import('firebase/messaging')
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
