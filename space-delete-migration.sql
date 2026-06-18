-- ============================================================
-- 관리자 6단계-A — 스페이스 삭제 마이그레이션
-- Supabase SQL Editor에서 전체 실행
-- ============================================================

-- ── 1. spaces.is_active 컬럼 추가 ────────────────────────────
-- DEFAULT true → 기존 스페이스 전부 활성 상태로 유지 (데이터 영향 없음)
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ── 2. 일반 앱 RLS 업데이트: 비활성 스페이스 제외 ─────────────
-- 일반 유저는 is_active = true 인 스페이스만 조회 가능
-- 관리자 Edge Function은 service_role 키를 사용하므로 RLS 적용 안 됨 → 전체 조회 가능
DROP POLICY IF EXISTS "spaces_select_members" ON spaces;
CREATE POLICY "spaces_select_members" ON spaces
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    is_active = true AND
    EXISTS (
      SELECT 1 FROM space_members sm
      WHERE sm.space_id = spaces.id
        AND sm.user_id  = auth.uid()
    )
  );

-- ── 3. join_space_by_code RPC 업데이트: 비활성 스페이스 참가 불가 ──
-- 코드로 참가 시 is_active = true 인 스페이스만 허용
CREATE OR REPLACE FUNCTION join_space_by_code(p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space spaces%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_space
  FROM   spaces
  WHERE  UPPER(code) = UPPER(p_code)
    AND  is_active   = true
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  INSERT INTO space_members (space_id, user_id)
  VALUES (v_space.id, auth.uid())
  ON CONFLICT (space_id, user_id) DO NOTHING;

  RETURN row_to_json(v_space);
END;
$$;

-- ── 4. 영구삭제 RPC (트랜잭션으로 원자성 보장) ────────────────
-- 관리자 Edge Function에서만 호출 (service_role 권한 필요)
-- 삭제 순서: 자식 테이블(ratings/comments/meal_photos/notifications) → meals/ingredients/wishlist → space_members → spaces
CREATE OR REPLACE FUNCTION admin_hard_delete_space(p_space_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- ratings: meal_id FK (CASCADE 없음)
  DELETE FROM ratings
    WHERE meal_id IN (SELECT id FROM meals WHERE space_id = p_space_id);

  -- comments (meal 댓글): meal_id FK nullable (CASCADE 없음)
  DELETE FROM comments
    WHERE meal_id IN (SELECT id FROM meals WHERE space_id = p_space_id);

  -- meal_photos: meal_id FK (DB 레코드, Storage는 Edge Function에서 별도 정리)
  DELETE FROM meal_photos
    WHERE meal_id IN (SELECT id FROM meals WHERE space_id = p_space_id);

  -- notifications: space_id FK
  DELETE FROM notifications WHERE space_id = p_space_id;

  -- meals
  DELETE FROM meals WHERE space_id = p_space_id;

  -- ingredients
  DELETE FROM ingredients WHERE space_id = p_space_id;

  -- wishlist: wishlist_interests, wishlist 댓글(wishlist_id FK) 은 ON DELETE CASCADE로 자동 삭제
  DELETE FROM wishlist WHERE space_id = p_space_id;

  -- space_members (spaces ON DELETE CASCADE 있으나 명시적으로)
  DELETE FROM space_members WHERE space_id = p_space_id;

  -- 마지막으로 spaces 삭제
  DELETE FROM spaces WHERE id = p_space_id;
END;
$$;

-- ── 5. 확인 ─────────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'spaces'
ORDER BY ordinal_position;
