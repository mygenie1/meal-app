import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[식탁일기] Supabase 환경변수 누락\n' +
    'VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 를 .env 또는 Vercel 환경변수에 설정해주세요.'
  )
}

// 15초 타임아웃 — 응답 없는 연결이 무한 대기하지 않도록
function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 15000)
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id))
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? '',
  { global: { fetch: fetchWithTimeout } }
)
