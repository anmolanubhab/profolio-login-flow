-- Create trigger function for skill endorsement notifications
CREATE OR REPLACE FUNCTION public.notify_skill_endorsement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  endorser_profile profiles%ROWTYPE;
  skill_record skills%ROWTYPE;
BEGIN
  -- Get endorser's profile info
  SELECT * INTO endorser_profile
  FROM public.profiles
  WHERE id = NEW.endorser_id;

  -- Get the skill name
  SELECT * INTO skill_record
  FROM public.skills
  WHERE id = NEW.skill_id;

  -- Insert notification for the endorsed user
  INSERT INTO public.notifications (user_id, type, payload)
  VALUES (
    NEW.endorsed_user_id,
    'skill_endorsement',
    jsonb_build_object(
      'sender_name', COALESCE(endorser_profile.display_name, endorser_profile.full_name, 'Someone'),
      'sender_avatar', endorser_profile.avatar_url,
      'skill_name', skill_record.skill_name,
      'endorser_id', NEW.endorser_id
    )
  );

  RETURN NEW;
END;
$function$;

-- Create trigger for skill endorsements
CREATE TRIGGER on_skill_endorsement_created
  AFTER INSERT ON public.skill_endorsements
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_skill_endorsement();