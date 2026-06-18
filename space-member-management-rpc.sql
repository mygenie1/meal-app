-- ============================================================
-- 스페이스 구성원 관리 RPC 3종
-- Supabase 대시보드 → SQL Editor에서 실행
-- ============================================================
-- space_members SELECT RLS: "user_id = auth.uid()" (본인 레코드만)
-- spaces UPDATE RLS: 기본 정책에 따라 오너 외 수정 불가
-- → 세 함수 모두 SECURITY DEFINER로 RLS 우회 + 서버 측에서 권한 재검증
--
-- space_members 컬럼: id, space_id, user_id, joined_at
-- spaces 컬럼:        id, name, emoji, code, owner_id, created_at
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. get_space_members — 스페이스 멤버 목록 조회
--    조건: 호출자가 해당 스페이스의 멤버여야 실행 가능
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_space_members(p_space_id uuid)
RETURNS TABLE (
  user_id      uuid,
  display_name text,
  joined_at    timestamptz,
  is_owner     boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 호출자가 이 스페이스의 멤버인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM space_members
    WHERE space_id = p_space_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: you are not a member of this space';
  END IF;

  RETURN QUERY
  SELECT
    sm.user_id,
    COALESCE(
      u.raw_user_meta_data->>'name',
      u.raw_user_meta_data->>'full_name',
      u.email,
      '멤버'
    )::text AS display_name,
    sm.joined_at,
    (s.owner_id IS NOT NULL AND s.owner_id = sm.user_id) AS is_owner
  FROM space_members sm
  JOIN auth.users u ON u.id = sm.user_id
  JOIN spaces s ON s.id = sm.space_id
  WHERE sm.space_id = p_space_id
  ORDER BY sm.joined_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_space_members(uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 2. remove_space_member — 멤버 강퇴 (오너만 가능)
--    조건: 호출자 = owner_id, 오너 자신은 강퇴 불가
--    meals/사진 등 공유 콘텐츠 보존 — space_members 행만 삭제
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION remove_space_member(p_space_id uuid, p_target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT owner_id INTO v_owner_id FROM spaces WHERE id = p_space_id;

  IF auth.uid() IS DISTINCT FROM v_owner_id THEN
    RAISE EXCEPTION 'Access denied: only the owner can remove members';
  END IF;

  IF p_target_user_id = v_owner_id THEN
    RAISE EXCEPTION 'Cannot remove the owner from the space';
  END IF;

  DELETE FROM space_members
  WHERE space_id = p_space_id AND user_id = p_target_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION remove_space_member(uuid, uuid) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- 3. regenerate_invite_code — 초대코드 재발급 (오너만 가능)
--    조건: 호출자 = owner_id
--    기존 코드 즉시 무효화, 새 6자리 대문자 코드 반환
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION regenerate_invite_code(p_space_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_new_code text;
  v_attempts int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT owner_id INTO v_owner_id FROM spaces WHERE id = p_space_id;

  IF auth.uid() IS DISTINCT FROM v_owner_id THEN
    RAISE EXCEPTION 'Access denied: only the owner can regenerate the invite code';
  END IF;

  LOOP
    -- 3바이트 랜덤 → 6자리 대문자 hex
    SELECT upper(encode(gen_random_bytes(3), 'hex')) INTO v_new_code;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM spaces WHERE code = v_new_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RAISE EXCEPTION 'Failed to generate a unique code after 10 attempts';
    END IF;
  END LOOP;

  UPDATE spaces SET code = v_new_code WHERE id = p_space_id;

  RETURN v_new_code;
END;
$$;

GRANT EXECUTE ON FUNCTION regenerate_invite_code(uuid) TO authenticated;
