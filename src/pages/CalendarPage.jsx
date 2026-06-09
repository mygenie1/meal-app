import { useState } from 'react'
import { format, startOfMonth, endOfMonth, isSameMonth } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import Modal from '../components/common/Modal'
import CalendarGrid from '../components/Calendar/CalendarGrid'
import DayDetail from '../components/MealRecord/DayDetail'
import { useNavigate } from 'react-router-dom'

function getMonthlyStat(meals) {
  const now = new Date()
  const count = meals.filter(m => {
    const d = new Date(m.date)
    return isSameMonth(d, now)
  }).length
  return count
}

function StatBanner({ space }) {
  const count = getMonthlyStat(space.meals || [])
  const month = format(new Date(), 'M', { locale: ko })

  const messages = [
    count === 0 ? `${month}월의 첫 번째 식사를 기록해봐요` : null,
    count === 1 ? `${month}월에 첫 끼를 함께 했어요 🌱` : null,
    count >= 2 && count < 5 ? `${month}월에 ${count}번 함께 먹었어요` : null,
    count >= 5 && count < 10 ? `${month}월에 벌써 ${count}번이나 함께 먹었어요 ✨` : null,
    count >= 10 ? `${month}월의 단골 멤버! ${count}번 함께 먹었어요 🏆` : null,
  ].find(m => m !== null)

  return (
    <div className="mx-4 mb-4 px-4 py-3 bg-cream-100 rounded-2xl">
      <div className="flex items-center gap-2">
        <span className="text-lg">{space.emoji}</span>
        <div>
          <p className="text-xs text-warm-light font-medium">{space.name}</p>
          <p className="text-sm text-warm-dark">{messages}</p>
        </div>
      </div>
    </div>
  )
}

export default function CalendarPage() {
  const { currentSpace, spaces } = useApp()
  const [selectedDay, setSelectedDay] = useState(null)
  const navigate = useNavigate()

  const meals = currentSpace?.meals || []

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
      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-cream-50/90 backdrop-blur-sm border-b border-cream-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-warm-dark">식탁 일기</h1>
          <button
            onClick={() => navigate('/spaces')}
            className="text-xs text-warm-light bg-cream-200 px-3 py-1 rounded-full hover:bg-cream-300 transition-colors"
          >
            {currentSpace?.emoji} {currentSpace?.name}
          </button>
        </div>
      </header>

      <div className="pb-28 pt-4">
        {/* 월간 통계 배너 */}
        {currentSpace && <StatBanner space={currentSpace} />}

        <CalendarGrid meals={meals} onDayClick={setSelectedDay} />
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
          />
        )}
      </Modal>
    </>
  )
}
