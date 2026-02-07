
-- Add views column to jobs if it doesn't exist
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- Function to safely increment job views
CREATE OR REPLACE FUNCTION public.increment_job_view(job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.jobs
  SET views = views + 1
  WHERE id = job_id;
END;
$$;

-- Function to get job analytics
CREATE OR REPLACE FUNCTION public.get_job_analytics(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_views INTEGER;
  v_total_applications INTEGER;
  v_shortlisted INTEGER;
  v_rejected INTEGER;
  v_messages_sent INTEGER;
  v_owner_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  -- Get job owner and views
  SELECT posted_by, views INTO v_owner_id, v_views
  FROM public.jobs
  WHERE id = p_job_id;

  -- Verify ownership (posted_by is profile_id)
  IF v_owner_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = v_owner_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied or job not found';
  END IF;

  -- Get application stats
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'shortlisted'),
    COUNT(*) FILTER (WHERE status = 'rejected')
  INTO v_total_applications, v_shortlisted, v_rejected
  FROM public.job_applications
  WHERE job_id = p_job_id;

  -- Get message stats (messages sent by the recruiter)
  -- We count messages where sender is the current user (recruiter)
  SELECT COUNT(*)
  INTO v_messages_sent
  FROM public.job_messages
  WHERE job_id = p_job_id AND sender_id = v_user_id;

  RETURN jsonb_build_object(
    'views', COALESCE(v_views, 0),
    'total_applications', v_total_applications,
    'shortlisted', v_shortlisted,
    'rejected', v_rejected,
    'messages_sent', v_messages_sent
  );
END;
$$;
