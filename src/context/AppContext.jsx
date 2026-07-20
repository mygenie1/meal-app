import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { requestFCMToken, onFCMMessage } from '../lib/firebase'
import { isNative } from '../lib/platform'
import { logApple } from '../lib/debugAppleLog' // DEBUG-APPLE

const AppContext = createContext(null)

const SPACE_KEY = 'mealapp_current_space'

// 알림 무한 스크롤: 최초 4개, 이후 묶음 10개씩
const NOTIF_PAGE_INITIAL = 4
const NOTIF_PAGE_SIZE = 10

// 이메일 계정의 카카오 CDN URL은 빈 문자열로 반환
function getUserAvatarUrl(user) {
  const provider = user?.app_metadata?.provider
  const raw = user?.user_metadata?.avatar_url || ''
  const isKakaoUrl = raw.includes('kakaocdn') || raw.includes('k.kakaocdn')
  return provider !== 'kakao' && isKakaoUrl ? '' : raw
}

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
    usedIngredients: row.used_ingredients ?? null,
    placeUrl: row.place_url || '',
    recipeId: row.recipe_id || null,
  }
}

// 목록 조회 시 photos(base64 대용량) 제외 → 타임아웃 방지
const MEAL_LIST_SELECT = 'id, space_id, date, title, restaurant_name, location, lat, lng, rating, review, memo, tag, meal_time, from_wishlist, user_id, nickname, avatar_url, created_at, used_ingredients, place_url, recipe_id'

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
    place_url: data.placeUrl ?? null,
  }
  // 별점은 ratings 테이블로 통일됨. rating이 명시적으로 전달된 경우에만 컬럼에 기록
  // (레거시 데이터 보존 — MealForm은 더 이상 rating을 보내지 않으므로 수정 시 기존 값 유지)
  if (data.rating !== undefined) row.rating = data.rating
  if (data.usedIngredients !== undefined) row.used_ingredients = data.usedIngredients
  // 레시피 연결 — 명시적으로 전달된 경우에만 기록(기존 meal 저장 회귀 방지)
  if (data.recipeId !== undefined) row.recipe_id = data.recipeId
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
    placeUrl: row.place_url || '',
  }
}

