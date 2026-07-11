import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import MealMap from '../components/Map/MealMap'
import MealDetailModal from '../components/MealRecord/MealDetailModal'
import UnifiedSearch from '../components/common/UnifiedSearch'
import RecipeDetailModal from '../components/Recipes/RecipeDetailModal'

export default function MapPage() {
  const { state } = useLocation()
  const { currentSpace, updateRecipe, deleteRecipe } = useApp()
  const wantWishTab = state?.tab === 'wish'
  const [viewingMeal, setViewingMeal] = useState(null)
  const [isWishTab, setIsWishTab] = useState(wantWishTab)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchRecipeId, setSearchRecipeId] = useState(null) // 통합검색에서 연 레시피 상세
  // 가고 싶은 곳 핀 포커스 — { id, nonce }. nonce가 바뀔 때마다 MealMap이 재이동.
  const [wishFocus, setWishFocus] = useState(
    wantWishTab && state?.wishId ? { id: state.wishId, nonce: 1 } : null
  )

  return (
    <div className={`flex flex-col ${isWishTab ? '' : 'h-full'}`}>
      <header
        className="shrink-0 sticky top-0 z-40 bg-cream-50/90 backdrop-blur-sm border-b border-cream-200 px-4"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: '0.75rem' }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-warm-dark">우리만의 맛집 지도</h1>
          <button
            onClick={() => setSearchOpen(true)}
            className="p-1.5 text-warm-light hover:text-warm-brown transition-colors"
            aria-label="검색"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </button>
        </div>
      </header>
      <div className={isWishTab ? '' : 'flex-1 overflow-hidden'}>
        <MealMap
          onViewMeal={setViewingMeal}
          onTabChange={tab => setIsWishTab(tab === 'wishlist')}
          initialTab={wantWishTab ? 'wishlist' : undefined}
          wishRandom={!!(wantWishTab && state?.random)}
          focusWishId={wishFocus?.id}
          focusWishNonce={wishFocus?.nonce}
        />
      </div>
      {viewingMeal && (
        <MealDetailModal meal={viewingMeal} onClose={() => setViewingMeal(null)} />
      )}

      <UnifiedSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelectMeal={m => { setSearchOpen(false); setViewingMeal(m) }}
        onSelectWish={w => {
          setSearchOpen(false)
          setIsWishTab(true)
          setWishFocus(f => ({ id: w.id, nonce: (f?.nonce || 0) + 1 }))
        }}
        onSelectRecipe={r => { setSearchOpen(false); setSearchRecipeId(r.id) }}
      />

      {/* 통합검색에서 연 레시피 상세 (RecipeDetailModal 재사용 — 담기/기록/수정 그대로) */}
      <RecipeDetailModal
        recipe={searchRecipeId ? (currentSpace?.recipes?.find(r => r.id === searchRecipeId) || null) : null}
        isOpen={!!searchRecipeId}
        onClose={() => setSearchRecipeId(null)}
        onSave={updateRecipe}
        onDelete={async r => { await deleteRecipe(r.id); setSearchRecipeId(null) }}
      />
    </div>
  )
}
