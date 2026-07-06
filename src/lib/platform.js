// Capacitor 네이티브(iOS/Android 앱) 여부 판별 유틸.
// 웹(브라우저/PWA)에서는 항상 false → 기존 웹 동작 100% 유지.
// 네이티브(capacitor://localhost)에서만 true → 웹 전용 기능(SW 등록/웹푸시/설치배너) 스킵.
import { Capacitor } from '@capacitor/core'

export function isNative() {
  return Capacitor.isNativePlatform()
}
