-- Add cover_url column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url text;

-- Migrate existing photo_url data to cover_url
-- We assume photo_url was being used for cover images as per ProfileHeader logic
UPDATE profiles 
SET cover_url = photo_url 
WHERE photo_url IS NOT NULL AND cover_url IS NULL;

-- Make sure RLS policies allow update of cover_url
-- (Assuming existing policy allows update of all columns for owner, but if it's explicit column list, we might need to check)
-- Usually policies are 'CHECK ( auth.uid() = user_id )' which covers all columns.
