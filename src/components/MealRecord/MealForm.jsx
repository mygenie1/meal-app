import { useState, useRef, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import StarRating from '../common/StarRating'
import { QtyStepper } from '../Ingredients/QtyStepper'
import { useApp } from '../../context/AppContext'
import { uploadPhotoWithThumbnail, getThumbUrl } from '../../lib/uploadPhoto'
import { supabase } from '../../lib/supabase'
import { sendNotification, buildFromUser, getSpaceMemberIds } from '../../lib/notify'

// 모바일 여부 — 모바일은 클립보드 paste가 잘 안 되므로 안내 문구 숨김
const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)

// ─── 이미지 압축 (Canvas, max 1200px, JPEG 0.82) ─────────────────────────
// 결과물은 base64 — 로컬 미리보기용. 실제 저장 시 Storage에 업로드 후 URL로 교체
function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const MAX = 1200
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round((height * MAX) / width); width = MAX }
        else { width = Math.round((width * MAX) / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
      URL.revokeObjectURL(url)
    }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}

// ─── Kakao SDK geocoding ──────────────────────────────────────────────────
async function geocodeKakao(query) {
  if (!window.kakao?.maps || !query.trim()) return null
  return new Promise(resolve => {
    window.kakao.maps.load(() => {
      const geocoder = new window.kakao.maps.services.Geocoder()
      geocoder.addressSearch(query, (result, status) => {
        if (status === window.kakao.maps.services.Status.OK && result[0]) {
          resolve([parseFloat(result[0].y), parseFloat(result[0].x)])
        } else {
          resolve(null)
        }
      })
    })
  })
}

// ─── Kakao SDK 장소 검색 ──────────────────────────────────────────────────
async function searchKakaoPlaces(query) {
  if (!window.kakao?.maps || !query.trim()) return []
  return new Promise(resolve => {
    window.kakao.maps.load(() => {
      const ps = new window.kakao.maps.services.Places()
      ps.keywordSearch(query, (result, status) => {
        resolve(status === window.kakao.maps.services.Status.OK ? result.slice(0, 5) : [])
      }, { size: 5 })
    })
  })
}

// ─── 현재 시간 → 끼니 자동 감지 ─────────────────────────────────────────
export function getAutoMealTime() {
  const h = new Date().getHours()
  if (h >= 5 && h < 11) return '아침'
  if (h >= 11 && h < 15) return '점심'
  return '저녁'
}

// ─── 상수 ─────────────────────────────────────────────────────────────────
const TAG_STYLE = {
  집밥: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  외식: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  카페: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700' },
  배달: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
}

const TAGS = [
  { key: '집밥', desc: '직접 요리한 홈 쿠킹' },
  { key: '외식', desc: '식당, 맛집에서 외식' },
  { key: '카페', desc: '카페, 디저트 가게' },
  { key: '배달', desc: '배달 음식 주문' },
]

const MEAL_TIMES = ['아침', '점심', '저녁']
const INPUT_CLS = 'w-full px-4 py-3 rounded-2xl bg-cream-100 border border-cream-200 text-base text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light transition-colors'
const LABEL_CLS = 'text-xs text-warm-light mb-1.5 block font-medium'

// ─── TagIcon ──────────────────────────────────────────────────────────────
function TagIcon({ tag, className = 'w-7 h-7' }) {
  if (tag === '집밥') return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 22V12h6v10" />
    </svg>
  )
  if (tag === '외식') return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  )
  if (tag === '카페') return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
  if (tag === '배달') return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
    </svg>
  )
  return null
}

