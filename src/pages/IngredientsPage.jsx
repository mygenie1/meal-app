import IngredientList from '../components/Ingredients/IngredientList'

export default function IngredientsPage() {
  return (
    <>
      <header className="sticky top-0 z-40 bg-cream-50/90 backdrop-blur-sm border-b border-cream-200 px-4 py-3">
        <h1 className="text-base font-semibold text-warm-dark">재료 목록</h1>
      </header>
      <div className="px-4 pb-28 pt-4">
        <IngredientList />
      </div>
    </>
  )
}
