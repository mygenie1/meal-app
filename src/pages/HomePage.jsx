import { useState, useMemo, useEffect, useRef } from 'react'
import { format, isSameMonth, parseISO, subMonths, startOfMonth } from 'date-fns'
import { ko, enUS } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import { useNavigate } from 'react-router-dom'
import MealDetailModal from '../components/MealRecord/MealDetailModal'
import Modal from '../components/common/Modal'
import DayDetail from '../components/MealRecord/DayDetail'
import LazyImage from '../components/common/LazyImage'
import { getOriginalUrl, getThumbUrl } from '../lib/uploadPhoto'
import AuthorBadge from '../components/common/AuthorBadge'
import { linkify } from '../lib/linkify'
import NotificationPanel, { NotificationBell } from '../components/common/NotificationPanel'

const TAG_STYLES = {
  '집밥': 'bg-green-50 text-green-700',
  '외식': 'bg-amber-50 text-amber-700',
  '카페': 'bg-pink-50 text-pink-700',
  '배달': 'bg-blue-50 text-blue-700',
}

// 태그 비율 바 색상
const TAG_BG = {
  '집밥': '#86efac',
  '외식': '#fcd34d',
  '카페': '#f9a8d4',
  '배달': '#93c5fd',
}
const TAG_ORDER = ['집밥', '외식', '카페', '배달']

const PAGE_SIZE = 20

const RATING_FILTERS = [
  { key: '', label: '전체' },
  { key: '3+', label: '★3점+' },
  { key: '4+', label: '★4점+' },
  { key: '5',  label: '★5점' },
]

const TAG_FILTERS = ['전체', '집밥', '외식', '카페', '배달']

// 별점 평균 — ratings 테이블(ratingsMap) 기준, 없으면 레거시 meal.rating 폴백
function avgRatingOf(ratingsMap, meal) {
  const rs = ratingsMap?.[meal.id] || []
  if (rs.length > 0) return Math.floor(rs.reduce((s, r) => s + r.rating, 0) / rs.length)
  return meal.rating || 0
}

function photoArrOf(meal) {
  return meal.photos?.length > 0 ? meal.photos : (meal.photo ? [meal.photo] : [])
}

// 포크+스푼 로고
function ForkSpoonIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 2v6a2 2 0 0 0 2 2v12M9 2v6a2 2 0 0 1-2 2" />
      <path d="M16 2c-1.7 0-3 1.8-3 4s1.3 4 3 4 3-1.8 3-4-1.3-4-3-4zM16 10v12" />
    </svg>
  )
}

// 포크+나이프 아이콘 (사진 없는 카드/빈 상태)
function UtensilsIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v7m0 0a2 2 0 002-2V3m-2 7v8m3-15v18M19 3c-1.5 1-2 3-2 6 0 2 .5 3 2 3v6" />
    </svg>
  )
}

// 리포트 헤더 장식 (반짝이)
function SparkleIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7z" />
    </svg>
  )
}

function PinIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
      <circle cx="12" cy="8" r="2" />
    </svg>
  )
}

