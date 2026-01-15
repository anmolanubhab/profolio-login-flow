-- Fix the notify_post_comment function to use the correct profile ID
CREATE OR REPLACE FUNCTION public.notify_post_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  post_author_profile_id UUID;
  commenter_profile profiles%ROWTYPE;
BEGIN
  -- Get the post author's profile id (posts.user_id is auth.uid, we need profiles.id)
  SELECT p.id INTO post_author_profile_id
  FROM public.profiles p
  JOIN public.posts po ON po.user_id = p.user_id
  WHERE po.id = NEW.post_id;

  -- Don't notify if post author profile not found
  IF post_author_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Don't notify if user comments on their own post
  IF post_author_profile_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get commenter's profile info
  SELECT * INTO commenter_profile
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Skip notification if commenter profile not found
  IF commenter_profile.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Insert notification
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    post_author_profile_id,
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
$function$;