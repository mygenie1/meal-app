-- 사용자별 별점 테이블 생성
CREATE TABLE IF NOT EXISTS ratings (
  id         uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  meal_id    uuid         NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  user_id    uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname   text         NOT NULL DEFAULT '',
  rating     integer      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (meal_id, user_id)
);

ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings_select" ON ratings FOR SELECT USING (true);
CREATE POLICY "ratings_insert" ON ratings FOR INSERT  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ratings_update" ON ratings FOR UPDATE  USING (auth.uid() = user_id);
CREATE POLICY "ratings_delete" ON ratings FOR DELETE  USING (auth.uid() = user_id);

-- 기존 meals.rating 값 마이그레이션 (로그인한 유저가 남긴 별점만)
INSERT INTO ratings (meal_id, user_id, nickname, rating)
SELECT id, user_id, nickname, rating
FROM meals
WHERE rating > 0 AND user_id IS NOT NULL
ON CONFLICT (meal_id, user_id) DO NOTHING;
