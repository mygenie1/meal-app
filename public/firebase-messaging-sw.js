// Firebase Messaging 서비스워커 — 앱이 꺼져 있을 때 푸시 알림 표시
// 아래 firebaseConfig 값을 Firebase 콘솔에서 복사한 값으로 교체하세요.
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyBdt2CKTJp5t1atJ7aFe29KDGVJ7Vw7eOo',
  projectId: 'siktak-ilgi',
  messagingSenderId: '583553438722',
  appId: '1:583553438722:web:e3ab666205d60dfb09031b',
})

const messaging = firebase.messaging()

// 백그라운드 메시지 수신 (앱이 닫혀 있거나 백그라운드일 때)
messaging.onBackgroundMessage(payload => {
  const notification = payload.notification || {}
  const data = payload.data || {}

  self.registration.showNotification(notification.title || '식탁일기', {
    body: notification.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: `meal-${data.type || 'notification'}`,
    data,
    requireInteraction: false,
    vibrate: [200, 100, 200],
  })
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
