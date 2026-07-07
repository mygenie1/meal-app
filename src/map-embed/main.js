// ── 카카오맵 iframe 프록시 embed 스크립트 (Phase 3) ─────────────────────────
// 목적: iOS Capacitor(capacitor://localhost)에서 카카오 JS SDK 가 도메인 검증에 막히는 문제를,
//       실제 등록 도메인(www.siktakilgi.com)에서 서빙되는 이 페이지를 iframe 으로 임베드해 우회.
//       iframe 문서 origin = www.siktakilgi.com 이므로 카카오 referer 검증 통과.
//
// Phase 2 범위: init/setPins → 태그/모드별 핀 렌더, 핀 클릭 → 부모로 {type:'pinClick', id},
//               panTo/userLoc 처리, select 하이라이트.
// Phase 3 범위(추가): 검색/역지오코딩 RPC.
//   요청 {type:'search',  reqId, query}     → 응답 {type:'search:result',  reqId, places:[...]}
//   요청 {type:'geocode', reqId, lat, lng}  → 응답 {type:'geocode:result', reqId, address, road, region}
//   실패 시 동일 result 타입에 error 필드 포함(빈 결과와 구분). reqId 로 부모가 요청↔응답 매칭.
//
// vanilla 모듈(React 미포함). 웹/안드로이드 기존 인라인 지도와 무관(신설 페이지).

// 부모(embedder) origin 허용목록 — 이 목록의 origin 에서 온 메시지만 처리.
const PARENT_ALLOWLIST = [
  'https://www.siktakilgi.com',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:4173',
]

// 태그별 핀 색상 — MealMap.jsx TAG_COLORS 와 동일
const TAG_COLORS = { 집밥: '#2f9e5f', 외식: '#d6862c', 카페: '#d15c87', 배달: '#5276c4' }
// 기본 중심(서울시청)
const DEFAULT_CENTER = { lat: 37.5665, lng: 126.9780 }

const params = new URLSearchParams(location.search)
const parentOrigin = params.get('parentOrigin')
const inIframe = window.parent && window.parent !== window

let map = null
let mode = 'meals' // 'meals' | 'wish' | 'detail'
let pinOverlays = [] // { id, overlay, el, pin }
let userOverlay = null

// embed → 부모 송신 (iframe 일 때만)
function post(msg) {
  if (!inIframe) return
  const target = parentOrigin && PARENT_ALLOWLIST.includes(parentOrigin) ? parentOrigin : '*'
  window.parent.postMessage({ v: 1, src: 'siktak-embed', ...msg }, target)
}

function showError() {
  const el = document.getElementById('err')
  if (el) el.style.display = 'flex'
}

// ── 핀 HTML (MealMap.jsx makePinHTML / makeWishPinHTML 포팅) ──────────────
function makeMealPin(color, selected) {
  const sz = selected ? 24 : 16
  const shadow = selected ? '0 3px 14px rgba(0,0,0,.4)' : '0 2px 6px rgba(0,0,0,.25)'
  const border = selected ? '3px solid white' : '2.5px solid white'
  return `<div style="position:relative;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:4px">
    <div style="width:${sz}px;height:${sz}px;background:${color || '#a07850'};border:${border};border-radius:50%;box-shadow:${shadow}"></div>
  </div>`
}
function makeWishPin(selected) {
  const sz = selected ? 22 : 16
  const shadow = selected ? '0 3px 14px rgba(0,0,0,.4)' : '0 2px 6px rgba(0,0,0,.25)'
  const border = selected ? '3px solid white' : '2.5px solid white'
  const bg = selected ? '#e11d48' : '#fb7185'
  return `<div style="position:relative;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:4px">
    <div style="width:${sz}px;height:${sz}px;background:${bg};border:${border};border-radius:50%;box-shadow:${shadow}"></div>
  </div>`
}

