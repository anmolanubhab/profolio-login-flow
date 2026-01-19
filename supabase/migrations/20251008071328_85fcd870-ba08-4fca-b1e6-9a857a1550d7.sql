-- Add status column to posts table for draft functionality
ALTER TABLE public.posts 
ADD COLUMN status text NOT NULL DEFAULT 'published';

-- Add a check constraint to ensure valid status values
ALTER TABLE public.posts 
ADD CONSTRAINT posts_status_check 
CHECK (status IN ('draft', 'published'));

-- Create an index on status for better query performance
CREATE INDEX idx_posts_status ON public.posts(status);