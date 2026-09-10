-- Messaging read-state fix
-- Root cause: the only UPDATE policy on public.messages is USING (auth.uid() = sender_id),
-- so a recipient can never flip is_read on messages they received, and the unread badge
-- only ever grows. Fix with two SECURITY DEFINER RPCs (participant-checked, idempotent):
--   * mark_conversation_read(uuid) -- flips received messages in one conversation to read
--   * unread_message_count()       -- single source of truth for the global unread badge
-- Conversations are strictly 1:1, so the existing messages.is_read column is sufficient;
-- no new table, no schema change.

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_updated integer;
begin
  if v_uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and (c.participant_1 = v_uid or c.participant_2 = v_uid)
  ) then
    raise exception 'not a participant of this conversation' using errcode = '42501';
  end if;

  update public.messages m
     set is_read = true
   where m.conversation_id = p_conversation_id
     and m.sender_id is distinct from v_uid
     and m.is_read = false;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.mark_conversation_read(uuid) to authenticated;

create or replace function public.unread_message_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(count(*), 0)::integer
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.is_read = false
    and m.sender_id is distinct from auth.uid()
    and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid());
$$;

revoke all on function public.unread_message_count() from public, anon;
grant execute on function public.unread_message_count() to authenticated;
