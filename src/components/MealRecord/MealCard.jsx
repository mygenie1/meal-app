import StarRating from '../common/StarRating'

const TAG_STYLES = {
  '집밥': 'bg-green-50 text-green-700 border-green-200',
  '외식': 'bg-amber-50 text-amber-700 border-amber-200',
  '카페': 'bg-pink-50 text-pink-700 border-pink-200',
  '배달': 'bg-blue-50 text-blue-700 border-blue-200',
}

const MEAL_TIME_STYLE = 'text-[10px] px-1.5 py-0.5 rounded-full bg-cream-200 text-warm-light font-medium'

export default function MealCard({ meal, onEdit, onDelete }) {
  const thumbPhoto = meal.photos?.[0] || meal.photo || ''
  const hasContent = meal.title || meal.restaurantName || meal.location || meal.rating > 0 || meal.review || meal.memo

  return (
    <div className="bg-white rounded-2xl border border-cream-200 overflow-hidden">
      {thumbPhoto && (
        <img
          src={thumbPhoto}
          alt="식사 사진"
          className="w-full object-cover"
          style={{ maxHeight: '220px' }}
        />
      )}

      {hasContent && (
        <div className="px-4 pt-3 pb-2 space-y-2">
          {meal.title && (
            <p className="text-base font-bold text-warm-dark leading-snug">{meal.title}</p>
          )}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {meal.restaurantName && (
                <h3 className={`font-semibold text-warm-dark leading-snug ${meal.title ? 'text-sm' : 'text-base'}`}>
                  {meal.restaurantName}
                </h3>
              )}
              {meal.location && (
                <p className="text-xs text-warm-light mt-0.5 flex items-center gap-1">
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.686 2 6 4.686 6 8c0 4.5 6 12 6 12s6-7.5 6-12c0-3.314-2.686-6-6-6z" />
                    <circle cx="12" cy="8" r="2" />
                  </svg>
                  <span className="truncate">{meal.location}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {meal.mealTime && (
                <span className={MEAL_TIME_STYLE}>{meal.mealTime}</span>
              )}
              {meal.tag && (
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${TAG_STYLES[meal.tag] || 'bg-cream-100 text-warm-light border-cream-200'}`}>
                  {meal.tag}
                </span>
              )}
            </div>
          </div>

          {meal.rating > 0 && (
            <StarRating value={meal.rating} readonly />
          )}

          {meal.review && (
            <p className="text-sm text-warm-dark leading-relaxed">{meal.review}</p>
          )}

          {meal.memo && (
            <p className="text-xs text-warm-light leading-relaxed whitespace-pre-line">{meal.memo}</p>
          )}
        </div>
      )}

      <div className="px-4 py-2 flex gap-3 border-t border-cream-100">
        <button
          onClick={onEdit}
          className="text-xs text-warm-light hover:text-warm-brown transition-colors py-1"
        >
          수정
        </button>
        <span className="text-cream-200">|</span>
        <button
          onClick={onDelete}
          className="text-xs text-warm-light hover:text-red-400 transition-colors py-1"
        >
          삭제
        </button>
      </div>
    </div>
  )
}
