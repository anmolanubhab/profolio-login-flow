
-- Fix duplicate notifications by deduplicating recipients in the trigger function
-- Rewritten to avoid syntax issues with array initialization

CREATE OR REPLACE FUNCTION public.handle_new_application_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_job_title TEXT;
  v_company_id UUID;
  v_owner_id UUID;
  v_candidate_profile_id UUID;
  v_candidate_name TEXT;
  v_recipient_ids UUID[] := '{}'; -- Initialize as empty array
  v_recipient_id UUID;
  v_admin_ids UUID[];
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

  -- Add Owner to recipients
  IF v_owner_id IS NOT NULL THEN
    v_recipient_ids := array_append(v_recipient_ids, v_owner_id);
  END IF;

  -- Get Admins
  SELECT array_agg(user_id) INTO v_admin_ids
  FROM public.company_members
  WHERE company_id = v_company_id
  AND role IN ('super_admin', 'content_admin');

  -- Add Admins to recipients
  IF v_admin_ids IS NOT NULL THEN
    v_recipient_ids := array_cat(v_recipient_ids, v_admin_ids);
  END IF;

  -- Deduplicate and Insert
  IF v_recipient_ids IS NOT NULL AND array_length(v_recipient_ids, 1) > 0 THEN
    -- Loop through DISTINCT recipient IDs
    FOREACH v_recipient_id IN ARRAY (SELECT ARRAY(SELECT DISTINCT unnest(v_recipient_ids)))
    LOOP
      -- Insert notification if recipient is not the candidate
      IF v_recipient_id IS DISTINCT FROM v_candidate_profile_id THEN
        -- Check if notification already exists to avoid duplicates
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
