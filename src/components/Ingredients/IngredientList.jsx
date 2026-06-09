import { useState } from 'react'
import { useApp } from '../../context/AppContext'

function Section({ title, emoji, type, items, onAdd, onToggle, onDelete }) {
  const [input, setInput] = useState('')

  function handleAdd(e) {
    e.preventDefault()
    if (!input.trim()) return
    onAdd(type, input.trim())
    setInput('')
  }

  const pending = items.filter(i => !i.done)
  const done = items.filter(i => i.done)

  return (
    <div className="bg-white rounded-2xl border border-cream-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{emoji}</span>
        <h3 className="font-semibold text-warm-dark">{title}</h3>
        {pending.length > 0 && (
          <span className="ml-auto text-xs bg-cream-200 text-warm-light px-2 py-0.5 rounded-full">
            {pending.length}개 남음
          </span>
        )}
      </div>

      {/* 입력 */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-3">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="추가하기"
          className="flex-1 px-3 py-1.5 rounded-xl bg-cream-100 border border-cream-200 text-sm text-warm-dark placeholder-cream-400 focus:outline-none focus:border-warm-light"
        />
        <button
          type="submit"
          className="px-3 py-1.5 rounded-xl bg-warm-brown text-white text-sm hover:bg-warm-dark transition-colors"
        >
          +
        </button>
      </form>

      {/* 미완료 목록 */}
      <div className="space-y-1.5">
        {pending.map(item => (
          <div key={item.id} className="flex items-center gap-2 group">
            <button
              onClick={() => onToggle(type, item.id)}
              className="w-5 h-5 rounded-md border-2 border-cream-300 hover:border-warm-brown transition-colors shrink-0 flex items-center justify-center"
            />
            <span className="flex-1 text-sm text-warm-dark">{item.text}</span>
            <button
              onClick={() => onDelete(type, item.id)}
              className="opacity-0 group-hover:opacity-100 text-xs text-cream-400 hover:text-red-400 transition-all"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* 완료된 목록 */}
      {done.length > 0 && (
        <div className="mt-3 pt-3 border-t border-cream-100 space-y-1.5">
          {done.map(item => (
            <div key={item.id} className="flex items-center gap-2 group">
              <button
                onClick={() => onToggle(type, item.id)}
                className="w-5 h-5 rounded-md bg-warm-brown/20 border-2 border-warm-brown/30 transition-colors shrink-0 flex items-center justify-center"
              >
                <span className="text-warm-brown text-xs font-bold">✓</span>
              </button>
              <span className="flex-1 text-sm text-cream-400 line-through">{item.text}</span>
              <button
                onClick={() => onDelete(type, item.id)}
                className="opacity-0 group-hover:opacity-100 text-xs text-cream-400 hover:text-red-400 transition-all"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="text-center text-xs text-cream-400 py-3">항목이 없어요</p>
      )}
    </div>
  )
}

export default function IngredientList() {
  const { currentSpace, addIngredient, toggleIngredient, deleteIngredient } = useApp()

  if (!currentSpace) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-cream-400">
        <p className="text-3xl mb-2">🛒</p>
        <p className="text-sm">스페이스를 먼저 만들어주세요</p>
      </div>
    )
  }

  const { toBuy = [], remaining = [] } = currentSpace.ingredients || {}

  return (
    <div className="space-y-4">
      <Section
        title="살 것 목록"
        emoji="🛒"
        type="toBuy"
        items={toBuy}
        onAdd={addIngredient}
        onToggle={toggleIngredient}
        onDelete={deleteIngredient}
      />
      <Section
        title="남은 재료"
        emoji="🥦"
        type="remaining"
        items={remaining}
        onAdd={addIngredient}
        onToggle={toggleIngredient}
        onDelete={deleteIngredient}
      />
    </div>
  )
}
