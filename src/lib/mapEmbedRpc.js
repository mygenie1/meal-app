// ── map-embed iframe RPC 클라이언트 (Phase 3) ─────────────────────────────
// 부모(앱 또는 테스트 하네스) ↔ /map-embed.html iframe 사이의 검색/역지오코딩 요청을
// reqId nonce 매칭 + 타임아웃으로 Promise 로 감싼다.
//
//   rpc.search(query, {size})  → Promise<{ places:[...], error? }>
//   rpc.geocode(lat, lng)      → Promise<{ address, road, region, error? }>
//
// 응답은 embed 가 { src:'siktak-embed', type:'search:result'|'geocode:result', reqId, ... } 로 보냄.
// 타임아웃 시 reject, embed 가 error 필드를 담아 보내면 resolve 된 객체의 .error 로 노출(빈 결과와 구분).
//
// ★ Phase 3 에서는 앱에 상시 mount 하지 않는다 — map-embed-test.html 하네스에서만 검증.
//   Phase 4 에서 숨김 iframe 을 상시 mount 하고 isNative() 분기로 MealForm/위시폼에 연결 예정.

const RESULT_TYPE = {
  search: 'search:result',
  geocode: 'geocode:result',
}

function makeReqId(type) {
  // 브라우저 런타임 — Math.random 로 충분(충돌 무시 가능). crypto 있으면 더 안전.
  const rand = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10)
  return `${type}-${Date.now().toString(36)}-${rand}`
}

/**
 * @param {object}   opts
 * @param {() => (Window|null)} opts.getTarget  응답 대상 iframe contentWindow 를 반환(지연 평가 — mount 전엔 null).
 * @param {string}   opts.targetOrigin          postMessage targetOrigin + 수신 origin 검증(예: location.origin).
 * @param {number}  [opts.timeout=8000]         응답 타임아웃(ms).
 */
export function createMapEmbedRpc({ getTarget, targetOrigin, timeout = 8000 } = {}) {
  const pending = new Map() // reqId → { resolve, timer, resultType }

  function onMessage(e) {
    if (targetOrigin && e.origin !== targetOrigin) return
    const d = e.data
    if (!d || d.src !== 'siktak-embed' || d.reqId == null) return
    const entry = pending.get(d.reqId)
    if (!entry || d.type !== entry.resultType) return
    clearTimeout(entry.timer)
    pending.delete(d.reqId)
    entry.resolve(d)
  }
  window.addEventListener('message', onMessage)

  function call(type, payload) {
    const target = typeof getTarget === 'function' ? getTarget() : null
    if (!target) return Promise.reject(new Error('map-embed iframe not ready'))
    const resultType = RESULT_TYPE[type]
    const reqId = makeReqId(type)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(reqId)
        reject(new Error(`map-embed ${type} timeout (${timeout}ms)`))
      }, timeout)
      pending.set(reqId, { resolve, timer, resultType })
      target.postMessage({ v: 1, src: 'siktak', type, reqId, ...payload }, targetOrigin || '*')
    })
  }

  return {
    /** 키워드 검색 → { places, error? } */
    search: (query, opts = {}) => call('search', { query, size: opts.size }),
    /** 좌표 → 주소 역지오코딩 → { address, road, region, error? } */
    geocode: (lat, lng) => call('geocode', { lat, lng }),
    /** 리스너 해제 + 대기 중 요청 정리(iframe unmount 시 호출). */
    destroy() {
      window.removeEventListener('message', onMessage)
      pending.forEach((e) => {
        clearTimeout(e.timer)
        e.resolve({ error: 'rpc destroyed' })
      })
      pending.clear()
    },
  }
}
