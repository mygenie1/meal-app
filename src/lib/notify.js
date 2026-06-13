import { supabase } from './supabase'

export function buildFromUser(user) {
  if (!user) return null
  return {
    id: user.id,
    nickname: user.user_metadata?.name || user.user_metadata?.full_name || '멤버',
    avatar_url: user.user_metadata?.avatar_url || '',
  }
}

export async function sendNotification({ toUserId, spaceId, mealId, fromUser, type, message }) {
  if (!toUserId || !fromUser?.id || toUserId === fromUser.id) return
  try {
    const { error } = await supabase.from('notifications').insert({
      user_id: toUserId,
      space_id: spaceId || null,
      meal_id: mealId || null,
      from_user_id: fromUser.id,
      from_nickname: fromUser.nickname || '',
      from_avatar_url: fromUser.avatar_url || '',
      type,
      message,
      is_read: false,
    })
    if (error) console.error('[notify] 알림 전송 실패:', error)
  } catch (e) {
    console.error('[notify] 알림 처리 오류:', e)
  }
}
