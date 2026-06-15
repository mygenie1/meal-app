-- ============================================================
-- ingredients 테이블에 quantity(개수) 컬럼 추가
-- 재료 개수 관리 기능
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- 기존 NULL 데이터는 앱에서 1로 표시 (rowToIngredient: row.quantity ?? 1)
-- 필요 시 아래로 일괄 정리 가능:
-- UPDATE ingredients SET quantity = 1 WHERE quantity IS NULL;

-- 확인
SELECT 'ingredients.quantity 컬럼 추가 완료' AS status;
