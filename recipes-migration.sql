-- ============================================================
-- 식탁일기 — 레시피 관리 마이그레이션 (Phase 1)
-- Supabase 대시보드 → SQL Editor에서 전체 실행
-- ★ 반드시 배포(코드 push) 전에 먼저 실행할 것 (컬럼 없이 insert하면 저장 회귀)
-- ============================================================

-- ── 1. recipes 테이블 ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id    uuid        NOT NULL REFERENCES spaces(id)     ON DELETE CASCADE,
  author_id   uuid                 REFERENCES auth.users(id) ON DELETE SET NULL,  -- 처음부터 FK(유령 데이터 방지)
  name        text        NOT NULL,
  memo        text,
  link_url    text,                                                               -- 유튜브 등 외부 URL (앱에서 http(s)://만 저장)
  photo       text,                                                               -- 대표사진 (wishlist.photo와 동일 방식)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipes_space_id_idx ON recipes(space_id);

-- ── 2. recipe_ingredients 테이블 ─────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id          uuid     PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id   uuid     NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,  -- 레시피 삭제 시 동반 삭제
  name        text     NOT NULL,
  amount      text,                                                        -- "2", "200", "2큰술" 등 자유 텍스트
  unit        text,                                                        -- "개", "g", "큰술" 등
  sort_order  integer  NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_id_idx ON recipe_ingredients(recipe_id);

-- ── 3. meals.recipe_id 컬럼 추가 (Phase 1은 컬럼만, 사용은 Phase 3) ──
ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL;

-- ── 4. RLS 활성화 ────────────────────────────────────────────
ALTER TABLE recipes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;

-- ── 5. recipes 정책 (space_members 기반, meals/ingredients와 동일 패턴) ──
DROP POLICY IF EXISTS "recipes_select_members" ON recipes;
DROP POLICY IF EXISTS "recipes_insert_members" ON recipes;
DROP POLICY IF EXISTS "recipes_update_members" ON recipes;
DROP POLICY IF EXISTS "recipes_delete_members" ON recipes;

CREATE POLICY "recipes_select_members" ON recipes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = recipes.space_id AND sm.user_id = auth.uid())
  );
CREATE POLICY "recipes_insert_members" ON recipes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = recipes.space_id AND sm.user_id = auth.uid())
  );
CREATE POLICY "recipes_update_members" ON recipes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = recipes.space_id AND sm.user_id = auth.uid())
  );
CREATE POLICY "recipes_delete_members" ON recipes
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM space_members sm WHERE sm.space_id = recipes.space_id AND sm.user_id = auth.uid())
  );

-- ── 6. recipe_ingredients 정책 (recipes 경유 join으로 space_members 확인) ──
DROP POLICY IF EXISTS "recipe_ingredients_select_members" ON recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_insert_members" ON recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_update_members" ON recipe_ingredients;
DROP POLICY IF EXISTS "recipe_ingredients_delete_members" ON recipe_ingredients;

CREATE POLICY "recipe_ingredients_select_members" ON recipe_ingredients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN space_members sm ON sm.space_id = r.space_id
      WHERE r.id = recipe_ingredients.recipe_id AND sm.user_id = auth.uid()
    )
  );
CREATE POLICY "recipe_ingredients_insert_members" ON recipe_ingredients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN space_members sm ON sm.space_id = r.space_id
      WHERE r.id = recipe_ingredients.recipe_id AND sm.user_id = auth.uid()
    )
  );
CREATE POLICY "recipe_ingredients_update_members" ON recipe_ingredients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN space_members sm ON sm.space_id = r.space_id
      WHERE r.id = recipe_ingredients.recipe_id AND sm.user_id = auth.uid()
    )
  );
CREATE POLICY "recipe_ingredients_delete_members" ON recipe_ingredients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM recipes r
      JOIN space_members sm ON sm.space_id = r.space_id
      WHERE r.id = recipe_ingredients.recipe_id AND sm.user_id = auth.uid()
    )
  );

-- ── 7. 적용 확인용 (선택 — 실행 후 결과 확인) ────────────────
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'meals' AND column_name = 'recipe_id';
-- SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('recipes','recipe_ingredients') ORDER BY tablename, policyname;
