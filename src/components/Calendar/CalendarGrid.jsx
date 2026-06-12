import { useState, useRef, useEffect } from 'react'
import LazyImage from '../common/LazyImage'
import { getThumbUrl } from '../../lib/uploadPhoto'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, isToday, addMonths, subMonths,
  getYear, getMonth,
} from 'date-fns'
import { ko } from 'date-fns/locale'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const THIS_YEAR = getYear(new Date())
const YEARS = Array.from({ length: THIS_YEAR + 3 - 2020 }, (_, i) => 2020 + i)

// ─── 연/월 피커 패널 ──────────────────────────────────────────────────────
function MonthPicker({ current, onSelect, onClose }) {
  const [pickerYear, setPickerYear] = useState(getYear(current))
  const selectedMonth = getMonth(current) // 0-indexed

  return (
    <div className="bg-white rounded-2xl border border-cream-200 shadow-sm mx-4 mb-4 overflow-hidden">
      {/* 연도 선택 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cream-100">
        <button
          onClick={() => setPickerYear(y => Math.max(2020, y - 1))}
          disabled={pickerYear <= 2020}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-cream-100 text-warm-brown disabled:opacity-30 transition-colors text-lg"
        >
          ‹
        </button>
        <span className="text-base font-bold text-warm-dark">{pickerYear}년</span>
        <button
          onClick={() => setPickerYear(y => Math.min(THIS_YEAR + 2, y + 1))}
          disabled={pickerYear >= THIS_YEAR + 2}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-cream-100 text-warm-brown disabled:opacity-30 transition-colors text-lg"
        >
          ›
        </button>
      </div>

      {/* 월 선택 3×4 그리드 */}
      <div className="grid grid-cols-4 gap-2 p-4">
        {MONTH_NAMES.map((name, idx) => {
          const isCurrent = pickerYear === getYear(current) && idx === selectedMonth
          return (
            <button
              key={idx}
              onClick={() => onSelect(new Date(pickerYear, idx, 1))}
              className={`
                py-2.5 rounded-xl text-sm font-medium transition-colors active:scale-95
                ${isCurrent
                  ? 'bg-warm-brown text-white'
                  : 'hover:bg-cream-100 text-warm-dark'}
              `}
            >
              {name}
            </button>
          )
        })}
      </div>

      {/* 취소 */}
      <div className="px-4 pb-4">
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl border border-cream-200 text-warm-light text-sm hover:bg-cream-50 transition-colors"
        >
          취소
        </button>
      </div>
    </div>
  )
}

