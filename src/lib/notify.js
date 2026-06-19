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
  if (targets.length === 0) {
    console.log('[notify] targets 없음(본인 제외 후 0명) — 알림 스킵', { type, mealId })
    return
  }
  try {
    const { error } = await supabase.from('notifications').insert(
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
    if (error) {
      console.error('[notify] notifications INSERT 실패:', error.code, error.message, { type, mealId, targets: targets.length })
    } else {
      console.log('[notify] notifications INSERT 성공:', targets.length, '건', { type, mealId })
    }
  } catch (e) {
    console.error('[notify] 알림 전송 예외:', e)
  }
}

export async function getSpaceMemberIds(spaceId) {
  const { data, error } = await supabase.rpc('get_space_member_ids', { p_space_id: spaceId })
  if (error) console.error('[notify] getSpaceMemberIds RPC 실패:', error.message, '| spaceId:', spaceId)
  else console.log('[notify] getSpaceMemberIds 결과:', data?.length ?? 0, '명', '| spaceId:', spaceId)
  return data?.map(row => row.user_id) || []
}
