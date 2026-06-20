import { useState, useMemo, useEffect, useRef } from 'react'
import { format, isSameMonth, parseISO, subMonths, addMonths, startOfMonth, differenceInDays } from 'date-fns'
import { ko, enUS } from 'date-fns/locale'
import { useApp } from '../context/AppContext'
import { useNavigate, useLocation } from 'react-router-dom'
import MealDetailModal from '../components/MealRecord/MealDetailModal'
import Modal from '../components/common/Modal'
import DayDetail from '../components/MealRecord/DayDetail'
import LazyImage from '../components/common/LazyImage'
import { getOriginalUrl, getThumbUrl } from '../lib/uploadPhoto'
import AuthorBadge from '../components/common/AuthorBadge'
import { linkify } from '../lib/linkify'
import NotificationPanel, { NotificationBell } from '../components/common/NotificationPanel'
import Avatar from '../components/common/Avatar'

const TAG_STYLES = {
  '집밥': 'bg-green-50 text-green-700',
  '외식': 'bg-amber-50 text-amber-700',
  '카페': 'bg-pink-50 text-pink-700',
  '배달': 'bg-blue-50 text-blue-700',
}

const CAT_COLOR = { '집밥': '#2f9e5f', '외식': '#d6862c', '카페': '#d15c87', '배달': '#5276c4' }
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

