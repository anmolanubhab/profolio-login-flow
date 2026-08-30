-- =============================================================================
-- My Network — unify connection state + harden the request lifecycle
-- =============================================================================
-- Context: the app grew THREE connection-accept code paths (Network invitations,
-- profile page, notifications page). Only one of them also wrote the
-- denormalised `connections` table, so `friend_requests` (status='accepted')
-- and `connections` had drifted out of sync — My Network showed fewer
-- connections than the profile page. `connections` is still the table read by
-- mutual-count, connections search, network counts and Story audience, so we:
--
--   1. keep `friend_requests` as the single WRITE path (all 3 UIs already
--      write there) and add a trigger that mirrors accepted requests into
--      `connections` automatically;
--   2. backfill both directions so existing data converges;
--   3. add SECURITY DEFINER RPCs so every client action is one atomic,
--      guard-checked call that also emits the right notification;
--   4. add an optional invitation note (LinkedIn parity);
--   5. exclude blocked users from people discovery.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Optional invitation note
-- ---------------------------------------------------------------------------
ALTER TABLE public.friend_requests
  ADD COLUMN IF NOT EXISTS message text;

DO $$ BEGIN
  ALTER TABLE public.friend_requests
    ADD CONSTRAINT friend_requests_message_len CHECK (message IS NULL OR char_length(message) <= 300);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 2) friend_requests -> connections sync trigger
--    `connections` becomes a pure projection of accepted friend_requests.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_connection_from_friend_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  a uuid;
  b uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    a := OLD.sender_id; b := OLD.receiver_id;
    DELETE FROM public.connections
      WHERE least(user_id, connection_id) = least(a, b)
        AND greatest(user_id, connection_id) = greatest(a, b);
    RETURN OLD;
  END IF;

  a := NEW.sender_id; b := NEW.receiver_id;

  IF NEW.status = 'accepted' THEN
    -- undirected upsert; canonical row is (least, greatest)
    INSERT INTO public.connections (user_id, connection_id, status)
    VALUES (least(a, b), greatest(a, b), 'accepted'::connection_status)
    ON CONFLICT DO NOTHING;
  ELSE
    -- pending / rejected: make sure no stale accepted pair lingers
    DELETE FROM public.connections
      WHERE least(user_id, connection_id) = least(a, b)
        AND greatest(user_id, connection_id) = greatest(a, b);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_connection_from_friend_request ON public.friend_requests;
CREATE TRIGGER trg_sync_connection_from_friend_request
  AFTER INSERT OR DELETE OR UPDATE OF status ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.sync_connection_from_friend_request();

-- ---------------------------------------------------------------------------
-- 3) Backfill both directions
-- ---------------------------------------------------------------------------
-- (a) every accepted friend_request -> a connections row
INSERT INTO public.connections (user_id, connection_id, status)
SELECT DISTINCT least(fr.sender_id, fr.receiver_id), greatest(fr.sender_id, fr.receiver_id), 'accepted'::connection_status
FROM public.friend_requests fr
WHERE fr.status = 'accepted'
ON CONFLICT DO NOTHING;

-- (b) every existing connections row -> an accepted friend_request row
--     (so the profile page / notifications page, which read friend_requests,
--      also see these historical connections). Respect the (sender,receiver)
--      unique constraint by only inserting when neither direction exists.
INSERT INTO public.friend_requests (sender_id, receiver_id, status)
SELECT c.user_id, c.connection_id, 'accepted'::friend_request_status
FROM public.connections c
WHERE c.status = 'accepted'
  AND NOT EXISTS (
    SELECT 1 FROM public.friend_requests fr
    WHERE (fr.sender_id = c.user_id AND fr.receiver_id = c.connection_id)
       OR (fr.sender_id = c.connection_id AND fr.receiver_id = c.user_id)
  )
