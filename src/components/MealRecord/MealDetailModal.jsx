import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../../context/AppContext'
import Modal from '../common/Modal'
import MealForm from './MealForm'
import PhotoGallery from '../common/PhotoGallery'

const TAG_STYLES = {
  '집밥': 'bg-green-50 text-green-700 border-green-200',
  '외식': 'bg-amber-50 text-amber-700 border-amber-200',
  '카페': 'bg-pink-50 text-pink-700 border-pink-200',
  '배달': 'bg-blue-50 text-blue-700 border-blue-200',
}

export default function MealDetailModal({ meal, onClose }) {
  const { updateMeal, deleteMeal, loadMealPhotos, currentSpace } = useApp()
  const [editing, setEditing] = useState(false)

  // context에서 실시간 meal 조회 — loadMealPhotos 완료 후 photos가 갱신되면 여기도 반영됨
  const liveMeal = currentSpace?.meals.find(m => m.id === meal?.id) ?? meal

  useEffect(() => {
    if (meal?.id && !meal.photosLoaded) {
      loadMealPhotos(meal.id)
    }
  }, [meal?.id])

  if (!meal) return null

  const dateObj = parseISO(liveMeal.date)
  const photos = liveMeal.photos?.length > 0 ? liveMeal.photos : (liveMeal.photo ? [liveMeal.photo] : [])

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

  return (
    <Modal isOpen onClose={onClose}>
      {/* 사진 갤러리 — 상단 full-bleed */}
      {!liveMeal.photosLoaded ? (
        <div className="-mx-5 -mt-4 mb-5 h-36 bg-cream-100 flex items-center justify-center">
          <p className="text-sm text-cream-400">사진 불러오는 중...</p>
        </div>
      ) : photos.length > 0 ? (
        <div className="-mx-5 -mt-4 mb-5">
          <PhotoGallery photos={photos} maxHeight={300} />
        </div>
      ) : null}

      {/* 제목 */}
      {liveMeal.title && (
        <h2 className="text-lg font-bold text-warm-dark mb-1 leading-snug">{liveMeal.title}</h2>
      )}

      {/* 식당명 */}
      {liveMeal.restaurantName && (
        <p className={`font-semibold text-warm-dark leading-snug ${liveMeal.title ? 'text-sm mb-0.5' : 'text-base mb-0.5'}`}>
          {liveMeal.restaurantName}
        </p>
      )}

      {/* 위치 */}
      {liveMeal.location && (
        <p className="text-xs text-warm-light flex items-center gap-1 mb-2">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
            <circle cx="12" cy="8" r="2" />
          </svg>
          {liveMeal.location}
        </p>
      )}

      {/* 날짜 + 끼니 */}
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs text-cream-400">
          {format(dateObj, 'yyyy년 M월 d일 (eee)', { locale: ko })}
        </p>
        {liveMeal.mealTime && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cream-200 text-warm-light font-medium">
            {liveMeal.mealTime}
          </span>
        )}
      </div>

      {/* 별점 */}
      {liveMeal.rating > 0 && (
        <div className="flex gap-0.5 mb-3">
          {[1, 2, 3, 4, 5].map(i => (
            <span key={i} className={`text-xl ${i <= liveMeal.rating ? 'star-filled' : 'star-empty'}`}>★</span>
          ))}
        </div>
      )}

      {/* 한줄평 */}
      {liveMeal.review && (
        <p className="text-sm text-warm-dark mb-2 leading-relaxed">{liveMeal.review}</p>
      )}

      {/* 메모 */}
      {liveMeal.memo && (
        <p className="text-xs text-warm-light leading-relaxed whitespace-pre-line mb-3">{liveMeal.memo}</p>
      )}

      {/* 태그 */}
      {liveMeal.tag && (
        <div className="mb-5">
          <span className={`inline-block text-xs px-2.5 py-1 rounded-full font-medium border ${TAG_STYLES[liveMeal.tag] || 'bg-cream-100 text-warm-light border-cream-200'}`}>
            {liveMeal.tag}
          </span>
        </div>
      )}

      {/* 수정 / 삭제 */}
      <div className="flex gap-3 pt-4 border-t border-cream-100">
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
