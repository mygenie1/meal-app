-- banners 테이블에 광고 고지 문구 컬럼 추가
-- Supabase 대시보드 → SQL Editor에서 실행

ALTER TABLE banners ADD COLUMN IF NOT EXISTS disclosure text;
