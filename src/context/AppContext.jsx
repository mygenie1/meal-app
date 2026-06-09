import { createContext, useContext, useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'

const AppContext = createContext(null)

const STORAGE_KEY = 'mealapp_data'

const defaultData = {
  spaces: [],
  currentSpaceId: null,
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return defaultData
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function AppProvider({ children }) {
  const [data, setData] = useState(loadData)

  useEffect(() => {
    saveData(data)
  }, [data])

  const currentSpace = data.spaces.find(s => s.id === data.currentSpaceId) || null

  // 스페이스 생성
  function createSpace(name, emoji = '🍽️') {
    const newSpace = {
      id: uuidv4(),
      name,
      emoji,
      code: Math.random().toString(36).substring(2, 8).toUpperCase(),
      createdAt: new Date().toISOString(),
      meals: [],
      ingredients: { toBuy: [], remaining: [] },
    }
    setData(prev => ({
      ...prev,
      spaces: [...prev.spaces, newSpace],
      currentSpaceId: newSpace.id,
    }))
    return newSpace
  }

  // 스페이스 전환
  function switchSpace(id) {
    setData(prev => ({ ...prev, currentSpaceId: id }))
  }

  // 스페이스 삭제
  function deleteSpace(id) {
    setData(prev => {
      const spaces = prev.spaces.filter(s => s.id !== id)
      return {
        ...prev,
        spaces,
        currentSpaceId: prev.currentSpaceId === id
          ? (spaces[0]?.id || null)
          : prev.currentSpaceId,
      }
    })
  }

  // 식사 기록 추가
  function addMeal(mealData) {
    const newMeal = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      ...mealData,
    }
    setData(prev => ({
      ...prev,
      spaces: prev.spaces.map(s =>
        s.id === prev.currentSpaceId
          ? { ...s, meals: [...s.meals, newMeal] }
          : s
      ),
    }))
    return newMeal
  }

  // 식사 기록 수정
  function updateMeal(mealId, updates) {
    setData(prev => ({
      ...prev,
      spaces: prev.spaces.map(s =>
        s.id === prev.currentSpaceId
          ? {
              ...s,
              meals: s.meals.map(m =>
                m.id === mealId ? { ...m, ...updates } : m
              ),
            }
          : s
      ),
    }))
  }

  // 식사 기록 삭제
  function deleteMeal(mealId) {
    setData(prev => ({
      ...prev,
      spaces: prev.spaces.map(s =>
        s.id === prev.currentSpaceId
          ? { ...s, meals: s.meals.filter(m => m.id !== mealId) }
          : s
      ),
    }))
  }

  // 특정 스페이스의 meal에 좌표 캐싱 (지오코딩 결과 저장용)
  function cacheGeocoords(spaceId, mealId, lat, lng) {
    setData(prev => ({
      ...prev,
      spaces: prev.spaces.map(s =>
        s.id === spaceId
          ? {
              ...s,
              meals: s.meals.map(m =>
                m.id === mealId ? { ...m, lat, lng } : m
              ),
            }
          : s
      ),
    }))
  }

  // 재료 추가
  function addIngredient(type, text) {
    const item = { id: uuidv4(), text, done: false }
    setData(prev => ({
      ...prev,
      spaces: prev.spaces.map(s =>
        s.id === prev.currentSpaceId
          ? {
              ...s,
              ingredients: {
                ...s.ingredients,
                [type]: [...s.ingredients[type], item],
              },
            }
          : s
      ),
    }))
  }

  // 재료 체크 토글
  function toggleIngredient(type, itemId) {
    setData(prev => ({
      ...prev,
      spaces: prev.spaces.map(s =>
        s.id === prev.currentSpaceId
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
      ),
    }))
  }

  // 재료 삭제
  function deleteIngredient(type, itemId) {
    setData(prev => ({
      ...prev,
      spaces: prev.spaces.map(s =>
        s.id === prev.currentSpaceId
          ? {
              ...s,
              ingredients: {
                ...s.ingredients,
                [type]: s.ingredients[type].filter(i => i.id !== itemId),
              },
            }
          : s
      ),
    }))
  }

  // 코드로 스페이스 참가 (로컬 MVP — 같은 기기에 있는 스페이스 찾기)
  function joinByCode(code) {
    const found = data.spaces.find(
      s => s.code.toUpperCase() === code.toUpperCase()
    )
    if (found) {
      switchSpace(found.id)
      return found
    }
    return null
  }

  return (
    <AppContext.Provider
      value={{
        spaces: data.spaces,
        currentSpace,
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
