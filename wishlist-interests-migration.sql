-- ============================================================
-- wishlist_interests 테이블 생성
-- '나도 가고싶어요' 기능: 스페이스 멤버가 위시리스트 항목에 관심 표시
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

CREATE TABLE IF NOT EXISTS wishlist_interests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  wishlist_id uuid NOT NULL REFERENCES wishlist(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nickname TEXT NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(wishlist_id, user_id)
);

ALTER TABLE wishlist_interests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wishlist_interests_all" ON wishlist_interests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 확인
SELECT 'wishlist_interests 테이블 생성 완료' AS status;
