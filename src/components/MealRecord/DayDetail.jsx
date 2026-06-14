import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../../context/AppContext'
import MealForm from './MealForm'
import PhotoGallery from '../common/PhotoGallery'
import StarRating from '../common/StarRating'
import { getThumbUrl, getOriginalUrl } from '../../lib/uploadPhoto'
import AuthorBadge from '../common/AuthorBadge'
import { linkify } from '../../lib/linkify'

const MEAL_TIME_ORDER = { 아침: 0, 점심: 1, 저녁: 2 }
const MEAL_TIMES = ['아침', '점심', '저녁']

const TAG_STYLES = {
  집밥: 'bg-green-50 text-green-700 border-green-200',
  외식: 'bg-amber-50 text-amber-700 border-amber-200',
  카페: 'bg-pink-50 text-pink-700 border-pink-200',
  배달: 'bg-blue-50 text-blue-700 border-blue-200',
}

function DayMealCard({ meal, isRep, showRepBtn, onSetRep, onView, onEdit, onDelete }) {
  const { ratingsMap } = useApp()
  const rawPhotos = meal.photosLoaded
    ? (meal.photos?.length > 0 ? meal.photos : (meal.photo ? [meal.photo] : []))
    : []
  const thumbPhotos = rawPhotos.map(p => getThumbUrl(p)).filter(Boolean)
  const originalPhotos = rawPhotos.map(p => getOriginalUrl(p)).filter(Boolean)
  const mealRatings = ratingsMap?.[meal.id] || []
  const avgRating = mealRatings.length > 0
    ? Math.floor(mealRatings.reduce((s, r) => s + r.rating, 0) / mealRatings.length)
    : meal.rating || 0
  const ratingCount = mealRatings.length

  return (
    <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
      {/* 사진 갤러리 */}
      {!meal.photosLoaded ? (
        <div className="h-14 bg-cream-100 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-cream-300 border-t-warm-light rounded-full animate-spin" />
        </div>
      ) : thumbPhotos.length > 0 ? (
        <PhotoGallery photos={thumbPhotos} fullscreenPhotos={originalPhotos} maxHeight={180} />
      ) : null}

      {/* 내용 — 클릭하면 상세 모달 */}
      <div
        onClick={onView}
        className={`px-4 pt-3 pb-2 ${onView ? 'cursor-pointer active:bg-cream-50' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {meal.title && (
              <p className="text-sm font-semibold text-warm-dark leading-snug">{meal.title}</p>
            )}
            {meal.restaurantName && (
              <p className={`text-xs truncate ${meal.title ? 'text-warm-light mt-0.5' : 'text-warm-dark font-medium'}`}>
                {meal.restaurantName}
              </p>
            )}
            {!meal.title && !meal.restaurantName && (
              <p className="text-xs text-cream-400">식사 기록</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isRep && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warm-brown text-white font-semibold">
                대표
              </span>
            )}
            {meal.tag && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${TAG_STYLES[meal.tag] || 'bg-cream-100 text-warm-light border-cream-200'}`}>
                {meal.tag}
              </span>
            )}
          </div>
        </div>
        {avgRating > 0 && (
          <div className="mt-1.5 flex items-center gap-1">
            <StarRating value={avgRating} readonly />
            {ratingCount >= 2 && (
              <span className="text-[10px] text-cream-400">{ratingCount}명</span>
            )}
          </div>
        )}
        {meal.review && (
          <p className="text-xs text-warm-dark mt-1 leading-relaxed line-clamp-2 break-words">{linkify(meal.review)}</p>
        )}
        <AuthorBadge meal={meal} className="mt-2" />
      </div>

      {/* 액션 버튼 */}
      <div className="px-4 py-2 flex items-center gap-3 border-t border-cream-100">
        {onView && (
          <>
            <button
              onClick={onView}
              className="text-xs text-warm-light hover:text-warm-brown transition-colors py-1"
            >
              상세보기
            </button>
            <span className="text-cream-200">|</span>
          </>
        )}
        {showRepBtn && !isRep && (
          <>
            <button
              onClick={onSetRep}
              className="text-xs text-warm-light hover:text-warm-brown transition-colors py-1"
            >
              대표설정
            </button>
            <span className="text-cream-200">|</span>
          </>
        )}
        <button
          onClick={onEdit}
          className="text-xs text-warm-light hover:text-warm-brown transition-colors py-1"
        >
          수정
        </button>
        <span className="text-cream-200">|</span>
        <button
          onClick={onDelete}
          className="text-xs text-warm-light hover:text-red-400 transition-colors py-1"
        >
          삭제
        </button>
      </div>
    </div>
  )
}

