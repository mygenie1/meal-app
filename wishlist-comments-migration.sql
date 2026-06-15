-- ============================================================
-- 가고 싶은 곳(wishlist) 댓글 지원 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. 현재 상태 확인 (참고용, 실행해도 무방)
SELECT policyname, cmd, qual, with_check
FROM pg_policies WHERE tablename = 'comments';

-- ============================================================
-- 2. wishlist_id 컬럼 추가 (이미 있으면 스킵)
-- ============================================================
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS wishlist_id UUID REFERENCES wishlist(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comments_wishlist_id_idx ON comments(wishlist_id);

-- ============================================================
-- 3. meal_id를 nullable로 변경
--    wishlist 댓글은 meal_id가 NULL → NOT NULL 제약 해제
-- ============================================================
ALTER TABLE comments ALTER COLUMN meal_id DROP NOT NULL;

-- ============================================================
-- 4. RLS 정책 전체 교체
--    이름을 모르는 기존 정책을 DO 블록으로 전부 삭제 후
--    meal / wishlist 댓글 모두 허용하는 정책으로 재생성
-- ============================================================

-- 기존 정책 전체 삭제 (이름 무관)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'comments' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON comments', r.policyname);
  END LOOP;
END $$;

-- 새 정책
CREATE POLICY "comments_select" ON comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "comments_insert" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "comments_delete" ON comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 5. 완료 확인
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'comments'
ORDER BY ordinal_position;
