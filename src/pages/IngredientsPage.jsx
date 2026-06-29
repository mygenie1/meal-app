import { useState } from 'react'
import IngredientList from '../components/Ingredients/IngredientList'
import RecipeList from '../components/Recipes/RecipeList'
import BannerSlot from '../components/common/BannerSlot'

export default function IngredientsPage() {
  const [bannerActive, setBannerActive] = useState(false)
  const [view, setView] = useState('ingredients') // 'ingredients' | 'recipes'

  return (
    <div
      className="px-4"
      style={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        // 배너 활성 시 BottomNav(4rem) + 배너(~8rem) + safe-area 만큼 여백 확보
        paddingBottom: bannerActive
          ? 'calc(13rem + env(safe-area-inset-bottom))'
          : '7rem',
      }}
    >
      <div className="mb-4">
        <h1 className="text-xl font-bold text-warm-dark">재료</h1>
        <p className="text-sm text-warm-light mt-1">
          {view === 'ingredients'
            ? '장 볼 거리와 냉장고에 남은 재료를 함께 관리해요'
            : '자주 해먹는 요리를 레시피로 기록해요'}
        </p>
      </div>

      {/* 재료 / 레시피 전환 토글 */}
      <div className="flex p-1 mb-5 bg-cream-100 rounded-2xl">
        <button
          onClick={() => setView('ingredients')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
            view === 'ingredients' ? 'bg-warm-brown text-white shadow-sm' : 'text-warm-light'
          }`}
        >
          재료
        </button>
        <button
          onClick={() => setView('recipes')}
          className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
            view === 'recipes' ? 'bg-warm-brown text-white shadow-sm' : 'text-warm-light'
          }`}
        >
          레시피
        </button>
      </div>

      {view === 'ingredients' ? <IngredientList /> : <RecipeList />}

      {/* 재료 하단 배너 슬롯 — BottomNav 바로 위 fixed 포지션 */}
      <BannerSlot slot="ingredients_bottom" fixed onActive={setBannerActive} />
    </div>
  )
}
