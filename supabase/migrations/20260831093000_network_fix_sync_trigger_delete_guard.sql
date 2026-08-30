-- The DELETE / non-accepted branch of the friend_requests -> connections sync
-- trigger must not drop the connections row while ANOTHER accepted
-- friend_request for the same undirected pair still exists (legacy reverse-pair
-- rows, or concurrent edits). Rebuild the function with that guard.

CREATE OR REPLACE FUNCTION public.sync_connection_from_friend_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  a uuid; b uuid;
  still_accepted boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    a := OLD.sender_id; b := OLD.receiver_id;
  ELSE
    a := NEW.sender_id; b := NEW.receiver_id;
  END IF;

  IF TG_OP <> 'DELETE' AND NEW.status = 'accepted' THEN
    INSERT INTO public.connections (user_id, connection_id, status)
    VALUES (least(a, b), greatest(a, b), 'accepted'::connection_status)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- DELETE, or UPDATE to a non-accepted status: only drop the connection
  -- when no other accepted friend_request for this pair remains.
  SELECT EXISTS (
    SELECT 1 FROM public.friend_requests fr
    WHERE fr.status = 'accepted'
      AND least(fr.sender_id, fr.receiver_id) = least(a, b)
      AND greatest(fr.sender_id, fr.receiver_id) = greatest(a, b)
      AND (TG_OP = 'DELETE' OR fr.id <> NEW.id)
  ) INTO still_accepted;

  IF NOT still_accepted THEN
    DELETE FROM public.connections
      WHERE least(user_id, connection_id) = least(a, b)
        AND greatest(user_id, connection_id) = greatest(a, b);
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

INSERT INTO public.connections (user_id, connection_id, status)
SELECT DISTINCT least(fr.sender_id, fr.receiver_id), greatest(fr.sender_id, fr.receiver_id), 'accepted'::connection_status
FROM public.friend_requests fr
WHERE fr.status = 'accepted'
ON CONFLICT DO NOTHING;

-- Trigger function must not be callable as a REST RPC.
REVOKE ALL ON FUNCTION public.sync_connection_from_friend_request() FROM public, anon, authenticated;
