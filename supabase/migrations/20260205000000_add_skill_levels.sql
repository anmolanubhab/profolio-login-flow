-- Add level and is_top columns to skills table
ALTER TABLE public.skills 
ADD COLUMN IF NOT EXISTS level text DEFAULT 'Beginner',
ADD COLUMN IF NOT EXISTS is_top boolean DEFAULT false;
