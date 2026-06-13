import { useApp } from '../../context/AppContext'

function formatTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min  = Math.floor(diff / 60000)
  const hour = Math.floor(min / 60)
  const day  = Math.floor(hour / 24)
  if (min  < 1)  return '방금'
  if (min  < 60) return `${min}분 전`
  if (hour < 24) return `${hour}시간 전`
  if (day  < 7)  return `${day}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

const TYPE_LABEL = {
  new_meal: '새 기록',
  new_comment: '댓글',
  new_rating: '별점',
  comment: '댓글',   // 레거시 호환
  rating: '별점',    // 레거시 호환
}

// ── 벨 아이콘 버튼 (배지 포함) ──────────────────────────────────────────
export function NotificationBell({ onClick }) {
  const { unreadCount } = useApp()
  return (
    <button
      onClick={onClick}
      className="relative p-1.5 text-warm-light hover:text-warm-brown transition-colors"
      aria-label="알림"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-warm-brown rounded-full text-white text-[9px] flex items-center justify-center font-bold px-0.5 leading-none">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}

// ── 알림 패널 ────────────────────────────────────────────────────────────
export default function NotificationPanel({ open, onClose, onSelectMeal }) {
  const { notifications, unreadCount, markNotificationRead, markAllNotificationsRead } = useApp()

  async function handleClick(notif) {
    if (!notif.is_read) await markNotificationRead(notif.id)
    if (notif.meal_id && onSelectMeal) onSelectMeal(notif.meal_id)
    onClose()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] max-w-lg mx-auto">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />

      {/* panel — top sheet */}
      <div className="absolute top-0 left-0 right-0 bg-cream-50 rounded-b-3xl shadow-2xl max-h-[75dvh] flex flex-col overflow-hidden"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-cream-200 shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-warm-dark">알림</h2>
            {unreadCount > 0 && (
              <span className="text-[10px] bg-warm-brown text-white px-1.5 py-0.5 rounded-full font-bold leading-none">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllNotificationsRead}
                className="text-xs text-warm-light hover:text-warm-brown transition-colors"
              >
                전체 읽음
              </button>
            )}
            <button onClick={onClose} className="p-1 text-cream-400 hover:text-warm-light transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 목록 */}
        <ul className="overflow-y-auto flex-1 overscroll-contain">
          {notifications.length === 0 ? (
            <li className="py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-cream-200 flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-cream-400" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </div>
              <p className="text-sm text-cream-400">아직 알림이 없어요</p>
            </li>
          ) : (
            notifications.map(notif => (
              <li key={notif.id}>
                <button
                  onClick={() => handleClick(notif)}
                  className={`w-full flex items-start gap-3 px-4 py-3.5 hover:bg-cream-100 active:bg-cream-200 transition-colors text-left border-b border-cream-100 ${!notif.is_read ? 'bg-warm-brown/[0.04]' : ''}`}
                >
                  {/* 아바타 */}
                  {notif.from_avatar_url ? (
                    <img src={notif.from_avatar_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 mt-0.5" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-cream-200 shrink-0 mt-0.5 flex items-center justify-center">
                      <span className="text-xs text-warm-light font-bold leading-none">
                        {(notif.from_nickname || '?').charAt(0)}
                      </span>
                    </div>
                  )}

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    {notif.type && TYPE_LABEL[notif.type] && (
                      <span className="text-[10px] text-warm-brown font-semibold mr-1">
                        [{TYPE_LABEL[notif.type]}]
                      </span>
                    )}
                    <span className={`text-sm leading-relaxed ${!notif.is_read ? 'text-warm-dark' : 'text-warm-light'}`}>
                      {notif.message}
                    </span>
                    <p className="text-[10px] text-cream-400 mt-0.5">{formatTimeAgo(notif.created_at)}</p>
                  </div>

                  {/* 읽지 않음 점 */}
                  {!notif.is_read && (
                    <div className="w-2 h-2 rounded-full bg-warm-brown shrink-0 mt-2.5" />
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
