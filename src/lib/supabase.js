import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[식탁일기] Supabase 환경변수 누락\n' +
    'VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 를 .env 또는 Vercel 환경변수에 설정해주세요.'
  )
}

export const supabase = createClient(
  supabaseUrl ?? '',
  supabaseAnonKey ?? ''
)
