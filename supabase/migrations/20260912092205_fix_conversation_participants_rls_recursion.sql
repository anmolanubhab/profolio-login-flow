-- The self-referencing subquery in "Members can view participant rows for
-- their conversations" causes Postgres to re-apply that same policy while
-- evaluating it (42P17 infinite recursion), which also breaks every other
-- policy (conversations, messages) that queries conversation_participants.
-- Fix: check membership through a SECURITY DEFINER function, which runs
-- with RLS bypassed, so there's no self-reference for Postgres to recurse on.

create or replace function public.is_conversation_participant(p_conversation_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = p_user_id
  );
$$;

grant execute on function public.is_conversation_participant(uuid, uuid) to authenticated;

drop policy "Members can view participant rows for their conversations" on public.conversation_participants;

create policy "Members can view participant rows for their conversations"
on public.conversation_participants for select
using ( public.is_conversation_participant(conversation_id, auth.uid()) );
