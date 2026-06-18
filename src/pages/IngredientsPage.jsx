import { useState } from 'react'
import IngredientList from '../components/Ingredients/IngredientList'
import BannerSlot from '../components/common/BannerSlot'

export default function IngredientsPage() {
  const [bannerActive, setBannerActive] = useState(false)

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
      <div className="mb-5">
        <h1 className="text-xl font-bold text-warm-dark">재료</h1>
        <p className="text-sm text-warm-light mt-1">장 볼 거리와 냉장고에 남은 재료를 함께 관리해요</p>
      </div>
      <IngredientList />
      {/* 재료 하단 배너 슬롯 — BottomNav 바로 위 fixed 포지션 */}
      <BannerSlot slot="ingredients_bottom" fixed onActive={setBannerActive} />
    </div>
  )
}
