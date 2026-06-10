import { useState, useRef } from 'react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addDays, isSameMonth, isSameDay, isToday, addMonths, subMonths,
} from 'date-fns'
import { ko } from 'date-fns/locale'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

export default function CalendarGrid({ meals = [], onDayClick }) {
  const [current, setCurrent] = useState(new Date())
  const touchStartX = useRef(null)

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
    return meals.filter(m => isSameDay(new Date(m.date), date))
  }

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) < 50) return
    if (dx < 0) setCurrent(prev => addMonths(prev, 1))
    else setCurrent(prev => subMonths(prev, 1))
    touchStartX.current = null
  }

  return (
    <div
      className="px-4 select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-5">
        <button
          onClick={() => setCurrent(subMonths(current, 1))}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-cream-200 text-warm-brown transition-colors text-lg"
        >
          ‹
        </button>
        <h2 className="text-base font-semibold text-warm-dark tracking-wide">
          {format(current, 'yyyy년 M월', { locale: ko })}
        </h2>
        <button
          onClick={() => setCurrent(addMonths(current, 1))}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-cream-200 text-warm-brown transition-colors text-lg"
        >
          ›
        </button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-2">
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
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          const dayMeals = getMealsForDay(day)
          const hasMeals = dayMeals.length > 0
          const thumbPhoto = dayMeals.find(m => m.photos?.[0])?.photos?.[0]
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
                ${hasMeals ? 'min-h-[72px]' : 'min-h-[56px]'}
                ${today && !hasMeals ? 'ring-1 ring-warm-brown/40 bg-warm-brown/5' : ''}
                ${!hasMeals ? 'hover:bg-cream-100' : ''}
              `}
            >
              {/* 사진 썸네일 배경 */}
              {thumbPhoto && (
                <div className="absolute inset-0">
                  <img src={thumbPhoto} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/25" />
                </div>
              )}

              {/* 사진 없이 기록만 있는 날 */}
              {hasMeals && !thumbPhoto && (
                <div className="absolute inset-0 bg-cream-200" />
              )}

              {/* 날짜 숫자 */}
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

              {/* 식사 개수 뱃지 */}
              {hasMeals && (
                <div className="relative z-10 pb-1.5 flex justify-center">
                  <span
                    className={`
                      text-[9px] font-medium px-1.5 py-0.5 rounded-full
                      ${thumbPhoto ? 'bg-white/30 text-white' : 'bg-warm-brown/20 text-warm-brown'}
                    `}
                  >
                    {dayMeals.length > 1 ? `+${dayMeals.length}` : dayMeals[0].title || dayMeals[0].restaurantName || '식사'}
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
