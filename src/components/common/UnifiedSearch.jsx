import { useState, useEffect, useRef, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import { runUnifiedSearch } from '../../lib/unifiedSearch'
import FeedCard from '../MealRecord/FeedCard'
import WishResultCard from './WishResultCard'

// 통합검색 오버레이 — 홈/지도 공용. 게시글(meal) + 가보고 싶은 곳(wishlist) 검색.
// onSelectMeal(meal): meal 결과 클릭, onSelectWish(wish): wishlist 결과 클릭 (호출 측에서 이동 처리)
export default function UnifiedSearch({ open, onClose, onSelectMeal, onSelectWish }) {
  const { currentSpace, loadMealPhotos } = useApp()
  const [query, setQuery] = useState('')
  const requestedRef = useRef(new Set())
  const inputRef = useRef(null)

  const meals = currentSpace?.meals || []
  const wishlist = currentSpace?.wishlist || []

  const results = useMemo(
    () => runUnifiedSearch(meals, wishlist, query),
    [meals, wishlist, query]
  )

  // 열릴 때 입력 초기화 + 포커스
  useEffect(() => {
    if (open) {
      setQuery('')
      const t = setTimeout(() => inputRef.current?.focus(), 60)
      return () => clearTimeout(t)
    }
  }, [open])

  // 검색 결과 meal 사진 로드 (meal 타입만)
  useEffect(() => {
    if (!open || !query.trim()) return
    results.forEach(r => {
      if (r.type !== 'meal') return
      const m = r.item
      if (!m.photosLoaded && !requestedRef.current.has(m.id)) {
        requestedRef.current.add(m.id)
        loadMealPhotos(m.id)
      }
    })
  }, [results, open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] bg-cream-50 max-w-lg mx-auto flex flex-col">
      {/* 검색 헤더 */}
      <header
        className="sticky top-0 z-10 bg-cream-50/95 backdrop-blur-sm border-b border-cream-200 px-4"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: '0.75rem' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-1 -ml-1 text-warm-light hover:text-warm-brown transition-colors"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="제목, 식당명, 한줄평, 메모, 가보고 싶은 곳 검색"
            autoFocus
            className="flex-1 min-w-0 bg-transparent text-base text-warm-dark outline-none placeholder-cream-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-cream-400 hover:text-warm-light transition-colors"
              aria-label="지우기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </header>

      {/* 결과 */}
      <div className="flex-1 overflow-y-auto pb-28 pt-4 px-4">
        {!query.trim() ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <svg className="w-10 h-10 text-cream-300 mb-3" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <p className="text-sm text-cream-400">검색어를 입력해주세요</p>
            <p className="text-xs text-cream-300 mt-1">제목, 식당명, 한줄평, 메모, 가보고 싶은 곳</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <p className="text-sm font-medium text-warm-dark mb-1">검색 결과가 없어요</p>
            <p className="text-xs text-warm-light">다른 키워드로 검색해보세요</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-warm-light mb-3">
              <span className="font-medium text-warm-brown">"{query}"</span> 검색 결과 {results.length}건
            </p>
            <div className="space-y-4">
              {results.map(r => r.type === 'meal' ? (
                <FeedCard key={`m-${r.item.id}`} meal={r.item} onClick={() => onSelectMeal?.(r.item)} />
              ) : (
                <WishResultCard key={`w-${r.item.id}`} wish={r.item} onClick={() => onSelectWish?.(r.item)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
