-- ============================================================
-- 스페이스 멤버 목록 조회 RPC
-- Supabase 대시보드 → SQL Editor에서 실행
-- ============================================================
-- space_members SELECT RLS (user_id = auth.uid()) 우회용.
-- 프론트에서 직접 조회하면 본인 레코드만 반환되어 알림 대상이 0명이 됨.
-- SECURITY DEFINER로 RLS를 우회해 스페이스의 전체 멤버 user_id 목록을 반환.
-- get_space_member_count와 동일 패턴.
--
-- 호출: supabase.rpc('get_space_member_ids', { p_space_id: spaceId })
-- 반환: [{ user_id: uuid }, ...]

CREATE OR REPLACE FUNCTION get_space_member_ids(p_space_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM space_members WHERE space_id = p_space_id;
$$;

-- authenticated 롤에 실행 권한 부여
GRANT EXECUTE ON FUNCTION get_space_member_ids(uuid) TO authenticated;
