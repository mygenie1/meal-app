// ── map-embed 지도 iframe 뷰 (Phase 4, 네이티브 전용 렌더) ───────────────────
// iOS 앱에서 인라인 kakao.maps.Map 대신 이 iframe 을 렌더한다. 선언형 props(pins/userLoc/
// fly/selectedId) → postMessage(init/setPins/userLoc/panTo/select)로 매핑, pinClick 수신 → onPinClick.
// ★ 호출측에서 isNative() 분기로만 사용. 웹/안드로이드는 이 컴포넌트를 렌더하지 않음.
import { useEffect, useRef } from 'react'
import { EMBED_ORIGIN, EMBED_URL, NATIVE_PARENT_ORIGIN } from '../../lib/mapEmbed'

export default function MapEmbedView({
  mode = 'meals',
  pins = [],
  userLoc,       // [lat, lng] | null
  center,        // { lat, lng } | undefined
  level,         // number | undefined
  fly,           // [lat, lng] | null — panTo 트리거
  selectedId,    // 하이라이트할 핀 id
  onPinClick,    // (id) => void
  onBoundsChange, // ({swLat,swLng,neLat,neLng}) => void — 지도 이동/줌 종료 시 보이는 영역
  style,
  className,
}) {
  const iframeRef = useRef(null)
  const readyRef = useRef(false)
  // ready 핸들러가 최신 props 로 init 하도록 ref 로 보관(리스너는 1회 등록이라 stale closure 회피)
  const stateRef = useRef({})
  stateRef.current = { mode, pins, userLoc, center, level, selectedId }
  const onPinClickRef = useRef(onPinClick)
  onPinClickRef.current = onPinClick
  const onBoundsChangeRef = useRef(onBoundsChange)
  onBoundsChangeRef.current = onBoundsChange

  function post(msg) {
    const w = iframeRef.current?.contentWindow
    if (w && readyRef.current) w.postMessage({ v: 1, src: 'siktak', ...msg }, EMBED_ORIGIN)
  }

  // 수신: ready → init(최신 props), pinClick → 콜백.
  // ★ e.source 로 "자기 iframe" 메시지만 처리 — 지도/숨김 RPC iframe 다중 공존 시 격리 필수.
  useEffect(() => {
    function onMsg(e) {
      if (e.origin !== EMBED_ORIGIN) return
      if (e.source !== iframeRef.current?.contentWindow) return
      const d = e.data
      if (!d || d.src !== 'siktak-embed') return
      if (d.type === 'ready') {
        readyRef.current = true
        const s = stateRef.current
        iframeRef.current?.contentWindow?.postMessage({
          v: 1, src: 'siktak', type: 'init',
          mode: s.mode,
          center: s.center,
          level: s.level,
          pins: s.pins,
          userLoc: s.userLoc ? { lat: s.userLoc[0], lng: s.userLoc[1] } : undefined,
          selectedId: s.selectedId,
        }, EMBED_ORIGIN)
      } else if (d.type === 'pinClick') {
        onPinClickRef.current?.(d.id)
      } else if (d.type === 'boundsChanged') {
        if (d.bounds) onBoundsChangeRef.current?.(d.bounds)
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // prop 동기화 (ready 전엔 post 가 no-op → 초기값은 ready 시 init 이 담당)
  useEffect(() => { post({ type: 'setPins', mode, pins, selectedId }) }, [pins, mode]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { post({ type: 'select', id: selectedId }) }, [selectedId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (userLoc) post({ type: 'userLoc', lat: userLoc[0], lng: userLoc[1] }) }, [userLoc]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (fly) post({ type: 'panTo', lat: fly[0], lng: fly[1], level: 5 }) }, [fly]) // eslint-disable-line react-hooks/exhaustive-deps

  const src = `${EMBED_URL}?parentOrigin=${encodeURIComponent(NATIVE_PARENT_ORIGIN)}`
  return (
    <iframe
      ref={iframeRef}
      src={src}
      title="지도"
      className={className}
      style={{ border: 'none', width: '100%', height: '100%', ...style }}
    />
  )
}