// 레시피 row → 앱 내부 객체 (place_url의 placeUrl 매핑 전례 그대로 camelCase)
// recipe_ingredients 중첩 배열을 ingredients(camelCase)로, sort_order 기준 정렬
function rowToRecipe(row) {
  const ings = Array.isArray(row.recipe_ingredients) ? row.recipe_ingredients : []
  return {
    id: row.id,
    spaceId: row.space_id,
    authorId: row.author_id || null,
    name: row.name || '',
    memo: row.memo || '',
    linkUrl: row.link_url || '',
    photo: row.photo || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ingredients: [...ings]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map(i => ({
        id: i.id,
        name: i.name || '',
        amount: i.amount || '',
        unit: i.unit || '',
        sortOrder: i.sort_order ?? 0,
      })),
  }
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const hasBootedRef = useRef(false)
  // 카카오 등 다른 provider로 이미 가입된 이메일에 애플 등으로 로그인 시도 →
  // Supabase 가 자동 계정 연결을 거부한 경우의 사용자 안내 문구 (App.jsx appUrlOpen 이 설정, LoginPage 가 토스트로 표시)
  const [oauthConflictMessage, setOauthConflictMessage] = useState('')

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
  const [unreadCount, setUnreadCount] = useState(0)          // 안읽은 전체 수 (목록 길이와 무관, 별도 count 쿼리)
  const [hasMoreNotifs, setHasMoreNotifs] = useState(true)   // 더 불러올 알림이 있는지
  const [loadingMoreNotifs, setLoadingMoreNotifs] = useState(false)
  const notifIdsRef = useRef(new Set())                       // 로드된 알림 id (중복 방지: 초기/추가/실시간 공유)
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
      logApple(`onAuthStateChange: event=${event}, user=${currentUser?.id || 'null'}`) // DEBUG-APPLE
      setUser(currentUser)
      setAuthLoading(false)

      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && currentUser) {
        if (!hasBootedRef.current) {
          hasBootedRef.current = true
          // ★ 이 콜백은 GoTrue 의 auth lock 을 잡은 채로 실행된다(signInWithPassword 가 락 안에서 emit).
          //   여기서 supabase 호출(boot 의 .from(), registerFCMToken 의 .from())을 바로 시작하면
          //   PostgREST 가 요청 전에 auth.getSession() 으로 같은 락을 다시 잡으려다 데드락에 빠질 수 있다
          //   — 프로미스가 영영 pending 이라 fetch 타임아웃(AbortController)도 무력하고,
          //   boot 의 catch/재시도/에러배너에 도달하지 못해 로그인 스피너가 무한히 돈다.
          //   Supabase 공식 권고대로 콜백 안에서는 React 상태만 만지고, 실제 supabase 호출은 밖으로 defer.
          setTimeout(() => {
            boot(0, currentUser)
            // ★ 사용자가 설정에서 알림을 끈 상태(notif_enabled==='false')면 boot에서 재등록 안 함
            //   — 토글 OFF로 삭제한 토큰이 다음 실행 때 되살아나지 않게.
            // 웹: prompt:false(granted일 때만 조용히 등록, 자동 프롬프트 없음 — 기존 동작 유지)
            // 네이티브(iOS): prompt:true — 네이티브는 권한 요청에 제스처 불필요(OS 시스템 프롬프트)
            if (localStorage.getItem('notif_enabled') !== 'false') {
              registerFCMToken(currentUser.id, { prompt: isNative() })
            }
          }, 0)
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

  // ── 로그인 게이트 워치독 ──────────────────────────────────────────────
  // App.jsx 는 (authLoading || loading) 동안 전체화면 스피너를 띄우는데, 두 플래그 모두
  // "정상 경로"에서만 해제된다. supabase-js 초기화나 boot 가 어떤 이유로든 끝나지 않으면
  // 앱이 스피너에 영구히 갇힌다(= 앱스토어 2.1(a) 리젝 증상). 근본 원인이 무엇이든
  // 갇히지만은 않도록 강제 이탈 경로를 둔다.

  // 인증 초기화(INITIAL_SESSION emit)가 안 끝나면 → 세션 없음으로 간주하고 로그인 화면으로.
  // 뒤늦게 세션이 복구되면 onAuthStateChange 가 정상적으로 user 를 채우고 boot 이 돈다.
  useEffect(() => {
    if (!authLoading) return
    const t = setTimeout(() => {
      console.warn('[Auth] 초기화 8초 초과 — 세션 없음으로 간주하고 로그인 화면 표시')
      logApple('[Auth] 초기화 8초 초과 — 세션 없음으로 간주') // DEBUG-APPLE
      setAuthLoading(false)
      setLoading(false)
    }, 8000)
    return () => clearTimeout(t)
  }, [authLoading])

  // boot 이 어떤 경로로든 끝나지 않으면 → 빈 상태로 앱 오픈 + 에러 배너(재시도 가능).
  // 정상적으로는 boot 의 타임아웃/재시도/catch 가 먼저 끝난다(최악 ~20초). 이건 최후의 백스톱.
  useEffect(() => {
    if (authLoading || !loading) return
    const t = setTimeout(() => {
      console.warn('[boot] 워치독 발동 — 빈 상태로 앱 오픈')
      logApple('[boot] 워치독 발동 — 빈 상태로 앱 오픈') // DEBUG-APPLE
      setLoadError('연결이 지연되고 있어요')
      setLoading(false)
    }, 25000)
    return () => clearTimeout(t)
  }, [authLoading, loading])

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
    if (!user?.id) {
      setNotifications([]); setUnreadCount(0); setHasMoreNotifs(true)
      notifIdsRef.current = new Set()
      return
    }
    let destroyed = false
    notifIdsRef.current = new Set()

    // 최초 묶음 (4개만 — 화면 적게 차지). 이후 스크롤 시 loadMoreNotifications로 추가.
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(0, NOTIF_PAGE_INITIAL - 1)
      .then(({ data }) => {
        if (destroyed || !data) return
        data.forEach(n => notifIdsRef.current.add(n.id))
        setNotifications(data)
        setHasMoreNotifs(data.length === NOTIF_PAGE_INITIAL)
      })

    // 안읽은 전체 수는 페이지네이션과 별개로 정확히 — head count 쿼리
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
      .then(({ count }) => { if (!destroyed && typeof count === 'number') setUnreadCount(count) })

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        ({ new: newRow }) => {
          if (destroyed || newRow?.user_id !== user.id) return
          // 같은 알림이 두 번 전달되는 경우 중복 추가 방지 (id 기준, ref 공유)
          if (notifIdsRef.current.has(newRow.id)) return
          notifIdsRef.current.add(newRow.id)
          setNotifications(prev => [newRow, ...prev])
          if (!newRow.is_read) setUnreadCount(c => c + 1)
        }
      )
      .subscribe()

    return () => { destroyed = true; supabase.removeChannel(channel) }
  }, [user?.id])

  const MAX_RETRIES = 3
  const RETRY_DELAYS = [800, 1500, 3000]
  // boot 쿼리 자체의 상한. supabase.js 의 15초 fetch 타임아웃은 "fetch 가 발사된 뒤"에만 작동하므로,
  // fetch 이전 단계(auth lock 대기 등)에서 멈추면 무력하다. 그 경우에도 반드시 catch 로 빠져나오게
  // Promise.race 로 강제 상한을 건다. 최악 소요 = 6+0.8+6+1.5+6 ≈ 20초 → 그 뒤엔 앱이 열린다.
  const BOOT_TIMEOUT_MS = 6000

  function withTimeout(promise, ms, label) {
    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} 시간 초과 (${Math.round(ms / 1000)}초)`)), ms)
    })
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
  }

  // iOS/Android 네이티브(Capacitor) FCM 토큰 등록 — @capacitor-firebase/messaging.
  // APNs→FCM 스위즐링으로 통합 FCM 토큰을 발급받아 기존 send-push(FCM v1) 백엔드를 그대로 재사용.
  // 웹 경로(requestFCMToken)와 완전 분리 — 반환 shape { ok, reason, permission }은 동일(SettingsModal 공용).
  // 네이티브는 웹과 달리 권한 요청에 사용자 제스처가 불필요(OS 시스템 프롬프트) → 부팅 시 prompt:true로 등록 가능.
  async function registerNativeFCMToken(userId, { prompt = false } = {}) {
    if (!userId) return { ok: false, reason: 'no-user' }
    console.log('[FCM-native] 등록 시작, userId:', userId, 'prompt:', prompt)
    try {
      // 동적 import — 웹 번들에 네이티브 플러그인이 섞이지 않게 (firebase.js 패턴과 동일)
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging')

      let { receive } = await FirebaseMessaging.checkPermissions()
      if (receive === 'prompt' || receive === 'prompt-with-rationale') {
        if (!prompt) return { ok: false, reason: 'needs-gesture', permission: 'default' }
        receive = (await FirebaseMessaging.requestPermissions()).receive
      }
      if (receive !== 'granted') {
        return { ok: false, reason: receive === 'denied' ? 'denied' : 'not-granted', permission: receive }
      }

      const { token } = await FirebaseMessaging.getToken()
      if (!token) return { ok: false, reason: 'empty-token', permission: 'granted' }

      // 중복 방지 조건부 INSERT (웹과 동일 패턴) — platform:'ios'로 저장 → send-push가 APNs 페이로드로 분기
      const { data: existing } = await supabase
        .from('fcm_tokens').select('id')
        .eq('user_id', userId).eq('token', token).maybeSingle()
      if (existing) {
        console.log('[FCM-native] 토큰 이미 저장됨, 스킵')
        return { ok: true, reason: 'already', permission: 'granted' }
      }
      const { error } = await supabase
        .from('fcm_tokens').insert({ user_id: userId, token, platform: 'ios' })
      if (error) {
        console.error('[FCM-native] 토큰 저장 실패:', error)
        return { ok: false, reason: 'db-error', permission: 'granted' }
      }
      console.log('[FCM-native] 토큰 저장 완료')
      return { ok: true, reason: 'saved', permission: 'granted' }
    } catch (e) {
      console.error('[FCM-native] 토큰 등록 오류:', e)
      return { ok: false, reason: 'error' }
    }
  }

  // FCM 토큰 등록 — 로그인 직후 한 번만 시도
  // prompt:false(부팅) → granted일 때만 조용히 토큰 등록 / prompt:true(버튼 탭) → 권한 프롬프트
  // 반환: { ok, reason, permission } — SettingsModal 화면 표시/판별용
  async function registerFCMToken(userId, { prompt = false } = {}) {
    if (!userId) return { ok: false, reason: 'no-user' }
    // 네이티브(Capacitor)는 웹푸시 대신 네이티브 FCM 경로. 웹은 아래 기존 경로 그대로.
    if (isNative()) return registerNativeFCMToken(userId, { prompt })
    console.log('[FCM] registerFCMToken 시작, userId:', userId, 'prompt:', prompt)
    try {
      const { token, permission, reason } = await requestFCMToken({ prompt })
      if (!token) {
        console.log('[FCM] 토큰 없음 — 저장 스킵, reason:', reason)
        return { ok: false, reason, permission }
      }
      // 포그라운드 알림 핸들러 — 토큰 취득 성공 시 항상 등록 (중복 저장 여부 무관)
      onFCMMessage((payload) => {
        const d = payload.data || {}
        const title = d.title || '식탁일기'
        const body = d.body || ''
        if ('serviceWorker' in navigator && Notification.permission === 'granted') {
          const origin = window.location.origin
          // 포그라운드 알림도 FCM SW(전용 스코프)로 표시 → 그 SW의 notificationclick이
          // meal_id 딥링크를 처리(클릭 시 게시글 열기). 없으면 controller SW로 폴백.
          navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope')
            .then(r => r || navigator.serviceWorker.ready)
            .then(reg => {
              reg.showNotification(title, {
                body,
                icon: `${origin}/icon-192x192.png`,
                badge: `${origin}/notification-icon-192.png`,
                tag: `meal-${d.type || 'notification'}-fg`,
                data: d,
                requireInteraction: false,
                vibrate: [200, 100, 200],
              })
            })
        }
      })
      // SELECT 후 조건부 INSERT — DB UNIQUE 제약 없어도 중복 행 방지
      const { data: existing } = await supabase
        .from('fcm_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('token', token)
        .maybeSingle()
      if (existing) {
        console.log('[FCM] 토큰 이미 저장됨, 스킵')
        return { ok: true, reason: 'already', permission }
      }
      const { error } = await supabase
        .from('fcm_tokens')
        .insert({ user_id: userId, token })
      if (error) {
        console.error('[FCM] 토큰 저장 실패:', error)
        return { ok: false, reason: 'db-error', permission }
      }
      console.log('[FCM] 토큰 저장 완료')
      return { ok: true, reason: 'saved', permission }
    } catch (e) {
      console.error('[FCM] 토큰 등록 오류:', e)
      return { ok: false, reason: 'error' }
    }
  }

  // FCM 토큰 해제 — 이 기기의 현재 토큰만 삭제 (설정 "알림" 토글 OFF).
  // ★ send-push/DB 스키마 무변경 — 토큰 행이 없으면 send-push가 이 기기로 발송하지 않음.
  //   삭제 범위는 "이 기기"(localStorage가 기기별) — 현재 토큰을 재취득해 그 행만 삭제.
  async function unregisterFCMToken(userId) {
    if (!userId) return { ok: false, reason: 'no-user' }
    console.log('[FCM] unregisterFCMToken 시작, userId:', userId)
    try {
      let token = null
      if (isNative()) {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging')
        token = (await FirebaseMessaging.getToken().catch(() => ({})))?.token || null
      } else {
        // 현재 토큰만 취득(등록 아님) — requestFCMToken은 토큰 문자열만 반환, fcm_tokens INSERT 안 함
        token = (await requestFCMToken({ prompt: false }))?.token || null
      }
      if (token) {
        const { error } = await supabase
          .from('fcm_tokens').delete().eq('user_id', userId).eq('token', token)
        if (error) { console.error('[FCM] 토큰 삭제 실패:', error); return { ok: false, reason: 'db-error' } }
        console.log('[FCM] 이 기기 토큰 삭제 완료')
      } else {
        console.log('[FCM] 삭제할 현재 토큰 없음(권한 미허용 등) — 스킵')
      }
      return { ok: true }
    } catch (e) {
      console.error('[FCM] 토큰 해제 오류:', e)
      return { ok: false, reason: 'error' }
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
      const { data: memberships, error } = await withTimeout(
        supabase
          .from('space_members')
          .select('spaces(*)')
          .eq('user_id', currentUser?.id),
        BOOT_TIMEOUT_MS,
        'spaces 조회'
      )

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
        recipes: [],
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
          recipes: prevMap[s.id]?.recipes ?? [],
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

        // recipes도 선택적 — 테이블 미존재/오류 시 빈 배열 (재료 동반 조회)
        let recipesData = []
        try {
          const { data: rData } = await supabase
            .from('recipes')
            .select('*, recipe_ingredients(*)')
            .eq('space_id', space.id)
            .order('created_at')
          if (rData) recipesData = rData
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
            recipes: recipesData.map(rowToRecipe),
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
    // 네이티브(Capacitor): 커스텀 스킴으로 리다이렉트 + in-app 브라우저로 OAuth URL 오픈.
    // implicit flow라 카카오→Supabase 콜백(https)→302 커스텀 스킴에 #access_token 해시가 실려 옴
    // → 복귀는 App.jsx appUrlOpen 리스너가 setSession으로 처리.
    if (isNative()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'kakao',
        options: {
          redirectTo: 'com.siktakilgi.app://login-callback',
          skipBrowserRedirect: true,
        },
      })
      if (error) { console.error('카카오 로그인 오류(native):', error); return }
      if (data?.url) {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url: data.url })
      }
      return
    }
    // 웹 — 기존 그대로 (detectSessionInUrl이 해시 토큰 자동 처리)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: window.location.origin },
    })
    if (error) console.error('카카오 로그인 오류:', error)
  }

  // Apple 로그인 (iOS 네이티브 전용 — 앱스토어 4.8 대응)
  // ★ 웹 OAuth 방식 — 카카오 signIn()과 완전히 동일한 구조(브라우저 + 커스텀 스킴 딥링크 + setSession).
  //   네이티브 ASAuthorization 시트(@capacitor-community/apple-sign-in)가 Capacitor 8 + WKWebView
  //   환경에서 AKAuthenticationError -7003 / AuthorizationError 1001로 계속 실패해(entitlement·
  //   프로파일·서명·nonce·플러그인 전부 실측 정상 확인됨) 웹 OAuth로 우회.
  //   Apple Services ID(com.siktakilgi.web) + Supabase Apple provider(Client IDs=
  //   com.siktakilgi.app,com.siktakilgi.web / Secret Key / Return URL) 콘솔 설정 완료.
  // 웹/안드로이드는 isNative()=false 라 이 함수가 아무 것도 하지 않는다.
  async function signInApple() {
    if (!isNative()) return { ok: false, reason: 'not-native' }
    logApple('1. signInWithOAuth 호출') // DEBUG-APPLE
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: 'com.siktakilgi.app://login-callback',
        skipBrowserRedirect: true,
      },
    })
    if (error) {
      logApple(`CATCH: signInWithOAuth error=${error.message}`) // DEBUG-APPLE
      console.error('[Apple] 로그인 오류(native):', error)
      return { ok: false, reason: 'supabase-error', message: error.message }
    }
    if (data?.url) {
      logApple('2. data.url 수신 / Browser.open') // DEBUG-APPLE
      const { Browser } = await import('@capacitor/browser')
      await Browser.open({ url: data.url })
    }
    // 이름/이메일은 Apple이 최초 로그인 시 서버로 보낸 user 파라미터를 Supabase가
    // user_metadata(name/full_name)에 자동 반영 — 별도 updateUser 불필요.
    // 표시 쪽은 이미 user.user_metadata?.name || user.user_metadata?.full_name 폴백 보유.
    return { ok: true }
  }

  // 로그아웃
  async function signOut() {
    await supabase.auth.signOut()
    // onAuthStateChange SIGNED_OUT 이벤트에서 상태 초기화
  }

  // 회원 탈퇴: RPC로 auth.users 직접 삭제 → 로컬 세션 정리
  async function deleteAccount() {
    if (!user) throw new Error('로그인 상태가 아닙니다')

    // 오너 승계 먼저 처리 (space_members 삭제 전이어야 다음 오너를 찾을 수 있음)
    const { error: successionErr } = await supabase.rpc('transfer_owned_spaces', { p_user_id: user.id })
    if (successionErr) console.error('[deleteAccount] 오너 승계 오류 (계속 진행):', successionErr.message)

    // 관련 데이터 먼저 정리
    await supabase.from('space_members').delete().eq('user_id', user.id)
    await supabase.from('fcm_tokens').delete().eq('user_id', user.id)
    await supabase.from('notifications').delete().eq('user_id', user.id)

    // RPC로 auth.users 삭제
    const { error } = await supabase.rpc('delete_user_account', { user_id: user.id })
    if (error) {
      console.error('[deleteAccount] RPC 실패:', error)
      throw new Error(error.message || '탈퇴 처리에 실패했어요')
    }

    console.log('[deleteAccount] 삭제 완료 — 로컬 상태 초기화')
    // 로컬 상태 강제 초기화 (signOut은 호출부에서 처리)
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
      recipes: [],
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

  // 스페이스 나가기 — leave_space RPC (오너면 자동 승계 후 나가기, 일반 멤버면 본인만 제거)
  async function leaveSpace(id) {
    if (!user?.id) return

    const { error } = await supabase.rpc('leave_space', { p_space_id: id })
    console.log('[leaveSpace] RPC 결과:', error ? error.message : '성공')
    if (error) { console.error('[leaveSpace] 오류:', error); return }

    // 삭제 성공 후 내가 실제로 속한 스페이스만 DB에서 재조회 → stale local state 방지
    const { data: memberships } = await supabase
      .from('space_members')
      .select('space_id')
      .eq('user_id', user.id)

    const mySpaceIds = new Set((memberships || []).map(m => m.space_id))
    console.log('[leaveSpace] 남은 스페이스 수:', mySpaceIds.size)

    // 대체 현재 스페이스는 로컬에 실재하는 첫 잔여 스페이스로 (id가 state에 있음을 보장)
    const nextFirstId = spaces.find(s => mySpaceIds.has(s.id))?.id || null
    // ★ 필터는 functional update — RPC 대기 중 Realtime로 갱신된 최신 spaces 기준으로 걸러
    //   stale 클로저(spaces)로 덮어써 그 갱신을 유실하는 것을 방지
    setSpaces(prev => prev.filter(s => mySpaceIds.has(s.id)))
    setCurrentSpaceId(cur => mySpaceIds.has(cur) ? cur : nextFirstId)
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
      rowData.avatar_url = getUserAvatarUrl(user)
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

  // ── 레시피 CRUD ─────────────────────────────────────────────
  // 재료 배열(ingredients: [{name, amount, unit}])을 recipe_ingredients에 동반 저장
  async function addRecipe(data) {
    if (!currentSpaceId) return null

    const { data: recipeRow, error } = await supabase
      .from('recipes')
      .insert({
        space_id: currentSpaceId,
        author_id: user?.id || null,
        name: data.name,
        memo: data.memo || '',
        link_url: data.linkUrl || null,
        photo: data.photo || '',
      })
      .select()
      .single()

    if (error) { console.error('[addRecipe]', error); return null }

    const ingredients = Array.isArray(data.ingredients) ? data.ingredients : []
    let savedIngredients = []
    if (ingredients.length > 0) {
      const rows = ingredients.map((ing, idx) => ({
        recipe_id: recipeRow.id,
        name: ing.name,
        amount: ing.amount || null,
        unit: ing.unit || null,
        sort_order: idx,
      }))
      const { data: ingData, error: ingErr } = await supabase
        .from('recipe_ingredients')
        .insert(rows)
        .select()
      if (ingErr) console.error('[addRecipe ingredients]', ingErr)
      else savedIngredients = ingData || []
    }

    const item = rowToRecipe({ ...recipeRow, recipe_ingredients: savedIngredients })
    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId ? { ...s, recipes: [...(s.recipes || []), item] } : s
    ))
    return item
  }

  // 레시피 수정 — 재료는 기존 전체 삭제 후 재삽입 (단순)
  async function updateRecipe(id, data) {
    const { data: recipeRow, error } = await supabase
      .from('recipes')
      .update({
        name: data.name,
        memo: data.memo || '',
        link_url: data.linkUrl || null,
        photo: data.photo || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) { console.error('[updateRecipe]', error); return null }

    await supabase.from('recipe_ingredients').delete().eq('recipe_id', id)

    const ingredients = Array.isArray(data.ingredients) ? data.ingredients : []
    let savedIngredients = []
    if (ingredients.length > 0) {
      const rows = ingredients.map((ing, idx) => ({
        recipe_id: id,
        name: ing.name,
        amount: ing.amount || null,
        unit: ing.unit || null,
        sort_order: idx,
      }))
      const { data: ingData, error: ingErr } = await supabase
        .from('recipe_ingredients')
        .insert(rows)
        .select()
      if (ingErr) console.error('[updateRecipe ingredients]', ingErr)
      else savedIngredients = ingData || []
    }

    const item = rowToRecipe({ ...recipeRow, recipe_ingredients: savedIngredients })
    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId ? { ...s, recipes: (s.recipes || []).map(r => r.id === id ? item : r) } : s
    ))
    return item
  }

  // 레시피 삭제 (recipe_ingredients는 FK ON DELETE CASCADE로 동반 삭제)
  async function deleteRecipe(id) {
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    if (error) { console.error('[deleteRecipe]', error); return }
    setSpaces(prev => prev.map(s =>
      s.id === currentSpaceId ? { ...s, recipes: (s.recipes || []).filter(r => r.id !== id) } : s
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
      place_url: data.placeUrl || null,
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
    if (updates.placeUrl !== undefined) row.place_url = updates.placeUrl
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
      avatar_url: getUserAvatarUrl(user),
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

  // 알림 추가 로드 (무한 스크롤) — 가장 오래된 항목보다 더 과거 묶음을 cursor로 조회.
  // created_at cursor라 실시간 prepend로 인한 offset 드리프트 없음.
  async function loadMoreNotifications() {
    if (!user?.id || loadingMoreNotifs || !hasMoreNotifs) return
    const oldest = notifications[notifications.length - 1]
    if (!oldest) return
    setLoadingMoreNotifs(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .lt('created_at', oldest.created_at)
      .limit(NOTIF_PAGE_SIZE)
    if (data) {
      const fresh = data.filter(n => !notifIdsRef.current.has(n.id))
      fresh.forEach(n => notifIdsRef.current.add(n.id))
      if (fresh.length) setNotifications(prev => [...prev, ...fresh])
      setHasMoreNotifs(data.length === NOTIF_PAGE_SIZE)
    }
    setLoadingMoreNotifs(false)
  }

  // 알림 읽음 처리 — 안읽은 카운트도 함께 보정
  async function markNotificationRead(id) {
    const target = notifications.find(n => n.id === id)
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    if (target && !target.is_read) setUnreadCount(c => Math.max(0, c - 1))
  }

  async function markAllNotificationsRead() {
    if (!user) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
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

    let joinRecipesData = []
    try {
      const { data: rData } = await supabase
        .from('recipes')
        .select('*, recipe_ingredients(*)')
        .eq('space_id', spaceRow.id)
        .order('created_at')
      if (rData) joinRecipesData = rData
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
      recipes: joinRecipesData.map(rowToRecipe),
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
        oauthConflictMessage,
        setOauthConflictMessage,
        signIn,
        signInApple,
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
        addRecipe,
        updateRecipe,
        deleteRecipe,
        wishlistInterestsMap,
        addWishlistInterest,
        removeWishlistInterest,
        joinByCode,
        ratingsMap,
        addOrUpdateRating,
        deleteRating,
        notifications: notifEnabled ? notifications : [],
        unreadCount: notifEnabled ? unreadCount : 0,
        hasMoreNotifications: notifEnabled ? hasMoreNotifs : false,
        loadingMoreNotifications: loadingMoreNotifs,
        loadMoreNotifications,
        notifEnabled,
        setNotifEnabledPref,
        unregisterFCMToken,
        registerFCMToken,
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
