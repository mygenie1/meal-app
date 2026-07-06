// Firebase Messaging 서비스워커 — 앱이 꺼져 있을 때 푸시 알림 표시
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyBdt2CKTJp5t1atJ7aFe29KDGVJ7Vw7eOo',
  projectId: 'siktak-ilgi',
  messagingSenderId: '583553438722',
  appId: '1:583553438722:web:e3ab666205d60dfb09031b',
})

const messaging = firebase.messaging()

// 알림 아이콘/badge의 절대 origin은 canonical www로 고정.
// self.location.origin이 apex(siktakilgi.com)면 아이콘 요청이 www로 308 리다이렉트되는데,
// 알림 아이콘 fetch는 크로스호스트 리다이렉트를 따라가지 못해 기본 아이콘으로 대체됨.
// send-push Edge Function의 SITE 상수와 동일 도메인으로 통일.
const SITE = 'https://www.siktakilgi.com'

// 빈 핸들러 — FCM SDK가 포그라운드 onMessage 라우팅을 유지하기 위해 필요
// (onBackgroundMessage가 없으면 FCM SDK가 메인 스레드 onMessage를 발동하지 않음)
// 실제 showNotification은 아래 push 핸들러가 담당
messaging.onBackgroundMessage(() => {})

// Android/iOS 통합 백그라운드 알림 핸들러 (W3C 표준 push 이벤트)
//
// 포그라운드 판정: clients.matchAll()에 visible 클라이언트가 있으면
//   AppContext의 onFCMMessage(onMessage 콜백)가 처리 → SW는 showNotification 스킵
//   → 포그라운드 1개 보장
//
// 백그라운드/종료: visible 클라이언트 없음 → SW가 showNotification 1회
//   - Android: FCM SDK는 onBackgroundMessage(빈 함수)만 실행, showNotification 안 함
//   - iOS: APNs → push 이벤트 직접 발생, 이 핸들러가 1회 표시
self.addEventListener('push', (event) => {
  // event.data는 동기적으로 읽어야 함 (waitUntil 내 비동기 후 만료될 수 있음)
  let data = {}
  if (event.data) {
    try {
      const payload = event.data.json()
      // FCM v1 data-only 페이로드: { data: { title, body, type, ... } }
      data = payload.data || payload
    } catch {
      try { data = { body: event.data.text() } } catch { /* ignore */ }
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // 앱이 포그라운드(visible)이면 onFCMMessage(onMessage)가 처리 — SW 스킵
      const hasFocusedClient = clientList.some(c => c.visibilityState === 'visible')
      if (hasFocusedClient) return

      return self.registration.showNotification(data.title || '식탁일기', {
        body: data.body || '',
        icon: `${SITE}/icon-192.png`,
        badge: `${SITE}/notification-icon-192.png`,
        tag: `meal-${data.type || 'notification'}`,
        data,
        requireInteraction: false,
        vibrate: [200, 100, 200],
      })
    })
  )
})

// 알림 클릭 → 해당 게시글로 이동 (meal_id 딥링크)
//  - 기존 창 있으면: focus() + postMessage(OPEN_MEAL) → 앱이 리로드 없이 모달 오픈 (★ 안드로이드)
//  - 기존 창 없으면(콜드스타트): openWindow('/?meal=<id>') → 앱 마운트 시 파라미터로 오픈 (★ iOS)
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const mealId = (event.notification.data && event.notification.data.meal_id) || ''
  const target = mealId ? `/?meal=${mealId}` : '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          if (mealId) client.postMessage({ type: 'OPEN_MEAL', mealId })
          return
        }
      }
      return clients.openWindow(target)
    })
  )
})
