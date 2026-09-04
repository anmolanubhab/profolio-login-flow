-- B3: atomic, concurrency-safe merge into profiles.preferences.
--
-- The 4 client writers (useProfileSettings / useNotificationPreferences /
-- useAdvertisingDataSettings x2) each did: read the whole `preferences` blob,
-- merge in the browser, then UPDATE the whole blob. Two of them running against
-- stale snapshots silently drop each other's unrelated changes (and a shallow
-- blob write from a stale snapshot can even revert unrelated *real* sub-keys of
-- data_use / notifications).
--
-- This RPC does the merge SERVER-SIDE inside the UPDATE's SET expression, so it
-- always merges against the CURRENT committed row (Read Committed re-evaluates
-- `f(preferences)` after a concurrent writer commits its row lock). The merge is
-- DEEP so concurrent writes to different sub-keys of the same object
-- (data_use.connections vs data_use.groups, notifications.jobs vs
-- notifications.network) both survive.

-- Recursive deep merge: objects merged key-by-key, everything else = b wins.
-- A JSON `null` in `b` sets the key to null (the client never deletes keys).
create or replace function public._jsonb_deep_merge(a jsonb, b jsonb)
returns jsonb
language sql
immutable
as $$
  select case
    when a is null then b
    when b is null then a
    when jsonb_typeof(a) <> 'object' or jsonb_typeof(b) <> 'object' then b
    else coalesce(
      (
        select jsonb_object_agg(
          k,
          case
            when (a ? k) and (b ? k) then public._jsonb_deep_merge(a -> k, b -> k)
            when (b ? k) then b -> k
            else a -> k
          end
        )
        from (
          select jsonb_object_keys(a) as k
          union
          select jsonb_object_keys(b) as k
        ) keys
      ),
      '{}'::jsonb
    )
  end
$$;

-- Atomic patch of the CALLER'S OWN preferences. Returns the merged blob so the
-- client can reconcile local state with the authoritative value. `patch` is the
-- delta only, e.g. {"notifications":{"jobs":false}} / {"data_use":{"connections":false}}
-- / {"mentions_from":"nobody"}.
create or replace function public.update_my_preferences_patch(patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  merged jsonb;
begin
  if patch is null or jsonb_typeof(patch) <> 'object' then
    raise exception 'update_my_preferences_patch: patch must be a JSON object';
  end if;

  update public.profiles p
     set preferences = public._jsonb_deep_merge(coalesce(p.preferences, '{}'::jsonb), patch)
   where p.user_id = auth.uid()
  returning p.preferences into merged;

  if not found then
    raise exception 'update_my_preferences_patch: no profile row for the current user';
  end if;

  return merged;
end;
$$;

revoke all on function public._jsonb_deep_merge(jsonb, jsonb) from public, anon;
revoke all on function public.update_my_preferences_patch(jsonb) from public, anon;
grant execute on function public.update_my_preferences_patch(jsonb) to authenticated;
