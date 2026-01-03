-- Fix the notify_new_message trigger to use the correct profile.id for notifications
CREATE OR REPLACE FUNCTION public.notify_new_message()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  receiver_auth_id UUID;
  receiver_profile_id UUID;
  sender_profile profiles%ROWTYPE;
  conversation_record conversations%ROWTYPE;
BEGIN
  -- Get conversation details
  SELECT * INTO conversation_record
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  -- Determine receiver auth id (the other participant)
  IF conversation_record.participant_1 = NEW.sender_id THEN
    receiver_auth_id := conversation_record.participant_2;
  ELSE
    receiver_auth_id := conversation_record.participant_1;
  END IF;

  -- Get the receiver's profile.id from their auth user_id
  SELECT id INTO receiver_profile_id
  FROM public.profiles
  WHERE user_id = receiver_auth_id;

  -- If no profile found, skip notification
  IF receiver_profile_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get sender's profile info
  SELECT p.* INTO sender_profile
  FROM public.profiles p
  WHERE p.user_id = NEW.sender_id;

  -- Insert notification using the profile.id (not auth.uid())
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    receiver_profile_id,
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
$function$;