-- ============================================================================
-- Group chat support for Profolio Messages
-- ============================================================================

-- 1. Extend conversations for group support.
alter table public.conversations
  add column is_group boolean not null default false,
  add column group_name text,
  add column group_description text,
  add column group_avatar_url text,
  add column created_by uuid references auth.users(id);

-- 2. Membership join table.
create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (conversation_id, user_id)
);

alter table public.conversation_participants enable row level security;

create index idx_conversation_participants_user on public.conversation_participants(user_id);
create index idx_conversation_participants_conversation on public.conversation_participants(conversation_id);

-- 3. Mirror legacy participant_1/participant_2 into conversation_participants.
create or replace function public.sync_conversation_participants_from_legacy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.participant_1 is not null then
    insert into public.conversation_participants (conversation_id, user_id, role)
    values (new.id, new.participant_1, 'member')
    on conflict (conversation_id, user_id) do nothing;
  end if;
  if new.participant_2 is not null then
    insert into public.conversation_participants (conversation_id, user_id, role)
    values (new.id, new.participant_2, 'member')
    on conflict (conversation_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_sync_conversation_participants
after insert or update of participant_1, participant_2 on public.conversations
for each row execute function public.sync_conversation_participants_from_legacy();

-- Backfill existing 1:1 conversations.
insert into public.conversation_participants (conversation_id, user_id, role)
select id, participant_1, 'member' from public.conversations where participant_1 is not null
on conflict (conversation_id, user_id) do nothing;

insert into public.conversation_participants (conversation_id, user_id, role)
select id, participant_2, 'member' from public.conversations where participant_2 is not null
on conflict (conversation_id, user_id) do nothing;

-- 4. conversation_participants RLS: view-only for members, no client writes.
create policy "Members can view participant rows for their conversations"
on public.conversation_participants for select
using (
  exists (
    select 1 from public.conversation_participants cp2
    where cp2.conversation_id = conversation_participants.conversation_id
      and cp2.user_id = auth.uid()
  )
);

-- 5. Rewrite conversations/messages RLS to check membership via
--    conversation_participants instead of participant_1/participant_2.
drop policy "Users can view their own conversations" on public.conversations;
drop policy "Users can update their own conversations" on public.conversations;
drop policy "Users can create conversations" on public.conversations;

create policy "Members can view their conversations"
on public.conversations for select
using (
  exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
  )
);

create policy "Members can update their conversations"
on public.conversations for update
using (
  exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
  )
);

create policy "Users can create their own 1:1 conversations"
on public.conversations for insert
with check (
  is_group = false and (auth.uid() = participant_1 or auth.uid() = participant_2)
);

drop policy "Users can view messages from their conversations" on public.messages;
drop policy "Users can create messages in their conversations" on public.messages;

create policy "Members can view messages in their conversations"
on public.messages for select
using (
  exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
  )
);

create policy "Members can send messages in their conversations"
on public.messages for insert
with check (
  auth.uid() = sender_id
  and exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
  )
);

-- 6. Atomic group-conversation creation RPC. Minimum group size: 3 total
--    participants (creator/admin + at least 2 other members).
create or replace function public.create_group_conversation(
  p_name text,
  p_description text,
  p_avatar_url text,
  p_member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
  v_members uuid[];
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Group name is required';
  end if;

  select array_agg(distinct m) into v_members
  from unnest(coalesce(p_member_ids, '{}')) as m
  where m is not null and m <> auth.uid();

  if v_members is null or array_length(v_members, 1) < 2 then
    raise exception 'A group needs at least 2 other members';
  end if;

  insert into public.conversations (is_group, group_name, group_description, group_avatar_url, created_by)
  values (true, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), p_avatar_url, auth.uid())
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, user_id, role)
  values (v_conversation_id, auth.uid(), 'admin');

  insert into public.conversation_participants (conversation_id, user_id, role)
  select v_conversation_id, m, 'member' from unnest(v_members) as m;

  return v_conversation_id;
end;
$$;

grant execute on function public.create_group_conversation(text, text, text, uuid[]) to authenticated;
