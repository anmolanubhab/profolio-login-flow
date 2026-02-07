
-- Add experience_level to jobs table
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS experience_level TEXT DEFAULT 'mid';

-- Update RLS if needed (likely not needed for adding a column if existing policies cover 'all columns')
-- But good to document valid values
ALTER TABLE public.jobs 
ADD CONSTRAINT jobs_experience_level_check 
CHECK (experience_level IN ('entry', 'mid', 'senior', 'director', 'executive'));

-- Index for faster filtering
CREATE INDEX IF NOT EXISTS idx_jobs_experience_level ON public.jobs(experience_level);
CREATE INDEX IF NOT EXISTS idx_jobs_remote_option ON public.jobs(remote_option);
CREATE INDEX IF NOT EXISTS idx_jobs_employment_type ON public.jobs(employment_type);
