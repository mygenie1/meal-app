import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const AppContext = createContext(null)

const SPACE_KEY = 'mealapp_current_space'

// DB row → 앱 내부 meal 객체
// photosLoaded: false → 목록 조회 시 photos 컬럼 미포함, 상세 클릭 시 별도 로드
function rowToMeal(row, { photosLoaded = true } = {}) {
  const photos = Array.isArray(row.photos) && row.photos.length > 0
    ? row.photos
    : (row.photo ? [row.photo] : [])
  return {
    id: row.id,
    date: row.date,
    createdAt: row.created_at,
    title: row.title || '',
    photo: photos[0] || '',
    photos,
    photosLoaded,
    restaurantName: row.restaurant_name || '',
    location: row.location || '',
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    rating: row.rating || 0,
    review: row.review || '',
    memo: row.memo || '',
    tag: row.tag || '',
    mealTime: row.meal_time || '',
  }
}

// 목록 조회 시 photos(base64 대용량) 제외 → 타임아웃 방지
const MEAL_LIST_SELECT = 'id, space_id, date, title, restaurant_name, location, lat, lng, rating, review, memo, tag, meal_time, created_at'

// 앱 내부 meal 객체 → DB insert/update 용
function mealToRow(data) {
  const photos = data.photos ?? (data.photo ? [data.photo] : [])
  return {
    date: data.date,
    title: data.title ?? '',
    restaurant_name: data.restaurantName ?? '',
    location: data.location ?? '',
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    rating: data.rating ?? 0,
    review: data.review ?? '',
    memo: data.memo ?? '',
    tag: data.tag ?? '',
    photo: photos[0] ?? '',
    photos,
    meal_time: data.mealTime ?? '',
  }
}

function rowToIngredient(row) {
  return { id: row.id, text: row.text, done: row.done }
}

function rowToWishlist(row) {
  return {
    id: row.id,
    name: row.name || '',
    memo: row.memo || '',
    location: row.location || '',
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    createdAt: row.created_at,
    category: row.category || '',
    moodTags: Array.isArray(row.mood_tags) ? row.mood_tags : [],
    photo: row.photo || '',
    reason: row.reason || '',
    hours: row.hours || '',
    priceRange: row.price_range || '',
    visited: row.visited || false,
    visitedAt: row.visited_at || null,
  }
}

