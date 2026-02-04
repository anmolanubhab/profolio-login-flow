-- Make company_id nullable and add company_name for simpler job posting
ALTER TABLE public.jobs 
ALTER COLUMN company_id DROP NOT NULL;

-- Add company_name and apply_link columns for direct job posting
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS apply_link text;

-- Update RLS policies to allow all authenticated users to read jobs
DROP POLICY IF EXISTS "jobs_read_all" ON public.jobs;

CREATE POLICY "jobs_read_all" 
ON public.jobs 
FOR SELECT 
TO authenticated
USING (true);

-- Policy for users to create their own jobs
DROP POLICY IF EXISTS "jobs_poster_manage" ON public.jobs;

CREATE POLICY "jobs_user_create" 
ON public.jobs 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = jobs.posted_by 
    AND p.user_id = auth.uid()
  )
);

-- Policy for users to update their own jobs
CREATE POLICY "jobs_user_update" 
ON public.jobs 
FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = jobs.posted_by 
    AND p.user_id = auth.uid()
  )
);

-- Policy for users to delete their own jobs
CREATE POLICY "jobs_user_delete" 
ON public.jobs 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.id = jobs.posted_by 
    AND p.user_id = auth.uid()
  )
);