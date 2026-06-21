// 통합검색 공유 로직 — 홈/지도 양쪽에서 동일하게 사용 (복제 금지)
// meals + wishlist를 질의어로 검색해 { type: 'meal' | 'wishlist', item } 혼합 배열 반환

const MEAL_TIME_ORDER = { 아침: 0, 점심: 1, 저녁: 2 }

export function runUnifiedSearch(meals, wishlist, query) {
  const q = (query || '').trim().toLowerCase()
  if (!q) return []

  const sortedMeals = [...(meals || [])].sort((a, b) => {
    const dateDiff = new Date(b.date) - new Date(a.date)
    if (dateDiff !== 0) return dateDiff
    return (MEAL_TIME_ORDER[a.mealTime] ?? 1) - (MEAL_TIME_ORDER[b.mealTime] ?? 1)
  })

  const mealHits = sortedMeals
    .filter(m =>
      (m.title && m.title.toLowerCase().includes(q)) ||
      (m.restaurantName && m.restaurantName.toLowerCase().includes(q)) ||
      (m.review && m.review.toLowerCase().includes(q)) ||
      (m.memo && m.memo.toLowerCase().includes(q))
    )
    .map(m => ({ type: 'meal', item: m }))

  const wishHits = (wishlist || [])
    .filter(w =>
      (w.name && w.name.toLowerCase().includes(q)) ||
      (w.location && w.location.toLowerCase().includes(q)) ||
      (w.memo && w.memo.toLowerCase().includes(q)) ||
      (w.category && w.category.toLowerCase().includes(q))
    )
    .map(w => ({ type: 'wishlist', item: w }))

  return [...mealHits, ...wishHits]
}