// ─── CalendarGrid ─────────────────────────────────────────────────────────
export default function CalendarGrid({ meals = [], onDayClick, onMonthChange, filter = '전체', repMeals = {} }) {
  const [current, setCurrent] = useState(new Date())
  const [showPicker, setShowPicker] = useState(false)
  const touchStartX = useRef(null)

  useEffect(() => {
    onMonthChange?.(current)
  }, [current])

  const monthStart = startOfMonth(current)
  const monthEnd = endOfMonth(current)
  const gridStart = startOfWeek(monthStart)
  const gridEnd = endOfWeek(monthEnd)

  const days = []
  let d = gridStart
  while (d <= gridEnd) {
    days.push(d)
    d = addDays(d, 1)
  }

  function getMealsForDay(date) {
    const dayMeals = meals.filter(m => isSameDay(new Date(m.date), date))
    return filter && filter !== '전체' ? dayMeals.filter(m => m.tag === filter) : dayMeals
  }

  function handleTouchStart(e) {
    if (showPicker) return
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (showPicker || touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) < 50) return
    if (dx < 0) setCurrent(prev => addMonths(prev, 1))
    else setCurrent(prev => subMonths(prev, 1))
    touchStartX.current = null
  }

  function handlePickerSelect(date) {
    setCurrent(date)
    setShowPicker(false)
  }

  return (
    <div
      className="select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between px-4 mb-4">
        <button
          onClick={() => { setCurrent(subMonths(current, 1)); setShowPicker(false) }}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-cream-200 text-warm-brown transition-colors text-lg"
        >
          ‹
        </button>

        {/* 연/월 텍스트 — 클릭하면 피커 토글 */}
        <button
          onClick={() => setShowPicker(v => !v)}
          className={`
            flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-colors
            ${showPicker ? 'bg-warm-brown/10 text-warm-brown' : 'hover:bg-cream-100 text-warm-dark'}
          `}
        >
          <span className="text-base font-semibold tracking-wide">
            {format(current, 'yyyy년 M월', { locale: ko })}
          </span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${showPicker ? 'rotate-180 text-warm-brown' : 'text-cream-400'}`}
            fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <button
          onClick={() => { setCurrent(addMonths(current, 1)); setShowPicker(false) }}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-cream-200 text-warm-brown transition-colors text-lg"
        >
          ›
        </button>
      </div>

      {/* 연/월 피커 패널 */}
      {showPicker && (
        <MonthPicker
          current={current}
          onSelect={handlePickerSelect}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 px-4 mb-2">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-xs font-medium py-1 ${
              i === 0 ? 'text-rose-400' : i === 6 ? 'text-blue-400' : 'text-cream-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1 px-4">
        {days.map((day, idx) => {
          const dayMeals = getMealsForDay(day)
          const hasMeals = dayMeals.length > 0
          const dateStr = format(day, 'yyyy-MM-dd')
          const repMealId = repMeals[dateStr]
          const repMeal = repMealId ? dayMeals.find(m => m.id === repMealId) : null
          const displayMeal = repMeal || dayMeals.find(m => m.photos?.[0]) || dayMeals[0]
          const thumbPhoto = displayMeal ? getThumbUrl(displayMeal.photos?.[0] || '') : ''
          const displayTitle = displayMeal?.title || displayMeal?.restaurantName || '식사'
          const inMonth = isSameMonth(day, current)
          const today = isToday(day)
          const dayOfWeek = idx % 7

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`
                relative rounded-2xl overflow-hidden transition-all active:scale-95
                ${inMonth ? '' : 'opacity-25'}
                ${hasMeals ? 'h-[96px]' : 'h-[56px]'}
                ${today && !hasMeals ? 'ring-1 ring-warm-brown/40 bg-warm-brown/5' : ''}
                ${!hasMeals ? 'hover:bg-cream-100' : ''}
              `}
            >
              {/* 게시글 수 배지 */}
              {hasMeals && dayMeals.length > 1 && (
                <div className="absolute top-1 right-1 bg-warm-brown text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center z-20 leading-none">
                  {dayMeals.length}
                </div>
              )}
              {thumbPhoto && (
                <div className="absolute inset-0">
                  <LazyImage src={thumbPhoto} alt="" className="w-full h-full" />
                  <div className="absolute inset-0 bg-black/25" />
                </div>
              )}
              {hasMeals && !thumbPhoto && (
                <div className="absolute inset-0 bg-cream-200" />
              )}
              <div className="relative z-10 p-1.5">
                <span
                  className={`
                    text-xs font-semibold block text-center leading-5 w-5 h-5 mx-auto rounded-full
                    ${today ? 'bg-warm-brown text-white' : ''}
                    ${!today && thumbPhoto ? 'text-white' : ''}
                    ${!today && !thumbPhoto && hasMeals ? 'text-warm-dark' : ''}
                    ${!today && !hasMeals && dayOfWeek === 0 ? 'text-rose-400' : ''}
                    ${!today && !hasMeals && dayOfWeek === 6 ? 'text-blue-400' : ''}
                    ${!today && !hasMeals && dayOfWeek !== 0 && dayOfWeek !== 6 ? 'text-warm-dark' : ''}
                  `}
                >
                  {format(day, 'd')}
                </span>
              </div>
              {hasMeals && (
                <div className="relative z-10 px-1.5 pb-1.5">
                  <span
                    className={`
                      text-[9px] font-medium px-1 py-0.5 rounded-lg w-full
                      ${thumbPhoto ? 'bg-white/30 text-white' : 'bg-warm-brown/20 text-warm-brown'}
                    `}
                    style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      wordBreak: 'break-all',
                    }}
                  >
                    {displayTitle}
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
