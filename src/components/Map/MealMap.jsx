import { useState, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApp } from '../../context/AppContext'
import { getThumbUrl } from '../../lib/uploadPhoto'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const TAG_COLORS = {
  집밥: '#86efac',
  외식: '#fcd34d',
  카페: '#f9a8d4',
  배달: '#93c5fd',
}

function makeMealIcon(color, count = 1) {
  const sz = count > 1 ? 22 : 16
  const pad = count > 1 ? 8 : 0
  const badge = count > 1
    ? `<div style="position:absolute;top:-6px;right:-6px;background:#6b4f3a;color:#fff;border-radius:50%;width:14px;height:14px;font-size:8px;display:flex;align-items:center;justify-content:center;font-weight:700;border:1.5px solid #fff">${count}</div>`
    : ''
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${sz + pad}px;height:${sz + pad}px;display:flex;align-items:center;justify-content:center">
      <div style="width:${sz}px;height:${sz}px;background:${color || '#a07850'};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.25)"></div>
      ${badge}
    </div>`,
    iconSize: [sz + pad, sz + pad],
    iconAnchor: [(sz + pad) / 2, (sz + pad) / 2],
  })
}

function makeWishIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="font-size:22px;line-height:1;color:#f43f5e;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">★</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

async function geocode(q) {
  const params = new URLSearchParams({ q, format: 'json', limit: '1', countrycodes: 'kr', 'accept-language': 'ko' })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'Accept-Language': 'ko' } })
  const data = await res.json()
  return data[0] ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null
}

const FILTER_TAGS = ['전체', '외식', '카페', '집밥', '배달']
const ROUND = 1e4
const INPUT_CLS = 'w-full px-4 py-3 rounded-2xl bg-cream-100 border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light transition-colors'

function CloseBtn({ onClick }) {
  return (
    <button onClick={onClick} className="text-cream-400 hover:text-warm-light transition-colors p-1 shrink-0">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}

function MealPinCard({ meal, liveMeal }) {
  const display = liveMeal || meal
  const thumb = getThumbUrl(display.photos?.[0] || display.photo || '')
  return (
    <div className="shrink-0 w-52 rounded-2xl border border-cream-200 bg-white overflow-hidden" style={{ scrollSnapAlign: 'start' }}>
      {thumb && <img src={thumb} alt="" className="w-full h-28 object-cover" />}
      <div className="p-3">
        <p className="text-sm font-semibold text-warm-dark leading-snug truncate">
          {display.title || display.restaurantName || '식사 기록'}
        </p>
        {display.restaurantName && display.title && (
          <p className="text-xs text-warm-light truncate mt-0.5">{display.restaurantName}</p>
        )}
        {display.rating > 0 && (
          <div className="flex gap-0.5 mt-1">
            {[1, 2, 3, 4, 5].map(i => (
              <span key={i} style={{ color: i <= display.rating ? '#c4a882' : '#e5ddd5', fontSize: '13px' }}>★</span>
            ))}
          </div>
        )}
        {display.review && (
          <p className="text-xs text-warm-light mt-1 leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {display.review}
          </p>
        )}
        <p className="text-[10px] text-cream-400 mt-1.5">{display.date}</p>
      </div>
    </div>
  )
}

export default function MealMap() {
  const { currentSpace, addWishlistItem, deleteWishlistItem, cacheGeocoords, loadMealPhotos } = useApp()
  const [pins, setPins] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTag, setActiveTag] = useState('')
  const [showWishlist, setShowWishlist] = useState(true)
  const [bottomSheet, setBottomSheet] = useState(null) // { type: 'cluster'|'wish'|'addWish', ... }
  const [wishForm, setWishForm] = useState({ name: '', location: '', memo: '' })
  const [savingWish, setSavingWish] = useState(false)
  const requestedPhotosRef = useRef(new Set())

  const meals = useMemo(() =>
    (currentSpace?.meals || []).filter(m => m.location),
    [currentSpace?.meals]
  )
  const wishlist = currentSpace?.wishlist || []

  const uncachedKey = meals.filter(m => !m.lat || !m.lng).map(m => m.id).join(',')

  useEffect(() => {
    if (meals.length === 0) { setPins([]); return }
    async function loadPins() {
      setLoading(true)
      const results = await Promise.all(
        meals.map(async meal => {
          if (meal.lat && meal.lng) return { meal, coords: [meal.lat, meal.lng] }
          try {
            const coords = await geocode(meal.location)
            if (coords && currentSpace?.id) cacheGeocoords(currentSpace.id, meal.id, coords[0], coords[1])
            return { meal, coords }
          } catch { return { meal, coords: null } }
        })
      )
      setPins(results.filter(r => r.coords))
      setLoading(false)
    }
    loadPins()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals.length, uncachedKey])

  useEffect(() => {
    meals.forEach(m => {
      if (!m.photosLoaded && !requestedPhotosRef.current.has(m.id)) {
        requestedPhotosRef.current.add(m.id)
        loadMealPhotos(m.id)
      }
    })
  }, [meals.length])

  const filteredPins = activeTag ? pins.filter(p => p.meal.tag === activeTag) : pins

  const clusters = useMemo(() => {
    const map = {}
    filteredPins.forEach(({ meal, coords }) => {
      const key = `${Math.round(coords[0] * ROUND)},${Math.round(coords[1] * ROUND)}`
      if (!map[key]) map[key] = { coords, meals: [] }
      map[key].meals.push(meal)
    })
    return Object.values(map)
  }, [filteredPins])

  const wishWithCoords = wishlist.filter(w => w.lat && w.lng)
  const hasContent = clusters.length > 0 || (showWishlist && wishWithCoords.length > 0)

  const center = clusters.length > 0
    ? clusters[0].coords
    : wishWithCoords.length > 0
      ? [wishWithCoords[0].lat, wishWithCoords[0].lng]
      : [37.5665, 126.9780]

  async function handleSaveWish(e) {
    e.preventDefault()
    if (!wishForm.name.trim()) return
    setSavingWish(true)
    let lat = null, lng = null
    if (wishForm.location.trim()) {
      try {
        const coords = await geocode(wishForm.location)
        if (coords) { lat = coords[0]; lng = coords[1] }
      } catch {}
    }
    await addWishlistItem({ name: wishForm.name.trim(), memo: wishForm.memo.trim(), location: wishForm.location.trim(), lat, lng })
    setWishForm({ name: '', location: '', memo: '' })
    setBottomSheet(null)
    setSavingWish(false)
  }

  function handleDeleteWish(id) {
    if (!window.confirm('이 장소를 삭제할까요?')) return
    deleteWishlistItem(id)
    setBottomSheet(null)
  }

  return (
    <div className="relative">
      {/* 필터 + 가고싶은곳 버튼 */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
        {FILTER_TAGS.map(tag => {
          const isAll = tag === '전체'
          const isActive = isAll ? activeTag === '' : activeTag === tag
          return (
            <button
              key={tag}
              onClick={() => setActiveTag(isAll ? '' : tag)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors active:scale-95 shrink-0 ${
                isActive ? 'bg-warm-brown text-white shadow-sm' : 'bg-cream-100 text-warm-brown border border-cream-200 hover:bg-cream-200'
              }`}
            >
              {TAG_COLORS[tag] && (
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: isActive ? 'rgba(255,255,255,0.7)' : TAG_COLORS[tag] }} />
              )}
              {tag}
            </button>
          )
        })}
        <button
          onClick={() => setShowWishlist(v => !v)}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors active:scale-95 shrink-0 ${
            showWishlist ? 'bg-rose-400 text-white shadow-sm' : 'bg-cream-100 text-rose-400 border border-rose-200 hover:bg-rose-50'
          }`}
        >
          <span>★</span>가고싶은곳
        </button>
        <button
          onClick={() => setBottomSheet({ type: 'addWish' })}
          className="flex items-center gap-1 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap bg-cream-100 text-warm-brown border border-cream-200 hover:bg-cream-200 transition-colors active:scale-95 shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          추가
        </button>
      </div>

      {/* 로딩 오버레이 */}
      {loading && (
        <div className="absolute z-10 flex items-center justify-center bg-cream-50/80 rounded-2xl" style={{ top: '44px', left: 0, right: 0, bottom: 0 }}>
          <p className="text-sm text-warm-light">위치 찾는 중...</p>
        </div>
      )}

      {/* 지도 */}
      <div className="rounded-2xl overflow-hidden shadow-sm" style={{ height: '54vh' }}>
        <MapContainer
          center={center}
          zoom={hasContent ? 12 : 11}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          key={currentSpace?.id}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          {clusters.map((cluster, i) => (
            <Marker
              key={`c-${i}`}
              position={cluster.coords}
              icon={makeMealIcon(TAG_COLORS[cluster.meals[0].tag], cluster.meals.length)}
              eventHandlers={{ click: () => setBottomSheet({ type: 'cluster', cluster }) }}
            />
          ))}
          {showWishlist && wishWithCoords.map(w => (
            <Marker
              key={`w-${w.id}`}
              position={[w.lat, w.lng]}
              icon={makeWishIcon()}
              eventHandlers={{ click: () => setBottomSheet({ type: 'wish', item: w }) }}
            />
          ))}
        </MapContainer>
      </div>

      {/* 바텀 시트 — 클러스터 상세 */}
      {bottomSheet?.type === 'cluster' && (
        <div className="mt-3 bg-white rounded-2xl border border-cream-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <div>
              <p className="text-sm font-semibold text-warm-dark">
                {bottomSheet.cluster.meals[0].restaurantName || bottomSheet.cluster.meals[0].location || '이 위치'}
              </p>
              <p className="text-xs text-warm-light mt-0.5">{bottomSheet.cluster.meals.length}개 식사 기록</p>
            </div>
            <CloseBtn onClick={() => setBottomSheet(null)} />
          </div>
          <div className="flex gap-3 overflow-x-auto pb-4 px-4 scrollbar-hide" style={{ scrollSnapType: 'x mandatory' }}>
            {bottomSheet.cluster.meals.map(meal => {
              const liveMeal = currentSpace?.meals.find(m => m.id === meal.id) ?? meal
              return <MealPinCard key={meal.id} meal={meal} liveMeal={liveMeal} />
            })}
          </div>
        </div>
      )}

      {/* 바텀 시트 — 위시리스트 상세 */}
      {bottomSheet?.type === 'wish' && (
        <div className="mt-3 bg-white rounded-2xl border border-cream-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-rose-400 text-base leading-none">★</span>
                <p className="font-semibold text-warm-dark text-base leading-snug">{bottomSheet.item.name}</p>
              </div>
              {bottomSheet.item.location && (
                <p className="text-xs text-warm-light mb-1.5 flex items-center gap-1">
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
                    <circle cx="12" cy="8" r="2" />
                  </svg>
                  {bottomSheet.item.location}
                </p>
              )}
              {bottomSheet.item.memo && (
                <p className="text-sm text-warm-dark leading-relaxed">{bottomSheet.item.memo}</p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleDeleteWish(bottomSheet.item.id)}
                className="text-xs text-red-400 hover:text-red-500 transition-colors py-1 px-2 rounded-lg hover:bg-red-50"
              >
                삭제
              </button>
              <CloseBtn onClick={() => setBottomSheet(null)} />
            </div>
          </div>
        </div>
      )}

      {/* 바텀 시트 — 가고싶은곳 추가 */}
      {bottomSheet?.type === 'addWish' && (
        <div className="mt-3 bg-white rounded-2xl border border-cream-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-warm-dark">가고 싶은 곳 추가</p>
            <CloseBtn onClick={() => setBottomSheet(null)} />
          </div>
          <form onSubmit={handleSaveWish} className="space-y-3">
            <div>
              <label className="text-xs text-warm-light mb-1.5 block font-medium">장소명 *</label>
              <input
                type="text"
                value={wishForm.name}
                onChange={e => setWishForm(p => ({ ...p, name: e.target.value }))}
                placeholder="어디에 가고 싶으신가요?"
                required
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="text-xs text-warm-light mb-1.5 block font-medium">주소 (지도에 핀 표시)</label>
              <input
                type="text"
                value={wishForm.location}
                onChange={e => setWishForm(p => ({ ...p, location: e.target.value }))}
                placeholder="예: 서울 마포구 연남동"
                className={INPUT_CLS}
              />
            </div>
            <div>
              <label className="text-xs text-warm-light mb-1.5 block font-medium">메모</label>
              <input
                type="text"
                value={wishForm.memo}
                onChange={e => setWishForm(p => ({ ...p, memo: e.target.value }))}
                placeholder="가고 싶은 이유나 메모"
                className={INPUT_CLS}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBottomSheet(null)}
                className="flex-1 py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={savingWish}
                className="flex-1 py-3 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors disabled:opacity-60"
              >
                {savingWish ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 빈 상태 — 지도 위 오버레이 */}
      {!hasContent && !loading && (
        <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: '44px', left: 0, right: 0, height: '54vh' }}>
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-5 text-center shadow-sm">
            <p className="text-sm font-medium text-warm-dark mb-1">아직 등록된 맛집이 없어요</p>
            <p className="text-xs text-warm-light">식사 기록에 위치를 입력하면<br />여기에 나타나요</p>
          </div>
        </div>
      )}

      {/* 필터 결과 없음 */}
      {meals.length > 0 && filteredPins.length === 0 && !loading && (
        <div className="absolute flex flex-col items-center justify-center pointer-events-none" style={{ top: '44px', left: 0, right: 0, height: '54vh' }}>
          <div className="bg-white/90 backdrop-blur-sm rounded-2xl px-6 py-5 text-center shadow-sm">
            <p className="text-sm font-medium text-warm-dark mb-1">해당 태그의 맛집이 없어요</p>
            <p className="text-xs text-warm-light">다른 태그를 선택해보세요</p>
          </div>
        </div>
      )}
    </div>
  )
}
