
-- 1. Ensure Notifications table has RLS enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Policy: Users can view their own notifications
-- Assumes notifications.user_id refers to profiles.id
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = notifications.user_id
    AND profiles.user_id = auth.uid()
  )
);

-- 3. Function to handle new application notifications
CREATE OR REPLACE FUNCTION public.handle_new_application_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_company_id UUID;
  v_owner_id UUID; -- Profile ID
  v_candidate_profile_id UUID;
  v_candidate_name TEXT;
  v_recipient_ids UUID[];
  v_recipient_id UUID;
BEGIN
  -- Get Job Details
  SELECT title, company_id INTO v_job_title, v_company_id
  FROM public.jobs
  WHERE id = NEW.job_id;

  -- Get Company Owner (Profile ID)
  SELECT owner_id INTO v_owner_id
  FROM public.companies
  WHERE id = v_company_id;

  -- Get Candidate Profile
  SELECT id, display_name INTO v_candidate_profile_id, v_candidate_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  -- Collect Recipients (Owner)
  IF v_owner_id IS NOT NULL THEN
    v_recipient_ids := ARRAY[v_owner_id];
  END IF;

  -- Collect Recipients (Admins)
  -- Append to array (handle nulls)
  SELECT array_cat(v_recipient_ids, array_agg(user_id))
  INTO v_recipient_ids
  FROM public.company_members
  WHERE company_id = v_company_id
  AND role IN ('super_admin', 'content_admin');

  -- Loop and Insert
  IF v_recipient_ids IS NOT NULL THEN
    FOREACH v_recipient_id IN ARRAY v_recipient_ids
    LOOP
      -- Insert notification if recipient is not the candidate
      IF v_recipient_id IS DISTINCT FROM v_candidate_profile_id THEN
        -- Check if notification already exists to avoid duplicates (optional)
        IF NOT EXISTS (
            SELECT 1 FROM public.notifications 
            WHERE user_id = v_recipient_id 
            AND type = 'job_application_received' 
            AND (payload->>'job_id')::uuid = NEW.job_id
            AND (payload->>'candidate_profile_id')::uuid = v_candidate_profile_id
        ) THEN
            INSERT INTO public.notifications (
              user_id,
              type,
              payload,
              created_at,
              is_read
            ) VALUES (
              v_recipient_id,
              'job_application_received',
              jsonb_build_object(
                'job_id', NEW.job_id,
                'job_title', v_job_title,
                'company_id', v_company_id,
                'candidate_profile_id', v_candidate_profile_id,
                'candidate_name', v_candidate_name
              ),
              now(),
              false
            );
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger
DROP TRIGGER IF EXISTS on_application_created ON public.applications;
CREATE TRIGGER on_application_created
AFTER INSERT ON public.applications
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_application_notification();
