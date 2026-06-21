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
    const { getMessaging, isSupported } = await import('firebase/messaging')
    // 비지원 환경(예: iOS 일반 Safari 탭, 일부 브라우저)에서 getMessaging throw 방지
    const supported = await isSupported().catch(() => false)
    if (!supported) {
      console.warn('[FCM] 이 환경은 FCM 웹푸시 미지원 (isSupported=false)')
      return null
    }
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
// ★ prompt: true 일 때만 Notification.requestPermission() 호출 (iOS는 사용자 제스처 안에서만 허용)
//   prompt: false (부팅) → 이미 granted면 토큰만 조용히 발급, default면 프롬프트 없이 대기
// 반환: { token, permission, reason } — 화면 로그/판별용
export async function requestFCMToken({ prompt = false } = {}) {
  console.log('[FCM] requestFCMToken 호출, prompt:', prompt)

  if (!('Notification' in window)) {
    console.warn('[FCM] Notification API 미지원 브라우저')
    return { token: null, permission: 'unsupported', reason: 'no-notification-api' }
  }
  if (!('serviceWorker' in navigator)) {
    console.warn('[FCM] Service Worker 미지원 브라우저')
    return { token: null, permission: 'unsupported', reason: 'no-sw' }
  }

  const messaging = await getMessagingInstance()
  if (!messaging) {
    console.warn('[FCM] messaging이 null — 미지원/초기화 실패')
    return { token: null, permission: Notification.permission, reason: 'messaging-null' }
  }

  try {
    let permission = Notification.permission
    if (permission === 'default') {
      if (!prompt) {
        // iOS는 제스처 밖 자동 요청을 차단 → 버튼 탭을 기다림 (자동 프롬프트 안 함)
        console.log('[FCM] 권한 미결정 + 자동요청 안 함(버튼 탭 대기)')
        return { token: null, permission, reason: 'needs-gesture' }
      }
      console.log('[FCM] 알림 권한 요청 (사용자 제스처)')
      permission = await Notification.requestPermission()
      console.log(`[FCM] 권한 결과: ${permission}`)
    }
    if (permission !== 'granted') {
      return { token: null, permission, reason: permission === 'denied' ? 'denied' : 'not-granted' }
    }

    // 전용 스코프로 등록 — Workbox(vite-plugin-pwa) sw.js가 scope '/'를 점유하므로
    // 같은 scope '/'에 FCM SW를 등록하면 단일 registration 슬롯을 두고 충돌함.
    // (Workbox skipWaiting:false + clientsClaim:true → Workbox가 계속 active,
    //  FCM SW는 waiting에 머물러 push 이벤트가 핸들러 없는 sw.js로 전달되어 폐기)
    // FCM 관례 스코프('/firebase-cloud-messaging-push-scope', '/'보다 좁아 허용)에
    // 별도 registration을 만들어 충돌을 원천 제거. getToken에도 이 registration을 전달.
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/firebase-cloud-messaging-push-scope',
    })
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

    return { token: token || null, permission, reason: token ? 'ok' : 'empty-token' }
  } catch (err) {
    console.error('[FCM] 토큰 등록 실패:', err)
    return { token: null, permission: Notification.permission, reason: 'error' }
  }
}
