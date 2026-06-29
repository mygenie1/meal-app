// 통합검색 결과용 — 레시피 카드 (홈/지도 공용, WishResultCard와 일관)
export default function RecipeResultCard({ recipe, onClick }) {
  const ingCount = recipe.ingredients?.length || 0
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-cream-50 rounded-2xl shadow-sm border border-cream-200 p-4 flex items-start gap-3 hover:bg-cream-100 active:scale-[0.99] transition-colors"
    >
      {recipe.photo ? (
        <img src={recipe.photo} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-xl bg-cream-200 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-warm-brown" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[10px] font-semibold text-white bg-warm-brown px-1.5 py-0.5 rounded-full leading-none">레시피</span>
          {ingCount > 0 && <span className="text-[10px] text-warm-light">재료 {ingCount}개</span>}
        </div>
        <p className="text-sm font-semibold text-warm-dark truncate">{recipe.name || '이름 없는 레시피'}</p>
        {recipe.memo && <p className="text-xs text-cream-400 truncate mt-0.5">{recipe.memo}</p>}
      </div>
      <svg className="w-4 h-4 text-cream-300 shrink-0 mt-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  )
}
