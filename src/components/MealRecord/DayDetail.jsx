import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../../context/AppContext'
import MealForm from './MealForm'
import LazyImage from '../common/LazyImage'
import StarRating from '../common/StarRating'
import { getOriginalUrl } from '../../lib/uploadPhoto'
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
  const cover = rawPhotos.map(p => getOriginalUrl(p)).find(Boolean) || ''
  const mealRatings = ratingsMap?.[meal.id] || []
  const avgRating = mealRatings.length > 0
    ? Math.floor(mealRatings.reduce((s, r) => s + r.rating, 0) / mealRatings.length)
    : meal.rating || 0
  const ratingCount = mealRatings.length
  const title = meal.title || meal.restaurantName || '식사 기록'
  const subName = meal.title && meal.restaurantName ? meal.restaurantName : null
  const tagLine = [meal.mealTime, meal.tag].filter(Boolean).join(' · ')
  const dateChip = (() => { try { return format(parseISO(meal.date), 'M.d eee', { locale: ko }) } catch { return '' } })()

  return (
    <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
      {/* 4:3 풀블리드 사진 + 오버레이 칩 */}
      <div
        onClick={onView}
        className={`relative w-full aspect-[4/3] bg-cream-100 ${onView ? 'cursor-pointer' : ''}`}
      >
        {!meal.photosLoaded ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-cream-300 border-t-warm-light rounded-full animate-spin" />
          </div>
        ) : cover ? (
          <LazyImage src={cover} alt="" className="w-full h-full" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg className="w-8 h-8 text-cream-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        )}
        {/* 날짜칩 (좌상단) */}
        {dateChip && (
          <span className="absolute top-2.5 left-2.5 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
            {dateChip}
          </span>
        )}
        {/* 끼니·태그 (우상단) */}
        {tagLine && (
          <span className="absolute top-2.5 right-2.5 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
            {tagLine}
          </span>
        )}
        {/* 대표 뱃지 (좌하단) */}
        {isRep && (
          <span className="absolute bottom-2.5 left-2.5 bg-warm-brown text-white text-[10px] px-1.5 py-0.5 rounded-full font-semibold">
            대표
          </span>
        )}
      </div>

      {/* 내용 — 클릭하면 상세 모달 */}
      <div
        onClick={onView}
        className={`p-4 ${onView ? 'cursor-pointer active:bg-cream-50' : ''}`}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-warm-dark text-base leading-snug truncate">{title}</p>
          {avgRating > 0 && (
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              <StarRating value={avgRating} readonly />
              {ratingCount >= 2 && <span className="text-[10px] text-cream-400">{ratingCount}명</span>}
            </div>
          )}
        </div>
        {subName && <p className="text-xs text-warm-light truncate mt-0.5">{subName}</p>}
        {meal.location && (
          <p className="text-xs text-cream-400 flex items-center gap-1 mt-1">
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
              <circle cx="12" cy="8" r="2" />
            </svg>
            <span className="truncate">{meal.location}</span>
          </p>
        )}
        {meal.review && (
          <p className="text-sm text-warm-light mt-1.5 leading-relaxed line-clamp-1 break-words">{linkify(meal.review)}</p>
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

  // 달력(onViewMeal 전달)에서 빈 날 클릭 → 빈 상태 카드.
  // 홈("오늘 기록하기", onViewMeal 없음)에서 빈 날 → 기존처럼 바로 입력 폼.
  const [mode, setMode] = useState(dayMeals.length === 0 && !onViewMeal ? 'form' : 'list')
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
          onCancel={() => { if (dayMeals.length === 0 && !onViewMeal) onClose(); else setMode('list') }}
        />
      </div>
    )
  }

  // 빈 날 — 빈 상태
  if (dayMeals.length === 0) {
    return (
      <div ref={topRef}>
        <div className="mb-4">
          <p className="text-xs text-warm-light mb-0.5">식사 기록</p>
          <h3 className="font-semibold text-warm-dark text-base">{dateLabel}</h3>
        </div>
        <div className="text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-cream-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-cream-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p className="text-base font-semibold text-warm-dark mb-1">이 날의 기록이 없어요</p>
          <p className="text-sm text-cream-400 mb-5">함께한 식탁을 남겨볼까요?</p>
          <button
            onClick={() => setMode('form')}
            className="bg-warm-brown text-white px-5 py-2.5 rounded-2xl text-sm font-medium hover:bg-warm-dark transition-colors active:scale-95"
          >
            + 이날 기록 추가
          </button>
        </div>
      </div>
    )
  }

  // 목록 모드 — 끼니별 섹션
  return (
    <div ref={topRef}>
      <div className="mb-4">
        <p className="text-xs text-warm-light mb-0.5">식사 기록</p>
        <h3 className="font-semibold text-warm-dark text-base">{dateLabel}</h3>
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

      {/* 이날 기록 추가 (outline) */}
      <button
        onClick={() => setMode('form')}
        className="w-full mt-4 py-3 rounded-2xl border border-cream-300 text-warm-brown text-sm font-medium hover:bg-cream-100 transition-colors active:scale-[0.98]"
      >
        + 이날 기록 추가
      </button>
    </div>
  )
}
