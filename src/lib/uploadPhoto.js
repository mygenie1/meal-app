import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Storage 전용 클라이언트 — 파일 업로드는 15초 초과 가능하므로 타임아웃 없음
const storageClient = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '')

const BUCKET = 'meal-photos'

// base64 data URL → Blob 변환
function base64ToBlob(base64) {
  const [header, data] = base64.split(',')
  const mime = (header.match(/:(.*?);/) || [])[1] || 'image/jpeg'
  const binary = atob(data)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

// 이미 Storage URL인지 판별 (base64 data URL과 구분)
export function isStorageUrl(str) {
  return typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'))
}

// base64 → Supabase Storage 업로드 → 공개 URL 반환
// 이미 URL이면 그대로 반환 (재업로드 방지)
// 업로드 실패 시 base64 원본 반환 (하위 호환 — 기존 기록 안전)
export async function uploadPhotoToStorage(base64, spaceId) {
  if (isStorageUrl(base64)) return base64

  try {
    const blob = base64ToBlob(base64)
    const path = `${spaceId || 'shared'}/${uuidv4()}.jpg`

    const { error } = await storageClient.storage
      .from(BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', upsert: false })

    if (error) throw error

    const { data } = storageClient.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  } catch (err) {
    console.error('[uploadPhoto] Storage 업로드 실패, base64 폴백:', err)
    return base64
  }
}
