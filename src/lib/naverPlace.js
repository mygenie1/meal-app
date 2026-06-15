import { supabase } from './supabase'

export async function getNaverPlacePhotos(query) {
  try {
    const { data, error } = await supabase.functions.invoke('naver-place-photo', {
      body: { query },
    })
    if (error) throw error
    return data?.photos ?? []
  } catch (e) {
    console.error('네이버 장소 사진 가져오기 실패:', e)
    return []
  }
}
