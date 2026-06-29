import { useState, useMemo } from 'react'
import { useApp } from '../../context/AppContext'
import Modal from '../common/Modal'
import RecipeForm from './RecipeForm'
import RecipeDetailModal from './RecipeDetailModal'

// 레시피명/메모 자체 검색용 정규화 (통합검색 연동은 Phase 4)
function normalize(s) {
  return (s || '').trim().toLowerCase()
}

function RecipeCard({ recipe, cookCount = 0, onClick }) {
  const ingCount = recipe.ingredients?.length || 0
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border border-cream-200 shadow-sm overflow-hidden flex active:scale-[0.99] transition-transform"
    >
      {recipe.photo ? (
        <img src={recipe.photo} alt="" className="w-24 h-24 object-cover shrink-0" />
      ) : (
        <div className="w-24 h-24 shrink-0 bg-cream-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-cream-300" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0 p-3">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-warm-dark truncate">{recipe.name}</h3>
          {recipe.linkUrl && (
            <svg className="w-3.5 h-3.5 text-warm-light shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
            </svg>
          )}
        </div>
        {recipe.memo && (
          <p className="text-xs text-warm-light mt-1 line-clamp-2 break-words">{recipe.memo}</p>
        )}
        {(ingCount > 0 || cookCount > 0) && (
          <p className="text-[11px] text-cream-400 mt-1.5">
            {ingCount > 0 && `재료 ${ingCount}개`}
            {ingCount > 0 && cookCount > 0 && ' · '}
            {cookCount > 0 && `${cookCount}번 해먹음`}
          </p>
        )}
      </div>
    </button>
  )
}

export default function RecipeList() {
  const { currentSpace, addRecipe, updateRecipe, deleteRecipe } = useApp()
  const [query, setQuery] = useState('')
  const [addOpen, setAddOpen] = useState(false)   // 추가 폼 모달 (수정은 상세 모달 안 'edit' 뷰에서 처리)
  const [detailId, setDetailId] = useState(null)  // 상세 모달 대상 레시피 id

  const recipes = currentSpace?.recipes || []
  // 상세는 최신 데이터를 currentSpace에서 조회 → 수정 직후 즉시 갱신
  const detail = detailId ? (recipes.find(r => r.id === detailId) || null) : null

  // 레시피별 해먹은 횟수 = recipe_id로 연결된 식사 기록 수
  const cookCounts = useMemo(() => {
    const counts = {}
    ;(currentSpace?.meals || []).forEach(m => {
      if (m.recipeId) counts[m.recipeId] = (counts[m.recipeId] || 0) + 1
    })
    return counts
  }, [currentSpace?.meals])

  const filtered = useMemo(() => {
    const q = normalize(query)
    if (!q) return recipes
    return recipes.filter(
      r => normalize(r.name).includes(q) || normalize(r.memo).includes(q)
    )
  }, [recipes, query])

  if (!currentSpace) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-cream-400">
        <p className="text-sm">스페이스를 먼저 만들어주세요</p>
      </div>
    )
  }

  async function handleAdd(data) {
    await addRecipe(data)
    setAddOpen(false)
  }
  async function handleDelete(recipe) {
    await deleteRecipe(recipe.id)
    setDetailId(null)
  }

  return (
    <div>
      {/* 검색 + 추가 */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-cream-100 border border-cream-300">
          <svg className="w-4 h-4 text-cream-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="레시피 검색"
            className="flex-1 min-w-0 bg-transparent text-base text-warm-dark outline-none placeholder-cream-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-cream-400 shrink-0" aria-label="지우기">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="px-4 py-2 rounded-xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors active:scale-95 shrink-0"
        >
          추가
        </button>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 text-cream-400">
          {query ? (
            <p className="text-sm">검색 결과가 없어요</p>
          ) : (
            <>
              <svg className="w-10 h-10 text-cream-300 mb-3" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-sm text-warm-light">아직 저장한 레시피가 없어요</p>
              <p className="text-xs text-cream-400 mt-1">자주 해먹는 요리를 레시피로 기록해보세요</p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              cookCount={cookCounts[recipe.id] || 0}
              onClick={() => setDetailId(recipe.id)}
            />
          ))}
        </div>
      )}

      {/* 추가 모달 (수정은 상세 모달 안 'edit' 뷰에서 처리 — 모달 중첩 방지) */}
      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title="레시피 추가"
      >
        <RecipeForm
          initial={null}
          onSubmit={handleAdd}
          onCancel={() => setAddOpen(false)}
        />
      </Modal>

      {/* 상세 모달 (수정/삭제/재료담기 포함) */}
      <RecipeDetailModal
        recipe={detail}
        isOpen={!!detail}
        onClose={() => setDetailId(null)}
        onSave={updateRecipe}
        onDelete={handleDelete}
      />
    </div>
  )
}
