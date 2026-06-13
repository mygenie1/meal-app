-- wishlist 댓글 기능: comments 테이블에 wishlist_id 컬럼 추가
-- Supabase SQL Editor에서 직접 실행

ALTER TABLE comments ADD COLUMN IF NOT EXISTS wishlist_id UUID REFERENCES wishlist(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS comments_wishlist_id_idx ON comments(wishlist_id);
