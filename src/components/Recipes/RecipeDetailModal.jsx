import { useState } from 'react'
import Modal from '../common/Modal'
import { linkify } from '../../lib/linkify'

// 레시피 상세 모달 — 자체 Modal 포함 (MealDetailModal 패턴)
// onEdit(recipe): 수정 진입 / onDelete(recipe): 삭제
export default function RecipeDetailModal({ recipe, isOpen, onClose, onEdit, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!recipe) return null

  async function handleDelete() {
    await onDelete(recipe)
    setConfirmDelete(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={recipe.name}>
      <div className="space-y-4">
        {recipe.photo && (
          <img src={recipe.photo} alt="" className="w-full max-h-60 object-cover rounded-2xl" />
        )}

        {/* 외부 링크 */}
        {recipe.linkUrl && (
          <a
            href={recipe.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-cream-100 border border-cream-200 text-warm-brown text-sm font-medium hover:bg-cream-200 transition-colors"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5" />
            </svg>
            <span className="truncate">링크 열기</span>
          </a>
        )}

        {/* 재료 */}
        {recipe.ingredients?.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-warm-dark mb-2">재료</h3>
            <div className="rounded-2xl border border-cream-200 divide-y divide-cream-100 overflow-hidden">
              {recipe.ingredients.map(ing => (
                <div key={ing.id || ing.name} className="flex items-center justify-between px-4 py-2.5 bg-white">
                  <span className="text-sm text-warm-dark">{ing.name}</span>
                  {(ing.amount || ing.unit) && (
                    <span className="text-sm text-warm-light shrink-0 ml-2">
                      {ing.amount}{ing.unit ? ` ${ing.unit}` : ''}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 메모 / 조리법 */}
        {recipe.memo && (
          <div>
            <h3 className="text-sm font-semibold text-warm-dark mb-2">메모</h3>
            <p className="text-sm text-warm-dark leading-relaxed whitespace-pre-wrap break-words">
              {linkify(recipe.memo)}
            </p>
          </div>
        )}

        {/* 액션 */}
        <div className="flex gap-2 pt-2 border-t border-cream-200">
          {confirmDelete ? (
            <>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-3 rounded-2xl bg-cream-200 text-warm-dark font-medium transition-colors active:scale-95"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 rounded-2xl bg-red-500 text-white font-medium transition-colors active:scale-95"
              >
                삭제할게요
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onEdit(recipe)}
                className="flex-1 py-3 rounded-2xl bg-warm-brown text-white font-medium hover:bg-warm-dark transition-colors active:scale-95"
              >
                수정
              </button>
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-5 py-3 rounded-2xl bg-cream-100 text-warm-light font-medium hover:bg-cream-200 transition-colors active:scale-95"
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
