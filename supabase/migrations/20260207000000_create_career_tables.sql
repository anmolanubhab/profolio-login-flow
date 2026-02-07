-- Ensure resumes table exists
CREATE TABLE IF NOT EXISTS public.resumes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    content JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns if they don't exist
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.resumes ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'recruiters' CHECK (visibility IN ('everyone', 'recruiters', 'only_me'));

-- Migrate existing pdf_url to file_url if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'resumes' AND column_name = 'pdf_url') THEN
        UPDATE public.resumes SET file_url = pdf_url WHERE file_url IS NULL AND pdf_url IS NOT NULL;
    END IF;
END $$;

-- Ensure certificates table exists
CREATE TABLE IF NOT EXISTS public.certificates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_size BIGINT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns if they don't exist
ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'recruiters' CHECK (visibility IN ('everyone', 'recruiters', 'only_me'));

-- RLS for resumes
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own resumes" ON public.resumes;
DROP POLICY IF EXISTS "Users can insert their own resumes" ON public.resumes;
DROP POLICY IF EXISTS "Users can update their own resumes" ON public.resumes;
DROP POLICY IF EXISTS "Users can delete their own resumes" ON public.resumes;
DROP POLICY IF EXISTS "Public resumes are viewable by everyone" ON public.resumes;

CREATE POLICY "Users can view their own resumes"
ON public.resumes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own resumes"
ON public.resumes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own resumes"
ON public.resumes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own resumes"
ON public.resumes FOR DELETE
USING (auth.uid() = user_id);

-- RLS for certificates
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Users can insert their own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Users can update their own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Users can delete their own certificates" ON public.certificates;
DROP POLICY IF EXISTS "Public certificates are viewable by everyone" ON public.certificates;

CREATE POLICY "Users can view their own certificates"
ON public.certificates FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own certificates"
ON public.certificates FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own certificates"
ON public.certificates FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own certificates"
ON public.certificates FOR DELETE
USING (auth.uid() = user_id);

-- Public access policies
CREATE POLICY "Public resumes are viewable by everyone"
ON public.resumes FOR SELECT
USING (visibility = 'everyone');

CREATE POLICY "Public certificates are viewable by everyone"
ON public.certificates FOR SELECT
USING (visibility = 'everyone');
