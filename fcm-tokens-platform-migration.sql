-- fcm_tokens.platform 컬럼 추가 (iOS Capacitor 네이티브 푸시 A2)
--
-- 목적: send-push Edge Function이 토큰별로 발송 페이로드를 분기하기 위함.
--   'web'/'android' → 기존 webpush data-only (SW showNotification)
--   'ios'           → notification + apns(aps.alert) (APNs 표시)
--
-- ★ default 'web' 이라 ADD COLUMN 시 기존 행이 모두 'web'으로 백필됨 → 회귀 없음
--   (place_url / recipe_id 전례와 동일한 안전한 컬럼 추가 패턴)
--
-- ★★ 이 마이그레이션을 Supabase SQL Editor에서 먼저 실행한 뒤에
--    send-push 재배포 / 앱 코드 배포를 진행할 것.
--    (send-push가 platform 컬럼을 SELECT 하므로, 컬럼이 없으면 web/android 발송도 실패)

ALTER TABLE fcm_tokens
  ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web'
  CHECK (platform IN ('web', 'ios', 'android'));

-- 확인용
-- SELECT platform, count(*) FROM fcm_tokens GROUP BY platform;