export default function DayDetail({ date, onClose, onViewMeal, repMeals, onSetRepMeal }) {
  const { currentSpace, addMeal, updateMeal, deleteMeal, loadMealPhotos } = useApp()
  const topRef = useRef()

  const dateStr = format(date, 'yyyy-MM-dd')
  const dayMeals = (currentSpace?.meals.filter(m => m.date === dateStr) || [])
    .slice()
    .sort((a, b) => (MEAL_TIME_ORDER[a.mealTime] ?? 1) - (MEAL_TIME_ORDER[b.mealTime] ?? 1))

  const [mode, setMode] = useState(dayMeals.length === 0 ? 'form' : 'list')
  const [editingId, setEditingId] = useState(null)
  const editing = editingId ? dayMeals.find(m => m.id === editingId) ?? null : null
  const dateLabel = format(date, 'M월 d일 (eee)', { locale: ko })
  const repMealId = repMeals?.[dateStr]

  // 해당 날짜 식사 사진 lazy 로드
  useEffect(() => {
    dayMeals.forEach(m => { if (!m.photosLoaded) loadMealPhotos(m.id) })
  }, [dateStr, dayMeals.length])

  // 모드 전환 시 모달 컨테이너 맨 위로 스크롤
  useEffect(() => {
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [mode, editingId])

  // 끼니별 그룹화
  const groups = []
  MEAL_TIMES.forEach(time => {
    const timeMeals = dayMeals.filter(m => m.mealTime === time)
    if (timeMeals.length > 0) groups.push({ time, meals: timeMeals })
  })
  const otherMeals = dayMeals.filter(m => !MEAL_TIMES.includes(m.mealTime))
  if (otherMeals.length > 0) groups.push({ time: '', meals: otherMeals })

  function handleAdd(data) {
    setMode('list')
    return addMeal(data)
  }

  function handleEdit(data) {
    updateMeal(editingId, data)
    setEditingId(null)
  }

  function handleDelete(id) {
    if (confirm('이 기록을 삭제할까요?')) {
      deleteMeal(id)
      if (dayMeals.length === 1) setMode('form')
    }
  }

  function handleEditClick(meal) {
    if (!meal.photosLoaded) loadMealPhotos(meal.id)
    setEditingId(meal.id)
  }

  // 수정 모드
  if (editingId) {
    if (!editing?.photosLoaded) {
      return (
        <div ref={topRef}>
          <button
            onClick={() => setEditingId(null)}
            className="flex items-center gap-1 text-sm text-warm-light mb-5 hover:text-warm-brown transition-colors"
          >
            ← {dateLabel}
          </button>
          <div className="py-10 text-center text-sm text-cream-400">불러오는 중...</div>
        </div>
      )
    }
    return (
      <div ref={topRef}>
        <button
          onClick={() => setEditingId(null)}
          className="flex items-center gap-1 text-sm text-warm-light mb-5 hover:text-warm-brown transition-colors"
        >
          ← {dateLabel}
        </button>
        <MealForm
          date={date}
          initial={editing}
          onSubmit={handleEdit}
          onCancel={() => setEditingId(null)}
        />
      </div>
    )
  }

  // 입력 폼 모드
  if (mode === 'form') {
    return (
      <div ref={topRef}>
        {dayMeals.length > 0 && (
          <button
            onClick={() => setMode('list')}
            className="flex items-center gap-1 text-sm text-warm-light mb-5 hover:text-warm-brown transition-colors"
          >
            ← {dateLabel} 기록 보기
          </button>
        )}
        <MealForm
          date={date}
          onSubmit={handleAdd}
          onCancel={dayMeals.length > 0 ? () => setMode('list') : onClose}
        />
      </div>
    )
  }

  // 목록 모드 — 끼니별 섹션
  return (
    <div ref={topRef}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs text-warm-light mb-0.5">식사 기록</p>
          <h3 className="font-semibold text-warm-dark text-base">{dateLabel}</h3>
        </div>
        <button
          onClick={() => setMode('form')}
          className="text-sm bg-warm-brown text-white px-4 py-2 rounded-full hover:bg-warm-dark transition-colors font-medium"
        >
          + 추가
        </button>
      </div>

      <div className="space-y-4">
        {groups.map(({ time, meals }) => (
          <div key={time || 'other'}>
            {time && (
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-warm-brown">{time}</span>
                <div className="flex-1 h-px bg-cream-200" />
              </div>
            )}
            <div className="space-y-3">
              {meals.map(meal => (
                <DayMealCard
                  key={meal.id}
                  meal={meal}
                  isRep={meal.id === repMealId}
                  showRepBtn={dayMeals.length > 1}
                  onSetRep={() => onSetRepMeal?.(dateStr, meal.id)}
                  onView={onViewMeal ? () => onViewMeal(meal) : undefined}
                  onEdit={() => handleEditClick(meal)}
                  onDelete={() => handleDelete(meal.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
