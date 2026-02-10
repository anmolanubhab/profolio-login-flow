-- Update posts table status check constraint to include 'deleted'
ALTER TABLE public.posts 
DROP CONSTRAINT IF EXISTS posts_status_check;

ALTER TABLE public.posts 
ADD CONSTRAINT posts_status_check 
CHECK (status IN ('draft', 'published', 'deleted'));
