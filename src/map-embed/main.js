// ── 카카오맵 iframe 프록시 embed 스크립트 (Phase 1) ─────────────────────────
// 목적: iOS Capacitor(capacitor://localhost)에서 카카오 JS SDK 가 도메인 검증에 막히는 문제를,
//       실제 등록 도메인(www.siktakilgi.com)에서 서빙되는 이 페이지를 iframe 으로 임베드해 우회.
//       iframe 문서 origin = www.siktakilgi.com 이므로 카카오 referer 검증 통과.
//
// Phase 1 범위: 기본 지도 렌더 + init/setPins/panTo 수신 + ready 송신 + 직접 브라우저 테스트(쿼리 파라미터).
//   · 핀 클릭 브릿지 → Phase 2
//   · 검색/역지오코딩 RPC → Phase 3
//   · iOS 앱 연결(isNative 분기) → Phase 4
//
// 이 파일은 React 를 쓰지 않는 vanilla 모듈. 웹/안드로이드 기존 인라인 지도와 무관(신설 페이지).

// 부모(embedder) origin 허용목록 — 이 목록의 origin 에서 온 메시지만 처리.
//   web/안드로이드 TWA = https://www.siktakilgi.com, iOS = capacitor://localhost, 개발 = localhost
const PARENT_ALLOWLIST = [
  'https://www.siktakilgi.com',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:4173',
]

// 기본 중심(서울시청) — init 나 쿼리 파라미터가 없을 때
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 }

const params = new URLSearchParams(location.search)
// 부모가 iframe 생성 시 ?parentOrigin=<origin> 로 자기 origin 전달(응답 targetOrigin 용).
const parentOrigin = params.get('parentOrigin')
const inIframe = window.parent && window.parent !== window

let map = null
let markers = []

// embed → 부모 송신 (iframe 일 때만). targetOrigin 은 허용목록의 parentOrigin, 없으면 '*'
//   (Phase 1 메시지엔 민감정보 없음. Phase 2+ 응답도 스키마 태깅으로 오인 방지)
function post(msg) {
  if (!inIframe) return
  const target = parentOrigin && PARENT_ALLOWLIST.includes(parentOrigin) ? parentOrigin : '*'
  window.parent.postMessage({ v: 1, src: 'siktak-embed', ...msg }, target)
}

function showError() {
  const el = document.getElementById('err')
  if (el) el.style.display = 'flex'
}

function renderMap(center, level) {
  const container = document.getElementById('map')
  map = new window.kakao.maps.Map(container, {
    center: new window.kakao.maps.LatLng(center.lat, center.lng),
    level: level || 5,
  })
  // 컨테이너가 뒤늦게 크기를 잡는 경우 대비
  window.kakao.maps.event.trigger(map, 'resize')
}

function setPins(pins) {
  markers.forEach((m) => m.setMap(null))
  markers = []
  ;(pins || []).forEach((p) => {
    if (p == null || p.lat == null || p.lng == null) return
    const marker = new window.kakao.maps.Marker({
      position: new window.kakao.maps.LatLng(p.lat, p.lng),
      map,
    })
    markers.push(marker)
  })
}

function handleInit(data) {
  renderMap(data.center || DEFAULT_CENTER, data.level)
  if (data.pins) setPins(data.pins)
}

// 부모 → embed 수신
window.addEventListener('message', (e) => {
  if (!PARENT_ALLOWLIST.includes(e.origin)) return
  const d = e.data
  if (!d || d.src !== 'siktak') return // 우리 스키마만 처리(타 스크립트 메시지 무시)
  switch (d.type) {
    case 'init':
      handleInit(d)
      break
    case 'setPins':
      setPins(d.pins)
      break
    case 'panTo':
      if (map) {
        map.panTo(new window.kakao.maps.LatLng(d.lat, d.lng))
        if (d.level) map.setLevel(d.level)
      }
      break
    // userLoc / search / geocode → Phase 2~3
    default:
      break
  }
})

// SDK 로드 후 초기화
function boot() {
  if (!window.kakao || !window.kakao.maps) {
    showError()
    return
  }
  window.kakao.maps.load(() => {
    // 직접 브라우저 테스트: ?lat=..&lng=..&level=.. 로 즉시 렌더 (검증용)
    const lat = parseFloat(params.get('lat'))
    const lng = parseFloat(params.get('lng'))
    const level = parseInt(params.get('level'), 10)
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      renderMap({ lat, lng }, Number.isNaN(level) ? 5 : level)
    } else if (!inIframe) {
      // 파라미터 없이 직접 열면 기본(서울시청) 지도 → "지도 자체가 뜨는지" 확인용
      renderMap(DEFAULT_CENTER, 5)
    }
    // iframe 모드: 부모에 ready 통지 → 부모가 init 전송(Phase 4)
    post({ type: 'ready' })
  })
}

boot()
