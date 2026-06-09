import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AppContext = createContext(null)

const SPACE_KEY = 'mealapp_current_space'

// DB row → 앱 내부 meal 객체
function rowToMeal(row) {
  return {
    id: row.id,
    date: row.date,
    createdAt: row.created_at,
    photo: row.photo || '',
    restaurantName: row.restaurant_name || '',
    location: row.location || '',
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    rating: row.rating || 0,
    review: row.review || '',
    memo: row.memo || '',
    tag: row.tag || '',
  }
}

// 앱 내부 meal 객체 → DB insert/update 용
function mealToRow(data) {
  return {
    date: data.date,
    restaurant_name: data.restaurantName ?? '',
    location: data.location ?? '',
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    rating: data.rating ?? 0,
    review: data.review ?? '',
    memo: data.memo ?? '',
    tag: data.tag ?? '',
    photo: data.photo ?? '',
  }
}

function rowToIngredient(row) {
  return { id: row.id, text: row.text, done: row.done }
}

export function AppProvider({ children }) {
  const [spaces, setSpaces] = useState([])
  const [currentSpaceId, setCurrentSpaceId] = useState(
    () => localStorage.getItem(SPACE_KEY) || null
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const currentSpace = spaces.find(s => s.id === currentSpaceId) || null

  // currentSpaceId 변경 시 localStorage 동기화
  useEffect(() => {
    if (currentSpaceId) localStorage.setItem(SPACE_KEY, currentSpaceId)
    else localStorage.removeItem(SPACE_KEY)
  }, [currentSpaceId])

  // 앱 시작 시 Supabase에서 전체 데이터 로드
  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setLoadError(null)
    try {
      const [
        { data: spacesData, error: e1 },
        { data: mealsData, error: e2 },
        { data: ingredientsData, error: e3 },
      ] = await Promise.all([
        supabase.from('spaces').select('*').order('created_at'),
        supabase.from('meals').select('*').order('created_at'),
        supabase.from('ingredients').select('*').order('created_at'),
      ])

      const firstError = e1 || e2 || e3
      if (firstError) {
        console.error('Supabase load error:', firstError)
        setLoadError(firstError.message || 'Supabase 연결 오류')
        return
      }

      const built = (spacesData || []).map(s => ({
        id: s.id,
        name: s.name,
        emoji: s.emoji,
        code: s.code,
        createdAt: s.created_at,
        meals: (mealsData || []).filter(m => m.space_id === s.id).map(rowToMeal),
        ingredients: {
          toBuy: (ingredientsData || [])
            .filter(i => i.space_id === s.id && i.type === 'toBuy')
            .map(rowToIngredient),
          remaining: (ingredientsData || [])
            .filter(i => i.space_id === s.id && i.type === 'remaining')
            .map(rowToIngredient),
        },
      }))

      setSpaces(built)

      // 저장된 currentSpaceId가 없거나 DB에 없으면 첫 번째로 초기화
      setCurrentSpaceId(prev => {
        if (prev && built.find(s => s.id === prev)) return prev
        return built[0]?.id || null
      })
    } finally {
      setLoading(false)
    }
  }

  // 스페이스 생성
  async function createSpace(name, emoji = '🍽️') {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const { data, error } = await supabase
      .from('spaces')
      .insert({ name, emoji, code })
      .select()
      .single()

    if (error) { console.error(error); return null }

    const newSpace = {
      id: data.id,
      name: data.name,
      emoji: data.emoji,
      code: data.code,
      createdAt: data.created_at,
      meals: [],
      ingredients: { toBuy: [], remaining: [] },
    }
    setSpaces(prev => [...prev, newSpace])
    setCurrentSpaceId(data.id)
    return newSpace
  }

  // 스페이스 전환
  function switchSpace(id) {
    setCurrentSpaceId(id)
  }

  // 스페이스 삭제 (meals, ingredients는 CASCADE로 자동 삭제)
  async function deleteSpace(id) {
    const { error } = await supabase.from('spaces').delete().eq('id', id)
    if (error) { console.error(error); return }

    setSpaces(prev => {
      const next = prev.filter(s => s.id !== id)
      setCurrentSpaceId(cur => cur === id ? (next[0]?.id || null) : cur)
      return next
    })
  }

  // 식사 기록 추가
  async function addMeal(mealData) {
    if (!currentSpaceId) return null

    const { data, error } = await supabase
      .from('meals')
      .insert({ space_id: currentSpaceId, ...mealToRow(mealData) })
      .select()
      .single()

    if (error) { console.error(error); return null }

    const newMeal = rowToMeal(data)
    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId
        ? { ...s, meals: [...s.meals, newMeal] }
        : s
    ))
    return newMeal
  }

  // 식사 기록 수정
  async function updateMeal(mealId, updates) {
    const { error } = await supabase
      .from('meals')
      .update(mealToRow(updates))
      .eq('id', mealId)

    if (error) { console.error(error); return }

    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId
        ? { ...s, meals: s.meals.map(m => m.id === mealId ? { ...m, ...updates } : m) }
        : s
    ))
  }

  // 식사 기록 삭제
  async function deleteMeal(mealId) {
    const { error } = await supabase.from('meals').delete().eq('id', mealId)
    if (error) { console.error(error); return }

    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId
        ? { ...s, meals: s.meals.filter(m => m.id !== mealId) }
        : s
    ))
  }

  // 지오코딩 좌표 캐싱 (MealMap에서 호출, 어느 스페이스든 대상)
  async function cacheGeocoords(spaceId, mealId, lat, lng) {
    const { error } = await supabase
      .from('meals')
      .update({ lat, lng })
      .eq('id', mealId)

    if (error) { console.error(error); return }

    setSpaces(prev => prev.map(s =>
      s.id === spaceId
        ? { ...s, meals: s.meals.map(m => m.id === mealId ? { ...m, lat, lng } : m) }
        : s
    ))
  }

  // 재료 추가
  async function addIngredient(type, text) {
    if (!currentSpaceId) return

    const { data, error } = await supabase
      .from('ingredients')
      .insert({ space_id: currentSpaceId, type, text, done: false })
      .select()
      .single()

    if (error) { console.error(error); return }

    const item = rowToIngredient(data)
    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId
        ? { ...s, ingredients: { ...s.ingredients, [type]: [...s.ingredients[type], item] } }
        : s
    ))
  }

  // 재료 체크 토글
  async function toggleIngredient(type, itemId) {
    const item = currentSpace?.ingredients[type]?.find(i => i.id === itemId)
    if (!item) return

    const { error } = await supabase
      .from('ingredients')
      .update({ done: !item.done })
      .eq('id', itemId)

    if (error) { console.error(error); return }

    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId
        ? {
            ...s,
            ingredients: {
              ...s.ingredients,
              [type]: s.ingredients[type].map(i =>
                i.id === itemId ? { ...i, done: !i.done } : i
              ),
            },
          }
        : s
    ))
  }

  // 재료 삭제
  async function deleteIngredient(type, itemId) {
    const { error } = await supabase.from('ingredients').delete().eq('id', itemId)
    if (error) { console.error(error); return }

    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId
        ? {
            ...s,
            ingredients: {
              ...s.ingredients,
              [type]: s.ingredients[type].filter(i => i.id !== itemId),
            },
          }
        : s
    ))
  }

  // 코드로 스페이스 참가 — 이제 다른 기기에서 생성된 스페이스도 찾을 수 있음
  async function joinByCode(code) {
    const { data: spaceRow, error } = await supabase
      .from('spaces')
      .select('*')
      .ilike('code', code.trim())
      .single()

    if (error || !spaceRow) return null

    // 이미 로컬에 있으면 그냥 전환
    const existing = spaces.find(s => s.id === spaceRow.id)
    if (existing) {
      setCurrentSpaceId(spaceRow.id)
      return existing
    }

    // 없으면 해당 스페이스의 meals + ingredients 로드
    const [{ data: mealsData }, { data: ingredientsData }] = await Promise.all([
      supabase.from('meals').select('*').eq('space_id', spaceRow.id).order('created_at'),
      supabase.from('ingredients').select('*').eq('space_id', spaceRow.id).order('created_at'),
    ])

    const space = {
      id: spaceRow.id,
      name: spaceRow.name,
      emoji: spaceRow.emoji,
      code: spaceRow.code,
      createdAt: spaceRow.created_at,
      meals: (mealsData || []).map(rowToMeal),
      ingredients: {
        toBuy: (ingredientsData || []).filter(i => i.type === 'toBuy').map(rowToIngredient),
        remaining: (ingredientsData || []).filter(i => i.type === 'remaining').map(rowToIngredient),
      },
    }

    setSpaces(prev => [...prev, space])
    setCurrentSpaceId(space.id)
    return space
  }

  return (
    <AppContext.Provider
      value={{
        spaces,
        currentSpace,
        loading,
        loadError,
        createSpace,
        switchSpace,
        deleteSpace,
        addMeal,
        updateMeal,
        deleteMeal,
        cacheGeocoords,
        addIngredient,
        toggleIngredient,
        deleteIngredient,
        joinByCode,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
