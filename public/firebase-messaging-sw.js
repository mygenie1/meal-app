// Firebase Messaging 서비스워커 — 앱이 꺼져 있을 때 푸시 알림 표시
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyBdt2CKTJp5t1atJ7aFe29KDGVJ7Vw7eOo',
  projectId: 'siktak-ilgi',
  messagingSenderId: '583553438722',
  appId: '1:583553438722:web:e3ab666205d60dfb09031b',
})

// FCM 초기화 — getToken()과의 SW 연결을 위해 필요
// onBackgroundMessage는 사용하지 않음 (push 핸들러로 일원화)
firebase.messaging()

// Android/iOS 통합 백그라운드 알림 핸들러 (W3C 표준 push 이벤트)
//
// Android: FCM SDK가 push 이벤트를 내부 처리하지만,
//   data-only 페이로드 + onBackgroundMessage 콜백 없음
//   → FCM SDK는 showNotification 호출 안 함
//   → 이 핸들러가 showNotification 1회만 호출 (중복 없음)
//
// iOS: APNs → W3C push 이벤트 직접 발생
//   → FCM onBackgroundMessage 경유하지 않음
//   → 이 핸들러가 showNotification 1회 호출 (iOS 표시 복구)
self.addEventListener('push', (event) => {
  let data = {}
  if (event.data) {
    try {
      const payload = event.data.json()
      // FCM v1 data-only 페이로드: { data: { title, body, type, ... } }
      // 또는 일부 환경에서 data 필드 없이 flat하게 올 수 있음
      data = payload.data || payload
    } catch {
      try { data = { body: event.data.text() } } catch { /* ignore */ }
    }
  }

  const origin = self.location.origin
  const title = data.title || '식탁일기'
  const body = data.body || ''

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: `${origin}/icon-192x192.png`,
      badge: `${origin}/notification-icon-192.png`,
      tag: `meal-${data.type || 'notification'}`,
      data,
      requireInteraction: false,
      vibrate: [200, 100, 200],
    })
  )
})

// 알림 클릭 → 앱 포커스 또는 새 탭 열기
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
