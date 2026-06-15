-- ============================================================
-- 식탁일기 — RLS 마이그레이션
-- Supabase 대시보드 → SQL Editor에서 전체 실행
-- ============================================================

-- ── 1. space_members 테이블 생성 ────────────────────────────
CREATE TABLE IF NOT EXISTS space_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    uuid        NOT NULL REFERENCES spaces(id)      ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(space_id, user_id)
);

-- ── 2. 기존 데이터 마이그레이션 ─────────────────────────────
-- owner_id가 있는 기존 스페이스 → space_members에 자동 추가
INSERT INTO space_members (space_id, user_id)
SELECT id, owner_id
FROM   spaces
WHERE  owner_id IS NOT NULL
ON CONFLICT (space_id, user_id) DO NOTHING;

-- ── 3. RLS 활성화 ────────────────────────────────────────────
ALTER TABLE spaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients   ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist      ENABLE ROW LEVEL SECURITY;

-- ── 4. spaces 정책 ───────────────────────────────────────────
DROP POLICY IF EXISTS "spaces_select_members" ON spaces;
DROP POLICY IF EXISTS "spaces_insert_auth"    ON spaces;
DROP POLICY IF EXISTS "spaces_update_members" ON spaces;
DROP POLICY IF EXISTS "spaces_delete_owner"   ON spaces;

-- 조회: 내가 멤버인 스페이스만
CREATE POLICY "spaces_select_members" ON spaces
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM space_members sm
      WHERE sm.space_id = spaces.id
        AND sm.user_id  = auth.uid()
    )
  );

-- 삽입: 로그인 필수
CREATE POLICY "spaces_insert_auth" ON spaces
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 수정: 내가 멤버인 스페이스
CREATE POLICY "spaces_update_members" ON spaces
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM space_members sm
      WHERE sm.space_id = spaces.id
        AND sm.user_id  = auth.uid()
    )
  );

-- 삭제: 오너만
CREATE POLICY "spaces_delete_owner" ON spaces
  FOR DELETE USING (owner_id = auth.uid());

-- ── 5. meals 정책 ────────────────────────────────────────────
DROP POLICY IF EXISTS "meals_select_members" ON meals;
DROP POLICY IF EXISTS "meals_insert_members" ON meals;
DROP POLICY IF EXISTS "meals_update_members" ON meals;
DROP POLICY IF EXISTS "meals_delete_members" ON meals;

CREATE POLICY "meals_select_members" ON meals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = meals.space_id AND sm.user_id = auth.uid())
  );
CREATE POLICY "meals_insert_members" ON meals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = meals.space_id AND sm.user_id = auth.uid())
  );
CREATE POLICY "meals_update_members" ON meals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = meals.space_id AND sm.user_id = auth.uid())
  );
CREATE POLICY "meals_delete_members" ON meals
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = meals.space_id AND sm.user_id = auth.uid())
  );

-- ── 6. ingredients 정책 ──────────────────────────────────────
DROP POLICY IF EXISTS "ingredients_select_members" ON ingredients;
DROP POLICY IF EXISTS "ingredients_insert_members" ON ingredients;
DROP POLICY IF EXISTS "ingredients_update_members" ON ingredients;
DROP POLICY IF EXISTS "ingredients_delete_members" ON ingredients;

CREATE POLICY "ingredients_select_members" ON ingredients
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = ingredients.space_id AND sm.user_id = auth.uid())
  );
CREATE POLICY "ingredients_insert_members" ON ingredients
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = ingredients.space_id AND sm.user_id = auth.uid())
  );
CREATE POLICY "ingredients_update_members" ON ingredients
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = ingredients.space_id AND sm.user_id = auth.uid())
  );
CREATE POLICY "ingredients_delete_members" ON ingredients
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = ingredients.space_id AND sm.user_id = auth.uid())
  );

-- ── 7. wishlist 정책 ─────────────────────────────────────────
DROP POLICY IF EXISTS "wishlist_select_members" ON wishlist;
DROP POLICY IF EXISTS "wishlist_insert_members" ON wishlist;
DROP POLICY IF EXISTS "wishlist_update_members" ON wishlist;
DROP POLICY IF EXISTS "wishlist_delete_members" ON wishlist;

CREATE POLICY "wishlist_select_members" ON wishlist
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = wishlist.space_id AND sm.user_id = auth.uid())
  );
CREATE POLICY "wishlist_insert_members" ON wishlist
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = wishlist.space_id AND sm.user_id = auth.uid())
  );
CREATE POLICY "wishlist_update_members" ON wishlist
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = wishlist.space_id AND sm.user_id = auth.uid())
  );
CREATE POLICY "wishlist_delete_members" ON wishlist
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = wishlist.space_id AND sm.user_id = auth.uid())
  );

-- ── 8. space_members 정책 ────────────────────────────────────
DROP POLICY IF EXISTS "space_members_select" ON space_members;
DROP POLICY IF EXISTS "space_members_insert" ON space_members;
DROP POLICY IF EXISTS "space_members_delete" ON space_members;

-- 조회: 내 멤버십 레코드만
CREATE POLICY "space_members_select" ON space_members
  FOR SELECT USING (user_id = auth.uid());

-- 삽입: 자기 자신만 추가 가능
--   - 코드 참가: join_space_by_code RPC (SECURITY DEFINER) 경유
--   - 기존 스페이스 복구: localStorage space_id로 직접 INSERT (boot 로직)
CREATE POLICY "space_members_insert" ON space_members
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 삭제: 자기 자신만 탈퇴 가능
CREATE POLICY "space_members_delete" ON space_members
  FOR DELETE USING (user_id = auth.uid());

-- ── 9. join_space_by_code RPC ────────────────────────────────
-- SECURITY DEFINER: RLS를 우회해 코드로 스페이스를 찾고 멤버 등록
-- 클라이언트(AppContext joinByCode)에서 .rpc('join_space_by_code', { p_code }) 호출
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
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- 이미 멤버면 무시 (UNIQUE 제약)
  INSERT INTO space_members (space_id, user_id)
  VALUES (v_space.id, auth.uid())
  ON CONFLICT (space_id, user_id) DO NOTHING;

  RETURN row_to_json(v_space);
END;
$$;
