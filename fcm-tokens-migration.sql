-- FCM 토큰 저장 테이블
-- Supabase SQL Editor에서 실행하세요.

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token       TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

-- RLS 활성화
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- 본인 토큰만 읽기/쓰기 가능
CREATE POLICY "fcm_tokens_select" ON public.fcm_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_insert" ON public.fcm_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fcm_tokens_delete" ON public.fcm_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
