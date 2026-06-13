import { useApp } from '../../context/AppContext'

/**
 * 게시글 작성자 표시 컴포넌트
 * - 내 게시글: "나" 오른쪽 정렬 (warm-brown)
 * - 상대방 게시글: 아바타 + 닉네임 왼쪽 정렬 (gray)
 * - userId/nickname 모두 없으면 null 반환 (구 게시글 호환)
 */
export default function AuthorBadge({ meal, className = '' }) {
  const { user } = useApp()

  if (!meal.userId && !meal.nickname) return null

  const isOwn = !!user?.id && meal.userId === user.id

  if (isOwn) {
    return (
      <div className={`flex justify-end ${className}`}>
        <span className="text-[10px] text-warm-brown/60 font-medium">나</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {meal.avatarUrl ? (
        <img
          src={meal.avatarUrl}
          alt=""
          className="w-4 h-4 rounded-full object-cover shrink-0"
        />
      ) : (
        <div className="w-4 h-4 rounded-full bg-cream-200 shrink-0 flex items-center justify-center">
          <span className="text-[8px] text-warm-light font-bold leading-none">
            {(meal.nickname || '?').charAt(0)}
          </span>
        </div>
      )}
      <span className="text-[10px] text-cream-400 truncate max-w-[100px]">
        {meal.nickname || '알 수 없음'}
      </span>
    </div>
  )
}