// ── RECENT 피드 카드 ──────────────────────────────────────────────────
function FeedCard({ meal, onClick }) {
  const { ratingsMap } = useApp()
  const dateObj = parseISO(meal.date)
  const title = meal.title || meal.restaurantName || '식사 기록'
  const cover = meal.photosLoaded
    ? (photoArrOf(meal).map(getOriginalUrl).find(Boolean) || '')
    : ''
  const mealRatings = ratingsMap?.[meal.id] || []
  const avgRating = mealRatings.length > 0
    ? Math.floor(mealRatings.reduce((s, r) => s + r.rating, 0) / mealRatings.length)
    : meal.rating || 0
  const ratingCount = mealRatings.length
  const subPlace = meal.title && meal.restaurantName ? meal.restaurantName : null
  const tagLine = [meal.mealTime, meal.tag].filter(Boolean).join(' · ')

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-cream-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow active:scale-[0.99]"
    >
      {/* 4:3 풀블리드 사진 */}
      <div className="relative w-full aspect-[4/3] bg-cream-100">
        {cover ? (
          <LazyImage src={cover} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <UtensilsIcon className="w-8 h-8 text-cream-300" />
          </div>
        )}

        {/* 날짜칩 (좌상단) */}
        <span className="absolute top-2.5 left-2.5 text-[11px] font-medium text-warm-dark bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm">
          {format(dateObj, 'M.d eee', { locale: ko })}
        </span>

        {/* 끼니·태그 pill (우상단) */}
        {tagLine && (
          <span className="absolute top-2.5 right-2.5 text-[11px] font-medium text-warm-brown bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-full shadow-sm">
            {tagLine}
          </span>
        )}

        {/* 가고 싶었던 곳 (좌하단) */}
        {meal.fromWishlist && (
          <span className="absolute bottom-2.5 left-2.5 text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/90 text-white font-medium flex items-center gap-0.5">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            가고 싶었던 곳
          </span>
        )}
      </div>

      {/* 하단 정보 */}
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-warm-dark text-base leading-snug truncate">{title}</p>
          {avgRating > 0 && (
            <div className="flex items-center gap-1 shrink-0 mt-0.5">
              <span className="star-filled text-sm leading-none">★</span>
              <span className="text-xs font-semibold text-warm-dark leading-none">{avgRating}</span>
              {ratingCount >= 2 && <span className="text-[10px] text-cream-400 leading-none">·{ratingCount}</span>}
            </div>
          )}
        </div>

        {subPlace && (
          <p className="text-xs text-warm-light mt-0.5 truncate">{subPlace}</p>
        )}

        {meal.location && (
          <p className="text-xs text-warm-light mt-1 flex items-center gap-1">
            <PinIcon className="w-3 h-3 shrink-0" />
            <span className="truncate">{meal.location}</span>
          </p>
        )}

        {meal.review && (
          <p className="text-xs text-warm-light mt-1.5 line-clamp-1 leading-relaxed break-words">
            {linkify(meal.review)}
          </p>
        )}

        <AuthorBadge meal={meal} className="mt-2" />
      </div>
    </button>
  )
}

// ── 서브 스탯 (리포트 카드 하단) ──────────────────────────────────────
function SubStat({ value, label }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-base font-bold text-warm-dark leading-none">{value}</p>
      <p className="text-[11px] text-warm-light mt-1">{label}</p>
    </div>
  )
}

