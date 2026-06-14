import IngredientList from '../components/Ingredients/IngredientList'

export default function IngredientsPage() {
  return (
    <div className="px-4 pb-28" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      {/* 페이지 헤더 */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-warm-dark">재료</h1>
        <p className="text-sm text-warm-light mt-1">장 볼 거리와 냉장고에 남은 재료를 함께 관리해요</p>
      </div>
      <IngredientList />
    </div>
  )
}
