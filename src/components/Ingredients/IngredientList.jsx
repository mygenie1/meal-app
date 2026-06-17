import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { QtyStepper } from './QtyStepper'

function Section({ title, emoji, type, items, onAdd, onCheck, onChangeQty, onDelete, checkHint }) {
  const [input, setInput] = useState('')
  const [qty, setQty] = useState(1)

  function handleAdd(e) {
    e.preventDefault()
    if (!input.trim()) return
    onAdd(type, input.trim(), qty)
    setInput('')
    setQty(1)
  }

  // - 버튼: 1보다 크면 감소, 1이면 바로 삭제
  function handleDecrement(item) {
    if (item.quantity > 1) onChangeQty(type, item.id, item.quantity - 1)
    else onDelete(type, item.id)
  }

  return (
    <div>
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-semibold text-warm-dark flex items-center gap-1.5">
          <span className="text-lg">{emoji}</span>
          {title}
        </h3>
        <span className="bg-warm-brown text-white text-xs font-medium px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </div>

      {/* 입력 — 재료명 + 개수 스테퍼 + 추가 */}
      <form onSubmit={handleAdd} className="flex items-center gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="재료명 입력"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-cream-50 border border-cream-300 text-base text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light"
        />
        <QtyStepper
          quantity={qty}
          onDecrement={() => setQty(q => Math.max(1, q - 1))}
          onIncrement={() => setQty(q => q + 1)}
        />
        <button
          type="submit"
          className="px-4 py-2 rounded-xl bg-warm-brown text-white text-sm font-medium hover:bg-warm-dark transition-colors shrink-0"
        >
          추가
        </button>
      </form>

      {/* 목록 */}
      {items.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-10 h-10 text-cream-300 mx-auto mb-2" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p className="text-sm font-medium text-warm-dark">아직 재료가 없어요</p>
          <p className="text-xs text-cream-400 mt-0.5">장을 보거나 남은 재료를 기록해보세요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-2xl border border-cream-200 px-4 py-3 transition-colors ${
                item.done ? 'bg-cream-50' : 'bg-white'
              }`}
            >
              {/* 커스텀 원형 체크박스 */}
              <button
                onClick={() => onCheck(item)}
                aria-label={checkHint || (item.done ? '완료 해제' : '완료 체크')}
                title={checkHint}
                className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                  item.done ? 'bg-warm-brown border-warm-brown' : 'border-cream-300 hover:border-warm-brown'
                }`}
              >
                {item.done && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="2.6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* 재료명 */}
              <span className={`flex-1 min-w-0 text-sm truncate ${item.done ? 'line-through text-cream-400' : 'text-warm-dark'}`}>
                {item.text}
              </span>

              {/* 개수 스테퍼 (1이면 - 버튼이 휴지통) */}
              <QtyStepper
                quantity={item.quantity}
                minusAsDelete={item.quantity <= 1}
                onDecrement={() => handleDecrement(item)}
                onIncrement={() => onChangeQty(type, item.id, item.quantity + 1)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function IngredientList() {
  const { currentSpace, addIngredient, toggleIngredient, moveIngredientToRemaining, updateIngredientQuantity, deleteIngredient } = useApp()

  if (!currentSpace) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-cream-400">
        <svg className="w-10 h-10 text-cream-300 mb-3" fill="none" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="text-sm">스페이스를 먼저 만들어주세요</p>
      </div>
    )
  }

  const { toBuy = [], remaining = [] } = currentSpace.ingredients || {}

  return (
    <div className="space-y-7">
      <Section
        title="살 것"
        emoji="🛒"
        type="toBuy"
        items={toBuy}
        onAdd={addIngredient}
        onCheck={item => moveIngredientToRemaining(item.id)}
        checkHint="체크하면 남은 재료로 이동해요"
        onChangeQty={updateIngredientQuantity}
        onDelete={deleteIngredient}
      />
      <Section
        title="남은 재료"
        emoji="🥦"
        type="remaining"
        items={remaining}
        onAdd={addIngredient}
        onCheck={item => toggleIngredient('remaining', item.id)}
        onChangeQty={updateIngredientQuantity}
        onDelete={deleteIngredient}
      />
    </div>
  )
}
