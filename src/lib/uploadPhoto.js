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

// base64 → 지정 크기로 Canvas 압축
function compressBase64(base64, maxPx, quality) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round((height * maxPx) / width); width = maxPx }
        else { width = Math.round((width * maxPx) / height); height = maxPx }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => resolve(base64)
    img.src = base64
  })
}

// Storage에 Blob 업로드 → 공개 URL 반환
async function uploadBlob(blob, path) {
  const { error } = await storageClient.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  const { data } = storageClient.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// 이미 Storage URL인지 판별 (base64 data URL과 구분)
export function isStorageUrl(str) {
  return typeof str === 'string' && (str.startsWith('http://') || str.startsWith('https://'))
}

// DB photos[] 항목 파싱
// - '{"thumb":"...","original":"..."}' JSON 문자열 → 파싱
// - 일반 URL / base64 → { thumb: entry, original: entry } (레거시 호환)
export function parsePhoto(entry) {
  if (!entry) return { thumb: '', original: '' }
  try {
    const p = JSON.parse(entry)
    if (p && typeof p === 'object' && p.thumb && p.original) return p
  } catch {}
  return { thumb: entry, original: entry }
}

export function getThumbUrl(entry) {
  return parsePhoto(entry).thumb || ''
}

export function getOriginalUrl(entry) {
  return parsePhoto(entry).original || ''
}

// 썸네일 + 원본 두 버전 업로드 → JSON 문자열 반환
// 이미 처리된 항목(JSON 문자열, 레거시 URL)은 그대로 통과
export async function uploadPhotoWithThumbnail(entry, spaceId) {
  if (!entry) return entry

  // 이미 JSON photo 객체 문자열이면 스킵
  try {
    const p = JSON.parse(entry)
    if (p && typeof p === 'object' && p.thumb && p.original) return entry
  } catch {}

  // 레거시 URL → JSON으로 감싸서 반환 (재업로드 없음)
  if (isStorageUrl(entry)) {
    return JSON.stringify({ thumb: entry, original: entry })
  }

  // base64 → 두 크기로 압축 후 Storage 업로드
  try {
    const uuid = uuidv4()
    const prefix = spaceId || 'shared'
    const [origB64, thumbB64] = await Promise.all([
      compressBase64(entry, 1200, 0.82),
      compressBase64(entry, 400, 0.65),
    ])
    const [originalUrl, thumbUrl] = await Promise.all([
      uploadBlob(base64ToBlob(origB64), `${prefix}/${uuid}.jpg`),
      uploadBlob(base64ToBlob(thumbB64), `${prefix}/thumb_${uuid}.jpg`),
    ])
    return JSON.stringify({ thumb: thumbUrl, original: originalUrl })
  } catch (err) {
    console.error('[uploadPhoto] 썸네일 업로드 실패, base64 폴백:', err)
    return entry
  }
}

// 레거시 — 단일 URL 업로드 (하위 호환 유지)
export async function uploadPhotoToStorage(base64, spaceId) {
  if (isStorageUrl(base64)) return base64
  try {
    const blob = base64ToBlob(base64)
    const path = `${spaceId || 'shared'}/${uuidv4()}.jpg`
    const { error } = await storageClient.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false })
    if (error) throw error
    const { data } = storageClient.storage.from(BUCKET).getPublicUrl(path)
    return data.publicUrl
  } catch (err) {
    console.error('[uploadPhoto] Storage 업로드 실패, base64 폴백:', err)
    return base64
  }
}
