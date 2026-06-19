import { useState } from 'react'

// 재료 개수 스테퍼 — IngredientList / MealForm 공용
export function MinusIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  )
}

export function PlusIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  )
}

export function TrashIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}

// 원형 -/+ 버튼 + 가운데 숫자.
// minusAsDelete: quantity가 1일 때 - 가 삭제(휴지통)로 동작
// onDirectChange: 전달 시 숫자를 탭하면 직접 입력 가능 (없으면 기존 동작)
export function QtyStepper({ quantity, onDecrement, onIncrement, minusAsDelete, onDirectChange }) {
  const [editing, setEditing] = useState(false)
  const [inputVal, setInputVal] = useState('')

  function startEdit() {
    setInputVal(String(quantity))
    setEditing(true)
  }

  function commitEdit() {
    const n = parseInt(inputVal, 10)
    if (!isNaN(n) && n >= 1) {
      onDirectChange(n)
    }
    setEditing(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    if (e.key === 'Escape') { setEditing(false) }
  }

  return (
    <div className="flex items-center shrink-0">
      <button
        type="button"
        onClick={onDecrement}
        aria-label={minusAsDelete ? '삭제' : '개수 줄이기'}
        className={`w-7 h-7 rounded-full flex items-center justify-center active:scale-90 transition-all ${
          minusAsDelete
            ? 'bg-cream-200 text-cream-400 hover:text-red-400 hover:bg-cream-300'
            : 'bg-cream-200 text-warm-brown hover:bg-cream-300'
        }`}
      >
        {minusAsDelete ? <TrashIcon /> : <MinusIcon />}
      </button>

      {onDirectChange && editing ? (
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={inputVal}
          onChange={e => setInputVal(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-10 text-center font-medium text-warm-dark bg-cream-100 border border-warm-brown rounded focus:outline-none tabular-nums"
          style={{ fontSize: '16px' }}
        />
      ) : (
        <span
          className={`w-8 text-center text-sm font-medium text-warm-dark tabular-nums${
            onDirectChange ? ' cursor-pointer rounded active:bg-cream-100' : ''
          }`}
          onClick={onDirectChange ? startEdit : undefined}
        >
          {quantity}
        </span>
      )}

      <button
        type="button"
        onClick={onIncrement}
        aria-label="개수 늘리기"
        className="w-7 h-7 rounded-full bg-cream-200 text-warm-brown flex items-center justify-center hover:bg-cream-300 active:scale-90 transition-all"
      >
        <PlusIcon />
      </button>
    </div>
  )
}
