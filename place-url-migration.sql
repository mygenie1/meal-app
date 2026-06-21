-- 카카오 장소 링크(place_url) 저장용 컬럼 추가
-- 카카오 keywordSearch 결과의 place_url(http://place.map.kakao.com/{id})을 저장 → 게시물/위시리스트에서 "카카오맵에서 보기" 링크로 사용
-- Supabase SQL Editor에서 실행 (이미 Management API로 적용 완료 — 멱등, 재실행 안전)

ALTER TABLE public.meals    ADD COLUMN IF NOT EXISTS place_url text;
ALTER TABLE public.wishlist ADD COLUMN IF NOT EXISTS place_url text;
