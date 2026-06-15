CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id UUID REFERENCES public.spaces(id),
  meal_id UUID REFERENCES public.meals(id),
  from_user_id UUID REFERENCES auth.users(id),
  from_nickname TEXT DEFAULT '',
  from_avatar_url TEXT DEFAULT '',
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON public.notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
