ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_visibility   text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS website_visibility text NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS social_visibility  text NOT NULL DEFAULT 'public';

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_phone_visibility_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_phone_visibility_check
  CHECK (phone_visibility IN ('only_me','connections','public'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_website_visibility_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_website_visibility_check
  CHECK (website_visibility IN ('only_me','connections','public'));

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_social_visibility_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_social_visibility_check
  CHECK (social_visibility IN ('only_me','connections','public'));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY profiles_update_own ON public.profiles
      FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
