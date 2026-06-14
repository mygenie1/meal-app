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

// 원형 -/+ 버튼 + 가운데 숫자. minusAsDelete: quantity가 1일 때 - 가 삭제로 동작함을 라벨에 반영
export function QtyStepper({ quantity, onDecrement, onIncrement, minusAsDelete }) {
  return (
    <div className="flex items-center shrink-0">
      <button
        type="button"
        onClick={onDecrement}
        aria-label={minusAsDelete ? '삭제' : '개수 줄이기'}
        className="w-7 h-7 rounded-full bg-cream-200 text-warm-brown flex items-center justify-center hover:bg-cream-300 active:scale-90 transition-all"
      >
        <MinusIcon />
      </button>
      <span className="w-8 text-center text-sm font-medium text-warm-dark tabular-nums">{quantity}</span>
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