export function AppProvider({ children }) {
  const [spaces, setSpaces] = useState([])
  const [currentSpaceId, setCurrentSpaceId] = useState(
    () => localStorage.getItem(SPACE_KEY) || null
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [retryAttempt, setRetryAttempt] = useState(0) // 0 = 첫 시도, 1~2 = 재시도 중

  const currentSpace = spaces.find(s => s.id === currentSpaceId) || null

  // currentSpaceId 변경 시 localStorage 동기화
  useEffect(() => {
    if (currentSpaceId) localStorage.setItem(SPACE_KEY, currentSpaceId)
    else localStorage.removeItem(SPACE_KEY)
  }, [currentSpaceId])

  // 앱 시작 시 spaces만 빠르게 로드 → 나머지는 백그라운드
  useEffect(() => {
    boot(0)
  }, [])

  // Supabase Realtime 구독 — 다른 기기/사용자의 변경사항 실시간 반영
  useEffect(() => {
    const spacesChannel = supabase
      .channel('realtime:spaces')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spaces' }, ({ eventType, new: newRow, old: oldRow }) => {
        if (eventType === 'INSERT') {
          setSpaces(prev => {
            if (prev.find(s => s.id === newRow.id)) return prev
            return [...prev, {
              id: newRow.id,
              name: newRow.name,
              emoji: newRow.emoji,
              code: newRow.code,
              createdAt: newRow.created_at,
              meals: [],
              ingredients: { toBuy: [], remaining: [] },
              wishlist: [],
            }]
          })
        } else if (eventType === 'UPDATE') {
          setSpaces(prev => prev.map(s =>
            s.id === newRow.id
              ? { ...s, name: newRow.name, emoji: newRow.emoji, code: newRow.code }
              : s
          ))
        } else if (eventType === 'DELETE') {
          setSpaces(prev => {
            const next = prev.filter(s => s.id !== oldRow.id)
            setCurrentSpaceId(cur => cur === oldRow.id ? (next[0]?.id || null) : cur)
            return next
          })
        }
      })
      .subscribe()

    const mealsChannel = supabase
      .channel('realtime:meals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meals' }, ({ eventType, new: newRow, old: oldRow }) => {
        console.log(`[Realtime:meals] 이벤트=${eventType}`, {
          id: newRow?.id || oldRow?.id,
          space_id: newRow?.space_id,
          title: newRow?.title,
          tag: newRow?.tag,
          photos_count: Array.isArray(newRow?.photos) ? newRow.photos.length : 'null/undefined',
          raw_new: newRow,
        })
        if (eventType === 'INSERT') {
          setSpaces(prev => prev.map(s => {
            if (s.id !== newRow.space_id) return s
            const alreadyExists = s.meals.find(m => m.id === newRow.id)
            console.log(`[Realtime:meals INSERT] 이미 로컬에 있음=${!!alreadyExists}, 현재 meals수=${s.meals.length}`)
            if (alreadyExists) return s
            // Realtime 페이로드는 대용량 photos 컬럼이 잘릴 수 있으므로 photosLoaded: false
            return { ...s, meals: [...s.meals, rowToMeal(newRow, { photosLoaded: false })] }
          }))
        } else if (eventType === 'UPDATE') {
          // Realtime UPDATE payload는 photos[] 같은 대용량 base64 컬럼이 누락되거나
          // cacheGeocoords처럼 lat/lng만 변경하는 부분 UPDATE에서 다른 컬럼이 없을 수 있음.
          // payload를 직접 신뢰하지 않고 DB에서 전체 row를 재조회해 완전한 데이터를 사용.
          const mealId = newRow.id
          if (!mealId) return
          console.log(`[Realtime:meals UPDATE] DB 재조회 시작, mealId=${mealId}`)
          supabase
            .from('meals')
            .select('*')
            .eq('id', mealId)
            .single()
            .then(({ data, error }) => {
              if (error || !data) {
                console.error('[Realtime:meals UPDATE] DB 재조회 실패', error)
                return
              }
              console.log(`[Realtime:meals UPDATE] DB 재조회 성공, photos수=${Array.isArray(data.photos) ? data.photos.length : 0}`)
              setSpaces(prev => prev.map(s => {
                if (s.id !== data.space_id) return s
                return {
                  ...s,
                  meals: s.meals.map(m => m.id === data.id ? rowToMeal(data) : m),
                }
              }))
            })
        } else if (eventType === 'DELETE') {
          // DELETE 이벤트의 old는 id만 포함 → 전체 스페이스에서 제거
          console.log(`[Realtime:meals DELETE] id=${oldRow?.id}`)
          setSpaces(prev => prev.map(s => ({
            ...s,
            meals: s.meals.filter(m => m.id !== oldRow.id),
          })))
        }
      })
      .subscribe()

    const ingredientsChannel = supabase
      .channel('realtime:ingredients')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ingredients' }, ({ eventType, new: newRow, old: oldRow }) => {
        if (eventType === 'INSERT') {
          setSpaces(prev => prev.map(s => {
            if (s.id !== newRow.space_id) return s
            const type = newRow.type
            if (s.ingredients[type]?.find(i => i.id === newRow.id)) return s // 이미 로컬에 추가됨
            return {
              ...s,
              ingredients: {
                ...s.ingredients,
                [type]: [...(s.ingredients[type] || []), rowToIngredient(newRow)],
              },
            }
          }))
        } else if (eventType === 'UPDATE') {
          setSpaces(prev => prev.map(s => {
            if (s.id !== newRow.space_id) return s
            const type = newRow.type
            return {
              ...s,
              ingredients: {
                ...s.ingredients,
                [type]: s.ingredients[type].map(i =>
                  i.id === newRow.id ? rowToIngredient(newRow) : i
                ),
              },
            }
          }))
        } else if (eventType === 'DELETE') {
          // DELETE 이벤트의 old는 id만 포함 → 전체 스페이스/타입에서 제거
          setSpaces(prev => prev.map(s => ({
            ...s,
            ingredients: {
              toBuy: s.ingredients.toBuy.filter(i => i.id !== oldRow.id),
              remaining: s.ingredients.remaining.filter(i => i.id !== oldRow.id),
            },
          })))
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(spacesChannel)
      supabase.removeChannel(mealsChannel)
      supabase.removeChannel(ingredientsChannel)
    }
  }, [])

  const MAX_RETRIES = 3
  const RETRY_DELAYS = [1500, 3000, 5000]

  // Phase 1: spaces만 빠르게 조회 — DB 웜업 후 앱 즉시 오픈
  async function boot(attempt = 0) {
    setLoading(true)
    setLoadError(null)
    setRetryAttempt(attempt)

    try {
      const { data: spacesData, error } = await supabase
        .from('spaces')
        .select('*')
        .order('created_at')

      if (error) throw new Error(error.message || 'spaces 조회 오류')

      const spaceList = (spacesData || []).map(s => ({
        id: s.id,
        name: s.name,
        emoji: s.emoji,
        code: s.code,
        createdAt: s.created_at,
        meals: [],
        ingredients: { toBuy: [], remaining: [] },
        wishlist: [],
      }))

      // React 18 StrictMode에서 useEffect가 두 번 실행되므로
      // setSpaces(spaceList)로 단순 교체하면 기존 meals가 초기화됨.
      // functional update로 기존 meals/ingredients를 보존하고 space 메타데이터만 갱신.
      setSpaces(prev => {
        const prevMap = Object.fromEntries(prev.map(s => [s.id, s]))
        return spaceList.map(s => ({
          ...s,
          meals: prevMap[s.id]?.meals ?? [],
          ingredients: prevMap[s.id]?.ingredients ?? { toBuy: [], remaining: [] },
          wishlist: prevMap[s.id]?.wishlist ?? [],
        }))
      })
      setCurrentSpaceId(prev => {
        if (prev && spaceList.find(s => s.id === prev)) return prev
        return spaceList[0]?.id || null
      })
      setLoading(false)

      // Phase 2: 각 space의 meals + ingredients 백그라운드 로드 (에러 있어도 앱 유지)
      loadAllSpaceData(spaceList).catch(err =>
        console.warn('백그라운드 데이터 로드 실패:', err)
      )
    } catch (err) {
      console.error(`Supabase boot error (시도 ${attempt + 1}/${MAX_RETRIES}):`, err)

      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]))
        return boot(attempt + 1)
      }

      // 모든 재시도 소진 → 앱은 열되 에러 배너 표시
      const msg = err.name === 'AbortError'
        ? '연결 시간이 초과됐어요 (타임아웃)'
        : (err.message || 'Supabase 연결 오류')
      setLoadError(msg)
      setLoading(false) // 빈 상태로 앱 오픈
    }
  }

  // Phase 2: 각 space의 meals + ingredients를 순차 로드 (DB 부하 분산)
  async function loadAllSpaceData(spaceList) {
    console.log(`[loadAllSpaceData] 시작, spaces수=${spaceList.length}`, spaceList.map(s => s.id))
    for (const space of spaceList) {
      try {
        console.log(`[loadAllSpaceData] space=${space.id} DB 조회 시작`)
        const [
          { data: mealsData, error: e1 },
          { data: ingredientsData, error: e2 },
        ] = await Promise.all([
          supabase.from('meals').select(MEAL_LIST_SELECT).eq('space_id', space.id).order('created_at'),
          supabase.from('ingredients').select('*').eq('space_id', space.id).order('created_at'),
        ])

        if (e1) throw new Error(e1.message)
        if (e2) throw new Error(e2.message)

        // wishlist는 선택적 — 테이블이 없으면 빈 배열
        let wishlistData = []
        try {
          const { data: wData } = await supabase.from('wishlist').select('*').eq('space_id', space.id).order('created_at')
          if (wData) wishlistData = wData
        } catch {}

        console.log(`[loadAllSpaceData] space=${space.id} DB 조회 완료, meals수=${mealsData?.length}`)
        setSpaces(prev => prev.map(s => {
          if (s.id !== space.id) return s
          const dbMeals = (mealsData || []).map(row => rowToMeal(row, { photosLoaded: false }))
          const dbMealIds = new Set(dbMeals.map(m => m.id))
          // 백그라운드 로딩 중 addMeal로 추가된 meal이 이 DB 쿼리보다 늦게 DB에 반영됐을 수 있음.
          // DB 결과에 없는 로컬 meal을 보존해 race condition으로 인한 신규 기록 손실 방지.
          const localOnlyMeals = s.meals.filter(m => !dbMealIds.has(m.id))
          console.log(`[loadAllSpaceData] setSpaces: dbMeals=${dbMeals.length}, localOnly=${localOnlyMeals.length}, 현재state meals=${s.meals.length}`)
          if (localOnlyMeals.length > 0) {
            console.log('[loadAllSpaceData] 보존된 localOnly meal ids:', localOnlyMeals.map(m => m.id))
          }
          return {
            ...s,
            meals: [...dbMeals, ...localOnlyMeals],
            ingredients: {
              toBuy: (ingredientsData || []).filter(i => i.type === 'toBuy').map(rowToIngredient),
              remaining: (ingredientsData || []).filter(i => i.type === 'remaining').map(rowToIngredient),
            },
            wishlist: wishlistData.map(rowToWishlist),
          }
        }))
      } catch (err) {
        console.warn(`[loadAllSpaceData] Space ${space.id} 데이터 로드 실패:`, err)
      }
    }
    console.log('[loadAllSpaceData] 완료')
  }

  // 개별 meal의 photos 컬럼만 별도 조회 (목록 조회 시 photos 제외로 인한 lazy load)
  async function loadMealPhotos(mealId) {
    const { data, error } = await supabase
      .from('meals')
      .select('id, space_id, photo, photos')
      .eq('id', mealId)
      .single()

    if (error || !data) {
      console.error('[loadMealPhotos] 실패', error)
      // 실패해도 photosLoaded: true로 표시해서 로딩 스피너가 무한 돌지 않도록
      setSpaces(prev => prev.map(s => ({
        ...s,
        meals: s.meals.map(m => m.id === mealId ? { ...m, photosLoaded: true } : m),
      })))
      return
    }

    const photos = Array.isArray(data.photos) && data.photos.length > 0
      ? data.photos
      : (data.photo ? [data.photo] : [])

    setSpaces(prev => prev.map(s => {
      if (s.id !== data.space_id) return s
      return {
        ...s,
        meals: s.meals.map(m =>
          m.id === mealId
            ? { ...m, photo: photos[0] || '', photos, photosLoaded: true }
            : m
        ),
      }
    }))
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
      wishlist: [],
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
    console.log('[addMeal] 시작, currentSpaceId=', currentSpaceId, '| date=', mealData.date, '| tag=', mealData.tag)
    if (!currentSpaceId) {
      console.error('[addMeal] currentSpaceId 없음 → 저장 불가')
      return null
    }

    const rowData = mealToRow(mealData)

    // Optimistic update: INSERT 완료 전에 즉시 목록에 표시
    const tempId = 'temp_' + Date.now()
    const tempMeal = rowToMeal({ ...rowData, id: tempId, created_at: new Date().toISOString() })
    setSpaces(prev => prev.map(s => {
      if (s.id !== currentSpaceId) return s
      console.log(`[addMeal] optimistic 추가, 기존 meals수=${s.meals.length}`)
      return { ...s, meals: [...s.meals.filter(m => m.id !== tempId), tempMeal] }
    }))

    // photos는 로컬 rowData에 이미 있으므로 id/created_at만 받아옴
    // (전체 row 재다운로드 시 대용량 base64가 15초 타임아웃을 초과할 수 있음)
    console.log('[addMeal] Supabase INSERT 요청 시작')
    const { data, error } = await supabase
      .from('meals')
      .insert({ space_id: currentSpaceId, ...rowData })
      .select('id, created_at')
      .single()

    if (error) {
      console.error('[addMeal] INSERT 실패 →', error.message, error)
      // 저장 실패 시 임시 항목 롤백
      setSpaces(prev => prev.map(s => {
        if (s.id !== currentSpaceId) return s
        console.log('[addMeal] 실패 → optimistic 롤백')
        return { ...s, meals: s.meals.filter(m => m.id !== tempId) }
      }))
      return null
    }

    console.log('[addMeal] INSERT 성공, DB id=', data.id, '| created_at=', data.created_at)

    // 임시 항목을 DB 실제 ID로 교체
    // Realtime INSERT가 먼저 도착했을 수 있으므로 실제 ID도 같이 제거 후 추가
    const newMeal = rowToMeal({ ...rowData, id: data.id, created_at: data.created_at })
    setSpaces(prev => prev.map(s => {
      if (s.id !== currentSpaceId) return s
      const before = s.meals.length
      const next = [...s.meals.filter(m => m.id !== tempId && m.id !== newMeal.id), newMeal]
      console.log(`[addMeal] state 교체: 이전=${before} → 이후=${next.length} (tempId 제거 후 realId 추가)`)
      return { ...s, meals: next }
    }))
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
        ? { ...s, meals: s.meals.map(m => m.id === mealId ? { ...m, ...updates, photosLoaded: true } : m) }
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

  // 가고싶은곳 추가
  async function addWishlistItem(data) {
    if (!currentSpaceId) return null
    const row = {
      space_id: currentSpaceId,
      name: data.name,
      memo: data.memo || '',
      location: data.location || '',
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      category: data.category || '',
      mood_tags: data.moodTags || [],
      photo: data.photo || '',
      reason: data.reason || '',
      hours: data.hours || '',
      price_range: data.priceRange || '',
      visited: false,
    }
    const { data: rowData, error } = await supabase.from('wishlist').insert(row).select().single()
    if (error) { console.error(error); return null }
    const item = rowToWishlist(rowData)
    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId
        ? { ...s, wishlist: [...(s.wishlist || []), item] }
        : s
    ))
    return item
  }

  // 가고싶은곳 수정 (방문 처리 포함)
  async function updateWishlistItem(id, updates) {
    const row = {}
    if (updates.name !== undefined) row.name = updates.name
    if (updates.memo !== undefined) row.memo = updates.memo
    if (updates.location !== undefined) row.location = updates.location
    if (updates.lat !== undefined) row.lat = updates.lat
    if (updates.lng !== undefined) row.lng = updates.lng
    if (updates.category !== undefined) row.category = updates.category
    if (updates.moodTags !== undefined) row.mood_tags = updates.moodTags
    if (updates.photo !== undefined) row.photo = updates.photo
    if (updates.reason !== undefined) row.reason = updates.reason
    if (updates.hours !== undefined) row.hours = updates.hours
    if (updates.priceRange !== undefined) row.price_range = updates.priceRange
    if (updates.visited !== undefined) row.visited = updates.visited
    if (updates.visitedAt !== undefined) row.visited_at = updates.visitedAt

    const { error } = await supabase.from('wishlist').update(row).eq('id', id)
    if (error) { console.error(error); return }
    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId
        ? { ...s, wishlist: (s.wishlist || []).map(w => w.id === id ? { ...w, ...updates } : w) }
        : s
    ))
  }

  // 가고싶은곳 삭제
  async function deleteWishlistItem(id) {
    const { error } = await supabase.from('wishlist').delete().eq('id', id)
    if (error) { console.error(error); return }
    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId
        ? { ...s, wishlist: (s.wishlist || []).filter(w => w.id !== id) }
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

    // 없으면 해당 스페이스의 meals + ingredients + wishlist 로드
    const [{ data: mealsData }, { data: ingredientsData }] = await Promise.all([
      supabase.from('meals').select(MEAL_LIST_SELECT).eq('space_id', spaceRow.id).order('created_at'),
      supabase.from('ingredients').select('*').eq('space_id', spaceRow.id).order('created_at'),
    ])

    let joinWishlistData = []
    try {
      const { data: wData } = await supabase.from('wishlist').select('*').eq('space_id', spaceRow.id).order('created_at')
      if (wData) joinWishlistData = wData
    } catch {}

    const space = {
      id: spaceRow.id,
      name: spaceRow.name,
      emoji: spaceRow.emoji,
      code: spaceRow.code,
      createdAt: spaceRow.created_at,
      meals: (mealsData || []).map(row => rowToMeal(row, { photosLoaded: false })),
      ingredients: {
        toBuy: (ingredientsData || []).filter(i => i.type === 'toBuy').map(rowToIngredient),
        remaining: (ingredientsData || []).filter(i => i.type === 'remaining').map(rowToIngredient),
      },
      wishlist: joinWishlistData.map(rowToWishlist),
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
        retryAttempt,
        reload: () => boot(0),
        createSpace,
        switchSpace,
        deleteSpace,
        addMeal,
        updateMeal,
        deleteMeal,
        loadMealPhotos,
        cacheGeocoords,
        addIngredient,
        toggleIngredient,
        deleteIngredient,
        addWishlistItem,
        updateWishlistItem,
        deleteWishlistItem,
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
