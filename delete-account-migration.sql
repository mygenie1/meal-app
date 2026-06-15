-- ============================================================
-- 회원 탈퇴 지원 마이그레이션
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. 현재 FK 제약 확인 (참고용, 실행해도 무방)
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('meals', 'comments', 'ratings', 'notifications');

-- ============================================================
-- 2. FK를 ON DELETE SET NULL으로 변경
--    (게시글·댓글·별점은 유저 삭제 후에도 보존, user_id만 NULL)
-- ============================================================

-- meals.user_id
ALTER TABLE meals DROP CONSTRAINT IF EXISTS meals_user_id_fkey;
ALTER TABLE meals
  ADD CONSTRAINT meals_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- comments.user_id
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
ALTER TABLE comments
  ADD CONSTRAINT comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- ratings.user_id
ALTER TABLE ratings DROP CONSTRAINT IF EXISTS ratings_user_id_fkey;
ALTER TABLE ratings
  ADD CONSTRAINT ratings_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- notifications.from_user_id (발신자 → NULL, 알림 자체는 수신자에게 보존)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_from_user_id_fkey;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_from_user_id_fkey
  FOREIGN KEY (from_user_id) REFERENCES auth.users(id)
  ON DELETE SET NULL;

-- notifications.user_id (수신자 inbox → CASCADE: 유저 삭제 시 본인 알림도 삭제)
-- Supabase 기본 생성 시 CASCADE가 아닐 수 있으므로 명시적으로 설정
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
  ON DELETE CASCADE;

-- ============================================================
-- 3. 완료 확인
-- ============================================================
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('meals', 'comments', 'ratings', 'notifications')
ORDER BY tc.table_name, kcu.column_name;
