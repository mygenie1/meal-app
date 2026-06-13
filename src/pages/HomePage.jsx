import { useState, useMemo, useEffect, useRef } from 'react'
import { format, isSameMonth, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
import MealDetailModal from '../components/MealRecord/MealDetailModal'
import Modal from '../components/common/Modal'
import DayDetail from '../components/MealRecord/DayDetail'
import PhotoGallery from '../components/common/PhotoGallery'
import { getOriginalUrl } from '../lib/uploadPhoto'
import AuthorBadge from '../components/common/AuthorBadge'
import NotificationPanel, { NotificationBell } from '../components/common/NotificationPanel'

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

const PAGE_SIZE = 20

const RATING_FILTERS = [
  { key: '', label: '전체' },
  { key: '3+', label: '★3점+' },
  { key: '4+', label: '★4점+' },
  { key: '5',  label: '★5점' },
]

const TAG_FILTERS = ['전체', '집밥', '외식', '카페', '배달']

function FeedCard({ meal, onClick }) {
  const { ratingsMap } = useApp()
  const dateObj = parseISO(meal.date)
  const title = meal.title || meal.restaurantName || '식사 기록'
  const photos = (meal.photos?.length > 0 ? meal.photos : (meal.photo ? [meal.photo] : []))
    .map(p => getOriginalUrl(p))
    .filter(Boolean)
  const showPhotos = meal.photosLoaded && photos.length > 0
  const mealRatings = ratingsMap?.[meal.id] || []
  const avgRating = mealRatings.length > 0
    ? Math.floor(mealRatings.reduce((s, r) => s + r.rating, 0) / mealRatings.length)
    : meal.rating || 0
  const ratingCount = mealRatings.length

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-cream-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow active:scale-[0.99]"
    >
      {showPhotos && <PhotoGallery photos={photos} maxHeight={200} />}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-warm-dark text-base leading-snug">{title}</p>
          <div className="flex items-center gap-1 shrink-0">
            {meal.mealTime && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cream-200 text-warm-light font-medium">
                {meal.mealTime}
              </span>
            )}
            {meal.tag && (
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${TAG_STYLES[meal.tag] || 'bg-cream-100 text-warm-light'}`}>
                {meal.tag}
              </span>
            )}
          </div>
        </div>
        {meal.title && meal.restaurantName && (
          <p className="text-xs text-warm-light mb-1 truncate">{meal.restaurantName}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {meal.fromWishlist && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-50 text-rose-400 font-medium border border-rose-100 flex items-center gap-0.5 shrink-0">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              가고 싶었던 곳
            </span>
          )}
          <p className="text-xs text-cream-400">
            {format(dateObj, 'yyyy.M.d (eee)', { locale: ko })}
          </p>
          {avgRating > 0 && (
            <div className="flex items-center gap-1">
              <div className="flex gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <span key={i} className={`text-sm leading-none ${i <= avgRating ? 'star-filled' : 'star-empty'}`}>★</span>
                ))}
              </div>
              {ratingCount >= 2 && (
                <span className="text-[10px] text-cream-400">{ratingCount}명</span>
              )}
            </div>
          )}
        </div>
        <AuthorBadge meal={meal} className="mt-2" />
      </div>
    </button>
  )
}

export default function HomePage() {
  const { currentSpace, spaces, loadMealPhotos } = useApp()
  const navigate = useNavigate()
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [todayFormOpen, setTodayFormOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [ratingFilter, setRatingFilter] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const sentinelRef = useRef(null)
  const requestedPhotosRef = useRef(new Set())
  const searchInputRef = useRef(null)
  const today = useMemo(() => new Date(), [])

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

  const MEAL_TIME_ORDER = { 아침: 0, 점심: 1, 저녁: 2 }
  const sortedMeals = useMemo(
    () => [...meals].sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date)
      if (dateDiff !== 0) return dateDiff
      return (MEAL_TIME_ORDER[a.mealTime] ?? 1) - (MEAL_TIME_ORDER[b.mealTime] ?? 1)
    }),
    [meals]
  )

  const filteredMeals = useMemo(() => {
    return sortedMeals.filter(m => {
      const r = m.rating || 0
      if (ratingFilter === '3+' && r < 3) return false
      if (ratingFilter === '4+' && r < 4) return false
      if (ratingFilter === '5'  && r !== 5) return false
      if (tagFilter && m.tag !== tagFilter) return false
      return true
    })
  }, [sortedMeals, ratingFilter, tagFilter])

  const visibleMeals = filteredMeals.slice(0, visibleCount)
  const hasMore = visibleCount < filteredMeals.length

  // 검색 결과
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    return sortedMeals.filter(m =>
      (m.title && m.title.toLowerCase().includes(q)) ||
      (m.restaurantName && m.restaurantName.toLowerCase().includes(q)) ||
      (m.review && m.review.toLowerCase().includes(q)) ||
      (m.memo && m.memo.toLowerCase().includes(q))
    )
  }, [searchQuery, sortedMeals])

  // 필터 변경 시 페이지 리셋
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [ratingFilter, tagFilter])

  // 보이는 카드만 사진 로드
  useEffect(() => {
    visibleMeals.forEach(m => {
      if (!m.photosLoaded && !requestedPhotosRef.current.has(m.id)) {
        requestedPhotosRef.current.add(m.id)
        loadMealPhotos(m.id)
      }
    })
  }, [visibleMeals])

  // 검색 결과 사진 로드
  useEffect(() => {
    if (!searchQuery.trim()) return
    searchResults.forEach(m => {
      if (!m.photosLoaded && !requestedPhotosRef.current.has(m.id)) {
        requestedPhotosRef.current.add(m.id)
        loadMealPhotos(m.id)
      }
    })
  }, [searchResults])

  // 무한 스크롤
  useEffect(() => {
    if (!hasMore) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisibleCount(c => c + PAGE_SIZE) },
      { rootMargin: '200px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, filteredMeals.length])

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
        {searchOpen ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery('') }}
              className="p-1 -ml-1 text-warm-light hover:text-warm-brown transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="제목, 식당명, 한줄평, 메모 검색"
              autoFocus
              className="flex-1 bg-transparent text-sm text-warm-dark outline-none placeholder-cream-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-cream-400 hover:text-warm-light transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <h1 className="text-base font-semibold text-warm-dark">식탁 일기</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-1.5 text-warm-light hover:text-warm-brown transition-colors"
              >
                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
              </button>
              <NotificationBell onClick={() => setNotifOpen(true)} />
              <button
                onClick={() => navigate('/spaces')}
                className="text-xs text-warm-light bg-cream-200 px-3 py-1 rounded-full hover:bg-cream-300 transition-colors"
              >
                {currentSpace?.emoji} {currentSpace?.name}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 검색 결과 화면 */}
      {searchOpen && (
        <div className="pb-28 pt-4 px-4">
          {!searchQuery.trim() ? (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <svg className="w-10 h-10 text-cream-300 mb-3" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <p className="text-sm text-cream-400">검색어를 입력해주세요</p>
              <p className="text-xs text-cream-300 mt-1">제목, 식당명, 한줄평, 메모</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <p className="text-sm font-medium text-warm-dark mb-1">검색 결과가 없어요</p>
              <p className="text-xs text-warm-light">다른 키워드로 검색해보세요</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-warm-light mb-3">
                <span className="font-medium text-warm-brown">"{searchQuery}"</span> 검색 결과 {searchResults.length}건
              </p>
              <div className="space-y-3">
                {searchResults.map(meal => (
                  <FeedCard key={meal.id} meal={meal} onClick={() => setSelectedMeal(meal)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className={`pb-28 pt-5 ${searchOpen ? 'hidden' : ''}`}>
        {/* 오늘 식사 기록 버튼 */}
        <div className="px-4 mb-5">
          <button
            onClick={() => setTodayFormOpen(true)}
            className="w-full flex items-center gap-3 bg-white border border-cream-200 rounded-2xl px-4 py-3 hover:bg-cream-50 transition-colors active:scale-[0.99] text-left shadow-sm"
          >
            <div className="w-9 h-9 bg-warm-brown/10 rounded-xl flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-warm-brown" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-warm-dark">오늘 식사 기록하기</p>
              <p className="text-xs text-warm-light">{format(today, 'M월 d일 (eee)', { locale: ko })}</p>
            </div>
            <svg className="w-4 h-4 text-cream-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* 통계 카드 */}
        <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide">
          <div className="shrink-0 w-32 bg-white rounded-2xl border border-cream-200 px-4 py-4">
            <p className="text-[11px] text-warm-light mb-1">함께한 식사</p>
            <p className="text-3xl font-bold text-warm-dark leading-none">
              {stats.totalCount}<span className="text-sm font-normal text-warm-light ml-0.5">번</span>
            </p>
          </div>
          <div className="shrink-0 w-32 bg-white rounded-2xl border border-cream-200 px-4 py-4">
            <p className="text-[11px] text-warm-light mb-1">이번 달</p>
            <p className="text-3xl font-bold text-warm-dark leading-none">
              {stats.thisMonthCount}<span className="text-sm font-normal text-warm-light ml-0.5">번</span>
            </p>
          </div>
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
          <div className="shrink-0 w-36 bg-white rounded-2xl border border-cream-200 px-4 py-4">
            <p className="text-[11px] text-warm-light mb-1">최애 맛집</p>
            {stats.fiveStarCount > 0 ? (
              <>
                <p className="text-3xl font-bold text-warm-dark leading-none">
                  {stats.fiveStarCount}<span className="text-sm font-normal text-warm-light ml-0.5">곳</span>
                </p>
                <div className="flex gap-0.5 mt-1.5">
                  {[1,2,3,4,5].map(i => <span key={i} className="text-xs star-filled">★</span>)}
                </div>
              </>
            ) : (
              <p className="text-xs text-cream-400">아직 없어요</p>
            )}
          </div>
        </div>

        {/* 최근 기록 헤더 */}
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

        {/* 필터 */}
        {sortedMeals.length > 0 && (
          <div className="space-y-2 mb-4">
            {/* 별점 필터 */}
            <div className="flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-hide">
              {RATING_FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setRatingFilter(key)}
                  className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors active:scale-95 border ${
                    ratingFilter === key
                      ? 'bg-warm-brown text-white border-warm-brown shadow-sm'
                      : 'bg-cream-100 text-warm-brown border-cream-200 hover:bg-cream-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* 분류 필터 */}
            <div className="flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-hide">
              {TAG_FILTERS.map(t => (
                <button
                  key={t}
                  onClick={() => setTagFilter(t === '전체' ? '' : t)}
                  className={`flex items-center px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors active:scale-95 border ${
                    (t === '전체' ? tagFilter === '' : tagFilter === t)
                      ? 'bg-warm-brown text-white border-warm-brown shadow-sm'
                      : 'bg-cream-100 text-warm-brown border-cream-200 hover:bg-cream-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 피드 */}
        {filteredMeals.length > 0 ? (
          <>
            <div className="px-4 space-y-3">
              {visibleMeals.map(meal => (
                <FeedCard
                  key={meal.id}
                  meal={meal}
                  onClick={() => setSelectedMeal(meal)}
                />
              ))}
            </div>
            {hasMore && (
              <div ref={sentinelRef} className="py-5 flex justify-center">
                <div className="w-5 h-5 border-2 border-cream-300 border-t-warm-brown rounded-full animate-spin" />
              </div>
            )}
          </>
        ) : sortedMeals.length > 0 ? (
          <div className="flex flex-col items-center text-center px-8 py-12">
            <p className="text-sm font-medium text-warm-dark mb-1">조건에 맞는 기록이 없어요</p>
            <p className="text-xs text-warm-light mb-4">필터를 변경해보세요</p>
            <button
              onClick={() => { setRatingFilter(''); setTagFilter('') }}
              className="text-xs text-warm-brown underline"
            >
              필터 초기화
            </button>
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

      <Modal isOpen={todayFormOpen} onClose={() => setTodayFormOpen(false)}>
        <DayDetail date={today} onClose={() => setTodayFormOpen(false)} />
      </Modal>

      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onSelectMeal={mealId => {
          const meal = spaces.flatMap(s => s.meals).find(m => m.id === mealId)
          if (meal) setSelectedMeal(meal)
        }}
      />
    </>
  )
}