function pinHTML(pin, selected) {
  if (mode === 'wish') return makeWishPin(selected)
  return makeMealPin(TAG_COLORS[pin.tag] || '#a07850', selected)
}

function renderMap(center, level) {
  const container = document.getElementById('map')
  map = new window.kakao.maps.Map(container, {
    center: new window.kakao.maps.LatLng(center.lat, center.lng),
    level: level || 5,
  })
  window.kakao.maps.event.trigger(map, 'resize')
}

function clearPins() {
  pinOverlays.forEach((p) => p.overlay.setMap(null))
  pinOverlays = []
}

function setPins(pins, selectedId) {
  clearPins()
  if (!map) return
  ;(pins || []).forEach((pin) => {
    if (pin == null || pin.lat == null || pin.lng == null) return
    const el = document.createElement('div')
    el.innerHTML = pinHTML(pin, selectedId != null && pin.id === selectedId)
    // 핀 클릭 → 부모로 pinClick 전달 (지도 클릭 이벤트와 분리)
    el.addEventListener('click', (ev) => {
      ev.stopPropagation()
      post({ type: 'pinClick', id: pin.id })
    })
    const overlay = new window.kakao.maps.CustomOverlay({
      position: new window.kakao.maps.LatLng(pin.lat, pin.lng),
      content: el,
      xAnchor: 0.5,
      yAnchor: 0.5,
      zIndex: selectedId != null && pin.id === selectedId ? 15 : 5,
    })
    overlay.setMap(map)
    pinOverlays.push({ id: pin.id, overlay, el, pin })
  })
}

// 선택 하이라이트만 갱신(핀 재전송 없이)
function selectPin(id) {
  pinOverlays.forEach((p) => {
    const selected = p.id === id
    p.el.innerHTML = pinHTML(p.pin, selected)
    p.overlay.setZIndex(selected ? 15 : 5)
    // innerHTML 재설정으로 리스너 소실 → 재바인딩
    const child = p.el.firstElementChild
    if (child) {
      child.addEventListener('click', (ev) => {
        ev.stopPropagation()
        post({ type: 'pinClick', id: p.id })
      })
    }
  })
}

// 내 위치 파란 점 (MealMap userOverlay 스타일)
function setUserLoc(lat, lng) {
  if (userOverlay) { userOverlay.setMap(null); userOverlay = null }
  if (lat == null || lng == null || !map) return
  const el = document.createElement('div')
  el.style.cssText = 'width:14px;height:14px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.25)'
  userOverlay = new window.kakao.maps.CustomOverlay({
    position: new window.kakao.maps.LatLng(lat, lng),
    content: el, xAnchor: 0.5, yAnchor: 0.5, zIndex: 20,
  })
  userOverlay.setMap(map)
}

function handleInit(data) {
  mode = data.mode || 'meals'
  renderMap(data.center || DEFAULT_CENTER, data.level)
  if (data.pins) setPins(data.pins, data.selectedId)
  if (data.userLoc) setUserLoc(data.userLoc.lat, data.userLoc.lng)
}

// ── 검색 / 역지오코딩 RPC (Phase 3) ───────────────────────────────────────
// SDK 는 libraries=services 로 로드됨 → kakao.maps.load 완료 후 services 사용 가능.
// 인스턴스는 지연 생성 후 재사용.
let placesSvc = null
let geocoderSvc = null
function getPlaces() {
  if (!placesSvc) placesSvc = new window.kakao.maps.services.Places()
  return placesSvc
}
function getGeocoder() {
  if (!geocoderSvc) geocoderSvc = new window.kakao.maps.services.Geocoder()
  return geocoderSvc
}
function servicesReady() {
  return !!(window.kakao && window.kakao.maps && window.kakao.maps.services)
}

