-- notifications 테이블 Realtime 실시간 구독 활성화
-- Supabase SQL Editor에서 실행

-- 1. Realtime 이벤트 필터링 정확도를 위해 REPLICA IDENTITY FULL 설정
--    (INSERT는 기본적으로 동작하지만, UPDATE/DELETE 필터에도 필요)
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 2. supabase_realtime publication에 테이블 추가
--    (Supabase 대시보드 → Database → Replication에서 notifications 테이블을 ON으로 켜도 동일 효과)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
