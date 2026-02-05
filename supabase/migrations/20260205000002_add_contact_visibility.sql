-- Add contact and visibility fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS display_email TEXT,
ADD COLUMN IF NOT EXISTS show_email BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_phone BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'open_to_networking' 
CHECK (availability_status IN ('hiring', 'open_to_work', 'busy', 'open_to_networking'));
