CREATE OR REPLACE FUNCTION accept_interview(p_interview_id UUID, p_application_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_interview_status TEXT;
    v_scheduled_at TIMESTAMPTZ;
    v_application_status TEXT;
BEGIN
    -- Get interview details
    SELECT status, scheduled_at INTO v_interview_status, v_scheduled_at
    FROM public.interviews
    WHERE id = p_interview_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Interview not found');
    END IF;

    -- Get application details
    SELECT status INTO v_application_status
    FROM public.applications
    WHERE id = p_application_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Application not found');
    END IF;

    -- Check if already accepted
    IF v_interview_status = 'accepted' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Interview already accepted');
    END IF;

    -- Check time constraint (24 hours before)
    IF NOW() >= (v_scheduled_at - INTERVAL '24 hours') THEN
        -- Auto-reject
        UPDATE public.interviews
        SET status = 'rejected'
        WHERE id = p_interview_id;

        UPDATE public.applications
        SET status = 'rejected'
        WHERE id = p_application_id;
        
        RETURN jsonb_build_object('success', false, 'error', 'Interview acceptance window has closed. Application rejected.');
    END IF;

    -- Update status
    UPDATE public.interviews
    SET status = 'accepted'
    WHERE id = p_interview_id;

    -- Application status remains 'interview'
    
    RETURN jsonb_build_object('success', true);
END;
$$;
