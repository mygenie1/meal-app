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
  const touchStartY = useRef(null)

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
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e) {
    if (showPicker || touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    touchStartX.current = null
    touchStartY.current = null
    // 수평 이동이 50px 이상이고 수직 이동보다 커야 스와이프로 인식
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return
    if (dx < 0) setCurrent(prev => addMonths(prev, 1))
    else setCurrent(prev => subMonths(prev, 1))
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

      {/* 날짜 그리드 — 모든 셀 고정 정사각형 */}
      <div className="grid grid-cols-7 gap-1 px-4">
        {days.map((day) => {
          const dayMeals = getMealsForDay(day)
          const hasMeals = dayMeals.length > 0
          const dateStr = format(day, 'yyyy-MM-dd')
          const repMealId = repMeals[dateStr]
          const repMeal = repMealId ? dayMeals.find(m => m.id === repMealId) : null
          const displayMeal = repMeal || dayMeals.find(m => m.photos?.[0]) || dayMeals[0]
          const thumbPhoto = displayMeal ? getThumbUrl(displayMeal.photos?.[0] || '') : ''
          const inMonth = isSameMonth(day, current)
          const today = isToday(day)

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDayClick(day)}
              className={`
                relative aspect-square rounded-lg overflow-hidden transition-all active:scale-95
                ${!inMonth ? 'opacity-30' : ''}
                ${today && hasMeals ? 'ring-2 ring-warm-brown ring-inset' : ''}
              `}
            >
              {hasMeals ? (
                <>
                  {/* 사진 배경 (없으면 베이지) */}
                  {thumbPhoto ? (
                    <div className="absolute inset-0">
                      <LazyImage src={thumbPhoto} alt="" className="w-full h-full" />
                      <div className="absolute inset-0 bg-black/20" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 bg-cream-200" />
                  )}
                  {/* 위시리스트 방문 점 */}
                  {dayMeals.some(m => m.fromWishlist) && (
                    <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-rose-400 z-20 shadow-sm" />
                  )}
                  {/* 날짜 숫자 (우상단) */}
                  <span className={`absolute top-0.5 right-1 text-[10px] font-medium z-10 ${thumbPhoto ? 'text-white drop-shadow-sm' : 'text-warm-dark'}`}>
                    {format(day, 'd')}
                  </span>
                  {/* 여러 끼니 기록 — 우하단 숫자 뱃지 */}
                  {dayMeals.length > 1 && (
                    <span className="absolute bottom-0.5 right-0.5 bg-warm-brown text-white text-[9px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center z-20 leading-none">
                      {dayMeals.length}
                    </span>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 bg-cream-50 flex items-center justify-center">
                  <span className={`text-xs ${today ? 'bg-warm-brown text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-warm-dark'}`}>
                    {format(day, 'd')}
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
