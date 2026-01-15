-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to notify on post like
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author_id UUID;
  liker_profile profiles%ROWTYPE;
BEGIN
  -- Get the post author's profile id
  SELECT user_id INTO post_author_id
  FROM public.posts
  WHERE id = NEW.post_id;

  -- Don't notify if user likes their own post
  IF post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get liker's profile info
  SELECT * INTO liker_profile
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Insert notification
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    post_author_id,
    'like',
    jsonb_build_object(
      'sender_name', COALESCE(liker_profile.display_name, liker_profile.full_name, 'Someone'),
      'sender_avatar', liker_profile.avatar_url,
      'post_id', NEW.post_id
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger for post likes
DROP TRIGGER IF EXISTS on_post_like ON public.post_likes;
CREATE TRIGGER on_post_like
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_like();

-- Create function to notify on comment
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_author_id UUID;
  commenter_profile profiles%ROWTYPE;
BEGIN
  -- Get the post author's profile id
  SELECT user_id INTO post_author_id
  FROM public.posts
  WHERE id = NEW.post_id;

  -- Don't notify if user comments on their own post
  IF post_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get commenter's profile info
  SELECT * INTO commenter_profile
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Insert notification
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    post_author_id,
    'comment',
    jsonb_build_object(
      'sender_name', COALESCE(commenter_profile.display_name, commenter_profile.full_name, 'Someone'),
      'sender_avatar', commenter_profile.avatar_url,
      'post_id', NEW.post_id,
      'message', LEFT(NEW.content, 100)
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger for comments
DROP TRIGGER IF EXISTS on_post_comment ON public.comments;
CREATE TRIGGER on_post_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_comment();

-- Create function to notify on connection request
CREATE OR REPLACE FUNCTION public.notify_connection_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_profile profiles%ROWTYPE;
BEGIN
  -- Only notify on new pending requests
  IF NEW.status != 'pending' THEN
    RETURN NEW;
  END IF;

  -- Get sender's profile info
  SELECT * INTO sender_profile
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Insert notification for the receiver
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    NEW.connection_id,
    'connection_request',
    jsonb_build_object(
      'sender_name', COALESCE(sender_profile.display_name, sender_profile.full_name, 'Someone'),
      'sender_avatar', sender_profile.avatar_url,
      'connection_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger for connection requests
DROP TRIGGER IF EXISTS on_connection_request ON public.connections;
CREATE TRIGGER on_connection_request
  AFTER INSERT ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_connection_request();

-- Create function to notify on connection acceptance
CREATE OR REPLACE FUNCTION public.notify_connection_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  accepter_profile profiles%ROWTYPE;
BEGIN
  -- Only notify when status changes to accepted
  IF OLD.status = 'accepted' OR NEW.status != 'accepted' THEN
    RETURN NEW;
  END IF;

  -- Get accepter's profile info
  SELECT * INTO accepter_profile
  FROM public.profiles
  WHERE id = NEW.connection_id;

  -- Insert notification for the original requester
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    NEW.user_id,
    'connection_accepted',
    jsonb_build_object(
      'sender_name', COALESCE(accepter_profile.display_name, accepter_profile.full_name, 'Someone'),
      'sender_avatar', accepter_profile.avatar_url,
      'connection_id', NEW.id
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger for connection acceptance
DROP TRIGGER IF EXISTS on_connection_accepted ON public.connections;
CREATE TRIGGER on_connection_accepted
  AFTER UPDATE ON public.connections
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_connection_accepted();

-- Create function to notify on profile view
CREATE OR REPLACE FUNCTION public.notify_profile_view()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  viewer_profile profiles%ROWTYPE;
BEGIN
  -- Don't notify for self-views
  IF NEW.viewer_id = NEW.viewed_profile_id THEN
    RETURN NEW;
  END IF;

  -- Get viewer's profile info
  SELECT * INTO viewer_profile
  FROM public.profiles
  WHERE id = NEW.viewer_id;

  -- Insert notification (only once per day per viewer)
  INSERT INTO public.notifications (user_id, type, payload)
  SELECT 
    NEW.viewed_profile_id,
    'profile_view',
    jsonb_build_object(
      'sender_name', COALESCE(viewer_profile.display_name, viewer_profile.full_name, 'Someone'),
      'sender_avatar', viewer_profile.avatar_url,
      'profile_id', NEW.viewer_id
    )
  WHERE NOT EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = NEW.viewed_profile_id
      AND type = 'profile_view'
      AND payload->>'profile_id' = NEW.viewer_id::text
      AND created_at > NOW() - INTERVAL '1 day'
  );

  RETURN NEW;
END;
$$;

-- Create trigger for profile views
DROP TRIGGER IF EXISTS on_profile_view ON public.profile_views;
CREATE TRIGGER on_profile_view
  AFTER INSERT ON public.profile_views
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_profile_view();

-- Create function to notify on new message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  receiver_id UUID;
  sender_profile profiles%ROWTYPE;
  conversation_record conversations%ROWTYPE;
BEGIN
  -- Get conversation details
  SELECT * INTO conversation_record
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  -- Determine receiver (the other participant)
  IF conversation_record.participant_1 = NEW.sender_id THEN
    receiver_id := conversation_record.participant_2;
  ELSE
    receiver_id := conversation_record.participant_1;
  END IF;

  -- Get sender's profile info
  SELECT p.* INTO sender_profile
  FROM public.profiles p
  WHERE p.user_id = NEW.sender_id;

  -- Insert notification
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    receiver_id,
    'message',
    jsonb_build_object(
      'sender_name', COALESCE(sender_profile.display_name, sender_profile.full_name, 'Someone'),
      'sender_avatar', sender_profile.avatar_url,
      'message', LEFT(NEW.content, 100),
      'conversation_id', NEW.conversation_id
    )
  );

  RETURN NEW;
END;
$$;

-- Create trigger for new messages
DROP TRIGGER IF EXISTS on_new_message ON public.messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- Update the existing notify_new_job function to include more details
CREATE OR REPLACE FUNCTION public.notify_new_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Insert notification for all users (excluding the job poster)
  INSERT INTO public.notifications (user_id, type, payload)
  SELECT 
    p.id,
    'new_job',
    jsonb_build_object(
      'job_id', NEW.id,
      'job_title', NEW.title,
      'company_name', COALESCE(NEW.company_name, 'A company'),
      'location', NEW.location,
      'posted_at', NEW.posted_at
    )
  FROM public.profiles p
  WHERE p.id != NEW.posted_by;
  
  RETURN NEW;
END;
$function$;
