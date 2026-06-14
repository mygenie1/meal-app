-- ============================================================
-- FCM 토큰 중복 확인 및 정리
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

-- 1. 중복 현황 확인 (사용자별 토큰 수)
SELECT user_id, count(*) AS token_count
FROM fcm_tokens
GROUP BY user_id
HAVING count(*) > 1;

-- 2. 전체 토큰 목록
SELECT user_id, token, created_at
FROM fcm_tokens
ORDER BY user_id, created_at;

-- ============================================================
-- 3. 동일 (user_id, token) 중복 제거 — 오래된 것 삭제 (최신 1개 유지)
-- ============================================================
DELETE FROM fcm_tokens
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY user_id, token ORDER BY created_at DESC) AS rn
    FROM fcm_tokens
  ) t
  WHERE rn > 1
);

-- ============================================================
-- 4. UNIQUE 제약 추가 (이후 중복 삽입 DB 레벨에서 차단)
--    이미 존재하면 에러 없이 스킵 (IF NOT EXISTS 사용 불가 → 에러 무시)
-- ============================================================
ALTER TABLE fcm_tokens
  ADD CONSTRAINT fcm_tokens_user_token_unique UNIQUE (user_id, token);

-- ============================================================
-- 5. 정리 후 확인
-- ============================================================
SELECT user_id, count(*) AS token_count
FROM fcm_tokens
GROUP BY user_id
ORDER BY token_count DESC;
