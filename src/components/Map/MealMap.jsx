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

// ── 상수 ──────────────────────────────────────────────────────
const TAG_COLORS = { 집밥: '#86efac', 외식: '#fcd34d', 카페: '#f9a8d4', 배달: '#93c5fd' }
const MAP_FILTERS = ['전체', '외식', '카페']
const ROUND = 1e4
const INPUT_CLS = 'w-full px-4 py-3 rounded-2xl bg-cream-100 border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light transition-colors'
const WISH_CATEGORY_COLORS = { 한식: '#fca5a5', 일식: '#93c5fd', 양식: '#86efac', 중식: '#fcd34d', 카페: '#f9a8d4', 기타: '#d1b89a' }
const MOOD_TAGS = ['🔥 핫플', '💕 로맨틱', '🌿 힐링', '📸 인생샷', '✨ 특별한 날', '🍽️ 맛집 예감']
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

function makeUserIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.25)"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

// ── 유틸 ──────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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
          <p className="text-xs text-warm-light mt-1 leading-relaxed line-clamp-2">{display.review}</p>
        )}
        <p className="text-[10px] text-cream-400 mt-1.5">{display.date}</p>
      </div>
    </div>
  )
}

function WishFormFields({ form, setForm, photoPreview, setPhotoPreview, photoRef }) {
  return (
    <>
      <div>
        <label className="text-xs text-warm-light mb-1.5 block font-medium">장소명 *</label>
        <input type="text" value={form.name} required
          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
          placeholder="어디에 가고 싶으신가요?" className={INPUT_CLS} />
      </div>
      <div>
        <label className="text-xs text-warm-light mb-1.5 block font-medium">주소</label>
        <input type="text" value={form.location}
          onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
          placeholder="예: 서울 마포구 연남동" className={INPUT_CLS} />
      </div>
      <div>
        <label className="text-xs text-warm-light mb-2 block font-medium">분위기</label>
        <div className="flex gap-2 flex-wrap">
          {MOOD_TAGS.map(tag => {
            const on = form.moodTags.includes(tag)
            return (
              <button key={tag} type="button"
                onClick={() => setForm(p => ({ ...p, moodTags: on ? p.moodTags.filter(t => t !== tag) : [...p.moodTags, tag] }))}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors active:scale-95 ${on ? 'bg-warm-brown text-white border-transparent' : 'bg-cream-50 text-warm-light border-cream-200 hover:bg-cream-100'}`}
              >{tag}</button>
            )
          })}
        </div>
      </div>
      <div>
        <label className="text-xs text-warm-light mb-1.5 block font-medium">사진</label>
        {photoPreview ? (
          <div className="relative">
            <img src={photoPreview} alt="" className="w-full h-36 object-cover rounded-2xl" />
            <button type="button"
              onClick={() => { setPhotoPreview(''); if (photoRef.current) photoRef.current.value = '' }}
              className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => photoRef.current?.click()}
            className="w-full h-24 rounded-2xl border-2 border-dashed border-cream-300 flex flex-col items-center justify-center gap-1.5 text-cream-400 hover:border-warm-light hover:text-warm-light transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs">사진 추가</span>
          </button>
        )}
        <input ref={photoRef} type="file" accept="image/*" className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = ev => setPhotoPreview(ev.target.result)
            reader.readAsDataURL(file)
          }}
        />
      </div>
      <div>
        <label className="text-xs text-warm-light mb-1.5 block font-medium">메모</label>
        <input type="text" value={form.memo}
          onChange={e => setForm(p => ({ ...p, memo: e.target.value }))}
          placeholder="기타 메모" className={INPUT_CLS} />
      </div>
    </>
  )
}

function WishListCard({ item, onEdit, onDelete, onVisit, onViewOnMap }) {
  const catColor = WISH_CATEGORY_COLORS[item.category]
  return (
    <div className={`bg-white rounded-2xl border border-cream-200 overflow-hidden ${item.visited ? 'opacity-60' : ''}`}>
      {item.photo && (
        <img src={item.photo} alt="" className="w-full h-40 object-cover" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-warm-dark text-base leading-snug">{item.name}</p>
            {item.location && (
              <p className="text-xs text-warm-light mt-0.5 flex items-center gap-1">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
                  <circle cx="12" cy="8" r="2" />
                </svg>
                {item.location}
              </p>
            )}
          </div>
          {item.category && catColor && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium text-warm-dark shrink-0"
              style={{ background: catColor }}>
              {item.category}
            </span>
          )}
        </div>
        {item.moodTags?.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-2">
            {item.moodTags.map(tag => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-cream-100 text-warm-light border border-cream-200">
                {tag}
              </span>
            ))}
          </div>
        )}
        {item.memo && (
          <p className="text-sm text-warm-light leading-relaxed mb-3">{item.memo}</p>
        )}
        <div className="flex gap-2 flex-wrap">
          {!item.visited && (
            <button onClick={onVisit}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors active:scale-95">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              방문했어요
            </button>
          )}
          {item.lat && item.lng && (
            <button onClick={onViewOnMap}
              className="px-3 py-2 rounded-2xl border border-cream-200 text-warm-light text-xs hover:bg-cream-100 transition-colors active:scale-95 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              지도에서 확인
            </button>
          )}
          <button onClick={onEdit}
            className="px-3 py-2 rounded-2xl border border-cream-300 text-warm-brown text-sm hover:bg-cream-100 transition-colors active:scale-95">
            수정
          </button>
          <button onClick={onDelete}
            className="px-3 py-2 rounded-2xl border border-cream-200 text-red-400 text-sm hover:bg-red-50 transition-colors active:scale-95">
            삭제
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────
export default function MealMap() {
  const { currentSpace, addMeal, addWishlistItem, updateWishlistItem, deleteWishlistItem, cacheGeocoords, loadMealPhotos } = useApp()

  // 탭
  const [activeTab, setActiveTab] = useState('map')

  // 맛집 지도 탭
  const [pins, setPins] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeFilters, setActiveFilters] = useState(new Set(['전체']))
  const [clusterSheet, setClusterSheet] = useState(null) // { cluster }
  const [viewingMeal, setViewingMeal] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [locating, setLocating] = useState(false)

  // 근처 알림 배너
  const [nearbyWish, setNearbyWish] = useState(null)
  const [nearbyDismissed, setNearbyDismissed] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(false)
  const hasCheckedNearbyRef = useRef(false)

  // 가고 싶은 곳 탭 — 추가
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState(EMPTY_WISH_FORM)
  const [addPhotoPreview, setAddPhotoPreview] = useState('')
  const [savingAdd, setSavingAdd] = useState(false)
  const addPhotoRef = useRef()

  // 가고 싶은 곳 탭 — 수정
  const [editingWish, setEditingWish] = useState(null)
  const [editForm, setEditForm] = useState(EMPTY_WISH_FORM)
  const [editPhotoPreview, setEditPhotoPreview] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const editPhotoRef = useRef()

  // 방문 기록
  const [visitingWish, setVisitingWish] = useState(null)

  const requestedPhotosRef = useRef(new Set())

  const meals = useMemo(() => (currentSpace?.meals || []).filter(m => m.location), [currentSpace?.meals])
  const wishlist = currentSpace?.wishlist || []
  const unvisited = wishlist.filter(w => !w.visited)
  const visited = wishlist.filter(w => w.visited)

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

  // 지도 진입 시 근처 위시 탐색 (1회)
  useEffect(() => {
    if (hasCheckedNearbyRef.current) return
    const candidates = wishlist.filter(w => w.lat && w.lng && !w.visited)
    if (candidates.length === 0 || !navigator.geolocation) return
    hasCheckedNearbyRef.current = true
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        let closest = null, closestDist = Infinity
        candidates.forEach(w => {
          const d = haversineKm(latitude, longitude, w.lat, w.lng)
          if (d < closestDist) { closestDist = d; closest = w }
        })
        if (closest && closestDist < 1) {
          setNearbyWish({ item: closest, distanceM: Math.round(closestDist * 1000) })
          setTimeout(() => setBannerVisible(true), 80)
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    )
  }, [wishlist])

  // ── 맛집 지도 핸들러 ────────────────────────────────────────
  function handleToggleFilter(tag) {
    setActiveFilters(prev => {
      const next = new Set(prev)
      if (tag === '전체') return new Set(['전체'])
      next.delete('전체')
      if (next.has(tag)) {
        next.delete(tag)
        if (next.size === 0) next.add('전체')
      } else {
        next.add(tag)
      }
      return next
    })
  }

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

  const activeMealTags = [...activeFilters].filter(f => f !== '전체')
  const filteredPins = activeFilters.has('전체') ? pins
    : activeMealTags.length === 0 ? []
    : pins.filter(p => activeMealTags.includes(p.meal.tag))

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
    if (!clusterSheet) return null
    const [lat, lng] = clusterSheet.cluster.coords
    return `${Math.round(lat * ROUND)},${Math.round(lng * ROUND)}`
  }, [clusterSheet])

  const mapCenter = clusters.length > 0 ? clusters[0].coords : [37.5665, 126.9780]

  // ── 가고 싶은 곳 핸들러 ─────────────────────────────────────
  function handleOpenAdd() {
    setAddForm(EMPTY_WISH_FORM)
    setAddPhotoPreview('')
    setShowAddModal(true)
  }

  async function handleSaveAdd(e) {
    e.preventDefault()
    if (!addForm.name.trim()) return
    setSavingAdd(true)
    let lat = null, lng = null
    if (addForm.location.trim()) {
      try {
        const coords = await geocode(addForm.location)
        if (coords) { lat = coords[0]; lng = coords[1] }
      } catch {}
    }
    let photoUrl = ''
    if (addPhotoPreview) photoUrl = await uploadPhotoToStorage(addPhotoPreview, currentSpace?.id)
    await addWishlistItem({ name: addForm.name.trim(), memo: addForm.memo.trim(), location: addForm.location.trim(), lat, lng, moodTags: addForm.moodTags, photo: photoUrl })
    setShowAddModal(false)
    setSavingAdd(false)
  }

  function handleOpenEdit(item) {
    setEditingWish(item)
    setEditForm({ name: item.name || '', location: item.location || '', memo: item.memo || '', moodTags: item.moodTags || [] })
    setEditPhotoPreview(item.photo || '')
  }

  async function handleSaveEdit(e) {
    e.preventDefault()
    if (!editForm.name.trim() || !editingWish) return
    setSavingEdit(true)
    let lat = editingWish.lat, lng = editingWish.lng
    if (editForm.location.trim() && editForm.location !== editingWish.location) {
      try {
        const coords = await geocode(editForm.location)
        if (coords) { lat = coords[0]; lng = coords[1] }
      } catch {}
    }
    let photoUrl = editingWish.photo || ''
    if (editPhotoPreview && editPhotoPreview !== editingWish.photo) {
      photoUrl = editPhotoPreview.startsWith('data:') ? await uploadPhotoToStorage(editPhotoPreview, currentSpace?.id) : editPhotoPreview
    } else if (!editPhotoPreview) {
      photoUrl = ''
    }
    await updateWishlistItem(editingWish.id, { name: editForm.name.trim(), memo: editForm.memo.trim(), location: editForm.location.trim(), lat, lng, moodTags: editForm.moodTags, photo: photoUrl })
    setEditingWish(null)
    setSavingEdit(false)
  }

  function handleDelete(id) {
    if (!window.confirm('이 장소를 삭제할까요?')) return
    deleteWishlistItem(id)
  }

  function handleViewOnMap(wish) {
    setActiveTab('map')
    setFlyTarget([wish.lat, wish.lng])
  }

  async function handleVisitSubmit(mealData) {
    const meal = await addMeal({ ...mealData, fromWishlist: true })
    if (meal && visitingWish?.id) {
      await updateWishlistItem(visitingWish.id, { visited: true, visitedAt: new Date().toISOString().split('T')[0] })
    }
    setVisitingWish(null)
  }

  // ── 렌더 ──────────────────────────────────────────────────────
  return (
    <div>
      {/* 탭 바 */}
      <div className="flex gap-1 mb-3 p-1 bg-cream-100 rounded-2xl">
        <button
          onClick={() => setActiveTab('map')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'map' ? 'bg-white text-warm-dark shadow-sm' : 'text-warm-light hover:text-warm-brown'}`}
        >
          🗺️ 맛집 지도
        </button>
        <button
          onClick={() => setActiveTab('wishlist')}
          className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'wishlist' ? 'bg-white text-warm-dark shadow-sm' : 'text-warm-light hover:text-warm-brown'}`}
        >
          💕 가고 싶은 곳
        </button>
      </div>

      {/* ────────── 탭 1: 맛집 지도 ────────── */}
      {activeTab === 'map' && (
        <>
          {/* 근처 알림 배너 */}
          {nearbyWish && !nearbyDismissed && (
            <div
              className="mb-3"
              style={{ transform: bannerVisible ? 'translateY(0)' : 'translateY(-6px)', opacity: bannerVisible ? 1 : 0, transition: 'transform 0.35s ease, opacity 0.35s ease' }}
            >
              <div className="flex items-center gap-3 px-4 py-3 bg-cream-100 border border-cream-300 rounded-2xl">
                <div className="shrink-0 w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center">
                  <svg className="w-4 h-4 text-rose-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0 cursor-pointer"
                  onClick={() => setFlyTarget([nearbyWish.item.lat, nearbyWish.item.lng])}
                >
                  <p className="text-[11px] text-warm-light font-medium mb-0.5">근처에 가고 싶은 곳이 있어요</p>
                  <p className="text-sm font-semibold text-warm-dark truncate">
                    {nearbyWish.item.name}
                    <span className="text-xs text-warm-light font-normal ml-1.5">약 {nearbyWish.distanceM}m</span>
                  </p>
                </div>
                <button onClick={() => setNearbyDismissed(true)} className="text-cream-400 hover:text-warm-light transition-colors p-1 shrink-0">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* 필터 바 */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1 scrollbar-hide">
            {MAP_FILTERS.map(opt => {
              const isActive = activeFilters.has(opt)
              return (
                <button key={opt} onClick={() => handleToggleFilter(opt)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors active:scale-95 shrink-0 border ${
                    isActive ? 'bg-warm-brown text-white border-warm-brown shadow-sm' : 'bg-cream-100 text-warm-brown border-cream-200 hover:bg-cream-200'
                  }`}
                >
                  {!isActive && TAG_COLORS[opt] && (
                    <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: TAG_COLORS[opt] }} />
                  )}
                  {opt}
                </button>
              )
            })}
          </div>

          {/* 지도 */}
          <div className="relative rounded-2xl shadow-sm overflow-hidden" style={{ height: '58vh', minHeight: 320 }}>
            <div className="absolute inset-0" style={{ isolation: 'isolate' }}>
              <MapContainer
                center={mapCenter}
                zoom={clusters.length > 0 ? 12 : 11}
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
                      eventHandlers={{ click: () => setClusterSheet({ cluster }) }}
                    />
                  )
                })}
                {userLocation && (
                  <Marker position={userLocation} icon={makeUserIcon()} zIndexOffset={2000} />
                )}
              </MapContainer>
            </div>

            {/* 현재 위치 버튼 */}
            <button onClick={handleLocate} disabled={locating}
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

            {/* 로딩 오버레이 */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-cream-50/70 z-10">
                <p className="text-sm text-warm-light">위치 찾는 중...</p>
              </div>
            )}
          </div>

          {/* 빈 상태 */}
          {clusters.length === 0 && !loading && (
            <div className="mt-4 py-8 text-center">
              <p className="text-sm font-medium text-warm-dark mb-1">아직 등록된 맛집이 없어요</p>
              <p className="text-xs text-warm-light">식사 기록에 위치를 입력하면<br />여기에 나타나요</p>
            </div>
          )}
        </>
      )}

      {/* ────────── 탭 2: 가고 싶은 곳 ────────── */}
      {activeTab === 'wishlist' && (
        <>
          {/* 추가 버튼 */}
          <button onClick={handleOpenAdd}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-cream-300 text-warm-light text-sm font-medium hover:border-warm-brown hover:text-warm-brown transition-colors active:scale-[0.98] flex items-center justify-center gap-2 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            가고 싶은 곳 추가
          </button>

          {/* 미방문 목록 */}
          {unvisited.length > 0 ? (
            <div className="space-y-3 mb-6">
              {unvisited.map(item => (
                <WishListCard key={item.id} item={item}
                  onEdit={() => handleOpenEdit(item)}
                  onDelete={() => handleDelete(item.id)}
                  onVisit={() => setVisitingWish(item)}
                  onViewOnMap={item.lat && item.lng ? () => handleViewOnMap(item) : null}
                />
              ))}
            </div>
          ) : (
            <div className="py-10 text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-rose-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-warm-dark mb-1">아직 가고 싶은 곳이 없어요</p>
              <p className="text-xs text-warm-light">위 버튼으로 가고 싶은 장소를 추가해보세요</p>
            </div>
          )}

          {/* 방문 완료 섹션 */}
          {visited.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-warm-light">방문 완료</span>
                <div className="flex-1 h-px bg-cream-200" />
                <span className="text-xs text-cream-400">{visited.length}곳</span>
              </div>
              <div className="space-y-3">
                {visited.map(item => (
                  <WishListCard key={item.id} item={item}
                    onEdit={() => handleOpenEdit(item)}
                    onDelete={() => handleDelete(item.id)}
                    onVisit={null}
                    onViewOnMap={item.lat && item.lng ? () => handleViewOnMap(item) : null}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ────────── 바텀시트: 식사 클러스터 ────────── */}
      <Modal
        isOpen={!!clusterSheet}
        onClose={() => setClusterSheet(null)}
      >
        {clusterSheet && (
          <>
            <p className="font-semibold text-warm-dark mb-0.5">
              {clusterSheet.cluster.meals[0].restaurantName || clusterSheet.cluster.meals[0].location || '이 위치'}
            </p>
            <p className="text-xs text-warm-light mb-4">{clusterSheet.cluster.meals.length}개 식사 기록</p>
            <div
              className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 scrollbar-hide"
              style={{ scrollSnapType: 'x mandatory' }}
              onTouchStart={e => e.stopPropagation()}
              onTouchMove={e => e.stopPropagation()}
            >
              {clusterSheet.cluster.meals.map(meal => {
                const liveMeal = currentSpace?.meals.find(m => m.id === meal.id) ?? meal
                return (
                  <MealPinCard key={meal.id} meal={meal} liveMeal={liveMeal}
                    onClick={() => { setClusterSheet(null); setViewingMeal(liveMeal) }}
                  />
                )
              })}
            </div>
          </>
        )}
      </Modal>

      {/* ────────── 모달: 가고 싶은 곳 추가 ────────── */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="가고 싶은 곳 추가">
        <form onSubmit={handleSaveAdd} className="space-y-4">
          <WishFormFields
            form={addForm} setForm={setAddForm}
            photoPreview={addPhotoPreview} setPhotoPreview={setAddPhotoPreview}
            photoRef={addPhotoRef}
          />
          <div className="flex gap-3 pt-1" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={() => setShowAddModal(false)}
              className="flex-1 py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors">
              취소
            </button>
            <button type="submit" disabled={savingAdd}
              className="flex-1 py-3 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors disabled:opacity-60">
              {savingAdd ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ────────── 모달: 가고 싶은 곳 수정 ────────── */}
      <Modal isOpen={!!editingWish} onClose={() => setEditingWish(null)} title="가고 싶은 곳 수정">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <WishFormFields
            form={editForm} setForm={setEditForm}
            photoPreview={editPhotoPreview} setPhotoPreview={setEditPhotoPreview}
            photoRef={editPhotoRef}
          />
          <div className="flex gap-3 pt-1" style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}>
            <button type="button" onClick={() => setEditingWish(null)}
              className="flex-1 py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors">
              취소
            </button>
            <button type="submit" disabled={savingEdit}
              className="flex-1 py-3 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors disabled:opacity-60">
              {savingEdit ? '수정 중...' : '수정 완료'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ────────── 모달: 방문 기록 ────────── */}
      <Modal isOpen={!!visitingWish} onClose={() => setVisitingWish(null)}>
        {visitingWish && (
          <div className="pb-1">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-rose-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <p className="text-sm font-semibold text-warm-dark">{visitingWish.name} 방문 기록</p>
            </div>
            <MealForm
              date={new Date()}
              initial={{ tag: '외식', restaurantName: visitingWish.name, location: visitingWish.location || '', lat: visitingWish.lat || null, lng: visitingWish.lng || null }}
              onSubmit={handleVisitSubmit}
              onCancel={() => setVisitingWish(null)}
            />
          </div>
        )}
      </Modal>

      {/* ────────── 모달: 식사 상세 ────────── */}
      {viewingMeal && (
        <MealDetailModal meal={viewingMeal} onClose={() => setViewingMeal(null)} />
      )}
    </div>
  )
}