ON CONFLICT (sender_id, receiver_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4) Lifecycle RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.send_connection_request(target_profile_id uuid, note text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  me uuid := public.current_profile_id();
  reverse_id uuid;
  inserted_id uuid;
  sender_name text;
  sender_avatar text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF target_profile_id IS NULL OR target_profile_id = me THEN
    RAISE EXCEPTION 'invalid target';
  END IF;

  -- blocked either direction
  IF EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (user_id = me AND blocked_user_id = target_profile_id)
       OR (user_id = target_profile_id AND blocked_user_id = me)
  ) THEN
    RAISE EXCEPTION 'blocked';
  END IF;

  -- already connected?
  IF EXISTS (
    SELECT 1 FROM public.connections c
    WHERE c.status = 'accepted'
      AND least(c.user_id, c.connection_id) = least(me, target_profile_id)
      AND greatest(c.user_id, c.connection_id) = greatest(me, target_profile_id)
  ) THEN
    RETURN 'connected';
  END IF;

  -- an inbound pending request from the target already exists -> accept it
  SELECT id INTO reverse_id FROM public.friend_requests
   WHERE sender_id = target_profile_id AND receiver_id = me AND status = 'pending'
   LIMIT 1;
  IF reverse_id IS NOT NULL THEN
    UPDATE public.friend_requests SET status = 'accepted', updated_at = now() WHERE id = reverse_id;
    SELECT COALESCE(display_name, full_name, 'Someone'), avatar_url
      INTO sender_name, sender_avatar FROM public.profiles WHERE id = me;
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (target_profile_id, 'connection_accepted',
            jsonb_build_object('connection_id', me, 'sender_name', sender_name, 'sender_avatar', sender_avatar));
    RETURN 'connected';
  END IF;

  -- clear any stale non-pending row from me->target so we can re-send
  DELETE FROM public.friend_requests
   WHERE sender_id = me AND receiver_id = target_profile_id AND status <> 'pending';

  INSERT INTO public.friend_requests (sender_id, receiver_id, status, message)
  VALUES (me, target_profile_id, 'pending', NULLIF(btrim(note), ''))
  ON CONFLICT (sender_id, receiver_id) DO NOTHING
  RETURNING id INTO inserted_id;

  -- Only notify when a brand-new pending request was actually created.
  IF inserted_id IS NOT NULL THEN
    SELECT COALESCE(display_name, full_name, 'Someone'), avatar_url
      INTO sender_name, sender_avatar FROM public.profiles WHERE id = me;
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (target_profile_id, 'connection_request',
            jsonb_build_object('sender_id', me, 'sender_name', sender_name, 'sender_avatar', sender_avatar));
  END IF;

  RETURN 'pending';
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_connection_request(request_id uuid, accept boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  me uuid := public.current_profile_id();
  fr public.friend_requests%ROWTYPE;
  accepter_name text;
  accepter_avatar text;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO fr FROM public.friend_requests WHERE id = request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'request not found'; END IF;
  IF fr.receiver_id <> me THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF fr.status <> 'pending' THEN RETURN fr.status::text; END IF;

  IF accept THEN
    UPDATE public.friend_requests SET status = 'accepted', updated_at = now() WHERE id = request_id;
    SELECT COALESCE(display_name, full_name, 'Someone'), avatar_url
      INTO accepter_name, accepter_avatar FROM public.profiles WHERE id = me;
    INSERT INTO public.notifications (user_id, type, payload)
    VALUES (fr.sender_id, 'connection_accepted',
            jsonb_build_object('connection_id', me, 'sender_name', accepter_name, 'sender_avatar', accepter_avatar));
    RETURN 'connected';
  ELSE
    -- LinkedIn "Ignore" removes the invitation entirely
    DELETE FROM public.friend_requests WHERE id = request_id;
    RETURN 'ignored';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_connection_request(request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  me uuid := public.current_profile_id();
  fr public.friend_requests%ROWTYPE;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO fr FROM public.friend_requests WHERE id = request_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF fr.sender_id <> me THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF fr.status <> 'pending' THEN RETURN false; END IF;
  DELETE FROM public.friend_requests WHERE id = request_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.send_connection_request(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.respond_to_connection_request(uuid, boolean) FROM public, anon;
REVOKE ALL ON FUNCTION public.withdraw_connection_request(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.send_connection_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_connection_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_connection_request(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5) People discovery must not surface blocked users
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_people(search text DEFAULT ''::text, lim integer DEFAULT 20, off integer DEFAULT 0)
RETURNS TABLE(profile_id uuid, display_name text, full_name text, headline text, profession text, location text, avatar_url text, last_name_visibility text, mutual_count integer, relationship text, request_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  with me as (select public.current_profile_id() as pid)
  select
    p.id,
    p.display_name,
    p.full_name,
    p.headline,
    p.profession,
    p.location,
    p.avatar_url,
    p.last_name_visibility,
    public.mutual_connections_count(p.id) as mutual_count,
    case
      when p.id = (select pid from me) then 'self'
      when exists (
        select 1 from public.connections c
        where c.status = 'accepted'
          and ((c.user_id = (select pid from me) and c.connection_id = p.id)
            or (c.user_id = p.id and c.connection_id = (select pid from me)))
      ) then 'connected'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending' and fr.sender_id = (select pid from me) and fr.receiver_id = p.id
      ) then 'pending_outgoing'
      when exists (
        select 1 from public.friend_requests fr
        where fr.status = 'pending' and fr.sender_id = p.id and fr.receiver_id = (select pid from me)
      ) then 'pending_incoming'
      else 'none'
    end as relationship,
    (
      select fr.id from public.friend_requests fr
      where fr.status = 'pending'
        and ((fr.sender_id = (select pid from me) and fr.receiver_id = p.id)
          or (fr.sender_id = p.id and fr.receiver_id = (select pid from me)))
      limit 1
    ) as request_id
  from public.profiles p
  where p.id <> (select pid from me)
    and coalesce(p.profile_discovery, true) = true
    and not exists (
      select 1 from public.blocked_users b
      where (b.user_id = (select pid from me) and b.blocked_user_id = p.id)
         or (b.user_id = p.id and b.blocked_user_id = (select pid from me))
    )
    and (
      coalesce(nullif(trim(search), ''), '') = ''
      or p.display_name ilike '%' || search || '%'
      or p.full_name   ilike '%' || search || '%'
      or p.headline    ilike '%' || search || '%'
      or p.profession  ilike '%' || search || '%'
      or p.location    ilike '%' || search || '%'
    )
  order by
    public.mutual_connections_count(p.id) desc,
    p.created_at desc
  limit least(greatest(lim, 1), 100) offset greatest(off, 0);
$function$;

-- ---------------------------------------------------------------------------
-- 6) Realtime for live invitation updates
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
