// ── map-embed 숨김 iframe RPC 프로바이더 (Phase 4, 네이티브 전용) ────────────
// iOS 앱에서 검색/지오코딩을 위임할 숨김 iframe 을 앱에 1개 상시 mount 하고,
// createMapEmbedRpc 인스턴스를 context 로 노출한다. MealForm/위시폼이 useMapEmbedRpc() 로 사용.
// ★ 웹/안드로이드(isNative()=false): iframe 없이 children 그대로 통과 → rpc=null → 호출부가 웹 폴백.
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { isNative } from '../../lib/platform'
import { createMapEmbedRpc } from '../../lib/mapEmbedRpc'
import { EMBED_ORIGIN, EMBED_URL, NATIVE_PARENT_ORIGIN } from '../../lib/mapEmbed'

const RpcContext = createContext(null)
export function useMapEmbedRpc() {
  return useContext(RpcContext)
}

export default function MapEmbedRpcProvider({ children }) {
  const iframeRef = useRef(null)
  const [rpc, setRpc] = useState(null)

  useEffect(() => {
    if (!isNative()) return
    const inst = createMapEmbedRpc({
      getTarget: () => iframeRef.current?.contentWindow || null,
      targetOrigin: EMBED_ORIGIN,
      timeout: 8000,
    })
    setRpc(inst)
    return () => inst.destroy()
  }, [])

  // 웹/안드로이드: 래퍼/iframe 없이 children 그대로 (렌더 트리 무변경 → 회귀 0)
  if (!isNative()) return children

  const src = `${EMBED_URL}?parentOrigin=${encodeURIComponent(NATIVE_PARENT_ORIGIN)}`
  return (
    <RpcContext.Provider value={rpc}>
      {children}
      <iframe
        ref={iframeRef}
        src={src}
        title="map-rpc"
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: 'fixed', width: 1, height: 1, left: -9999, top: -9999, border: 'none', opacity: 0, pointerEvents: 'none' }}
      />
    </RpcContext.Provider>
  )
}
