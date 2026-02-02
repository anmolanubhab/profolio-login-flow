-- Create a function to notify all users when a new job is posted
CREATE OR REPLACE FUNCTION public.notify_new_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert notification for all users (excluding the job poster)
  INSERT INTO public.notifications (user_id, type, payload)
  SELECT 
    p.id,
    'new_job',
    jsonb_build_object(
      'job_id', NEW.id,
      'job_title', NEW.title,
      'company_id', NEW.company_id,
      'posted_at', NEW.posted_at
    )
  FROM public.profiles p
  WHERE p.id != NEW.posted_by;
  
  RETURN NEW;
END;
$$;

-- Create trigger to call the function after a new job is inserted
DROP TRIGGER IF EXISTS on_job_posted ON public.jobs;

CREATE TRIGGER on_job_posted
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  WHEN (NEW.status = 'open')
  EXECUTE FUNCTION public.notify_new_job();