-- Add subscription fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free', 'recruiter_pro')),
ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active';

-- Add featured flag to jobs
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_plan ON public.profiles(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_jobs_is_featured ON public.jobs(is_featured);
