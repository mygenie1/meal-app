import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { requestFCMToken } from '../lib/firebase'

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
    fromWishlist: row.from_wishlist || false,
    userId: row.user_id || null,
    nickname: row.nickname || '',
    avatarUrl: row.avatar_url || '',
  }
}

// 목록 조회 시 photos(base64 대용량) 제외 → 타임아웃 방지
const MEAL_LIST_SELECT = 'id, space_id, date, title, restaurant_name, location, lat, lng, rating, review, memo, tag, meal_time, from_wishlist, user_id, nickname, avatar_url, created_at'

// 앱 내부 meal 객체 → DB insert/update 용
function mealToRow(data) {
  const photos = data.photos ?? (data.photo ? [data.photo] : [])
  const row = {
    date: data.date,
    title: data.title ?? '',
    restaurant_name: data.restaurantName ?? '',
    location: data.location ?? '',
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    review: data.review ?? '',
    memo: data.memo ?? '',
    tag: data.tag ?? '',
    photo: photos[0] ?? '',
    photos,
    meal_time: data.mealTime ?? '',
    from_wishlist: data.fromWishlist ?? false,
  }
  // 별점은 ratings 테이블로 통일됨. rating이 명시적으로 전달된 경우에만 컬럼에 기록
  // (레거시 데이터 보존 — MealForm은 더 이상 rating을 보내지 않으므로 수정 시 기존 값 유지)
  if (data.rating !== undefined) row.rating = data.rating
  return row
}

