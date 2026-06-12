import { useState, useEffect, useMemo, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApp } from '../../context/AppContext'
import { getThumbUrl, uploadPhotoToStorage } from '../../lib/uploadPhoto'
import MealDetailModal from '../MealRecord/MealDetailModal'
import Modal from '../common/Modal'
import MealForm from '../MealRecord/MealForm'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const TAG_COLORS = { 집밥: '#86efac', 외식: '#fcd34d', 카페: '#f9a8d4', 배달: '#93c5fd' }
const FILTER_TAGS = ['전체', '외식', '카페']
const ROUND = 1e4
const INPUT_CLS = 'w-full px-4 py-3 rounded-2xl bg-cream-100 border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light transition-colors'

const WISH_CATEGORIES = ['한식', '일식', '양식', '중식', '카페', '기타']
const WISH_CATEGORY_COLORS = {
  한식: '#fca5a5', 일식: '#93c5fd', 양식: '#86efac',
  중식: '#fcd34d', 카페: '#f9a8d4', 기타: '#d1b89a',
}
const MOOD_TAGS = ['🔥 핫플', '💕 로맨틱', '🌿 힐링', '📸 인생샷', '✨ 특별한 날']
const EMPTY_WISH_FORM = { name: '', location: '', memo: '', moodTags: [] }

// ── 아이콘 팩토리 ──────────────────────────────────────────────

function makeMealIcon(color, count = 1, selected = false) {
  const sz = selected ? (count > 1 ? 30 : 24) : (count > 1 ? 22 : 16)
  const pad = count > 1 ? 8 : 0
  const total = sz + pad
  const border = selected ? '3px solid white' : '2.5px solid white'
  const shadow = selected ? '0 3px 14px rgba(0,0,0,.4)' : '0 2px 6px rgba(0,0,0,.25)'
  const badge = count > 1
    ? `<div style="position:absolute;top:-6px;right:-6px;background:#6b4f3a;color:#fff;border-radius:50%;width:14px;height:14px;font-size:8px;display:flex;align-items:center;justify-content:center;font-weight:700;border:1.5px solid #fff">${count}</div>`
    : ''
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${total}px;height:${total}px;display:flex;align-items:center;justify-content:center">
      <div style="width:${sz}px;height:${sz}px;background:${color || '#a07850'};border:${border};border-radius:50%;box-shadow:${shadow}"></div>
      ${badge}
    </div>`,
    iconSize: [total, total],
    iconAnchor: [total / 2, total / 2],
  })
}

function makeWishIcon(category, visited = false) {
  if (visited) {
    return L.divIcon({
      className: '',
      html: `<div style="width:20px;height:20px;background:#9ca3af;border:2.5px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25)">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    })
  }
  const fill = WISH_CATEGORY_COLORS[category] || '#f43f5e'
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.28))">
      <svg width="26" height="26" viewBox="0 0 24 24" fill="${fill}" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  })
}

function makeUserIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.25)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

async function geocode(q) {
  const params = new URLSearchParams({ q, format: 'json', limit: '1', countrycodes: 'kr', 'accept-language': 'ko' })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { 'Accept-Language': 'ko' } })
  const data = await res.json()
  return data[0] ? [parseFloat(data[0].lat), parseFloat(data[0].lon)] : null
}

function FlyTo({ coords }) {
  const map = useMap()
  useEffect(() => {
    if (coords) map.flyTo(coords, 15, { duration: 1.2 })
  }, [coords?.[0], coords?.[1]])
  return null
}

// ── 서브 컴포넌트 ──────────────────────────────────────────────

function CloseBtn({ onClick }) {
  return (
    <button onClick={onClick} className="text-cream-400 hover:text-warm-light transition-colors p-1 shrink-0">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  )
}

