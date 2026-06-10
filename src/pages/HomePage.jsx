import { useState, useMemo } from 'react'
import { format, isSameMonth, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
import MealDetailModal from '../components/MealRecord/MealDetailModal'

const TAG_STYLES = {
  '집밥': 'bg-green-50 text-green-700',
  '외식': 'bg-amber-50 text-amber-700',
  '카페': 'bg-pink-50 text-pink-700',
  '배달': 'bg-blue-50 text-blue-700',
}

const TAG_BG = {
  '집밥': '#86efac',
  '외식': '#fcd34d',
  '카페': '#f9a8d4',
  '배달': '#93c5fd',
}

function PhotoPlaceholder() {
  return (
    <div className="w-full bg-cream-100 flex items-center justify-center" style={{ height: '180px' }}>
      <svg className="w-10 h-10 text-cream-300" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
  )
}

function FeedCard({ meal, onClick }) {
  const dateObj = parseISO(meal.date)
  const title = meal.title || meal.restaurantName || '식사 기록'

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-cream-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow active:scale-[0.99]"
    >
      {meal.photo ? (
        <img
          src={meal.photo}
          alt="식사 사진"
          className="w-full object-cover"
          style={{ height: '200px' }}
        />
      ) : (
        <PhotoPlaceholder />
      )}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-warm-dark text-base leading-snug">{title}</p>
          {meal.tag && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${TAG_STYLES[meal.tag] || 'bg-cream-100 text-warm-light'}`}>
              {meal.tag}
            </span>
          )}
        </div>
        {meal.title && meal.restaurantName && (
          <p className="text-xs text-warm-light mb-1 truncate">{meal.restaurantName}</p>
        )}
        <div className="flex items-center gap-2">
          <p className="text-xs text-cream-400">
            {format(dateObj, 'yyyy.M.d (eee)', { locale: ko })}
          </p>
          {meal.rating > 0 && (
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map(i => (
                <span key={i} className={`text-sm leading-none ${i <= meal.rating ? 'star-filled' : 'star-empty'}`}>★</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  )
}

export default function HomePage() {
  const { currentSpace, spaces } = useApp()
  const navigate = useNavigate()
  const [selectedMeal, setSelectedMeal] = useState(null)

  const meals = currentSpace?.meals || []

  const stats = useMemo(() => {
    const now = new Date()
    const totalCount = meals.length
    const thisMonthCount = meals.filter(m => {
      try { return isSameMonth(parseISO(m.date), now) } catch { return false }
    }).length

    const restaurantCounts = {}
    meals.forEach(m => {
      if (m.restaurantName) restaurantCounts[m.restaurantName] = (restaurantCounts[m.restaurantName] || 0) + 1
    })
    const topRestaurants = Object.entries(restaurantCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    const tagCounts = {}
    meals.forEach(m => {
      if (m.tag) tagCounts[m.tag] = (tagCounts[m.tag] || 0) + 1
    })
    const topTagEntry = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0] || null

    const fiveStarCount = meals.filter(m => m.rating === 5).length

    return { totalCount, thisMonthCount, topRestaurants, topTagEntry, fiveStarCount }
  }, [meals])

  const sortedMeals = useMemo(
    () => [...meals].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [meals]
  )

  if (spaces.length === 0) {
    return (
      <>
        <header className="sticky top-0 z-40 bg-cream-50/90 backdrop-blur-sm border-b border-cream-200 px-4 py-3">
          <h1 className="text-base font-semibold text-warm-dark">식탁 일기</h1>
        </header>
        <div className="flex flex-col items-center justify-center flex-1 text-center px-8 py-20">
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

      <div className="pb-28 pt-5">
        {/* ── 통계 카드 (가로 스크롤) ── */}
        <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
          {/* 함께한 식사 */}
          <div className="shrink-0 w-32 bg-white rounded-2xl border border-cream-200 px-4 py-4">
            <p className="text-[11px] text-warm-light mb-1">함께한 식사</p>
            <p className="text-3xl font-bold text-warm-dark leading-none">
              {stats.totalCount}
              <span className="text-sm font-normal text-warm-light ml-0.5">번</span>
            </p>
          </div>

          {/* 이번 달 */}
          <div className="shrink-0 w-32 bg-white rounded-2xl border border-cream-200 px-4 py-4">
            <p className="text-[11px] text-warm-light mb-1">이번 달</p>
            <p className="text-3xl font-bold text-warm-dark leading-none">
              {stats.thisMonthCount}
              <span className="text-sm font-normal text-warm-light ml-0.5">번</span>
            </p>
          </div>

          {/* 자주 찾은 곳 */}
          <div className="shrink-0 w-44 bg-white rounded-2xl border border-cream-200 px-4 py-4">
            <p className="text-[11px] text-warm-light mb-2">자주 찾은 곳</p>
            {stats.topRestaurants.length > 0 ? (
              <div className="space-y-1.5">
                {stats.topRestaurants.map(([name, count], i) => (
                  <div key={name} className="flex items-center justify-between gap-1">
                    <span className="text-xs text-warm-dark truncate">
                      <span className="text-cream-400 mr-1">{i + 1}.</span>{name}
                    </span>
                    <span className="text-[11px] text-cream-400 shrink-0">{count}회</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-cream-400">아직 없어요</p>
            )}
          </div>

          {/* 즐겨 먹는 것 */}
          <div className="shrink-0 w-36 bg-white rounded-2xl border border-cream-200 px-4 py-4">
            <p className="text-[11px] text-warm-light mb-2">즐겨 먹는 것</p>
            {stats.topTagEntry ? (
              <div className="space-y-1">
                <span
                  className="inline-block text-xs px-2.5 py-1 rounded-full font-medium text-warm-dark"
                  style={{ background: (TAG_BG[stats.topTagEntry[0]] || '#e5ddd5') + '55' }}
                >
                  {stats.topTagEntry[0]}
                </span>
                <p className="text-xs text-cream-400">{stats.topTagEntry[1]}번</p>
              </div>
            ) : (
              <p className="text-xs text-cream-400">아직 없어요</p>
            )}
          </div>

          {/* 최애 맛집 (별점 5점) */}
          <div className="shrink-0 w-36 bg-white rounded-2xl border border-cream-200 px-4 py-4">
            <p className="text-[11px] text-warm-light mb-1">최애 맛집</p>
            {stats.fiveStarCount > 0 ? (
              <>
                <p className="text-3xl font-bold text-warm-dark leading-none">
                  {stats.fiveStarCount}
                  <span className="text-sm font-normal text-warm-light ml-0.5">곳</span>
                </p>
                <div className="flex gap-0.5 mt-1.5">
                  {[1,2,3,4,5].map(i => (
                    <span key={i} className="text-xs star-filled">★</span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-cream-400">아직 없어요</p>
            )}
          </div>
        </div>

        {/* ── 최근 기록 피드 ── */}
        <div className="flex items-center justify-between px-4 mt-7 mb-3">
          <h2 className="text-sm font-semibold text-warm-dark">최근 기록</h2>
          {sortedMeals.length > 0 && (
            <button
              onClick={() => navigate('/calendar')}
              className="text-xs text-warm-light hover:text-warm-brown transition-colors"
            >
              달력 보기 →
            </button>
          )}
        </div>

        {sortedMeals.length > 0 ? (
          <div className="px-4 space-y-3">
            {sortedMeals.map(meal => (
              <FeedCard
                key={meal.id}
                meal={meal}
                onClick={() => setSelectedMeal(meal)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-8 py-12">
            <div className="w-14 h-14 rounded-full bg-cream-200 flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-warm-light" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
            </div>
            <p className="text-sm font-medium text-warm-dark mb-1">아직 기록이 없어요</p>
            <p className="text-xs text-warm-light mb-5">첫 번째 식사를 기록해볼까요?</p>
            <button
              onClick={() => navigate('/calendar')}
              className="bg-warm-brown text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-warm-dark transition-colors active:scale-95"
            >
              달력에서 기록하기
            </button>
          </div>
        )}
      </div>

      {selectedMeal && (
        <MealDetailModal
          meal={selectedMeal}
          onClose={() => setSelectedMeal(null)}
        />
      )}
    </>
  )
}
