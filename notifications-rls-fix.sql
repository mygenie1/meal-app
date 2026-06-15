-- notifications 테이블 RLS 정책 수정
-- Supabase SQL Editor에서 실행

-- 기존 정책 모두 제거
DROP POLICY IF EXISTS "auth_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

-- RLS 활성화 (이미 돼 있어도 무해)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- INSERT: 인증된 사용자가 본인 명의로 보내는 알림만 허용
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

-- SELECT: 본인이 받은 알림만 조회
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- UPDATE: 본인이 받은 알림 읽음 처리
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: 본인 알림 삭제
CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
