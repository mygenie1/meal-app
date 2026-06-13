import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../../context/AppContext'
import Modal from '../common/Modal'
import MealForm from './MealForm'
import PhotoGallery from '../common/PhotoGallery'
import { getOriginalUrl } from '../../lib/uploadPhoto'
import AuthorBadge from '../common/AuthorBadge'

const TAG_STYLES = {
  집밥: 'bg-green-50 text-green-700 border-green-200',
  외식: 'bg-amber-50 text-amber-700 border-amber-200',
  카페: 'bg-pink-50 text-pink-700 border-pink-200',
  배달: 'bg-blue-50 text-blue-700 border-blue-200',
}

function SmallMap({ lat, lng }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || !window.kakao?.maps) return
    let overlay = null
    let destroyed = false
    window.kakao.maps.load(() => {
      if (destroyed || !containerRef.current) return
      const center = new window.kakao.maps.LatLng(lat, lng)
      const map = new window.kakao.maps.Map(containerRef.current, { center, level: 4 })
      map.setDraggable(false)
      map.setZoomable(false)
      const pinEl = document.createElement('div')
      pinEl.style.cssText = 'width:14px;height:14px;background:#6b4f3a;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)'
      overlay = new window.kakao.maps.CustomOverlay({
        position: center, content: pinEl, xAnchor: 0.5, yAnchor: 0.5,
      })
      overlay.setMap(map)
    })
    return () => { destroyed = true; if (overlay) overlay.setMap(null) }
  }, [lat, lng])

  return <div ref={containerRef} className="rounded-2xl overflow-hidden" style={{ height: 150 }} />
}

export default function MealDetailModal({ meal, onClose }) {
  const { updateMeal, deleteMeal, loadMealPhotos, currentSpace } = useApp()
  const [editing, setEditing] = useState(false)

  const liveMeal = currentSpace?.meals.find(m => m.id === meal?.id) ?? meal

  useEffect(() => {
    if (meal?.id && !meal.photosLoaded) {
      loadMealPhotos(meal.id)
    }
  }, [meal?.id])

  if (!meal) return null

  const dateObj = parseISO(liveMeal.date)
  const photos = (liveMeal.photos?.length > 0 ? liveMeal.photos : (liveMeal.photo ? [liveMeal.photo] : []))
    .map(p => getOriginalUrl(p))
    .filter(Boolean)

  async function handleDownload(url) {
    try {
      const res = await fetch(url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `식탁일기_${liveMeal.date}.jpg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000)
    } catch {
      window.open(url, '_blank')
    }
  }

  function handleEdit(data) {
    updateMeal(liveMeal.id, data)
    setEditing(false)
    onClose()
  }

  function handleDelete() {
    if (window.confirm('이 기록을 삭제할까요?')) {
      deleteMeal(meal.id)
      onClose()
    }
  }

  if (editing) {
    return (
      <Modal isOpen onClose={onClose}>
        <button
          onClick={() => setEditing(false)}
          className="flex items-center gap-1 text-sm text-warm-light mb-5 hover:text-warm-brown transition-colors"
        >
          ← 돌아가기
        </button>
        <MealForm
          date={dateObj}
          initial={liveMeal}
          onSubmit={handleEdit}
          onCancel={() => setEditing(false)}
        />
      </Modal>
    )
  }

  const hasMap = !!(liveMeal.lat && liveMeal.lng)

  return (
    <Modal isOpen onClose={onClose}>

      {/* ① 사진 — full-bleed 최상단 */}
      {!liveMeal.photosLoaded ? (
        <div className="-mx-5 -mt-4 mb-5 h-48 bg-cream-100 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-cream-300 border-t-warm-light rounded-full animate-spin" />
        </div>
      ) : photos.length > 0 ? (
        <div className="-mx-5 -mt-4 mb-5">
          <PhotoGallery photos={photos} maxHeight={300} onDownload={handleDownload} />
        </div>
      ) : null}

      {/* ② 제목 */}
      {liveMeal.title && (
        <h2 className="text-lg font-bold text-warm-dark mb-1 leading-snug">{liveMeal.title}</h2>
      )}

      {/* ② 날짜 + 끼니 + 태그 + 위시리스트 뱃지 */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <p className="text-xs text-cream-400">
          {format(dateObj, 'yyyy년 M월 d일 (eee)', { locale: ko })}
        </p>
        {liveMeal.mealTime && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cream-200 text-warm-light font-medium">
            {liveMeal.mealTime}
          </span>
        )}
        {liveMeal.tag && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${TAG_STYLES[liveMeal.tag] || 'bg-cream-100 text-warm-light border-cream-200'}`}>
            {liveMeal.tag}
          </span>
        )}
        {liveMeal.fromWishlist && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-400 font-medium border border-rose-100 flex items-center gap-1">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            가고 싶었던 곳
          </span>
        )}
      </div>

      {/* ② 작성자 */}
      <AuthorBadge meal={liveMeal} className="mb-2" />

      {/* ② 별점 */}
      {liveMeal.rating > 0 && (
        <div className="flex gap-0.5 mb-3">
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i} className={`text-xl ${i <= liveMeal.rating ? 'star-filled' : 'star-empty'}`}>★</span>
          ))}
        </div>
      )}

      {/* ③ 식당명 */}
      {liveMeal.restaurantName && (
        <p className={`font-semibold text-warm-dark leading-snug mb-1 ${liveMeal.title ? 'text-sm' : 'text-base'}`}>
          {liveMeal.restaurantName}
        </p>
      )}

      {/* ③ 한줄평 */}
      {liveMeal.review && (
        <p className="text-sm text-warm-dark mb-2 leading-relaxed">{liveMeal.review}</p>
      )}

      {/* ③ 메모 */}
      {liveMeal.memo && (
        <p className="text-xs text-warm-light leading-relaxed whitespace-pre-line mb-3">{liveMeal.memo}</p>
      )}

      {/* ④ 위치 + 지도 (맨 아래, 딱 하나) */}
      {liveMeal.location && (
        <p className="text-xs text-warm-light flex items-center gap-1 mb-2 mt-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
            <circle cx="12" cy="8" r="2" />
          </svg>
          {liveMeal.location}
        </p>
      )}

      {hasMap && <SmallMap lat={liveMeal.lat} lng={liveMeal.lng} />}

      {/* ⑤ 수정 / 삭제 */}
      <div className="flex gap-3 pt-4 mt-4 border-t border-cream-100">
        <button
          onClick={() => setEditing(true)}
          className="flex-1 py-2.5 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors"
        >
          수정
        </button>
        <button
          onClick={handleDelete}
          className="flex-1 py-2.5 rounded-2xl border border-red-100 text-red-400 text-sm font-medium hover:bg-red-50 transition-colors"
        >
          삭제
        </button>
      </div>

    </Modal>
  )
}
