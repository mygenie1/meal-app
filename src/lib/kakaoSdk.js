// ── 카카오 지도 SDK 로더 ─────────────────────────────────────────────────
// index.html 이 SDK 를 async 로 주입한다(동기 <script> 였을 때는 dapi.kakao.com 응답이
// 늦으면 앱 JS 자체가 실행되지 않아 부팅이 통째로 막혔다 — 국내 인프라라 해외에서 느림).
// 그래서 window.kakao 는 앱 시작 시점에 "아직 없을 수 있다". SDK 를 쓰는 쪽은
// 반드시 이 loadKakaoSdk() 를 await 한 뒤에 window.kakao 를 만져야 한다.
//
// 네이티브(iOS): index.html 이 SDK 를 아예 주입하지 않는다(카카오가 capacitor:// origin 을
// 거부 — 어차피 map-embed iframe 경유). 따라서 여기서는 항상 false 가 되고, 호출부는
// isNative() 분기로 이미 iframe/RPC 를 쓰므로 영향이 없다.
export function loadKakaoSdk() {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.kakao?.maps) return Promise.resolve(true)

  const ready = window.__kakaoSdkReady
  if (!ready) return Promise.resolve(false)

  // 타임아웃으로 false 가 먼저 resolve 됐어도, 그 뒤 늦게 로드됐을 수 있으니 다시 확인
  return ready.then(() => !!window.kakao?.maps)
}
