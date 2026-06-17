import { useState, useRef, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, isSameMonth, addMonths, subMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import Modal from '../components/common/Modal'
import CalendarGrid from '../components/Calendar/CalendarGrid'
import DayDetail from '../components/MealRecord/DayDetail'
import MealDetailModal from '../components/MealRecord/MealDetailModal'
import { useNavigate } from 'react-router-dom'

const TAG_COLOR = { '집밥': '#2f9e5f', '외식': '#d6862c', '카페': '#d15c87', '배달': '#5276c4' }

function StatBanner({ space, displayMonth }) {
  const base = displayMonth || new Date()
  const count = (space.meals || []).filter(m => isSameMonth(new Date(m.date), base)).length
  const month = format(base, 'M', { locale: ko })

  const messages = [
    count === 0 ? `${month}월의 첫 번째 식사를 기록해봐요` : null,
    count === 1 ? `${month}월에 첫 끼를 함께 했어요 🌱` : null,
    count >= 2 && count < 5 ? `${month}월에 ${count}번 함께 먹었어요` : null,
    count >= 5 && count < 10 ? `${month}월에 벌써 ${count}번이나 함께 먹었어요 ✨` : null,
    count >= 10 ? `${month}월의 단골 멤버! ${count}번 함께 먹었어요 🏆` : null,
  ].find(m => m !== null)

  return (
    <div className="mx-4 mb-3 px-4 py-3.5 bg-cream-100 rounded-2xl flex items-center gap-3">
      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg shrink-0">
        {space.emoji}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-warm-dark truncate">{space.name}</p>
        <p className="text-sm text-warm-light leading-snug">{messages}</p>
      </div>
    </div>
  )
}

function loadRepMeals(spaceId) {
  if (!spaceId) return {}
  try {
    const raw = localStorage.getItem(`mealapp_rep_${spaceId}`)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveRepMeals(spaceId, map) {
  if (!spaceId) return
  try { localStorage.setItem(`mealapp_rep_${spaceId}`, JSON.stringify(map)) } catch {}
}

export default function CalendarPage() {
  const { currentSpace, spaces, loadMealPhotos } = useApp()
  const [selectedDay, setSelectedDay] = useState(null)
  const [viewingMeal, setViewingMeal] = useState(null)
  const [displayMonth, setDisplayMonth] = useState(new Date())
  const [filter, setFilter] = useState('전체')
  const [repMeals, setRepMeals] = useState({})
  const requestedPhotosRef = useRef(new Set())
  const navigate = useNavigate()

  const meals = currentSpace?.meals || []

  // 스페이스 전환 시 대표 게시글 로드
  useEffect(() => {
    setRepMeals(loadRepMeals(currentSpace?.id))
  }, [currentSpace?.id])

  // 현재 달 ±1달 사진 미리 로딩 (총 3달치)
  useEffect(() => {
    if (!currentSpace) return
    const prev = subMonths(displayMonth, 1)
    const next = addMonths(displayMonth, 1)
    ;(currentSpace.meals || []).forEach(m => {
      if (!m.date || m.photosLoaded || requestedPhotosRef.current.has(m.id)) return
      try {
        const mealDate = new Date(m.date)
        if (
          isSameMonth(mealDate, displayMonth) ||
          isSameMonth(mealDate, prev) ||
          isSameMonth(mealDate, next)
        ) {
          requestedPhotosRef.current.add(m.id)
          loadMealPhotos(m.id)
        }
      } catch {}
    })
  }, [displayMonth, currentSpace?.id, currentSpace?.meals?.length])

  function handleSetRepMeal(dateStr, mealId) {
    const updated = { ...repMeals, [dateStr]: mealId }
    setRepMeals(updated)
    saveRepMeals(currentSpace?.id, updated)
  }

  if (spaces.length === 0) {
    return (
      <>
        <header className="sticky top-0 z-40 bg-cream-50/90 backdrop-blur-sm border-b border-cream-200 px-4 py-3">
          <h1 className="text-base font-semibold text-warm-dark">식탁 일기</h1>
        </header>
        <div className="flex flex-col items-center justify-center flex-1 text-center px-8 py-16">
          <div className="w-16 h-16 rounded-full bg-cream-200 flex items-center justify-center mb-5">
            <svg className="w-8 h-8 text-warm-light" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="font-semibold text-warm-dark text-lg mb-2">식탁 일기를 시작해볼까요?</p>
          <p className="text-sm text-warm-light leading-relaxed mb-6">
            함께 먹은 순간들을 기록하고<br />우리만의 맛집 지도를 만들어요
          </p>
          <button
            onClick={() => navigate('/spaces')}
            className="bg-warm-brown text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-warm-dark transition-colors"
          >
            스페이스 만들기
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="pb-28" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        {/* 단골 멤버 카드 */}
        {currentSpace && <StatBanner space={currentSpace} displayMonth={displayMonth} />}

        {/* 카테고리 범례 + 태그 필터 (한 줄) */}
        <div className="px-4 mb-3 flex items-center justify-between gap-3">
          <div className="flex gap-3 overflow-x-auto flex-1 min-w-0">
            {[
              { tag: '집밥', color: '#2f9e5f' },
              { tag: '외식', color: '#d6862c' },
              { tag: '카페', color: '#d15c87' },
              { tag: '배달', color: '#5276c4' },
            ].map(({ tag, color }) => (
              <div key={tag} className="flex items-center gap-1 shrink-0">
                <span className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[10px] text-warm-light">{tag}</span>
              </div>
            ))}
          </div>
          <div className="relative flex-shrink-0">
            {filter !== '전체' && (
              <span
                className="absolute left-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full pointer-events-none z-10"
                style={{ background: TAG_COLOR[filter] }}
              />
            )}
            <select
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className={`text-sm border border-cream-300 rounded-xl ${filter !== '전체' ? 'pl-7' : 'pl-3'} pr-7 py-1.5 bg-cream-50 text-warm-dark focus:outline-none focus:border-warm-light appearance-none cursor-pointer`}
            >
              {['전체', '집밥', '외식', '카페', '배달'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-cream-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        <CalendarGrid
          meals={meals}
          onDayClick={setSelectedDay}
          onMonthChange={setDisplayMonth}
          filter={filter}
          repMeals={repMeals}
        />
      </div>

      <Modal
        isOpen={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={null}
      >
        {selectedDay && (
          <DayDetail
            date={selectedDay}
            onClose={() => setSelectedDay(null)}
            onViewMeal={meal => setViewingMeal(meal)}
            repMeals={repMeals}
            onSetRepMeal={handleSetRepMeal}
          />
        )}
      </Modal>

      {viewingMeal && (
        <MealDetailModal
          meal={viewingMeal}
          onClose={() => setViewingMeal(null)}
        />
      )}
    </>
  )
}
