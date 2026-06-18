-- ============================================================
-- 스페이스 오너 승계 마이그레이션
-- Supabase 대시보드 → SQL Editor에서 전체 실행
-- ============================================================
-- 해결 문제:
--   오너가 leaveSpace하거나 영구삭제되면 spaces.owner_id가 dangling UUID로
--   남아 남은 멤버가 강퇴/코드변경/claimSpace를 전혀 할 수 없는 "유령 오너" 현상.
--
-- 해결 방법:
--   [1] leave_space RPC — 오너가 나갈 때 가장 오래된 멤버에게 자동 승계 (없으면 null)
--   [2] transfer_owned_spaces RPC — 유저 삭제 전 일괄 승계 처리 (deleteAccount/hard_delete에서 호출)
--   [3] spaces.owner_id FK ON DELETE SET NULL — 위 로직이 누락돼도 dangling 대신 null
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. leave_space — 스페이스 나가기 (오너 승계 포함)
--    - 비오너: space_members에서 본인 행만 삭제 (기존 동작과 동일)
--    - 오너 + 남은 멤버 있음: joined_at ASC 첫 번째에게 owner_id 승계 후 본인 삭제
--    - 오너 + 혼자: owner_id = null 후 본인 삭제
--    meals/사진/기록은 보존 (space_members 행만 제거)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION leave_space(p_space_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id   uuid;
  v_next_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 호출자가 멤버인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM space_members
    WHERE space_id = p_space_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this space';
  END IF;

  SELECT owner_id INTO v_owner_id FROM spaces WHERE id = p_space_id;

  -- 오너가 나가는 경우: 승계 처리
  IF v_owner_id IS NOT NULL AND v_owner_id = auth.uid() THEN
    -- 자신 제외 joined_at 가장 오래된 멤버
    SELECT user_id INTO v_next_owner
    FROM space_members
    WHERE space_id = p_space_id AND user_id <> auth.uid()
    ORDER BY joined_at ASC
    LIMIT 1;

    -- 승계 (v_next_owner가 NULL이면 owner_id = NULL로 세팅 — 빈 스페이스)
    UPDATE spaces SET owner_id = v_next_owner WHERE id = p_space_id;
  END IF;

  -- 멤버십 제거 (meals/사진/기록은 보존)
  DELETE FROM space_members
  WHERE space_id = p_space_id AND user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION leave_space(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 2. transfer_owned_spaces — 유저 삭제 전 오너 일괄 승계
--    deleteAccount(프론트) / admin hard_delete 에서 space_members 삭제 전에 호출
--    해당 유저가 오너인 모든 스페이스에 대해 동일한 승계 로직 적용
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION transfer_owned_spaces(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r            record;
  v_next_owner uuid;
BEGIN
  -- 해당 유저가 오너인 스페이스를 순회
  FOR r IN
    SELECT id FROM spaces WHERE owner_id = p_user_id
  LOOP
    -- 자신 제외 joined_at 가장 오래된 멤버
    SELECT user_id INTO v_next_owner
    FROM space_members
    WHERE space_id = r.id AND user_id <> p_user_id
    ORDER BY joined_at ASC
    LIMIT 1;

    -- 승계 또는 null 처리
    UPDATE spaces SET owner_id = v_next_owner WHERE id = r.id;
  END LOOP;
END;
$$;

-- authenticated(자기 탈퇴) + service_role(관리자 삭제) 모두 호출 가능
GRANT EXECUTE ON FUNCTION transfer_owned_spaces(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 3. spaces.owner_id FK — ON DELETE SET NULL (이중 안전망)
--    위 RPC 로직이 누락돼도 auth.users 삭제 시 dangling UUID 대신 null로 처리
-- ─────────────────────────────────────────────────────────────
ALTER TABLE spaces DROP CONSTRAINT IF EXISTS spaces_owner_id_fkey;
ALTER TABLE spaces
  ADD CONSTRAINT spaces_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES auth.users(id)
  ON DELETE SET NULL;