// 카카오 place 원형 필드만 화이트리스트로 복사(postMessage structured clone 안전 + Phase 4 에서
// 기존 searchKakaoPlaces 소비 형태 place_name/x/y/place_url 그대로 유지).
function normalizePlace(p) {
  return {
    id: p.id,
    place_name: p.place_name,
    category_name: p.category_name,
    category_group_name: p.category_group_name,
    phone: p.phone,
    address_name: p.address_name,
    road_address_name: p.road_address_name,
    x: p.x, // 경도(lng, 문자열)
    y: p.y, // 위도(lat, 문자열)
    place_url: p.place_url,
  }
}

function handleSearch(d) {
  const reqId = d.reqId
  const query = (d.query || '').trim()
  const size = d.size || 5
  if (!query) { post({ type: 'search:result', reqId, places: [], error: 'empty query' }); return }
  if (!servicesReady()) { post({ type: 'search:result', reqId, places: [], error: 'services unavailable' }); return }
  try {
    getPlaces().keywordSearch(query, (result, status) => {
      const S = window.kakao.maps.services.Status
      if (status === S.OK) {
        post({ type: 'search:result', reqId, places: result.slice(0, size).map(normalizePlace) })
      } else if (status === S.ZERO_RESULT) {
        post({ type: 'search:result', reqId, places: [] })
      } else {
        post({ type: 'search:result', reqId, places: [], error: 'status:' + status })
      }
    }, { size })
  } catch (err) {
    post({ type: 'search:result', reqId, places: [], error: String((err && err.message) || err) })
  }
}

function handleGeocode(d) {
  const reqId = d.reqId
  const lat = d.lat, lng = d.lng
  if (lat == null || lng == null) { post({ type: 'geocode:result', reqId, address: null, error: 'no coords' }); return }
  if (!servicesReady()) { post({ type: 'geocode:result', reqId, address: null, error: 'services unavailable' }); return }
  try {
    // ★ coord2Address(x=lng, y=lat, cb) — 인자 순서 경도 먼저.
    getGeocoder().coord2Address(lng, lat, (result, status) => {
      const S = window.kakao.maps.services.Status
      if (status === S.OK && result[0]) {
        const r = result[0]
        const road = r.road_address // 도로명(없을 수 있음)
        const addr = r.address       // 지번
        post({
          type: 'geocode:result', reqId,
          address: (road && road.address_name) || (addr && addr.address_name) || null,
          road: road ? road.address_name : null,
          region: addr ? addr.address_name : null,
        })
      } else {
        post({ type: 'geocode:result', reqId, address: null, error: 'status:' + status })
      }
    })
  } catch (err) {
    post({ type: 'geocode:result', reqId, address: null, error: String((err && err.message) || err) })
  }
}

// 부모 → embed 수신
window.addEventListener('message', (e) => {
  if (!PARENT_ALLOWLIST.includes(e.origin)) return
  const d = e.data
  if (!d || d.src !== 'siktak') return // 우리 스키마만 처리
  switch (d.type) {
    case 'init':
      handleInit(d)
      break
    case 'setPins':
      if (d.mode) mode = d.mode
      setPins(d.pins, d.selectedId)
      break
    case 'select':
      selectPin(d.id)
      break
    case 'panTo':
      if (map) {
        map.panTo(new window.kakao.maps.LatLng(d.lat, d.lng))
        if (d.level) map.setLevel(d.level)
      }
      break
    case 'userLoc':
      setUserLoc(d.lat, d.lng)
      break
    case 'search':
      handleSearch(d)
      break
    case 'geocode':
      handleGeocode(d)
      break
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
    // 직접 브라우저 테스트: ?lat=..&lng=..&level=.. 로 즉시 렌더
    const lat = parseFloat(params.get('lat'))
    const lng = parseFloat(params.get('lng'))
    const level = parseInt(params.get('level'), 10)
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      renderMap({ lat, lng }, Number.isNaN(level) ? 5 : level)
    } else if (!inIframe) {
      renderMap(DEFAULT_CENTER, 5)
    }
    // iframe 모드: 부모에 ready 통지 → 부모가 init 전송
    post({ type: 'ready' })
  })
}

boot()
