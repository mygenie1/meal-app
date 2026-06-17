-- ============================================================
-- 스페이스 멤버 수 조회 RPC
-- Supabase 대시보드 → SQL Editor에서 실행
-- ============================================================
-- space_members SELECT RLS가 "user_id = auth.uid()" (본인 레코드만) 이므로
-- 프론트에서 직접 조회하면 항상 1개만 반환됨.
-- SECURITY DEFINER로 RLS 우회하여 실제 멤버 수를 반환.
-- 나가기 확인 모달에서 혼자인지 여부 판단에 사용.

CREATE OR REPLACE FUNCTION get_space_member_count(p_space_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM space_members WHERE space_id = p_space_id;
$$;
