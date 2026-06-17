import { supabase } from './supabase'

function getUserAvatarUrl(user) {
  const provider = user?.app_metadata?.provider
  const raw = user?.user_metadata?.avatar_url || ''
  const isKakaoUrl = raw.includes('kakaocdn') || raw.includes('k.kakaocdn')
  return provider !== 'kakao' && isKakaoUrl ? '' : raw
}

export function buildFromUser(user) {
  if (!user) return null
  return {
    id: user.id,
    nickname: user.user_metadata?.name || user.user_metadata?.full_name || '멤버',
    avatar_url: getUserAvatarUrl(user),
  }
}

export async function sendNotification({ toUserIds, spaceId, mealId, fromUser, type, message }) {
  const targets = toUserIds.filter(id => id !== fromUser.id)
  if (targets.length === 0) return
  try {
    await supabase.from('notifications').insert(
      targets.map(userId => ({
        user_id: userId,
        space_id: spaceId || null,
        meal_id: mealId || null,
        from_user_id: fromUser.id,
        from_nickname: fromUser.nickname || '',
        from_avatar_url: fromUser.avatar_url || '',
        type,
        message,
        is_read: false,
      }))
    )
  } catch (e) {
    console.error('[notify] 알림 전송 실패:', e)
  }
}

export async function getSpaceMemberIds(spaceId) {
  const { data } = await supabase.rpc('get_space_member_ids', { p_space_id: spaceId })
  return data?.map(row => row.user_id) || []
}
