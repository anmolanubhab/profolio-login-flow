-- Settings -> Visibility: "Active status" + "Profile update broadcasts".
--
-- Toggles themselves live in the existing profiles.preferences jsonb:
--   preferences.show_active_status            boolean  (default: shown)
--   preferences.share_profile_updates         boolean  (default: off)
--   preferences.last_profile_update_broadcast_at  timestamptz (throttle marker)
--
-- Only the "last seen" timestamp is a real column (indexed, read by other
-- users' profile pages) and the fan-out helper is a function (client-side
-- notification INSERTs are RLS-restricted to profile_view / friend_request /
-- new_follower for the caller only).

-- ---------------------------------------------------------------------------
-- Active status: lightweight presence timestamp.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists last_active_at timestamptz;

create index if not exists profiles_last_active_at_idx
  on public.profiles (last_active_at);

-- The existing "profiles are self-updatable" policy already covers this
-- column; no new policy required. The heartbeat is just
--   update profiles set last_active_at = now() where user_id = auth.uid()

-- ---------------------------------------------------------------------------
-- Profile-update broadcasts: notify the caller's accepted connections.
-- SECURITY DEFINER so it can insert `profile_update` notifications (blocked
-- for clients by notifications_insert_verified_actor). Gated by the caller's
-- own preferences.share_profile_updates toggle and throttled to once / 24h.
-- ---------------------------------------------------------------------------
create or replace function public.broadcast_profile_update()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me       uuid;
  my_name  text;
  prefs    jsonb;
  last_bc  timestamptz;
begin
  select id, display_name, coalesce(preferences, '{}'::jsonb)
    into me, my_name, prefs
  from public.profiles
  where user_id = auth.uid();

  if me is null then
    return;
  end if;

  -- Respect the user's toggle.
  if coalesce((prefs ->> 'share_profile_updates')::boolean, false) is not true then
    return;
  end if;

  -- Throttle: at most one broadcast per 24 hours.
  last_bc := nullif(prefs ->> 'last_profile_update_broadcast_at', '')::timestamptz;
  if last_bc is not null and last_bc > now() - interval '24 hours' then
    return;
  end if;

  insert into public.notifications (user_id, type, payload)
  select
    case when fr.sender_id = me then fr.receiver_id else fr.sender_id end,
    'profile_update',
    jsonb_build_object('sender_id', me, 'sender_name', my_name)
  from public.friend_requests fr
  where fr.status = 'accepted'
    and (fr.sender_id = me or fr.receiver_id = me);

  update public.profiles
     set preferences = jsonb_set(
           coalesce(preferences, '{}'::jsonb),
           '{last_profile_update_broadcast_at}',
           to_jsonb(now())
         )
   where id = me;
end;
$$;

grant execute on function public.broadcast_profile_update() to authenticated;
