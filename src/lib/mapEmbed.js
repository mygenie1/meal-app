// ── map-embed iframe 공통 상수 + 검색/지오코딩 분기 헬퍼 (Phase 4) ──────────
// iOS(Capacitor)에서 카카오 SDK 가 capacitor:// origin 을 거부하므로, 카카오 등록 도메인
// (www.siktakilgi.com)에서 서빙되는 map-embed.html 을 iframe 으로 임베드해 우회한다.
// ★ iframe src 는 반드시 절대 URL(www) — 상대경로면 capacitor://localhost 로 로드돼 동일하게 막힘.
import { isNative } from './platform'

export const EMBED_ORIGIN = 'https://www.siktakilgi.com'
export const EMBED_URL = `${EMBED_ORIGIN}/map-embed.html`
// 네이티브 WebView 부모 origin — embed 가 응답 targetOrigin 검증에 사용(PARENT_ALLOWLIST 에 등재됨).
export const NATIVE_PARENT_ORIGIN = 'capacitor://localhost'

// 장소 키워드 검색: 네이티브면 embed RPC, 아니면 웹 폴백(기존 searchKakaoPlaces) 그대로.
// 반환 형태(place_name/x/y/place_url/road_address_name…)는 embed normalizePlace 가 카카오 원형 유지.
export async function embedSearch(rpc, query, webFallback) {
  if (isNative() && rpc) {
    try {
      const r = await rpc.search(query)
      return r?.places || []
    } catch {
      return []
    }
  }
  return webFallback(query)
}

// 지오코딩(주소/장소명 → [lat, lng]): embed 엔 forward addressSearch 가 없어 keywordSearch 첫 결과로 근사.
// 웹/안드로이드는 기존 addressSearch 폴백 100% 유지.
export async function embedGeocode(rpc, query, webFallback) {
  if (isNative() && rpc) {
    try {
      const r = await rpc.search(query)
      const p = r?.places?.[0]
      return p ? [parseFloat(p.y), parseFloat(p.x)] : null
    } catch {
      return null
    }
  }
  return webFallback(query)
}
