-- ============================================================
-- feedback 테이블 생성
-- 앱 내 피드백 보내기 기능 (버그/제안/칭찬/기타 + 스크린샷)
-- Supabase SQL Editor에서 실행하세요.
-- ============================================================

CREATE TABLE IF NOT EXISTS feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  nickname TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'etc',        -- bug | suggestion | praise | etc
  content TEXT NOT NULL,
  screenshot_url TEXT,                      -- meal-photos 버킷 feedback/ 경로 공개 URL
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- 작성: 누구나 가능 / 조회: 본인 것만 (관리자는 service_role로 확인)
CREATE POLICY "feedback_insert" ON feedback
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "feedback_select_own" ON feedback
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 확인
SELECT 'feedback 테이블 생성 완료' AS status;
