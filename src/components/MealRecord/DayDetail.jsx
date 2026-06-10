import { useState } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useApp } from '../../context/AppContext'
import MealCard from './MealCard'
import MealForm from './MealForm'

const MEAL_TIME_ORDER = { 아침: 0, 점심: 1, 저녁: 2 }

export default function DayDetail({ date, onClose }) {
  const { currentSpace, addMeal, updateMeal, deleteMeal } = useApp()

  const dateStr = format(date, 'yyyy-MM-dd')
  const dayMeals = (currentSpace?.meals.filter(m => m.date === dateStr) || [])
    .slice()
    .sort((a, b) => (MEAL_TIME_ORDER[a.mealTime] ?? 1) - (MEAL_TIME_ORDER[b.mealTime] ?? 1))

  const [mode, setMode] = useState(dayMeals.length === 0 ? 'form' : 'list')
  const [editing, setEditing] = useState(null)

  const dateLabel = format(date, 'M월 d일 (eee)', { locale: ko })

  function handleAdd(data) {
    addMeal(data)
    setMode('list')
  }

  function handleEdit(data) {
    updateMeal(editing.id, data)
    setEditing(null)
  }

  function handleDelete(id) {
    if (confirm('이 기록을 삭제할까요?')) {
      deleteMeal(id)
      if (dayMeals.length === 1) setMode('form')
    }
  }

  // 수정 모드
  if (editing) {
    return (
      <div>
        <button
          onClick={() => setEditing(null)}
          className="flex items-center gap-1 text-sm text-warm-light mb-5 hover:text-warm-brown transition-colors"
        >
          ← {dateLabel}
        </button>
        <MealForm
          date={date}
          initial={editing}
          onSubmit={handleEdit}
          onCancel={() => setEditing(null)}
        />
      </div>
    )
  }

  // 입력 폼 모드
  if (mode === 'form') {
    return (
      <div>
        {dayMeals.length > 0 && (
          <button
            onClick={() => setMode('list')}
            className="flex items-center gap-1 text-sm text-warm-light mb-5 hover:text-warm-brown transition-colors"
          >
            ← {dateLabel} 기록 보기
          </button>
        )}
        <MealForm date={date} onSubmit={handleAdd} onCancel={dayMeals.length > 0 ? () => setMode('list') : onClose} />
      </div>
    )
  }

  // 목록 모드
  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-warm-light mb-0.5">식사 기록</p>
          <h3 className="font-semibold text-warm-dark text-base">{dateLabel}</h3>
        </div>
        <button
          onClick={() => setMode('form')}
          className="text-sm bg-warm-brown text-white px-4 py-2 rounded-full hover:bg-warm-dark transition-colors font-medium"
        >
          + 추가
        </button>
      </div>

      <div className="space-y-3">
        {dayMeals.map(meal => (
          <MealCard
            key={meal.id}
            meal={meal}
            onEdit={() => setEditing(meal)}
            onDelete={() => handleDelete(meal.id)}
          />
        ))}
      </div>
    </div>
  )
}