function MealPinCard({ meal, liveMeal, onClick }) {
  const display = liveMeal || meal
  const thumb = getThumbUrl(display.photos?.[0] || display.photo || '')
  return (
    <div
      className="shrink-0 w-52 rounded-2xl border border-cream-200 bg-white overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
      style={{ scrollSnapAlign: 'start' }}
      onClick={onClick}
    >
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
            {[1,2,3,4,5].map(i => (
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

function WishCard({ item, onClick }) {
  const catColor = WISH_CATEGORY_COLORS[item.category]
  return (
    <div
      className="shrink-0 w-44 rounded-2xl border border-cream-200 bg-white overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
      style={{ scrollSnapAlign: 'start' }}
      onClick={onClick}
    >
      {item.photo ? (
        <img src={item.photo} alt="" className="w-full h-24 object-cover" />
      ) : (
        <div className="w-full h-24 bg-cream-100 flex items-center justify-center">
          <svg className="w-7 h-7 text-cream-300" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </div>
      )}
      <div className="p-3">
        <div className="flex items-center gap-1 flex-wrap mb-1">
          {item.visited && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-semibold border border-green-200 shrink-0">방문완료</span>
          )}
          {item.category && catColor && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-warm-dark shrink-0" style={{ background: catColor }}>
              {item.category}
            </span>
          )}
        </div>
        <p className="text-sm font-semibold text-warm-dark leading-snug truncate">{item.name}</p>
        {item.location && <p className="text-[10px] text-cream-400 mt-0.5 truncate">{item.location}</p>}
        {item.priceRange && <p className="text-[10px] text-warm-light mt-1">{item.priceRange}</p>}
        {item.moodTags?.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {item.moodTags.slice(0, 2).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-cream-100 text-warm-light">{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────

export default function MealMap() {
  const { currentSpace, addMeal, addWishlistItem, updateWishlistItem, deleteWishlistItem, cacheGeocoords, loadMealPhotos } = useApp()

  // 식사 핀
  const [pins, setPins] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeTag, setActiveTag] = useState('')

  // 위시리스트
  const [showWishlist, setShowWishlist] = useState(true)
  const [activeWishCategory, setActiveWishCategory] = useState('')

  // 바텀시트
  const [bottomSheet, setBottomSheet] = useState(null) // 'cluster'|'wish'|'addWish'

  // 상세 모달
  const [viewingMeal, setViewingMeal] = useState(null)

  // 방문 플로우
  const [visitingWish, setVisitingWish] = useState(null)

  // 현재 위치
  const [userLocation, setUserLocation] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [locating, setLocating] = useState(false)

  // 위시 추가 폼
  const [wishForm, setWishForm] = useState(EMPTY_WISH_FORM)
  const [savingWish, setSavingWish] = useState(false)
  const [wishPhotoPreview, setWishPhotoPreview] = useState('')
  const wishPhotoRef = useRef()

  const requestedPhotosRef = useRef(new Set())

  const meals = useMemo(() =>
    (currentSpace?.meals || []).filter(m => m.location),
    [currentSpace?.meals]
  )
  const wishlist = currentSpace?.wishlist || []

  const uncachedKey = meals.filter(m => !m.lat || !m.lng).map(m => m.id).join(',')

  // 식사 핀 지오코딩 로드
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

  const selectedClusterKey = useMemo(() => {
    if (bottomSheet?.type !== 'cluster') return null
    const [lat, lng] = bottomSheet.cluster.coords
    return `${Math.round(lat * ROUND)},${Math.round(lng * ROUND)}`
  }, [bottomSheet])

  // 위시리스트 필터링
  const filteredWish = useMemo(() => {
    const base = activeWishCategory
      ? wishlist.filter(w => w.category === activeWishCategory)
      : wishlist
    return [...base].sort((a, b) => {
      if (a.visited && !b.visited) return 1
      if (!a.visited && b.visited) return -1
      return 0
    })
  }, [wishlist, activeWishCategory])

  const wishWithCoords = filteredWish.filter(w => w.lat && w.lng)
  const hasContent = clusters.length > 0 || (showWishlist && wishWithCoords.length > 0)

  const center = clusters.length > 0
    ? clusters[0].coords
    : wishWithCoords.length > 0
      ? [wishWithCoords[0].lat, wishWithCoords[0].lng]
      : [37.5665, 126.9780]

  // ── 핸들러 ──────────────────────────────────────────────────

  function handleLocate() {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = [pos.coords.latitude, pos.coords.longitude]
        setUserLocation(coords)
        setFlyTarget(coords)
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  }

  function handleWishPhotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setWishPhotoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

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

    let photoUrl = ''
    if (wishPhotoPreview) {
      photoUrl = await uploadPhotoToStorage(wishPhotoPreview, currentSpace?.id)
    }

    await addWishlistItem({
      name: wishForm.name.trim(),
      memo: wishForm.memo.trim(),
      location: wishForm.location.trim(),
      lat, lng,
      moodTags: wishForm.moodTags,
      photo: photoUrl,
    })

    setWishForm(EMPTY_WISH_FORM)
    setWishPhotoPreview('')
    setBottomSheet(null)
    setSavingWish(false)
  }

  function handleDeleteWish(id) {
    if (!window.confirm('이 장소를 삭제할까요?')) return
    deleteWishlistItem(id)
    setBottomSheet(null)
  }

  function handleVisitWish(item) {
    setBottomSheet(null)
    setVisitingWish(item)
  }

  async function handleVisitSubmit(mealData) {
    const meal = await addMeal(mealData)
    if (meal && visitingWish?.id) {
      await updateWishlistItem(visitingWish.id, {
        visited: true,
        visitedAt: new Date().toISOString().split('T')[0],
      })
    }
    setVisitingWish(null)
  }

  // ── 렌더 ──────────────────────────────────────────────────────

  return (
    <div className="relative">
      {/* 식사 태그 필터 + 위시리스트 토글 */}
      <div className="flex gap-2 mb-2 overflow-x-auto pb-1 scrollbar-hide">
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
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
          가고싶은곳
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

      {/* 위시 카테고리 필터 (가고싶은곳 표시 중일 때) */}
      {showWishlist && wishlist.length > 0 && (
        <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1 scrollbar-hide">
          {['전체', ...WISH_CATEGORIES].map(cat => {
            const isAll = cat === '전체'
            const isActive = isAll ? activeWishCategory === '' : activeWishCategory === cat
            const bgColor = !isAll && isActive ? WISH_CATEGORY_COLORS[cat] : undefined
            return (
              <button
                key={cat}
                onClick={() => setActiveWishCategory(isAll ? '' : cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors active:scale-95 border ${
                  isActive
                    ? 'text-warm-dark border-transparent'
                    : 'bg-cream-50 text-warm-light border-cream-200 hover:bg-cream-100'
                }`}
                style={bgColor ? { background: bgColor } : isActive ? { background: '#6b4f3a', color: 'white', borderColor: 'transparent' } : {}}
              >
                {cat}
              </button>
            )
          })}
        </div>
      )}

      {/* 로딩 오버레이 */}
      {loading && (
        <div className="absolute z-10 flex items-center justify-center bg-cream-50/80 rounded-2xl" style={{ top: showWishlist && wishlist.length > 0 ? '80px' : '44px', left: 0, right: 0, bottom: 0 }}>
          <p className="text-sm text-warm-light">위치 찾는 중...</p>
        </div>
      )}

      {/* 지도 */}
      <div className="relative rounded-2xl shadow-sm" style={{ height: '50vh' }}>
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <MapContainer
            center={center}
            zoom={hasContent ? 12 : 11}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            scrollWheelZoom={false}
            key={currentSpace?.id}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            <FlyTo coords={flyTarget} />
            {clusters.map((cluster, i) => {
              const key = `${Math.round(cluster.coords[0] * ROUND)},${Math.round(cluster.coords[1] * ROUND)}`
              const isSelected = key === selectedClusterKey
              return (
                <Marker
                  key={`c-${i}`}
                  position={cluster.coords}
                  icon={makeMealIcon(TAG_COLORS[cluster.meals[0].tag], cluster.meals.length, isSelected)}
                  zIndexOffset={isSelected ? 1000 : 0}
                  eventHandlers={{ click: () => setBottomSheet({ type: 'cluster', cluster }) }}
                />
              )
            })}
            {showWishlist && wishWithCoords.map(w => (
              <Marker
                key={`w-${w.id}`}
                position={[w.lat, w.lng]}
                icon={makeWishIcon(w.category, w.visited)}
                eventHandlers={{ click: () => setBottomSheet({ type: 'wish', item: w }) }}
              />
            ))}
            {userLocation && (
              <Marker position={userLocation} icon={makeUserIcon()} zIndexOffset={2000} />
            )}
          </MapContainer>
        </div>

        {/* 현재 위치 버튼 */}
        <button
          onClick={handleLocate}
          disabled={locating}
          title="현재 위치로 이동"
          style={{ position: 'absolute', right: 12, bottom: 28, zIndex: 400 }}
          className="bg-white rounded-full w-10 h-10 shadow-md flex items-center justify-center hover:bg-cream-50 active:scale-95 transition-all disabled:opacity-60"
        >
          {locating ? (
            <div className="w-4 h-4 border-2 border-cream-300 border-t-blue-400 rounded-full animate-spin" />
          ) : (
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="3" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          )}
        </button>
      </div>

      {/* 가고 싶은 곳 카드 목록 */}
      {showWishlist && filteredWish.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between mb-2 px-0.5">
            <p className="text-sm font-semibold text-warm-dark">가고 싶은 곳</p>
            <span className="text-xs text-warm-light">{filteredWish.length}곳</span>
          </div>
          <div
            className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory' }}
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
          >
            {filteredWish.map(w => (
              <WishCard key={w.id} item={w} onClick={() => setBottomSheet({ type: 'wish', item: w })} />
            ))}
          </div>
        </div>
      )}

      {/* 바텀시트 — 식사 클러스터 */}
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
          <div
            className="flex gap-3 overflow-x-auto pb-4 px-4 scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory' }}
            onTouchStart={e => e.stopPropagation()}
            onTouchMove={e => e.stopPropagation()}
          >
            {bottomSheet.cluster.meals.map(meal => {
              const liveMeal = currentSpace?.meals.find(m => m.id === meal.id) ?? meal
              return <MealPinCard key={meal.id} meal={meal} liveMeal={liveMeal} onClick={() => setViewingMeal(liveMeal)} />
            })}
          </div>
        </div>
      )}

      {/* 바텀시트 — 위시리스트 상세 */}
      {bottomSheet?.type === 'wish' && (() => {
        const item = bottomSheet.item
        const catColor = WISH_CATEGORY_COLORS[item.category]
        return (
          <div className="mt-3 bg-white rounded-2xl border border-cream-200 overflow-hidden">
            {item.photo && (
              <img src={item.photo} alt="" className="w-full h-40 object-cover" />
            )}
            <div className="p-4">
              {/* 헤더 */}
              <div className="flex items-start gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    {item.visited && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-600 font-semibold border border-green-200">방문완료</span>
                    )}
                    {item.category && catColor && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium text-warm-dark" style={{ background: catColor }}>
                        {item.category}
                      </span>
                    )}
                  </div>
                  <p className="font-semibold text-warm-dark text-base leading-snug">{item.name}</p>
                  {item.location && (
                    <p className="text-xs text-warm-light mt-0.5 flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" /><circle cx="12" cy="8" r="2" />
                      </svg>
                      {item.location}
                    </p>
                  )}
                </div>
                <CloseBtn onClick={() => setBottomSheet(null)} />
              </div>

              {/* 메타 정보 */}
              <div className="space-y-1.5 mb-3">
                {item.priceRange && (
                  <p className="text-xs text-warm-light">가격대: <span className="text-warm-dark font-medium">{item.priceRange}</span></p>
                )}
                {item.hours && (
                  <p className="text-xs text-warm-light">영업시간: <span className="text-warm-dark">{item.hours}</span></p>
                )}
                {item.reason && (
                  <p className="text-sm text-warm-dark leading-relaxed">{item.reason}</p>
                )}
                {item.memo && (
                  <p className="text-sm text-warm-light leading-relaxed">{item.memo}</p>
                )}
              </div>

              {/* 분위기 태그 */}
              {item.moodTags?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-3">
                  {item.moodTags.map(tag => (
                    <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-cream-100 text-warm-light border border-cream-200">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* 액션 버튼 */}
              <div className="flex gap-2">
                {!item.visited && (
                  <button
                    onClick={() => handleVisitWish(item)}
                    className="flex-1 py-2.5 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    방문했어요
                  </button>
                )}
                <button
                  onClick={() => handleDeleteWish(item.id)}
                  className={`py-2.5 rounded-2xl border border-cream-200 text-red-400 text-sm hover:bg-red-50 transition-colors ${item.visited ? 'flex-1' : 'px-4'}`}
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 바텀시트 — 가고싶은곳 추가 */}
      {bottomSheet?.type === 'addWish' && (
        <div className="mt-3 bg-white rounded-2xl border border-cream-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-warm-dark">가고 싶은 곳 추가</p>
            <CloseBtn onClick={() => { setBottomSheet(null); setWishForm(EMPTY_WISH_FORM); setWishPhotoPreview('') }} />
          </div>

          <form onSubmit={handleSaveWish} className="space-y-4">
            {/* 장소명 */}
            <div>
              <label className="text-xs text-warm-light mb-1.5 block font-medium">장소명 *</label>
              <input type="text" value={wishForm.name} required
                onChange={e => setWishForm(p => ({ ...p, name: e.target.value }))}
                placeholder="어디에 가고 싶으신가요?" className={INPUT_CLS} />
            </div>

            {/* 주소 */}
            <div>
              <label className="text-xs text-warm-light mb-1.5 block font-medium">주소</label>
              <input type="text" value={wishForm.location}
                onChange={e => setWishForm(p => ({ ...p, location: e.target.value }))}
                placeholder="예: 서울 마포구 연남동" className={INPUT_CLS} />
            </div>

            {/* 분위기 태그 */}
            <div>
              <label className="text-xs text-warm-light mb-2 block font-medium">분위기</label>
              <div className="flex gap-2 flex-wrap">
                {MOOD_TAGS.map(tag => {
                  const isActive = wishForm.moodTags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setWishForm(p => ({
                        ...p,
                        moodTags: isActive
                          ? p.moodTags.filter(t => t !== tag)
                          : [...p.moodTags, tag],
                      }))}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors active:scale-95 ${
                        isActive
                          ? 'bg-warm-brown text-white border-transparent'
                          : 'bg-cream-50 text-warm-light border-cream-200 hover:bg-cream-100'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 사진 */}
            <div>
              <label className="text-xs text-warm-light mb-1.5 block font-medium">사진</label>
              {wishPhotoPreview ? (
                <div className="relative">
                  <img src={wishPhotoPreview} alt="" className="w-full h-36 object-cover rounded-2xl" />
                  <button
                    type="button"
                    onClick={() => { setWishPhotoPreview(''); if (wishPhotoRef.current) wishPhotoRef.current.value = '' }}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => wishPhotoRef.current?.click()}
                  className="w-full h-24 rounded-2xl border-2 border-dashed border-cream-300 flex flex-col items-center justify-center gap-1.5 text-cream-400 hover:border-warm-light hover:text-warm-light transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs">사진 추가</span>
                </button>
              )}
              <input ref={wishPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleWishPhotoChange} />
            </div>

            {/* 메모 */}
            <div>
              <label className="text-xs text-warm-light mb-1.5 block font-medium">메모</label>
              <input type="text" value={wishForm.memo}
                onChange={e => setWishForm(p => ({ ...p, memo: e.target.value }))}
                placeholder="기타 메모" className={INPUT_CLS} />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setBottomSheet(null); setWishForm(EMPTY_WISH_FORM); setWishPhotoPreview('') }}
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

      {/* 빈 상태 */}
      {!hasContent && !loading && (
        <div className="mt-4 py-10 text-center">
          <p className="text-sm font-medium text-warm-dark mb-1">아직 등록된 맛집이 없어요</p>
          <p className="text-xs text-warm-light">식사 기록에 위치를 입력하면<br />여기에 나타나요</p>
        </div>
      )}

      {/* 상세 모달 */}
      {viewingMeal && (
        <MealDetailModal meal={viewingMeal} onClose={() => setViewingMeal(null)} />
      )}

      {/* 방문 기록 모달 */}
      {visitingWish && (
        <Modal onClose={() => setVisitingWish(null)}>
          <div className="px-1 pb-2">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-rose-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <p className="text-sm font-semibold text-warm-dark">{visitingWish.name} 방문 기록</p>
            </div>
            <MealForm
              date={new Date()}
              initial={{
                tag: '외식',
                restaurantName: visitingWish.name,
                location: visitingWish.location || '',
                lat: visitingWish.lat || null,
                lng: visitingWish.lng || null,
              }}
              onSubmit={handleVisitSubmit}
              onCancel={() => setVisitingWish(null)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
