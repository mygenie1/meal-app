import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApp } from '../../context/AppContext'
import Modal from '../common/Modal'
import MealForm from './MealForm'
import PhotoGallery from '../common/PhotoGallery'
import { getOriginalUrl } from '../../lib/uploadPhoto'

const TAG_STYLES = {
  집밥: 'bg-green-50 text-green-700 border-green-200',
  외식: 'bg-amber-50 text-amber-700 border-amber-200',
  카페: 'bg-pink-50 text-pink-700 border-pink-200',
  배달: 'bg-blue-50 text-blue-700 border-blue-200',
}

const pinIcon = L.divIcon({
  className: '',
  html: `<div style="width:14px;height:14px;background:#6b4f3a;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.3)"></div>`,
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

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

  const hasMap = liveMeal.lat && liveMeal.lng

  return (
    <Modal isOpen onClose={onClose}>
      {/* 1. 사진 — full-bleed 상단 */}
      {!liveMeal.photosLoaded ? (
        <div className="-mx-5 -mt-4 mb-5 h-48 bg-cream-100 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-cream-300 border-t-warm-light rounded-full animate-spin" />
        </div>
      ) : photos.length > 0 ? (
        <div className="-mx-5 -mt-4 mb-5">
          <PhotoGallery photos={photos} maxHeight={300} onDownload={handleDownload} />
        </div>
      ) : null}

      {/* 2. 제목 + 날짜 + 태그 + 별점 */}
      {liveMeal.title && (
        <h2 className="text-lg font-bold text-warm-dark mb-1 leading-snug">{liveMeal.title}</h2>
      )}

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
      </div>

      {liveMeal.rating > 0 && (
        <div className="flex gap-0.5 mb-3">
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i} className={`text-xl ${i <= liveMeal.rating ? 'star-filled' : 'star-empty'}`}>★</span>
          ))}
        </div>
      )}

      {/* 3. 식당명 + 한줄평 + 메모 */}
      {liveMeal.restaurantName && (
        <p className={`font-semibold text-warm-dark leading-snug mb-1 ${liveMeal.title ? 'text-sm' : 'text-base'}`}>
          {liveMeal.restaurantName}
        </p>
      )}

      {liveMeal.review && (
        <p className="text-sm text-warm-dark mb-2 leading-relaxed">{liveMeal.review}</p>
      )}

      {liveMeal.memo && (
        <p className="text-xs text-warm-light leading-relaxed whitespace-pre-line mb-3">{liveMeal.memo}</p>
      )}

      {/* 4. 지도 — 위치 참고용 (150px) */}
      {hasMap && (
        <div className="mt-2 mb-1">
          {liveMeal.location && (
            <p className="text-xs text-warm-light flex items-center gap-1 mb-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
                <circle cx="12" cy="8" r="2" />
              </svg>
              {liveMeal.location}
            </p>
          )}
          <div className="rounded-2xl overflow-hidden" style={{ height: 150 }}>
            <MapContainer
              center={[liveMeal.lat, liveMeal.lng]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              touchZoom={false}
              boxZoom={false}
              keyboard={false}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
              />
              <Marker position={[liveMeal.lat, liveMeal.lng]} icon={pinIcon} />
            </MapContainer>
          </div>
        </div>
      )}

      {/* 위치 텍스트만 있는 경우 (지도 없음) */}
      {!hasMap && liveMeal.location && (
        <p className="text-xs text-warm-light flex items-center gap-1 mb-3">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
            <circle cx="12" cy="8" r="2" />
          </svg>
          {liveMeal.location}
        </p>
      )}

      {/* 수정 / 삭제 */}
      <div className="flex gap-3 pt-4 mt-3 border-t border-cream-100">
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