// ── 서브 스탯 (리포트 카드 하단, 클릭 시 목록 토글) ────────────────────
function SubStat({ value, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 text-center rounded-xl py-1.5 transition-colors ${active ? 'bg-cream-100' : 'hover:bg-cream-50'}`}
    >
      <p className="text-base font-bold text-warm-dark leading-none">{value}</p>
      <p className="text-[11px] text-warm-light mt-1">{label}</p>
    </button>
  )
}

// 통합검색 결과용 — 가보고 싶은 곳 카드 (FeedCard는 meal 전용이라 별도)
function WishResultCard({ wish, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-cream-50 rounded-2xl shadow-sm border border-cream-200 p-4 flex items-start gap-3 hover:bg-cream-100 active:scale-[0.99] transition-colors"
    >
      <div className="w-10 h-10 rounded-xl bg-cream-200 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-warm-brown" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-semibold text-white bg-warm-brown px-1.5 py-0.5 rounded-full leading-none">가보고 싶은 곳</span>
          {wish.category && <span className="text-[10px] text-warm-light">{wish.category}</span>}
        </div>
        <p className="text-sm font-semibold text-warm-dark truncate">{wish.name || '이름 없는 장소'}</p>
        {wish.location && <p className="text-xs text-warm-light truncate mt-0.5">{wish.location}</p>}
        {wish.memo && <p className="text-xs text-cream-400 truncate mt-0.5">{wish.memo}</p>}
      </div>
      <svg className="w-4 h-4 text-cream-300 shrink-0 mt-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}

export default function HomePage() {
  const { currentSpace, spaces, loadMealPhotos, ratingsMap, user } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [selectedMeal, setSelectedMeal] = useState(null)
  const [activeStatTab, setActiveStatTab] = useState(null) // null | 'newPlaces' | 'rating' | 'days'
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
  const [reportMonth, setReportMonth] = useState(() => startOfMonth(new Date()))

  const meals = currentSpace?.meals || []
  const wishlist = currentSpace?.wishlist || []

  const oldestMealMonth = useMemo(() => {
    if (meals.length === 0) return startOfMonth(today)
    const dates = meals.map(m => m.date).filter(Boolean).sort()
    try { return startOfMonth(parseISO(dates[0])) } catch { return startOfMonth(today) }
  }, [meals, today])

  const isCurrentMonth = isSameMonth(reportMonth, today)
  const isOldestMonth = meals.length === 0 || isSameMonth(reportMonth, oldestMealMonth)

  // 추억 카드 — 오늘 날짜(월-일)와 같은 과거 기록, 없으면 30~90일 사이 랜덤 1개
  const memoryCard = useMemo(() => {
    const todayMD = format(today, 'MM-dd')
    const thisYear = format(today, 'yyyy')
    const memoryMeal = meals.find(m =>
      m.date && m.date.slice(5) === todayMD && m.date.slice(0, 4) !== thisYear
    )
    if (memoryMeal) return { meal: memoryMeal, isMemory: true }
    const range = meals.filter(m => {
      if (!m.date) return false
      try { const diff = differenceInDays(today, parseISO(m.date)); return diff >= 30 && diff <= 90 } catch { return false }
    })
    const fallbackMeal = range.length > 0 ? range[Math.floor(Math.random() * range.length)] : null
    return { meal: fallbackMeal, isMemory: false }
  }, [meals, today])

  // 오늘 어디가지? — 미방문 위시리스트
  const unvisitedWishes = useMemo(() => wishlist.filter(w => !w.visited), [wishlist])

  // 추억 카드 사진 lazy 로드
  useEffect(() => {
    const m = memoryCard.meal
    if (m && !m.photosLoaded) loadMealPhotos(m.id)
  }, [memoryCard.meal?.id])

  // 튜토리얼 완료 후 자동 오픈
  useEffect(() => {
    if (location.state?.openMealForm) {
      setTodayFormOpen(true)
    }
    if (location.state?.openBulkUpload) {
      setShowBulkUpload(true)
    }
    if (location.state?.openMealForm || location.state?.openBulkUpload) {
      window.history.replaceState({}, '')
    }
  }, [])
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

  // 식탁 리포트 데이터 (reportMonth 기준)
  const report = useMemo(() => {
    const monthStart = startOfMonth(reportMonth)
    const prevMonth = subMonths(reportMonth, 1)

    const thisMonthMeals = meals.filter(m => {
      try { return isSameMonth(parseISO(m.date), reportMonth) } catch { return false }
    })
    const lastMonthCount = meals.filter(m => {
      try { return isSameMonth(parseISO(m.date), prevMonth) } catch { return false }
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

    // ── 통계 클릭용 목록 ──
    // 새로운 맛집: 이번 달 처음 등장한 식당의 첫 기록
    const seenNew = new Set()
    const newPlaceMeals = []
    thisMonthMeals.forEach(m => {
      if (m.restaurantName && newNames.has(m.restaurantName) && !seenNew.has(m.restaurantName)) {
        seenNew.add(m.restaurantName)
        newPlaceMeals.push(m)
      }
    })
    // 평균 별점: 별점 있는 기록을 높은 순으로
    const ratingMeals = thisMonthMeals
      .map(m => {
        const rs = ratingsMap?.[m.id] || []
        const r = rs.length > 0 ? Math.round(rs.reduce((s, x) => s + x.rating, 0) / rs.length) : (m.rating || 0)
        return { meal: m, rating: r }
      })
      .filter(x => x.rating > 0)
      .sort((a, b) => b.rating - a.rating)
    // 기록한 날: 날짜별 그룹 (최신순)
    const byDate = {}
    thisMonthMeals.forEach(m => { if (m.date) (byDate[m.date] = byDate[m.date] || []).push(m) })
    const dayGroups = Object.keys(byDate).sort((a, b) => b.localeCompare(a)).map(date => ({
      date,
      count: byDate[date].length,
      rep: byDate[date][0],
    }))

    return {
      thisMonthCount,
      diff,
      hasHistory: meals.length > thisMonthCount,
      tagSegments,
      newRestaurants: newNames.size,
      avgRating,
      recordedDays,
      newPlaceMeals,
      ratingMeals,
      dayGroups,
    }
  }, [meals, ratingsMap, reportMonth])

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

  // 검색 결과 — 게시글(meals) + 가보고 싶은 곳(wishlist) 혼합 { type, item }
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return []
    const mealHits = sortedMeals
      .filter(m =>
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.restaurantName && m.restaurantName.toLowerCase().includes(q)) ||
        (m.review && m.review.toLowerCase().includes(q)) ||
        (m.memo && m.memo.toLowerCase().includes(q))
      )
      .map(m => ({ type: 'meal', item: m }))
    const wishHits = wishlist
      .filter(w =>
        (w.name && w.name.toLowerCase().includes(q)) ||
        (w.location && w.location.toLowerCase().includes(q)) ||
        (w.memo && w.memo.toLowerCase().includes(q)) ||
        (w.category && w.category.toLowerCase().includes(q))
      )
      .map(w => ({ type: 'wishlist', item: w }))
    return [...mealHits, ...wishHits]
  }, [searchQuery, sortedMeals, wishlist])

  // 필터 변경 시 페이지 리셋
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [ratingFilter, tagFilter])

  // reportMonth 변경 시 열린 통계 패널 닫기
  useEffect(() => { setActiveStatTab(null) }, [reportMonth])

  // 보이는 카드만 사진 로드
  useEffect(() => {
    visibleMeals.forEach(m => {
      if (!m.photosLoaded && !requestedPhotosRef.current.has(m.id)) {
        requestedPhotosRef.current.add(m.id)
        loadMealPhotos(m.id)
      }
    })
  }, [visibleMeals])

  // 검색 결과 사진 로드 (meal 타입만)
  useEffect(() => {
    if (!searchQuery.trim()) return
    searchResults.forEach(r => {
      if (r.type !== 'meal') return
      const m = r.item
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
            className="flex-1 bg-transparent text-base text-warm-dark outline-none placeholder-cream-400"
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
              className="ml-0.5 w-8 h-8 rounded-full overflow-hidden border border-cream-300 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="프로필"
            >
              <Avatar url={avatarUrl} nickname={nickname} size="md" />
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
              <p className="text-xs text-cream-300 mt-1">제목, 식당명, 한줄평, 메모, 가보고 싶은 곳</p>
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
                {searchResults.map(r => r.type === 'meal' ? (
                  <FeedCard key={`m-${r.item.id}`} meal={r.item} onClick={() => setSelectedMeal(r.item)} />
                ) : (
                  <WishResultCard
                    key={`w-${r.item.id}`}
                    wish={r.item}
                    onClick={() => navigate('/map', { state: { tab: 'wish', wishId: r.item.id } })}
                  />
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
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <SparkleIcon className="w-4 h-4 text-warm-brown shrink-0" />
                <h3 className="text-sm font-semibold text-warm-dark truncate">
                  {isCurrentMonth ? '이번 달 식탁 리포트' : format(reportMonth, 'yyyy년 M월 식탁 리포트', { locale: ko })}
                </h3>
              </div>
              <div className="flex items-center shrink-0 ml-2">
                <button
                  onClick={() => !isOldestMonth && setReportMonth(prev => subMonths(prev, 1))}
                  disabled={isOldestMonth}
                  aria-label="이전 달"
                  className={`p-1.5 rounded-full transition-colors ${isOldestMonth ? 'text-cream-300' : 'text-warm-light hover:text-warm-brown active:scale-95'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
                  </svg>
                </button>
                <span className="text-xs text-cream-400 w-[52px] text-center tabular-nums">
                  {format(reportMonth, 'yyyy.M', { locale: ko })}
                </span>
                <button
                  onClick={() => !isCurrentMonth && setReportMonth(prev => addMonths(prev, 1))}
                  disabled={isCurrentMonth}
                  aria-label="다음 달"
                  className={`p-1.5 rounded-full transition-colors ${isCurrentMonth ? 'text-cream-300' : 'text-warm-light hover:text-warm-brown active:scale-95'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
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
            <p className="text-xs text-warm-light mt-1">
              {isCurrentMonth ? '이번 달' : format(reportMonth, 'M월')} 함께한 식사
            </p>

            {/* 태그 비율 바 */}
            {report.tagSegments.length > 0 ? (
              <div className="mt-4">
                <div className="flex h-3 rounded-full overflow-hidden bg-cream-100 gap-[2px]">
                  {report.tagSegments.map(seg => (
                    <div key={seg.tag} style={{ width: `${seg.pct}%`, background: CAT_COLOR[seg.tag] }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2.5">
                  {report.tagSegments.map(seg => (
                    <div key={seg.tag} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CAT_COLOR[seg.tag] }} />
                      <span className="text-[11px] text-warm-light">{seg.tag}</span>
                      <span className="text-[11px] font-semibold text-warm-dark">{seg.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 h-3 rounded-full bg-cream-100" />
            )}

            {/* 서브 스탯 3개 */}
            <div className="mt-5 flex items-stretch">
              <SubStat value={`${report.newRestaurants}곳`} label="새로운 가게"
                active={activeStatTab === 'newPlaces'}
                onClick={() => setActiveStatTab(t => t === 'newPlaces' ? null : 'newPlaces')} />
              <div className="w-px bg-cream-200 mx-1" />
              <SubStat value={report.avgRating} label="평균 별점"
                active={activeStatTab === 'rating'}
                onClick={() => setActiveStatTab(t => t === 'rating' ? null : 'rating')} />
              <div className="w-px bg-cream-200 mx-1" />
              <SubStat value={`${report.recordedDays}일`} label="기록한 날"
                active={activeStatTab === 'days'}
                onClick={() => setActiveStatTab(t => t === 'days' ? null : 'days')} />
            </div>

            {/* 통계 클릭 시 미니 목록 */}
            {activeStatTab && (() => {
              let rows = []
              if (activeStatTab === 'newPlaces') {
                rows = report.newPlaceMeals.map(m => ({
                  key: m.id, meal: m,
                  primary: m.restaurantName || m.title || '식사',
                  sub: [m.date, m.tag].filter(Boolean).join(' · '),
                }))
              } else if (activeStatTab === 'rating') {
                rows = report.ratingMeals.map(({ meal: m, rating }) => ({
                  key: m.id, meal: m,
                  primary: m.title || m.restaurantName || '식사',
                  sub: [m.date, m.tag].filter(Boolean).join(' · '),
                  rating,
                }))
              } else {
                rows = report.dayGroups.map(g => ({
                  key: g.date, meal: g.rep,
                  primary: g.rep?.title || g.rep?.restaurantName || '식사',
                  sub: `${g.date} · ${g.count}개 기록`,
                }))
              }
              return (
                <div className="mt-3 pt-3 border-t border-cream-200 space-y-1">
                  {rows.length === 0 ? (
                    <p className="text-xs text-cream-400 text-center py-2">기록이 없어요</p>
                  ) : rows.map(row => (
                    <div
                      key={row.key}
                      onClick={() => row.meal && setSelectedMeal(row.meal)}
                      className="flex items-center justify-between gap-2 py-2 px-2 rounded-xl cursor-pointer active:bg-cream-50"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-warm-dark truncate">{row.primary}</p>
                        <p className="text-xs text-cream-400 truncate">{row.sub}</p>
                      </div>
                      {activeStatTab === 'rating' && row.rating > 0 && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <span className="star-filled text-sm leading-none">★</span>
                          <span className="text-xs font-semibold text-warm-dark">{row.rating}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setActiveStatTab(null)}
                    className="w-full text-xs text-cream-400 pt-1 hover:text-warm-light transition-colors"
                  >
                    닫기
                  </button>
                </div>
              )
            })()}
          </div>
        </div>

        {/* 추억 카드 */}
        {memoryCard.meal && (() => {
          const dm = memoryCard.meal
          const photo = getThumbUrl(dm.photos?.[0] || '')
          let daysAgo = 0
          try { daysAgo = differenceInDays(today, parseISO(dm.date)) } catch {}
          let dateLabel = dm.date
          try { dateLabel = format(parseISO(dm.date), 'yyyy년 M월 d일') } catch {}
          return (
            <div className="px-4 mb-6">
              <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden shadow-sm">
                {photo && (
                  <div className="relative h-32">
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 bg-warm-brown text-white text-xs px-2 py-1 rounded-full font-medium">
                      {memoryCard.isMemory ? (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
                        </svg>
                      )}
                      {memoryCard.isMemory ? '오늘의 추억' : '지난 식탁'}
                    </span>
                  </div>
                )}
                <div className="p-4">
                  {/* 날짜 + 태그 */}
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs text-cream-400">
                      {dateLabel}{memoryCard.isMemory && ` · ${daysAgo}일 전`}
                    </p>
                    {dm.tag && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TAG_STYLES[dm.tag] || 'bg-cream-100 text-warm-light'}`}>
                        {dm.tag}
                      </span>
                    )}
                  </div>
                  {/* 장소 (외식/카페일 때) */}
                  {(dm.tag === '외식' || dm.tag === '카페') && dm.location && (
                    <p className="text-xs text-cream-400 mb-1 flex items-center gap-1">
                      <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
                        <circle cx="12" cy="8" r="2" />
                      </svg>
                      <span className="truncate">{dm.restaurantName || dm.location}</span>
                    </p>
                  )}
                  <h3 className="font-semibold text-warm-dark">
                    {dm.title || dm.restaurantName || '기록된 식탁'}
                  </h3>
                  {dm.review && (
                    <p className="text-sm text-warm-light mt-1 line-clamp-1 break-words">{dm.review}</p>
                  )}
                  <button
                    onClick={() => setSelectedMeal(dm)}
                    className="mt-3 text-sm text-warm-brown font-medium flex items-center gap-1 active:opacity-70 transition-opacity"
                  >
                    다시 보기
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        })()}

        {/* 오늘 어디가지? 카드 */}
        {unvisitedWishes.length > 0 && (
          <div className="px-4 mb-6">
            <div className="bg-white rounded-2xl border border-cream-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-warm-brown" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24">
                    <rect x="3" y="3" width="18" height="18" rx="4" />
                    <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
                    <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
                    <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
                    <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
                  </svg>
                  <span className="font-semibold text-warm-dark">오늘 어디 가지?</span>
                </div>
                <span className="text-xs text-cream-400">{unvisitedWishes.length}곳 저장됨</span>
              </div>
              <p className="text-sm text-warm-light mb-3">가고 싶은 곳 중 하나를 골라볼까요?</p>
              <button
                onClick={() => navigate('/map', { state: { tab: 'wish', random: true } })}
                className="w-full bg-warm-brown text-white rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:bg-warm-dark transition-colors active:scale-[0.99]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="4" />
                  <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
                </svg>
                하나 골라줘
              </button>
            </div>
          </div>
        )}

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