export default function HomePage() {
  const { currentSpace, spaces, loadMealPhotos, ratingsMap, user } = useApp()
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
  const nickname = user?.user_metadata?.name || user?.user_metadata?.full_name || '식탁'
  const avatarUrl = user?.user_metadata?.avatar_url

  // 오늘 기록 상태 — Hero 문구/버튼 분기
  const todayStatus = useMemo(() => {
    const todayStr = format(today, 'yyyy-MM-dd')
    const todayMeals = meals.filter(m => m.date === todayStr)
    const recorded = new Set(todayMeals.map(m => m.mealTime).filter(Boolean))
    const ALL_TIMES = ['아침', '점심', '저녁']

    if (todayMeals.length === 0) return { kind: 'empty' }
    if (ALL_TIMES.every(t => recorded.has(t))) return { kind: 'all' }

    const hour = today.getHours()
    let next = null
    if (!recorded.has('저녁') && hour >= 17) next = '저녁'
    else if (!recorded.has('점심') && hour >= 11) next = '점심'
    else if (!recorded.has('아침')) next = '아침'
    else next = ALL_TIMES.find(t => !recorded.has(t)) || '저녁'

    return { kind: 'partial', next }
  }, [meals, today])

  // 이번 달 식탁 리포트 데이터
  const report = useMemo(() => {
    const monthStart = startOfMonth(today)
    const lastMonth = subMonths(today, 1)

    const thisMonthMeals = meals.filter(m => {
      try { return isSameMonth(parseISO(m.date), today) } catch { return false }
    })
    const lastMonthCount = meals.filter(m => {
      try { return isSameMonth(parseISO(m.date), lastMonth) } catch { return false }
    }).length

    const thisMonthCount = thisMonthMeals.length
    const diff = thisMonthCount - lastMonthCount

    // 태그 비율
    const tagCounts = {}
    thisMonthMeals.forEach(m => { if (m.tag) tagCounts[m.tag] = (tagCounts[m.tag] || 0) + 1 })
    const tagTotal = Object.values(tagCounts).reduce((s, n) => s + n, 0)
    const tagSegments = TAG_ORDER
      .filter(t => tagCounts[t])
      .map(t => ({ tag: t, pct: Math.round((tagCounts[t] / tagTotal) * 100) }))

    // 새로운 맛집 — 이번 달 처음 등장한 restaurant_name
    const prevNames = new Set()
    meals.forEach(m => {
      if (m.restaurantName) {
        try { if (parseISO(m.date) < monthStart) prevNames.add(m.restaurantName) } catch {}
      }
    })
    const newNames = new Set()
    thisMonthMeals.forEach(m => {
      if (m.restaurantName && !prevNames.has(m.restaurantName)) newNames.add(m.restaurantName)
    })

    // 평균 별점 (이번 달)
    let sum = 0, cnt = 0
    thisMonthMeals.forEach(m => {
      const rs = ratingsMap?.[m.id] || []
      if (rs.length > 0) rs.forEach(r => { sum += r.rating; cnt++ })
      else if (m.rating) { sum += m.rating; cnt++ }
    })
    const avgRating = cnt > 0 ? (sum / cnt).toFixed(1) : '–'

    // 기록한 날 (unique date)
    const recordedDays = new Set(thisMonthMeals.map(m => m.date)).size

    return {
      thisMonthCount,
      diff,
      hasHistory: meals.length > thisMonthCount,
      tagSegments,
      newRestaurants: newNames.size,
      avgRating,
      recordedDays,
    }
  }, [meals, ratingsMap, today])

  const MEAL_TIME_ORDER = { 아침: 0, 점심: 1, 저녁: 2 }
  const sortedMeals = useMemo(
    () => [...meals].sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date)
      if (dateDiff !== 0) return dateDiff
      return (MEAL_TIME_ORDER[a.mealTime] ?? 1) - (MEAL_TIME_ORDER[b.mealTime] ?? 1)
    }),
    [meals]
  )

  // Hero 배경 음식 사진 — 가장 최근 로드된 썸네일
  const heroPhoto = useMemo(() => {
    for (const m of sortedMeals) {
      if (!m.photosLoaded) continue
      const u = photoArrOf(m).map(getThumbUrl).find(Boolean)
      if (u) return u
    }
    return ''
  }, [sortedMeals])

  const filteredMeals = useMemo(() => {
    return sortedMeals.filter(m => {
      const r = avgRatingOf(ratingsMap, m)
      if (ratingFilter === '3+' && r < 3) return false
      if (ratingFilter === '4+' && r < 4) return false
      if (ratingFilter === '5'  && r !== 5) return false
      if (tagFilter && m.tag !== tagFilter) return false
      return true
    })
  }, [sortedMeals, ratingFilter, tagFilter, ratingsMap])

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

  // Hero 문구/버튼 (상태별 — 기존 로직 유지)
  const hero = useMemo(() => {
    if (todayStatus.kind === 'all') {
      return {
        title: '오늘 식탁을 모두 기록했어요',
        subtitle: '오늘도 함께한 식사 고마워요',
        button: '달력에서 보기',
        onClick: () => navigate('/calendar'),
      }
    }
    if (todayStatus.kind === 'partial') {
      return {
        title: '한 끼 더 남겨볼까요?',
        subtitle: `${todayStatus.next}도 함께 기록해보세요`,
        button: '한 끼 더 기록하기',
        onClick: () => setTodayFormOpen(true),
      }
    }
    return {
      title: '오늘의 식탁을 남겨볼까요?',
      subtitle: '사진 한 장으로 오늘 먹은 한 끼를 남겨보세요',
      button: '기록하기',
      onClick: () => setTodayFormOpen(true),
    }
  }, [todayStatus, navigate])

  const todayEnLabel = `${format(today, 'M.d')} ${format(today, 'EEE', { locale: enUS }).toUpperCase()}`

  // ── 헤더 (로고 + 벨 + 아바타) ───────────────────────────────────────
  const Header = (
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
          {/* 로고 + 워드마크 */}
          <div className="flex items-center gap-2">
            <ForkSpoonIcon className="w-5 h-5 text-warm-brown" />
            <h1 className="text-base font-bold text-warm-dark tracking-tight">식탁일기</h1>
          </div>

          {/* 우측: 검색 + 벨 + 아바타 */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1.5 text-warm-light hover:text-warm-brown transition-colors"
              aria-label="검색"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </button>
            <NotificationBell onClick={() => setNotifOpen(true)} />
            <button
              onClick={() => navigate('/spaces')}
              className="ml-0.5 w-8 h-8 rounded-full overflow-hidden bg-cream-200 border border-cream-300 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="프로필"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-warm-light">{nickname.charAt(0)}</span>
              )}
            </button>
          </div>
        </div>
      )}
    </header>
  )

  if (spaces.length === 0) {
    return (
      <>
        {Header}
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
      {Header}

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
              <div className="space-y-4">
                {searchResults.map(meal => (
                  <FeedCard key={meal.id} meal={meal} onClick={() => setSelectedMeal(meal)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className={`pb-28 ${searchOpen ? 'hidden' : ''}`}>
        {/* 날짜 + 인사 */}
        <div className="px-4 pt-5 pb-3">
          <p className="text-xs text-warm-light">
            {format(today, 'yyyy년 M월 d일 EEEE', { locale: ko })}
          </p>
          <h2 className="text-xl font-bold text-warm-dark mt-1.5 leading-snug">
            {nickname}님, 오늘은<br />어떤 식탁이었나요?
          </h2>
        </div>

        {/* 히어로 CTA 카드 */}
        <div className="px-4 mb-6">
          <div className="relative overflow-hidden rounded-2xl bg-warm-brown text-white shadow-sm">
            {heroPhoto && (
              <>
                <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                <div className="absolute inset-0 bg-gradient-to-t from-warm-brown via-warm-brown/85 to-warm-brown/45" />
              </>
            )}
            <div className="relative px-5 py-5">
              <p className="text-[11px] font-semibold tracking-widest text-white/70">
                TODAY · {todayEnLabel}
              </p>
              <p className="text-lg font-bold mt-2 leading-snug">{hero.title}</p>
              <p className="text-xs text-white/75 mt-1 leading-relaxed">{hero.subtitle}</p>
              <button
                onClick={hero.onClick}
                className="mt-4 inline-flex items-center gap-1 bg-white text-warm-brown text-sm font-semibold pl-3 pr-4 py-2 rounded-full active:scale-95 transition-transform shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
                {hero.button}
              </button>
            </div>
          </div>
        </div>

        {/* 이번 달 식탁 리포트 */}
        <div className="px-4 mb-7">
          <div className="bg-white rounded-2xl border border-cream-200 shadow-sm px-5 py-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <SparkleIcon className="w-4 h-4 text-warm-brown" />
                <h3 className="text-sm font-semibold text-warm-dark">이번 달 식탁 리포트</h3>
              </div>
              <span className="text-xs text-cream-400">{format(today, 'yyyy.M', { locale: ko })}</span>
            </div>

            {/* 큰 숫자 + 지난달 대비 */}
            <div className="flex items-end gap-2">
              <p className="font-bold text-warm-dark leading-none" style={{ fontSize: '30px' }}>
                {report.thisMonthCount}
                <span className="text-base font-semibold text-warm-light ml-0.5">번</span>
              </p>
              {report.hasHistory && (
                <span className="mb-1 text-[11px] font-semibold text-white bg-warm-brown px-2 py-0.5 rounded-full">
                  지난달 {report.diff >= 0 ? '+' : ''}{report.diff}
                </span>
              )}
            </div>
            <p className="text-xs text-warm-light mt-1">이번 달 함께한 식사</p>

            {/* 태그 비율 바 */}
            {report.tagSegments.length > 0 ? (
              <div className="mt-4">
                <div className="flex h-2.5 rounded-full overflow-hidden bg-cream-100">
                  {report.tagSegments.map(seg => (
                    <div key={seg.tag} style={{ width: `${seg.pct}%`, background: TAG_BG[seg.tag] }} />
                  ))}
                </div>
                <p className="text-[11px] text-warm-light mt-2">
                  {report.tagSegments.map(seg => `${seg.tag} ${seg.pct}%`).join(' · ')}
                </p>
              </div>
            ) : (
              <div className="mt-4 h-2.5 rounded-full bg-cream-100" />
            )}

            {/* 서브 스탯 3개 */}
            <div className="mt-5 flex items-stretch">
              <SubStat value={`${report.newRestaurants}곳`} label="새로운 맛집" />
              <div className="w-px bg-cream-200 mx-1" />
              <SubStat value={report.avgRating} label="평균 별점" />
              <div className="w-px bg-cream-200 mx-1" />
              <SubStat value={`${report.recordedDays}일`} label="기록한 날" />
            </div>
          </div>
        </div>

        {/* RECENT 헤더 */}
        <div className="flex items-center justify-between px-4 mb-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-bold tracking-widest text-warm-brown">RECENT</span>
            <h2 className="text-sm font-semibold text-warm-dark">최근 식탁</h2>
          </div>
          {sortedMeals.length > 0 && (
            <button
              onClick={() => navigate('/calendar')}
              className="text-xs text-warm-light hover:text-warm-brown transition-colors"
            >
              전체보기 ›
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
            <div className="px-4 space-y-4">
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
