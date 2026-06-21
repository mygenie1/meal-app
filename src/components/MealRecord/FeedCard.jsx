import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../../context/AppContext'
import LazyImage from '../common/LazyImage'
import { getOriginalUrl } from '../../lib/uploadPhoto'
import { linkify } from '../../lib/linkify'
import AuthorBadge from '../common/AuthorBadge'

export function photoArrOf(meal) {
  return meal.photos?.length > 0 ? meal.photos : (meal.photo ? [meal.photo] : [])
}

// 포크+나이프 아이콘 (사진 없는 카드/빈 상태)
function UtensilsIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v7m0 0a2 2 0 002-2V3m-2 7v8m3-15v18M19 3c-1.5 1-2 3-2 6 0 2 .5 3 2 3v6" />
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

// ── RECENT 피드 카드 (홈 피드 + 통합검색 공용) ──────────────────────────
export default function FeedCard({ meal, onClick }) {
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
