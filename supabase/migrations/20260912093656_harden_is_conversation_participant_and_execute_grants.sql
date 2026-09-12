-- is_conversation_participant(conversation_id, user_id) let a caller pass an
-- ARBITRARY target user_id. Because it's SECURITY DEFINER and (like every
-- function) had the default PUBLIC execute grant Postgres applies unless
-- revoked, any authenticated (or anonymous) client could call it directly
-- via RPC as a membership oracle for other users, bypassing RLS. Fix: drop
-- the user_id parameter entirely and hardcode auth.uid() inside -- it can
-- now only ever answer "is the calling user a member", matching exactly
-- what the RLS policy needs and nothing more.
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  );
$$;

drop policy "Members can view participant rows for their conversations" on public.conversation_participants;

create policy "Members can view participant rows for their conversations"
on public.conversation_participants for select
using ( public.is_conversation_participant(conversation_id) );

-- The old 2-arg overload is no longer referenced by any policy -- drop it so
-- the arbitrary-user_id oracle can't be called at all.
drop function if exists public.is_conversation_participant(uuid, uuid);

-- Postgres grants EXECUTE to PUBLIC (anon + authenticated) by default on
-- CREATE FUNCTION unless revoked. Neither of these should be callable by an
-- unauthenticated client.
revoke execute on function public.is_conversation_participant(uuid) from public;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

revoke execute on function public.create_group_conversation(text, text, text, uuid[]) from public;
grant execute on function public.create_group_conversation(text, text, text, uuid[]) to authenticated;