function rowToIngredient(row) {
  // quantity가 NULL인 기존 데이터는 1로 표시 (하위 호환)
  return { id: row.id, text: row.text, done: row.done, quantity: row.quantity ?? 1 }
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
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const hasBootedRef = useRef(false)

  const [spaces, setSpaces] = useState([])
  const [currentSpaceId, setCurrentSpaceId] = useState(
    () => localStorage.getItem(SPACE_KEY) || null
  )
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [retryAttempt, setRetryAttempt] = useState(0) // 0 = 첫 시도, 1~2 = 재시도 중
  // mealId → [{ id, user_id, nickname, rating }]
  const [ratingsMap, setRatingsMap] = useState({})
  // wishlistId → [{ id, wishlist_id, user_id, nickname, avatar_url }]
  const [wishlistInterestsMap, setWishlistInterestsMap] = useState({})
  // 현재 유저의 알림 목록 (최신 50건)
  const [notifications, setNotifications] = useState([])
  const [notifEnabled, setNotifEnabled] = useState(() => localStorage.getItem('notif_enabled') !== 'false')

  function setNotifEnabledPref(val) {
    setNotifEnabled(val)
    localStorage.setItem('notif_enabled', val ? 'true' : 'false')
  }

  const currentSpace = spaces.find(s => s.id === currentSpaceId) || null

  // currentSpaceId 변경 시 localStorage 동기화
  useEffect(() => {
    if (currentSpaceId) localStorage.setItem(SPACE_KEY, currentSpaceId)
    else localStorage.removeItem(SPACE_KEY)
  }, [currentSpaceId])

  // Auth 상태 감지 → 로그인 후 boot
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      setAuthLoading(false)

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && currentUser) {
        if (!hasBootedRef.current) {
          hasBootedRef.current = true
          boot(0, currentUser)
          registerFCMToken(currentUser.id)
        }
      } else if (event === 'INITIAL_SESSION' && !currentUser) {
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        hasBootedRef.current = false
        setSpaces([])
        setCurrentSpaceId(null)
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Supabase Realtime 구독 — 다른 기기/사용자의 변경사항 실시간 반영
  // spacesChannel: 나가기/참가 후 DB 직접 재조회 방식으로 대체하여 제거
  useEffect(() => {
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
            const item = rowToIngredient(newRow)
            const inTarget = s.ingredients[type]?.some(i => i.id === newRow.id)
            if (inTarget) {
              // 같은 타입 내 갱신 — 순서 유지
              return {
                ...s,
                ingredients: {
                  ...s.ingredients,
                  [type]: s.ingredients[type].map(i => i.id === newRow.id ? item : i),
                },
              }
            }
            // 타입 변경(살것↔남은재료 이동) — 반대편에서 제거 후 새 타입에 추가
            const other = type === 'toBuy' ? 'remaining' : 'toBuy'
            return {
              ...s,
              ingredients: {
                ...s.ingredients,
                [other]: (s.ingredients[other] || []).filter(i => i.id !== newRow.id),
                [type]: [...(s.ingredients[type] || []).filter(i => i.id !== newRow.id), item],
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
      supabase.removeChannel(mealsChannel)
      supabase.removeChannel(ingredientsChannel)
    }
  }, [])

  // 알림 로드 + Realtime 구독 (로그인 시)
  useEffect(() => {
    if (!user?.id) { setNotifications([]); return }
    let destroyed = false

    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { if (!destroyed && data) setNotifications(data) })

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        ({ new: newRow }) => {
          if (!destroyed && newRow?.user_id === user.id) {
            // 같은 알림이 두 번 전달되는 경우 중복 추가 방지 (id 기준)
            setNotifications(prev =>
              prev.find(n => n.id === newRow.id) ? prev : [newRow, ...prev].slice(0, 50)
            )
          }
        }
      )
      .subscribe()

    return () => { destroyed = true; supabase.removeChannel(channel) }
  }, [user?.id])

  const MAX_RETRIES = 3
  const RETRY_DELAYS = [1500, 3000, 5000]

  // FCM 토큰 등록 — 로그인 직후 한 번만 시도
  async function registerFCMToken(userId) {
    if (!userId) return
    console.log('[FCM] registerFCMToken 시작, userId:', userId)
    try {
      const token = await requestFCMToken()
      if (!token) {
        console.log('[FCM] 토큰 없음 — 저장 스킵')
        return
      }
      // SELECT 후 조건부 INSERT — DB UNIQUE 제약 없어도 중복 행 방지
      const { data: existing } = await supabase
        .from('fcm_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('token', token)
        .maybeSingle()
      if (existing) {
        console.log('[FCM] 토큰 이미 저장됨, 스킵')
        return
      }
      const { error } = await supabase
        .from('fcm_tokens')
        .insert({ user_id: userId, token })
      if (error) {
        console.error('[FCM] 토큰 저장 실패:', error)
      } else {
        console.log('[FCM] 토큰 저장 완료')
      }
    } catch (e) {
      console.error('[FCM] 토큰 등록 오류:', e)
    }
  }

  // Phase 1: spaces만 빠르게 조회 — DB 웜업 후 앱 즉시 오픈
  async function boot(attempt = 0, currentUser = null) {
    setLoading(true)
    setLoadError(null)
    setRetryAttempt(attempt)

    try {
      // spaces 테이블 직접 조회 대신 space_members 기반으로 명시적 조회.
      // 이렇게 해야 나간 스페이스가 새로고침 후 다시 나타나는 버그를 방지할 수 있음.
      // spaces 테이블 RLS에만 의존하면 정책 설정 상태에 따라 모든 스페이스가 반환될 수 있음.
      const { data: memberships, error } = await supabase
        .from('space_members')
        .select('spaces(*)')
        .eq('user_id', currentUser?.id)

      if (error) throw new Error(error.message || 'spaces 조회 오류')

      const spaceRows = (memberships || [])
        .map(m => m.spaces)
        .filter(Boolean)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

      const spaceList = spaceRows.map(s => ({
        id: s.id,
        name: s.name,
        emoji: s.emoji,
        code: s.code,
        ownerId: s.owner_id || null,
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
        return boot(attempt + 1, currentUser)
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

        // 별점 로드 (테이블 미존재 시 무시)
        const mealIds = (mealsData || []).map(r => r.id)
        if (mealIds.length > 0) {
          try {
            const { data: ratingsData } = await supabase
              .from('ratings')
              .select('id, meal_id, user_id, nickname, rating')
              .in('meal_id', mealIds)
            if (ratingsData?.length > 0) {
              const rMap = {}
              ratingsData.forEach(r => {
                if (!rMap[r.meal_id]) rMap[r.meal_id] = []
                rMap[r.meal_id].push(r)
              })
              setRatingsMap(prev => ({ ...prev, ...rMap }))
            }
          } catch {}
        }

        // 위시리스트 관심 목록 로드
        const wishlistIds = wishlistData.map(w => w.id)
        if (wishlistIds.length > 0) {
          try {
            const { data: interestsData } = await supabase
              .from('wishlist_interests')
              .select('id, wishlist_id, user_id, nickname, avatar_url')
              .in('wishlist_id', wishlistIds)
            if (interestsData?.length > 0) {
              const iMap = {}
              interestsData.forEach(i => {
                if (!iMap[i.wishlist_id]) iMap[i.wishlist_id] = []
                iMap[i.wishlist_id].push(i)
              })
              setWishlistInterestsMap(prev => ({ ...prev, ...iMap }))
            }
          } catch {}
        }

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

  // 프로필 업데이트 (닉네임 등 user_metadata)
  async function updateProfile(updates) {
    const { data, error } = await supabase.auth.updateUser({ data: updates })
    if (error) { console.error(error); return false }
    setUser(data.user)
    return true
  }

  // 카카오 로그인
  async function signIn() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.origin },
    })
    if (error) console.error('카카오 로그인 오류:', error)
  }

  // 로그아웃
  async function signOut() {
    await supabase.auth.signOut()
    // onAuthStateChange SIGNED_OUT 이벤트에서 상태 초기화
  }

  // 회원 탈퇴: Edge Function 호출 → auth.users 삭제 → 로컬 세션 정리
  async function deleteAccount() {
    const { data, error } = await supabase.functions.invoke('delete-account')
    console.log('[deleteAccount] Edge Function 응답:', { data, error })
    if (error) {
      console.error('[deleteAccount] invoke 오류:', error)
      throw new Error(error.message || '탈퇴 처리에 실패했어요')
    }
    if (data?.error) {
      console.error('[deleteAccount] 서버 오류:', data.error)
      throw new Error(data.error)
    }
    console.log('[deleteAccount] 서버 삭제 완료 — 로컬 세션 정리')
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn('[deleteAccount] signOut 실패 (무시):', e)
    }
    // signOut이 onAuthStateChange를 트리거하지 않을 경우 강제 초기화
    setUser(null)
    setSpaces([])
    setCurrentSpaceId(null)
    localStorage.removeItem(SPACE_KEY)
  }

  // 스페이스 생성
  async function createSpace(name, emoji = '🍽️') {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const insertData = { name, emoji, code }
    if (user) insertData.owner_id = user.id

    const { data, error } = await supabase
      .from('spaces')
      .insert(insertData)
      .select()
      .single()

    if (error) { console.error(error); return null }

    // 생성한 스페이스를 space_members에도 등록 (RLS: 내 스페이스만 보이게)
    if (user?.id) {
      await supabase.from('space_members').insert({ space_id: data.id, user_id: user.id })
    }

    const newSpace = {
      id: data.id,
      name: data.name,
      emoji: data.emoji,
      code: data.code,
      ownerId: data.owner_id || null,
      createdAt: data.created_at,
      meals: [],
      ingredients: { toBuy: [], remaining: [] },
      wishlist: [],
    }
    setSpaces(prev => [...prev, newSpace])
    setCurrentSpaceId(data.id)
    return newSpace
  }

  // 기존 스페이스를 현재 로그인 사용자의 것으로 연동
  async function claimSpace(spaceId) {
    if (!user) return false
    const { error } = await supabase
      .from('spaces')
      .update({ owner_id: user.id })
      .eq('id', spaceId)
    if (error) { console.error(error); return false }
    // space_members에도 등록 (이미 있으면 무시)
    await supabase.from('space_members').insert({ space_id: spaceId, user_id: user.id })
    setSpaces(prev => prev.map(s => s.id === spaceId ? { ...s, ownerId: user.id } : s))
    return true
  }

  // 스페이스 전환
  function switchSpace(id) {
    setCurrentSpaceId(id)
  }

  // 스페이스 나가기 — space_members에서 내 참가 기록만 제거 (Supabase 데이터 삭제 없음)
  async function leaveSpace(id) {
    if (!user?.id) return

    const { error } = await supabase
      .from('space_members')
      .delete()
      .eq('space_id', id)
      .eq('user_id', user.id)
    console.log('[leaveSpace] DB 삭제 결과:', error ? error.message : '성공')
    if (error) { console.error('[leaveSpace] 오류:', error); return }

    // 삭제 성공 후 내가 실제로 속한 스페이스만 DB에서 재조회 → stale local state 방지
    const { data: memberships } = await supabase
      .from('space_members')
      .select('space_id')
      .eq('user_id', user.id)

    const mySpaceIds = new Set((memberships || []).map(m => m.space_id))
    console.log('[leaveSpace] 남은 스페이스 수:', mySpaceIds.size)

    const nextSpaces = spaces.filter(s => mySpaceIds.has(s.id))
    setSpaces(nextSpaces)
    setCurrentSpaceId(cur => mySpaceIds.has(cur) ? cur : (nextSpaces[0]?.id || null))
  }

  // 식사 기록 추가
  async function addMeal(mealData) {
    console.log('[addMeal] 시작, currentSpaceId=', currentSpaceId, '| date=', mealData.date, '| tag=', mealData.tag)
    if (!currentSpaceId) {
      console.error('[addMeal] currentSpaceId 없음 → 저장 불가')
      return null
    }

    const rowData = mealToRow(mealData)

    // 작성자 정보 자동 추가
    if (user) {
      rowData.user_id = user.id
      rowData.nickname = user.user_metadata?.name || user.user_metadata?.full_name || ''
      rowData.avatar_url = user.user_metadata?.avatar_url || ''
    }

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
  async function addIngredient(type, text, quantity = 1) {
    if (!currentSpaceId) return

    const qty = Math.max(1, quantity || 1)
    const { data, error } = await supabase
      .from('ingredients')
      .insert({ space_id: currentSpaceId, type, text, done: false, quantity: qty })
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

  // 살 것 → 남은 재료로 이동 (장본 재료를 냉장고로). type을 remaining으로 바꾸고 done 리셋
  async function moveIngredientToRemaining(itemId) {
    const item = currentSpace?.ingredients?.toBuy?.find(i => i.id === itemId)
    if (!item) return

    const { error } = await supabase
      .from('ingredients')
      .update({ type: 'remaining', done: false })
      .eq('id', itemId)

    if (error) { console.error(error); return }

    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId
        ? {
            ...s,
            ingredients: {
              toBuy: s.ingredients.toBuy.filter(i => i.id !== itemId),
              remaining: [...s.ingredients.remaining, { ...item, done: false }],
            },
          }
        : s
    ))
  }

  // 재료 개수 변경 (최소 1) — 0 이하로 줄이려면 호출 측에서 deleteIngredient 사용
  async function updateIngredientQuantity(type, itemId, quantity) {
    const qty = Math.max(1, quantity)
    const { error } = await supabase
      .from('ingredients')
      .update({ quantity: qty })
      .eq('id', itemId)

    if (error) { console.error(error); return }

    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId
        ? {
            ...s,
            ingredients: {
              ...s.ingredients,
              [type]: s.ingredients[type].map(i =>
                i.id === itemId ? { ...i, quantity: qty } : i
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
      user_id: user?.id || null,
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

  // 나도 가고싶어요 추가
  async function addWishlistInterest(wishlistId) {
    if (!user || !wishlistId) return false
    const row = {
      wishlist_id: wishlistId,
      user_id: user.id,
      nickname: user.user_metadata?.name || user.user_metadata?.full_name || '',
      avatar_url: user.user_metadata?.avatar_url || '',
    }
    // 낙관적 업데이트
    const optimistic = { id: `temp-${Date.now()}`, ...row }
    setWishlistInterestsMap(prev => {
      const existing = (prev[wishlistId] || []).filter(i => i.user_id !== user.id)
      return { ...prev, [wishlistId]: [...existing, optimistic] }
    })
    const { data, error } = await supabase
      .from('wishlist_interests')
      .insert(row)
      .select('id, wishlist_id, user_id, nickname, avatar_url')
      .single()
    if (error) {
      // 롤백
      setWishlistInterestsMap(prev => ({
        ...prev,
        [wishlistId]: (prev[wishlistId] || []).filter(i => i.id !== optimistic.id),
      }))
      return false
    }
    setWishlistInterestsMap(prev => ({
      ...prev,
      [wishlistId]: (prev[wishlistId] || []).map(i => i.id === optimistic.id ? data : i),
    }))
    return true
  }

  // 나도 가고싶어요 취소
  async function removeWishlistInterest(wishlistId) {
    if (!user || !wishlistId) return false
    const myEntry = (wishlistInterestsMap[wishlistId] || []).find(i => i.user_id === user.id)
    if (!myEntry) return false
    // 낙관적 업데이트
    setWishlistInterestsMap(prev => ({
      ...prev,
      [wishlistId]: (prev[wishlistId] || []).filter(i => i.user_id !== user.id),
    }))
    const { error } = await supabase
      .from('wishlist_interests')
      .delete()
      .eq('wishlist_id', wishlistId)
      .eq('user_id', user.id)
    if (error) {
      // 롤백
      setWishlistInterestsMap(prev => ({
        ...prev,
        [wishlistId]: [...(prev[wishlistId] || []), myEntry],
      }))
      return false
    }
    return true
  }

  // 알림 읽음 처리
  async function markNotificationRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function markAllNotificationsRead() {
    if (!user) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  // 별점 추가 또는 수정 (UPSERT)
  async function addOrUpdateRating(mealId, rating) {
    if (!user) return false
    const { data, error } = await supabase
      .from('ratings')
      .upsert({
        meal_id: mealId,
        user_id: user.id,
        nickname: user.user_metadata?.name || user.user_metadata?.full_name || '',
        rating,
      }, { onConflict: 'meal_id,user_id' })
      .select('id, meal_id, user_id, nickname, rating')
      .single()
    if (error) { console.error(error); return false }
    setRatingsMap(prev => {
      const existing = (prev[mealId] || []).filter(r => r.user_id !== user.id)
      return { ...prev, [mealId]: [...existing, data] }
    })
    return true
  }

  // 내 별점 삭제
  async function deleteRating(mealId) {
    if (!user) return false
    const { error } = await supabase
      .from('ratings')
      .delete()
      .eq('meal_id', mealId)
      .eq('user_id', user.id)
    if (error) { console.error(error); return false }
    setRatingsMap(prev => ({
      ...prev,
      [mealId]: (prev[mealId] || []).filter(r => r.user_id !== user.id),
    }))
    return true
  }

  // 코드로 스페이스 참가
  async function joinByCode(code) {
    // RPC (SECURITY DEFINER): RLS 우회하여 code로 스페이스 찾고 space_members에 등록
    // RPC 미존재 시 직접 조회로 폴백 (SQL 마이그레이션 전 하위 호환)
    let spaceRow = null
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('join_space_by_code', { p_code: code.trim() })

    if (!rpcError && rpcData) {
      spaceRow = rpcData
    } else {
      const { data: directData } = await supabase
        .from('spaces')
        .select('*')
        .ilike('code', code.trim())
        .maybeSingle()
      spaceRow = directData
    }

    if (!spaceRow) return null

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
      ownerId: spaceRow.owner_id || null,
      createdAt: spaceRow.created_at,
      meals: (mealsData || []).map(row => rowToMeal(row, { photosLoaded: false })),
      ingredients: {
        toBuy: (ingredientsData || []).filter(i => i.type === 'toBuy').map(rowToIngredient),
        remaining: (ingredientsData || []).filter(i => i.type === 'remaining').map(rowToIngredient),
      },
      wishlist: joinWishlistData.map(rowToWishlist),
    }

    setSpaces(prev => {
      if (prev.find(s => s.id === space.id)) return prev.map(s => s.id === space.id ? space : s)
      return [...prev, space]
    })
    setCurrentSpaceId(space.id)
    return space
  }

  return (
    <AppContext.Provider
      value={{
        user,
        authLoading,
        signIn,
        signOut,
        deleteAccount,
        updateProfile,
        spaces,
        currentSpace,
        loading,
        loadError,
        retryAttempt,
        reload: () => boot(0, user),
        createSpace,
        claimSpace,
        switchSpace,
        leaveSpace,
        addMeal,
        updateMeal,
        deleteMeal,
        loadMealPhotos,
        cacheGeocoords,
        addIngredient,
        toggleIngredient,
        moveIngredientToRemaining,
        updateIngredientQuantity,
        deleteIngredient,
        addWishlistItem,
        updateWishlistItem,
        deleteWishlistItem,
        wishlistInterestsMap,
        addWishlistInterest,
        removeWishlistInterest,
        joinByCode,
        ratingsMap,
        addOrUpdateRating,
        deleteRating,
        notifications: notifEnabled ? notifications : [],
        unreadCount: notifEnabled ? notifications.filter(n => !n.is_read).length : 0,
        notifEnabled,
        setNotifEnabledPref,
        markNotificationRead,
        markAllNotificationsRead,
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
