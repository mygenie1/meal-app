import { useState, useEffect } from 'react'
import Modal from '../common/Modal'
import { useApp } from '../../context/AppContext'
import { linkify } from '../../lib/linkify'
import RecipeForm from './RecipeForm'

// 재료명 매칭용 정규화 — 완전일치 비교 (부분일치 금지: "소금"이 "맛소금"에 걸리는 오탐 방지)
function normalize(s) {
  return (s || '').trim().toLowerCase().replace(/\s+/g, '')
}

// 살 것에 넣을 표시 텍스트 — 분량(amount/unit)이 있으면 "이름 (2개)" 형태로 병기
function buildBuyText(ing) {
  const parts = [ing.amount, ing.unit].map(p => (p || '').trim()).filter(Boolean)
  return parts.length ? `${ing.name} (${parts.join(' ')})` : ing.name
}

// 레시피 상세 모달 — 자체 Modal 포함 (MealDetailModal 패턴)
// onSave(recipeId, data): 수정 저장 / onDelete(recipe): 삭제
// 수정은 두 번째 히스토리-모달을 띄우지 않고 같은 모달 안 'edit' 뷰로 처리 (popstate 충돌 방지)
export default function RecipeDetailModal({ recipe, isOpen, onClose, onSave, onDelete }) {
  const { currentSpace, addIngredient } = useApp()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [view, setView] = useState('detail')   // 'detail' | 'cart' | 'edit'
  const [onlyMissing, setOnlyMissing] = useState(true) // true=없는것만, false=전체
  const [checked, setChecked] = useState({})    // { [idx]: bool }
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  const ingredients = recipe?.ingredients || []

  // 보유(냉장고=remaining) / 이미 담김(toBuy) 정규화 Set — 읽기만, 변경 없음
  const remainingSet = new Set((currentSpace?.ingredients?.remaining || []).map(i => normalize(i.text)))
  const toBuySet = new Set((currentSpace?.ingredients?.toBuy || []).map(i => normalize(i.text)))

  // 각 재료 분류: 'have'(보유 중) | 'incart'(장바구니에 있음) | 'new'(담기 후보)
  function statusOf(ing) {
    const norm = normalize(ing.name)
    if (toBuySet.has(norm)) return 'incart'
    if (remainingSet.has(norm)) return 'have'
    return 'new'
  }

  // 모드별 기본 체크 계산 — 없는것만: new만 / 전체: incart 제외 전부
  function computeDefaults(missingOnly) {
    const next = {}
    ingredients.forEach((ing, idx) => {
      const st = statusOf(ing)
      if (st === 'incart') next[idx] = false
      else if (st === 'have') next[idx] = !missingOnly
      else next[idx] = true
    })
    return next
  }

  // 모달 열림/레시피 변경 시 초기화
  useEffect(() => {
    if (isOpen) {
      setView('detail')
      setConfirmDelete(false)
      setOnlyMissing(true)
      setToast('')
    }
  }, [isOpen, recipe?.id])

  if (!recipe) return null

  async function handleDelete() {
    await onDelete(recipe)
    setConfirmDelete(false)
  }

  async function handleSaveEdit(data) {
    await onSave(recipe.id, data)
    setView('detail')
  }

  function openCart() {
    setOnlyMissing(true)
    setChecked(computeDefaults(true))
    setView('cart')
  }

  function switchMode(missingOnly) {
    setOnlyMissing(missingOnly)
    setChecked(computeDefaults(missingOnly))
  }

  function toggle(idx) {
    setChecked(prev => ({ ...prev, [idx]: !prev[idx] }))
  }

  const checkedCount = ingredients.filter((_, idx) => checked[idx]).length

  async function handleAddToCart() {
    if (busy || checkedCount === 0) return
    setBusy(true)
    try {
      let added = 0
      for (let idx = 0; idx < ingredients.length; idx++) {
        if (!checked[idx]) continue
        await addIngredient('toBuy', buildBuyText(ingredients[idx]), 1)
        added++
      }
      setView('detail')
      setToast(`살 것에 ${added}개 담았어요`)
      setTimeout(() => setToast(''), 2200)
    } catch (err) {
      console.error('[RecipeDetailModal] 재료 담기 실패:', err)
      setToast('담기에 실패했어요. 다시 시도해주세요')
      setTimeout(() => setToast(''), 2200)
    } finally {
      setBusy(false)
    }
  }

  const STATUS_LABEL = {
    have: { text: '냉장고에 있음', cls: 'text-warm-light bg-cream-100' },
    incart: { text: '장바구니에 있음', cls: 'text-warm-light bg-cream-100' },
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={recipe.name}>
      {/* 토스트 */}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-10 z-[95] px-5 py-3 rounded-2xl bg-warm-dark text-white text-sm font-medium shadow-lg whitespace-nowrap pointer-events-none">
          {toast}
        </div>
      )}

      {view === 'cart' ? (
        /* ── 재료 담기 미리보기 ── */
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('detail')}
              className="p-1 -ml-1 text-warm-light hover:text-warm-brown transition-colors"
              aria-label="뒤로"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-sm font-semibold text-warm-dark">살 것에 담기</h3>
          </div>

          {/* 모드 토글 */}
          <div className="flex p-1 bg-cream-100 rounded-2xl">
            <button
              onClick={() => switchMode(true)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                onlyMissing ? 'bg-warm-brown text-white shadow-sm' : 'text-warm-light'
              }`}
            >
              없는 재료만
            </button>
            <button
              onClick={() => switchMode(false)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                !onlyMissing ? 'bg-warm-brown text-white shadow-sm' : 'text-warm-light'
              }`}
            >
              전체
            </button>
          </div>

          <p className="text-[11px] text-warm-light -mt-1">
            냉장고에 있거나 이미 담은 재료는 자동 제외돼요. 필요하면 직접 체크하세요.
          </p>

          {/* 재료 목록 */}
          <div className="space-y-2">
            {ingredients.map((ing, idx) => {
              const st = statusOf(ing)
              const label = STATUS_LABEL[st]
              const isChecked = !!checked[idx]
              return (
                <button
                  key={ing.id || idx}
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center gap-3 rounded-2xl border border-cream-200 px-4 py-3 bg-white text-left active:scale-[0.99] transition-transform"
                >
                  <span
                    className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                      isChecked ? 'bg-warm-brown border-warm-brown' : 'border-cream-300'
                    }`}
                  >
                    {isChecked && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="flex-1 min-w-0 text-sm text-warm-dark truncate">
                    {ing.name}
                    {(ing.amount || ing.unit) && (
                      <span className="text-warm-light"> · {[ing.amount, ing.unit].filter(Boolean).join(' ')}</span>
                    )}
                  </span>
                  {label && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${label.cls}`}>{label.text}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* 확정 */}
          <div
            className="sticky bottom-0 bg-cream-50 pt-2"
            style={{ paddingBottom: 'max(8px, env(safe-area-inset-bottom))' }}
          >
            <button
              onClick={handleAddToCart}
              disabled={busy || checkedCount === 0}
              className="w-full py-3 rounded-2xl bg-warm-brown text-white font-medium hover:bg-warm-dark transition-colors active:scale-95 disabled:opacity-40"
            >
              {busy ? '담는 중...' : checkedCount > 0 ? `${checkedCount}개 담기` : '담을 재료를 선택하세요'}
            </button>
          </div>
        </div>
      ) : view === 'edit' ? (
        /* ── 수정 (같은 모달 안 뷰 전환 — 중첩 모달/popstate 충돌 방지) ── */
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('detail')}
              className="p-1 -ml-1 text-warm-light hover:text-warm-brown transition-colors"
              aria-label="뒤로"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h3 className="text-sm font-semibold text-warm-dark">레시피 수정</h3>
          </div>
          <RecipeForm
            initial={recipe}
            onSubmit={handleSaveEdit}
            onCancel={() => setView('detail')}
          />
        </div>
      ) : (
        /* ── 상세 ── */
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

          {/* 재료 + 담기 버튼 */}
          {ingredients.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-warm-dark">재료</h3>
                <button
                  onClick={openCart}
                  className="flex items-center gap-1 text-sm text-warm-brown font-medium hover:text-warm-dark transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  재료 담기
                </button>
              </div>
              <div className="rounded-2xl border border-cream-200 divide-y divide-cream-100 overflow-hidden">
                {ingredients.map(ing => (
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
                  onClick={() => setView('edit')}
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
      )}
    </Modal>
  )
}
