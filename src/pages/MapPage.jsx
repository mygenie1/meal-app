import { useState } from 'react'
import MealMap from '../components/Map/MealMap'
import MealDetailModal from '../components/MealRecord/MealDetailModal'

export default function MapPage() {
  const [viewingMeal, setViewingMeal] = useState(null)

  return (
    <div className="flex flex-col h-screen">
      <header
        className="shrink-0 z-40 bg-cream-50/90 backdrop-blur-sm border-b border-cream-200 px-4"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))', paddingBottom: '0.75rem' }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-warm-dark">우리만의 맛집 지도</h1>
        </div>
      </header>
      <div className="flex-1 overflow-hidden">
        <MealMap onViewMeal={setViewingMeal} />
      </div>
      {viewingMeal && (
        <MealDetailModal meal={viewingMeal} onClose={() => setViewingMeal(null)} />
      )}
    </div>
  )
}