// ─── 식당 자동완성 필드 ───────────────────────────────────────────────────
function RestaurantSearchField({ label, value, placeholder, onChange, onSelect }) {
  const [suggestions, setSuggestions] = useState([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [searching, setSearching] = useState(false)
  const timerRef = useRef(null)
  const wrapperRef = useRef(null)
  const scrollingRef = useRef(false)

  useEffect(() => {
    function handleOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [])

  function handleChange(e) {
    const q = e.target.value
    onChange(q)
    clearTimeout(timerRef.current)
    if (!q.trim()) {
      setSuggestions([])
      setShowDropdown(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      const results = await searchKakaoPlaces(q)
      setSuggestions(results)
      setShowDropdown(results.length > 0)
      setSearching(false)
    }, 350)
  }

  function handleSelect(place) {
    onSelect(place)
    setSuggestions([])
    setShowDropdown(false)
  }

  return (
    <div ref={wrapperRef}>
      <label className={LABEL_CLS}>{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
          onKeyDown={e => e.key === 'Escape' && setShowDropdown(false)}
          placeholder={placeholder}
          className={INPUT_CLS}
        />
        {searching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-cream-300 border-t-warm-light rounded-full animate-spin" />
        )}

        {showDropdown && suggestions.length > 0 && (
          <div
            className="absolute top-full left-0 right-0 mt-1 rounded-2xl border border-cream-200 bg-white shadow-md max-h-60 overflow-y-auto z-50"
            onTouchStart={() => { scrollingRef.current = false }}
            onTouchMove={() => { scrollingRef.current = true }}
            onScroll={e => e.stopPropagation()}
          >
            {suggestions.map((place, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={e => { e.preventDefault(); handleSelect(place) }}
                onTouchEnd={e => {
                  if (scrollingRef.current) { scrollingRef.current = false; return }
                  e.preventDefault()
                  handleSelect(place)
                }}
                className="w-full text-left px-4 py-3 hover:bg-cream-50 active:bg-cream-100 transition-colors border-b border-cream-100 last:border-0"
              >
                <p className="text-sm font-medium text-warm-dark truncate">{place.place_name}</p>
                {(place.road_address_name || place.address_name) && (
                  <p className="text-[11px] text-warm-light mt-0.5 truncate">
                    {place.road_address_name || place.address_name}
                  </p>
                )}
                {place.category_name && (
                  <p className="text-[10px] text-cream-400 mt-0.5 truncate">{place.category_name}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 위치 필드 ────────────────────────────────────────────────────────────
function LocationField({ form, geoStatus, onLocationChange, onLocationBlur }) {
  return (
    <div>
      <label className={LABEL_CLS}>위치</label>
      <input
        type="text"
        value={form.location}
        onChange={onLocationChange}
        onBlur={onLocationBlur}
        placeholder="예: 서울 마포구 연남동"
        className={INPUT_CLS}
      />
      {geoStatus === 'idle' && !form.location && (
        <p className="text-[11px] text-cream-400 mt-1 ml-1">입력하면 지도에 핀으로 표시돼요</p>
      )}
      {geoStatus === 'idle' && form.location && (
        <p className="text-[11px] text-cream-400 mt-1 ml-1">입력 완료 후 잠시 기다려주세요</p>
      )}
      {geoStatus === 'loading' && (
        <p className="text-[11px] text-warm-light mt-1 ml-1">주소 검색 중...</p>
      )}
      {geoStatus === 'found' && (
        <p className="text-[11px] text-green-600 mt-1 ml-1">지도에 핀으로 표시됩니다</p>
      )}
      {geoStatus === 'notfound' && (
        <p className="text-[11px] text-amber-500 mt-1 ml-1">주소를 찾을 수 없어요. 더 자세히 입력해보세요</p>
      )}
    </div>
  )
}

// ─── MealForm 메인 컴포넌트 ───────────────────────────────────────────────
export default function MealForm({ date, onSubmit, onCancel, initial, prefill }) {
  const { currentSpace, addIngredient, updateIngredientQuantity, deleteIngredient, user, ratingsMap, addOrUpdateRating, deleteRating } = useApp()

  // ★ seed = 값 프리필 전용 소스. 신규/수정 판정은 오직 initial로 (prefill은 신규 유지).
  //   "이 레시피로 기록하기"는 prefill로 값만 채우고 initial은 비워 → !initial 차감·알림 경로 정상.
  const seed = initial ?? prefill ?? null

  const [step, setStep] = useState(() => seed?.tag ? 'form' : 'tag')
  const [uploading, setUploading] = useState(false)
  const [formDate, setFormDate] = useState(
    () => seed?.date ?? format(date, 'yyyy-MM-dd')
  )
  const [form, setForm] = useState(() => {
    // 별점은 ratings 테이블로 통일 — 수정 모드에서는 내(작성자) ratings row로 초기화
    let initialRating = 0
    if (initial?.id && user) {
      const mine = (ratingsMap?.[initial.id] || []).find(r => r.user_id === user.id)
      initialRating = mine?.rating || 0
    }
    return {
      title: '', restaurantName: '', location: '', lat: null, lng: null,
      placeUrl: '',
      review: '', memo: '', tag: '',
      mealTime: getAutoMealTime(),  // 현재 시간 자동 감지
      ...seed,
      rating: initialRating,
      photos: seed?.photos?.length > 0
        ? seed.photos
        : (seed?.photo ? [seed.photo] : []),
    }
  })
  const [geoStatus, setGeoStatus] = useState(
    () => (seed?.lat && seed?.lng) ? 'found' : 'idle'
  )
  const [ingredientsOpen, setIngredientsOpen] = useState(false)
  // 사용 재료 선택 — { [ingredientId 또는 'used:이름' 가상키]: useQty }
  // 신규: remaining에서 차감 / 수정: 기존 used_ingredients를 초기값으로 (기록만 갱신, 차감 없음)
  const [usedItems, setUsedItems] = useState(() => {
    if (initial?.tag === '집밥' && Array.isArray(initial?.usedIngredients) && initial.usedIngredients.length) {
      const remaining = currentSpace?.ingredients?.remaining || []
      const seed = {}
      initial.usedIngredients.forEach(u => {
        const match = remaining.find(h => h.text === u.name)
        seed[match ? match.id : `used:${u.name}`] = u.qty
      })
      return seed
    }
    return {}
  })
  // 즉석 재료 추가 폼 — UI 전용 로컬 상태
  const [ingInput, setIngInput] = useState('')
  const [ingQty, setIngQty] = useState(1)
  const [pasteToast, setPasteToast] = useState(null) // null | { kind: 'loading'|'error', msg }
  const fileRef = useRef()
  const cameraRef = useRef()
  const photosLenRef = useRef(0)

  function set(key, val) {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  async function handlePhotos(e) {
    const files = Array.from(e.target.files)
    const canAdd = 5 - form.photos.length
    for (const file of files.slice(0, canAdd)) {
      // Canvas 압축으로 용량을 줄여 Supabase INSERT 타임아웃 방지
      const compressed = await compressImage(file)
      if (compressed) {
        setForm(prev => ({
          ...prev,
          photos: prev.photos.length < 5 ? [...prev.photos, compressed] : prev.photos,
        }))
      }
    }
    e.target.value = ''
  }

  // 현재 사진 개수를 ref로 추적 (paste 핸들러의 stale closure 대응)
  photosLenRef.current = form.photos.length

  // 클립보드 붙여넣기(Ctrl+V) → 기존 사진 업로드와 동일 처리 (compressImage 재사용)
  useEffect(() => {
    if (isMobile) return
    async function handlePaste(e) {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (!file) continue
          if (photosLenRef.current >= 5) {
            setPasteToast({ kind: 'error', msg: '사진은 최대 5장까지예요' })
            setTimeout(() => setPasteToast(null), 2000)
            return
          }
          setPasteToast({ kind: 'loading', msg: '사진을 업로드하는 중...' })
          try {
            const compressed = await compressImage(file)
            if (!compressed) throw new Error('compress failed')
            setForm(prev => prev.photos.length < 5 ? { ...prev, photos: [...prev.photos, compressed] } : prev)
            setPasteToast(null)
          } catch {
            setPasteToast({ kind: 'error', msg: '사진 붙여넣기에 실패했어요' })
            setTimeout(() => setPasteToast(null), 2000)
          }
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  function removePhoto(i) {
    setForm(prev => ({ ...prev, photos: prev.photos.filter((_, j) => j !== i) }))
  }

  function movePhoto(from, to) {
    setForm(prev => {
      const photos = [...prev.photos]
      const [removed] = photos.splice(from, 1)
      photos.splice(to, 0, removed)
      return { ...prev, photos }
    })
  }

  function handleLocationChange(e) {
    setForm(prev => ({ ...prev, location: e.target.value, lat: null, lng: null }))
    setGeoStatus('idle')
  }

  async function handleLocationBlur() {
    const location = form.location.trim()
    if (!location || form.lat) return
    setGeoStatus('loading')
    try {
      const coords = await geocodeKakao(location)
      if (coords) {
        setForm(prev => ({ ...prev, lat: coords[0], lng: coords[1] }))
        setGeoStatus('found')
      } else {
        setGeoStatus('notfound')
      }
    } catch {
      setGeoStatus('notfound')
    }
  }

  // 카카오 장소 선택 → 이름 + 위치 + 좌표 + 카카오맵 링크 자동 입력
  function handlePlaceSelect(place) {
    setForm(prev => ({
      ...prev,
      restaurantName: place.place_name,
      location: place.road_address_name || place.address_name || prev.location,
      lat: parseFloat(place.y),
      lng: parseFloat(place.x),
      placeUrl: place.place_url || '',
    }))
    setGeoStatus('found')
  }

  // 가게 이름 직접 입력 시 → 검색으로 들어온 카카오 링크는 무효화(잘못된 링크 방지)
  function handleNameChange(v) {
    setForm(prev => ({ ...prev, restaurantName: v, placeUrl: '' }))
  }

  const needsGeo = form.tag === '외식' || form.tag === '카페'

  async function handleSubmit(e) {
    e.preventDefault()
    let { lat, lng } = form

    if (needsGeo && form.location.trim() && !lat && geoStatus === 'idle') {
      setGeoStatus('loading')
      try {
        const coords = await geocodeKakao(form.location)
        if (coords) { lat = coords[0]; lng = coords[1]; setGeoStatus('found') }
        else setGeoStatus('notfound')
      } catch {
        setGeoStatus('notfound')
      }
    }

    // 사용 재료 기록 — 신규/수정 공통: 현재 선택을 used_ingredients로 저장
    const selectedUsedArr = form.tag === '집밥'
      ? usableIngredients
          .filter(i => (usedItems[i.id] ?? 0) > 0)
          .map(i => ({ name: i.text, qty: usedItems[i.id] }))
      : []
    // 재고 차감 스냅샷 — ★ 신규 작성 시에만. 수정은 기록만 갱신(remaining 불변, 이중 차감 금지)
    const pendingDeductions = (!initial && form.tag === '집밥')
      ? usableIngredients
          .filter(i => !i.virtual && (usedItems[i.id] ?? 0) > 0)
          .map(i => ({ ...i, useQty: usedItems[i.id] }))
      : []

    // 사진 Storage 업로드 — base64는 URL로 교체, 이미 URL이면 그대로
    setUploading(true)
    try {
      const spaceId = currentSpace?.id
      const uploadedPhotos = await Promise.all(
        form.photos.map(p => uploadPhotoWithThumbnail(p, spaceId))
      )
      // 별점은 meals.rating에 쓰지 않고 ratings 테이블로 통일 → payload에서 제외
      const { rating: _selectedRating, ...formNoRating } = form
      const newMeal = await onSubmit({
        ...formNoRating,
        date: formDate,
        lat,
        lng,
        photos: uploadedPhotos,
        photo: uploadedPhotos[0] || '',
        // 집밥: 현재 선택을 기록(신규·수정 공통) / 그 외: 기존 값 보존
        usedIngredients: form.tag === '집밥'
          ? (selectedUsedArr.length > 0 ? selectedUsedArr : null)
          : (initial?.usedIngredients ?? null),
      })

      // 재료 차감 — 신규 집밥 + 저장 성공 시 1회만 (복구 없음)
      if (pendingDeductions.length > 0 && newMeal?.id) {
        for (const item of pendingDeductions) {
          try {
            if (item.useQty >= item.quantity) {
              await deleteIngredient('remaining', item.id)
            } else {
              await updateIngredientQuantity('remaining', item.id, item.quantity - item.useQty)
            }
          } catch (err) {
            console.error('[MealForm] 재료 차감 실패:', item.text, err)
          }
        }
      }

      // 작성자 별점 → ratings 테이블 upsert (신규: meal insert 후 / 수정: 기존 row 갱신)
      const mealId = newMeal?.id || initial?.id
      if (mealId && user) {
        try {
          if (form.rating > 0) {
            await addOrUpdateRating(mealId, form.rating)
          } else if (initial?.id) {
            // 수정 모드에서 별점을 비웠고 기존 내 별점이 있으면 삭제
            const hadMine = (ratingsMap?.[initial.id] || []).some(r => r.user_id === user.id)
            if (hadMine) await deleteRating(mealId)
          }
        } catch (e) {
          console.error('[MealForm] 별점 저장 중 오류:', e)
        }
      }
      // 새 게시글 알림 — 수정이 아닌 신규 등록이고 다른 멤버가 있을 때만
      if (!initial && newMeal?.id && user && currentSpace?.id) {
        try {
          const fromUser = buildFromUser(user)
          const title = form.title || form.restaurantName || '식사'
          const memberIds = await getSpaceMemberIds(currentSpace.id)
          await sendNotification({
            toUserIds: memberIds,
            spaceId: currentSpace.id,
            mealId: newMeal.id,
            fromUser,
            type: 'new_meal',
            message: `${fromUser.nickname}님이 새 식사를 기록했어요: ${title}`,
          })
        } catch (e) {
          console.error('[MealForm] 알림 처리 중 오류:', e)
        }
      }
      // 수정 게시글 알림 — 수정 시 같은 스페이스 다른 멤버 전원에게
      if (initial?.id && user && currentSpace?.id) {
        try {
          const fromUser = buildFromUser(user)
          const title = form.title || form.restaurantName || '식사'
          const memberIds = await getSpaceMemberIds(currentSpace.id)
          await sendNotification({
            toUserIds: memberIds,
            spaceId: currentSpace.id,
            mealId: initial.id,
            fromUser,
            type: 'new_meal',
            message: `${fromUser.nickname}님이 식사 기록을 수정했어요: ${title}`,
          })
        } catch (e) {
          console.error('[MealForm] 수정 알림 처리 중 오류:', e)
        }
      }
    } finally {
      setUploading(false)
    }
  }

  function selectTag(tag) {
    set('tag', tag)
    setStep('form')
  }

  const isGeocoding = geoStatus === 'loading'
  const isBusy = isGeocoding || uploading
  // 집밥 재료 = ingredients 테이블 remaining 타입 (재료 탭 "남은 재료"와 동일 데이터 공유)
  // 집밥은 이미 산(냉장고에 남은) 재료를 쓰는 것이므로 남은 재료 목록을 보여줌
  const homeIngredients = currentSpace?.ingredients?.remaining || []
  // 재료 사용 UI/저장 목록 = 남은 재료 + (수정 시) 이미 차감돼 remaining에 없는 기존 사용 재료(가상 행)
  const usableIngredients = (() => {
    const list = homeIngredients.map(i => ({ ...i }))
    if (initial?.tag === '집밥' && Array.isArray(initial?.usedIngredients)) {
      initial.usedIngredients.forEach(u => {
        if (!list.some(h => h.text === u.name)) {
          list.push({ id: `used:${u.name}`, text: u.name, quantity: u.qty, virtual: true })
        }
      })
    }
    return list
  })()
  const style = TAG_STYLE[form.tag] || {}

  // 즉석 재료 추가 — remaining에 즉시 insert 후 목록에 바로 표시
  async function handleAddIngredient(e) {
    e.preventDefault()
    const text = ingInput.trim()
    if (!text) return
    await addIngredient('remaining', text, ingQty)
    setIngInput('')
    setIngQty(1)
  }

  // 사용 재료 체크 토글
  function toggleUsedItem(item) {
    setUsedItems(prev => {
      if (prev[item.id]) {
        const next = { ...prev }
        delete next[item.id]
        return next
      }
      return { ...prev, [item.id]: 1 }
    })
  }

  // 사용 개수 변경 (1 이상, 남은 개수 초과 불가)
  function setUseQty(item, qty) {
    const clamped = Math.min(item.quantity, Math.max(1, qty))
    setUsedItems(prev => ({ ...prev, [item.id]: clamped }))
  }

  // ── Step 1: 날짜 + 태그 + 끼니 ───────────────────────────────────────
  if (step === 'tag') {
    return (
      <div>
        <div className="mb-4">
          <label className={LABEL_CLS}>날짜</label>
          <input
            type="date"
            value={formDate}
            onChange={e => setFormDate(e.target.value)}
            className={INPUT_CLS}
          />
        </div>

        <p className="text-lg font-semibold text-warm-dark mb-5">어떤 식사였나요?</p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          {TAGS.map(({ key, desc }) => {
            const s = TAG_STYLE[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectTag(key)}
                className={`flex flex-col items-center justify-center gap-2.5 py-6 rounded-2xl border-2 ${s.bg} ${s.border} hover:opacity-80 transition-all active:scale-95`}
              >
                <span className={s.text}><TagIcon tag={key} className="w-8 h-8" /></span>
                <div className="text-center">
                  <p className={`text-sm font-semibold ${s.text}`}>{key}</p>
                  <p className="text-[11px] text-warm-light mt-0.5 leading-snug px-1">{desc}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mb-6">
          <label className={LABEL_CLS}>끼니</label>
          <div className="flex gap-2">
            {MEAL_TIMES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => set('mealTime', form.mealTime === t ? '' : t)}
                className={`flex-1 py-2.5 rounded-2xl text-sm font-medium border transition-colors active:scale-95 ${
                  form.mealTime === t
                    ? 'bg-warm-brown text-white border-warm-brown'
                    : 'bg-cream-100 text-warm-light border-cream-200 hover:bg-cream-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="w-full py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors"
        >
          취소
        </button>
      </div>
    )
  }

  // ── Step 2: 태그별 폼 ────────────────────────────────────────────────
  const displayDate = formDate
    ? format(parseISO(formDate), 'M월 d일 (eee)', { locale: ko })
    : ''

  return (
    <form onSubmit={handleSubmit}>
      {/* 헤더: 태그 + 날짜(클릭 → 날짜 피커) + 변경 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${style.bg} ${style.border} ${style.text}`}>
            <TagIcon tag={form.tag} className="w-3.5 h-3.5" />
            {form.tag}
          </span>
          <div className="relative">
            <span className="text-xs text-warm-light pointer-events-none flex items-center gap-0.5">
              {displayDate}
              <svg className="w-2.5 h-2.5 text-cream-400 ml-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </span>
            <input
              type="date"
              value={formDate}
              onChange={e => setFormDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
              aria-label="날짜 변경"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => setStep('tag')}
          className="text-xs text-warm-light hover:text-warm-brown transition-colors"
        >
          변경
        </button>
      </div>

      {/* 끼니 */}
      <div className="flex gap-2 mb-4">
        {MEAL_TIMES.map(t => (
          <button
            key={t}
            type="button"
            onClick={() => set('mealTime', form.mealTime === t ? '' : t)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors active:scale-95 ${
              form.mealTime === t
                ? 'bg-warm-brown text-white border-warm-brown'
                : 'bg-cream-100 text-warm-light border-cream-200 hover:bg-cream-200'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* 사진 — 최대 5장 */}
        <div>
          {form.photos.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {form.photos.map((p, i) => (
                <div key={i} className="relative shrink-0 w-[100px] h-[100px] rounded-2xl overflow-hidden">
                  <img src={getThumbUrl(p) || p} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
                  {/* 삭제 버튼 */}
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-black/70 transition-colors"
                  >×</button>
                  {/* 순서 이동 버튼 */}
                  {form.photos.length > 1 && (
                    <div className="absolute bottom-1.5 left-0 right-0 flex justify-center gap-1">
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => movePhoto(i, i - 1)}
                          className="bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-black/70 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                      )}
                      {i < form.photos.length - 1 && (
                        <button
                          type="button"
                          onClick={() => movePhoto(i, i + 1)}
                          className="bg-black/50 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-black/70 transition-colors"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {form.photos.length < 5 && (
                <>
                  <button
                    type="button"
                    onClick={() => fileRef.current.click()}
                    className="shrink-0 w-[100px] h-[100px] rounded-2xl border-2 border-dashed border-cream-300 flex flex-col items-center justify-center text-cream-400 hover:border-cream-400 hover:bg-cream-100 transition-colors"
                  >
                    <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[10px]">갤러리</span>
                    <span className="text-[10px] opacity-60">{form.photos.length}/5</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraRef.current.click()}
                    className="shrink-0 w-[100px] h-[100px] rounded-2xl border-2 border-dashed border-cream-300 flex flex-col items-center justify-center text-cream-400 hover:border-cream-400 hover:bg-cream-100 transition-colors"
                  >
                    <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-[10px]">카메라</span>
                  </button>
                </>
              )}
            </div>
          ) : (
            <div
              className="w-full border-2 border-dashed border-cream-300 rounded-2xl flex items-center justify-center gap-6 text-cream-400 hover:border-cream-400 hover:bg-cream-50 transition-colors"
              style={{ height: '140px' }}
            >
              <button
                type="button"
                onClick={() => fileRef.current.click()}
                className="flex flex-col items-center gap-2 hover:text-warm-light transition-colors"
              >
                <svg className="w-7 h-7 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-medium">갤러리</span>
              </button>
              <div className="w-px h-10 bg-cream-200" />
              <button
                type="button"
                onClick={() => cameraRef.current.click()}
                className="flex flex-col items-center gap-2 hover:text-warm-light transition-colors"
              >
                <svg className="w-7 h-7 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-medium">카메라</span>
              </button>
            </div>
          )}
          <input type="file" ref={fileRef} accept="image/*" multiple className="hidden" onChange={handlePhotos} />
          <input type="file" ref={cameraRef} accept="image/*" capture="environment" className="hidden" onChange={handlePhotos} />
          {!isMobile && (
            <p className="text-xs text-cream-400 mt-2 text-center">Ctrl+V로 사진을 붙여넣을 수 있어요</p>
          )}
        </div>

        {/* 붙여넣기 토스트 */}
        {pasteToast && (
          <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-[95] px-4 py-2.5 rounded-2xl bg-warm-dark text-white text-sm font-medium shadow-lg flex items-center gap-2">
            {pasteToast.kind === 'loading' && (
              <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />
            )}
            {pasteToast.msg}
          </div>
        )}

        {/* 제목 */}
        <div>
          <label className={LABEL_CLS}>제목</label>
          <input
            type="text"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder={
              form.tag === '집밥' ? '오늘 만든 요리 이름은?' :
              form.tag === '카페' ? '어떤 음료를 마셨나요?' :
              '오늘 식사를 한 줄로 표현하면?'
            }
            className={INPUT_CLS}
          />
        </div>

        {/* 외식: 식당 자동완성 + 위치 */}
        {form.tag === '외식' && (
          <>
            <RestaurantSearchField
              label="식당 이름"
              value={form.restaurantName}
              placeholder="어디서 드셨나요?"
              onChange={handleNameChange}
              onSelect={handlePlaceSelect}
            />
            <LocationField
              form={form}
              geoStatus={geoStatus}
              onLocationChange={handleLocationChange}
              onLocationBlur={handleLocationBlur}
            />
          </>
        )}

        {/* 카페: 카페 자동완성 + 위치 */}
        {form.tag === '카페' && (
          <>
            <RestaurantSearchField
              label="카페 이름"
              value={form.restaurantName}
              placeholder="어느 카페였나요?"
              onChange={handleNameChange}
              onSelect={handlePlaceSelect}
            />
            <LocationField
              form={form}
              geoStatus={geoStatus}
              onLocationChange={handleLocationChange}
              onLocationBlur={handleLocationBlur}
            />
          </>
        )}

        {/* 배달: 가게 자동완성 (위치 없음) */}
        {form.tag === '배달' && (
          <RestaurantSearchField
            label="가게 이름"
            value={form.restaurantName}
            placeholder="어느 가게에서 시켰나요?"
            onChange={handleNameChange}
            onSelect={place => setForm(p => ({ ...p, restaurantName: place.place_name, placeUrl: place.place_url || '' }))}
          />
        )}

        {/* 별점 — 전체 태그 */}
        <div>
          <label className={LABEL_CLS}>별점</label>
          <StarRating value={form.rating} onChange={val => set('rating', val)} />
        </div>

        {/* 한줄평 — 외식/카페/배달 */}
        {form.tag !== '집밥' && (
          <div>
            <label className={LABEL_CLS}>한줄평</label>
            <input
              type="text"
              value={form.review}
              onChange={e => set('review', e.target.value)}
              placeholder={form.tag === '카페' ? '음료나 분위기는 어땠나요?' : '맛은 어땠나요?'}
              className={INPUT_CLS}
            />
          </div>
        )}

        {/* 메모 — 집밥/외식/배달 */}
        {form.tag !== '카페' && (
          <div>
            <label className={LABEL_CLS}>메모</label>
            <textarea
              value={form.memo}
              onChange={e => set('memo', e.target.value)}
              placeholder={form.tag === '집밥' ? '레시피나 특별한 점을 남겨볼까요?' : '더 남기고 싶은 이야기가 있나요?'}
              rows={3}
              className={`${INPUT_CLS} resize-none`}
            />
          </div>
        )}

        {/* 집밥: 재료 사용 — 남은 재료에서 선택 + 저장 시 차감 */}
        {form.tag === '집밥' && (
          <div className="rounded-2xl border border-cream-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setIngredientsOpen(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 bg-cream-100 hover:bg-cream-200 transition-colors"
            >
              <span className="text-sm font-medium text-warm-dark">재료 사용하기</span>
              <div className="flex items-center gap-2">
                {Object.values(usedItems).some(q => q > 0) && (
                  <span className="text-xs bg-warm-brown text-white px-2 py-0.5 rounded-full font-medium">
                    {Object.values(usedItems).filter(q => q > 0).length}종
                  </span>
                )}
                <svg
                  className={`w-4 h-4 text-cream-400 transition-transform ${ingredientsOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>
            {ingredientsOpen && (
              <div className="px-4 py-3 space-y-3">
                <p className="text-xs text-warm-light">남은 재료에서 사용할 것을 선택하고 개수를 지정하세요</p>

                {/* 즉석 재료 추가 */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ingInput}
                    onChange={e => setIngInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddIngredient(e) } }}
                    placeholder="재료 즉석 추가"
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-cream-100 border border-cream-200 text-base text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light"
                  />
                  <QtyStepper
                    quantity={ingQty}
                    onDecrement={() => setIngQty(q => Math.max(1, q - 1))}
                    onIncrement={() => setIngQty(q => q + 1)}
                    onDirectChange={n => setIngQty(n)}
                  />
                  <button
                    type="button"
                    onClick={handleAddIngredient}
                    className="px-3 py-1.5 rounded-xl bg-warm-brown text-white text-sm hover:bg-warm-dark transition-colors shrink-0"
                  >
                    추가
                  </button>
                </div>

                {/* 남은 재료 목록 — 체크 선택 + 사용 개수 (수정 시 기존 사용 재료도 표시) */}
                {usableIngredients.length > 0 ? (
                  <div className="space-y-2">
                    {usableIngredients.map(item => {
                      const isChecked = !!(usedItems[item.id])
                      const useQty = usedItems[item.id] || 1
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition-colors ${
                            isChecked ? 'bg-green-50 border-green-200' : 'bg-cream-50 border-cream-200'
                          }`}
                        >
                          {/* 체크 버튼 */}
                          <button
                            type="button"
                            onClick={() => toggleUsedItem(item)}
                            className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                              isChecked ? 'bg-warm-brown border-warm-brown' : 'border-cream-300 hover:border-warm-brown'
                            }`}
                          >
                            {isChecked && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>

                          {/* 재료명 + 남은 개수 */}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-warm-dark block truncate">{item.text}</span>
                            <span className="text-[10px] text-cream-400">{item.virtual ? '이전 기록' : `남은 ${item.quantity}개`}</span>
                          </div>

                          {/* 사용 개수 스테퍼 — 체크 시만 표시 */}
                          {isChecked && (
                            <QtyStepper
                              quantity={useQty}
                              onDecrement={() => setUseQty(item, useQty - 1)}
                              onIncrement={() => setUseQty(item, useQty + 1)}
                              onDirectChange={n => setUseQty(item, n)}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-center text-xs text-cream-400 py-2">남은 재료가 없어요. 위에서 즉석 추가하세요</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 저장 버튼 */}
      <div
        className="sticky bottom-0 bg-cream-50 pt-4 mt-6 -mx-5 px-5 border-t border-cream-100"
        style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
      >
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isBusy}
            className="flex-1 py-3 rounded-2xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {uploading ? '사진 업로드 중...' : isGeocoding ? '주소 확인 중...' : '저장하기'}
          </button>
        </div>
      </div>
    </form>
  )
}
