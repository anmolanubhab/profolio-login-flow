-- Security Fixes for Profolio

-- 1. Fix job_messages insert policy to be explicit and secure
-- Drop existing ambiguous policy
DROP POLICY IF EXISTS "Users can send messages if related to job" ON public.job_messages;

-- Re-create with explicit table references to avoid ambiguity
CREATE POLICY "Users can send messages if related to job"
ON public.job_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND (
    -- Sender is the Job Owner (Recruiter)
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_messages.job_id
      AND j.posted_by = auth.uid()
    )
    OR
    -- Sender is the Applicant
    EXISTS (
      SELECT 1 FROM public.job_applications ja
      WHERE ja.job_id = job_messages.job_id
      AND ja.user_id = auth.uid()
    )
  )
);

-- 2. Fix notify_on_new_message search_path and logic
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  job_title TEXT;
  notif_link TEXT;
BEGIN
  -- Get sender name (use display_name as primary, fallback to 'Someone')
  SELECT display_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  IF sender_name IS NULL THEN sender_name := 'Someone'; END IF;

  -- Get job title
  SELECT title INTO job_title FROM public.jobs WHERE id = NEW.job_id;

  -- Construct Link
  notif_link := '/jobs/messages?jobId=' || NEW.job_id || '&correspondentId=' || NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  VALUES (
    NEW.receiver_id,
    'message',
    'New message from ' || sender_name,
    'Regarding ' || job_title || ': ' || substring(NEW.content from 1 for 50) || '...',
    notif_link,
    jsonb_build_object(
      'message_id', NEW.id,
      'job_id', NEW.job_id,
      'sender_id', NEW.sender_id
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Ensure jobs policies are secure
-- Jobs are public read, but restricted write
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Drop potential existing policies to ensure clean state
DROP POLICY IF EXISTS "Jobs are viewable by everyone" ON public.jobs;
DROP POLICY IF EXISTS "Recruiters can insert jobs" ON public.jobs;
DROP POLICY IF EXISTS "Recruiters can update their own jobs" ON public.jobs;
DROP POLICY IF EXISTS "Recruiters can delete their own jobs" ON public.jobs;

-- Public Read
CREATE POLICY "Jobs are viewable by everyone"
ON public.jobs FOR SELECT
USING (true);

-- Owner Write
CREATE POLICY "Recruiters can insert jobs"
ON public.jobs FOR INSERT
WITH CHECK (auth.uid() = posted_by);

CREATE POLICY "Recruiters can update their own jobs"
ON public.jobs FOR UPDATE
USING (auth.uid() = posted_by);

CREATE POLICY "Recruiters can delete their own jobs"
ON public.jobs FOR DELETE
USING (auth.uid() = posted_by);

-- 4. Address 'saved_jobs' RLS (Already correct in 20260207000002, but verifying)
-- Users can view their own saved jobs.
-- No action needed if file 20260207000002 is applied.

-- 5. Address 'profiles' RLS
-- Profiles are currently public ("Profiles are viewable by everyone").
-- This is required for the public profile / portfolio feature.
-- Sensitive columns (if any, like email/phone) should be handled by application logic 
-- or by ensuring they are not stored in this table if they must be strictly private.
-- For now, we maintain public access to profiles to avoid breaking the application.

-- 6. Address 'notifications' RLS
-- Notifications should only be visible to the recipient
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

-- Users shouldn't typically insert notifications manually (triggered by system), 
-- but if we allow it for testing or specific features:
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
-- Ideally, disable insert for users. System uses SECURITY DEFINER functions.
-- So NO insert policy for public.

