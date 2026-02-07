
-- Create job_messages table
CREATE TABLE IF NOT EXISTS public.job_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.job_messages ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view messages they sent or received"
ON public.job_messages FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages if related to job"
ON public.job_messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND (
    -- Sender is the Job Owner (Recruiter)
    EXISTS (
      SELECT 1 FROM public.jobs 
      WHERE id = job_id 
      AND posted_by = auth.uid()
    )
    OR
    -- Sender is the Applicant
    EXISTS (
      SELECT 1 FROM public.job_applications 
      WHERE job_id = job_id 
      AND user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can mark received messages as read"
ON public.job_messages FOR UPDATE
USING (auth.uid() = receiver_id)
WITH CHECK (auth.uid() = receiver_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_messages_lookup 
ON public.job_messages(job_id, sender_id, receiver_id);

CREATE INDEX IF NOT EXISTS idx_job_messages_receiver_read 
ON public.job_messages(receiver_id, read);

-- Notification Trigger Function
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
  sender_name TEXT;
  job_title TEXT;
  notif_link TEXT;
BEGIN
  -- Get sender name
  SELECT full_name INTO sender_name FROM public.profiles WHERE user_id = NEW.sender_id;
  IF sender_name IS NULL THEN sender_name := 'Someone'; END IF;

  -- Get job title
  SELECT title INTO job_title FROM public.jobs WHERE id = NEW.job_id;

  -- Construct Link (Logic depends on who is receiving)
  -- If receiver is job owner (recruiter), link to applicant details? 
  -- If receiver is applicant, link to messages page?
  -- For now, generic link, handled by UI redirect or specific page
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger
DROP TRIGGER IF EXISTS on_new_job_message ON public.job_messages;
CREATE TRIGGER on_new_job_message
AFTER INSERT ON public.job_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_new_message();
