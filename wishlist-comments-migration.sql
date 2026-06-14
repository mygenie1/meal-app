-- ============================================================
-- 가고 싶은 곳(wishlist) 댓글 지원 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. 현재 comments 테이블 RLS 정책 확인 (참고용)
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'comments';

-- ============================================================
-- 2. wishlist_id 컬럼 추가
-- ============================================================
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS wishlist_id UUID REFERENCES wishlist(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comments_wishlist_id_idx ON comments(wishlist_id);

-- ============================================================
-- 3. meal_id를 nullable로 변경
--    wishlist 댓글은 meal_id가 NULL이므로 NOT NULL 제약 해제
-- ============================================================
ALTER TABLE comments ALTER COLUMN meal_id DROP NOT NULL;

-- ============================================================
-- 4. RLS 정책 업데이트
--    meal 댓글 + wishlist 댓글 모두 허용하는 정책으로 교체
-- ============================================================

-- 기존 정책 삭제 (이름이 다를 수 있으므로 주요 이름 시도)
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "Users can insert comments" ON comments;
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON comments;
DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "Users can view comments" ON comments;
DROP POLICY IF EXISTS "comments_delete" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;

-- 새 정책: 인증 유저라면 meal / wishlist 댓글 모두 허용
CREATE POLICY "comments_select_all" ON comments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "comments_insert_authenticated" ON comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (meal_id IS NOT NULL OR wishlist_id IS NOT NULL)
  );

CREATE POLICY "comments_delete_own" ON comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- 5. 완료 확인 — 컬럼 목록 조회
-- ============================================================
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'comments'
ORDER BY ordinal_position;
