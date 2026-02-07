
-- Function to notify candidate when application status changes
CREATE OR REPLACE FUNCTION public.notify_candidate_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  job_title TEXT;
  notif_title TEXT;
  notif_message TEXT;
  notif_link TEXT;
BEGIN
  -- Only proceed if status changed
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only for specific statuses
  IF NEW.status NOT IN ('viewed', 'shortlisted', 'rejected') THEN
    RETURN NEW;
  END IF;

  -- Get job title
  SELECT title INTO job_title FROM public.jobs WHERE id = NEW.job_id;
  
  -- Fallback if job not found (shouldn't happen due to FK)
  IF job_title IS NULL THEN
    job_title := 'a job';
  END IF;

  -- Define content based on status
  IF NEW.status = 'viewed' THEN
    notif_title := 'Application Viewed';
    notif_message := 'Your application for "' || job_title || '" was viewed by the recruiter.';
  ELSIF NEW.status = 'shortlisted' THEN
    notif_title := 'You are Shortlisted!';
    notif_message := 'Good news! You have been shortlisted for "' || job_title || '".';
  ELSIF NEW.status = 'rejected' THEN
    notif_title := 'Application Update';
    notif_message := 'Update on your application for "' || job_title || '".';
  END IF;

  notif_link := '/jobs/my-jobs'; -- Direct user to their applications list

  -- Insert notification
  -- Using SECURITY DEFINER allows the recruiter (who triggers this update) 
  -- to insert a notification for the candidate (NEW.user_id)
  INSERT INTO public.notifications (user_id, type, title, message, link, data)
  VALUES (
    NEW.user_id,
    'application_status',
    notif_title,
    notif_message,
    notif_link,
    jsonb_build_object(
      'job_id', NEW.job_id, 
      'status', NEW.status, 
      'application_id', NEW.id,
      'job_title', job_title
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_application_status_change ON public.job_applications;

CREATE TRIGGER on_application_status_change
AFTER UPDATE ON public.job_applications
FOR EACH ROW
EXECUTE FUNCTION public.notify_candidate_on_status_change();
