-- WhatsApp-style message actions foundation for 1:1 conversations.
-- Reuses the existing public.messages / public.conversations tables. Every
-- new table is scoped by RLS to the participants of the message's
-- conversation -- same rule the existing messages SELECT policy uses.

-- helper: is auth.uid() a participant of the conversation that owns p_message_id
create or replace function public._msg_is_participant(p_message_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    where m.id = p_message_id
      and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
  );
$$;
revoke all on function public._msg_is_participant(uuid) from public, anon;
grant execute on function public._msg_is_participant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- messages: reply + soft-delete
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null,
  add column if not exists deleted_for_everyone boolean not null default false;

create index if not exists idx_messages_reply_to on public.messages(reply_to_id) where reply_to_id is not null;

-- ---------------------------------------------------------------------------
-- message_reactions  (one emoji per user per message, WhatsApp-style)
-- ---------------------------------------------------------------------------
create table if not exists public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);
create index if not exists idx_message_reactions_message on public.message_reactions(message_id);
alter table public.message_reactions enable row level security;

create policy "reactions: participants can read"
  on public.message_reactions for select
  using (public._msg_is_participant(message_id));

create policy "reactions: own + participant can add"
  on public.message_reactions for insert
  with check (user_id = auth.uid() and public._msg_is_participant(message_id));

create policy "reactions: own can change"
  on public.message_reactions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public._msg_is_participant(message_id));

create policy "reactions: own can remove"
  on public.message_reactions for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- starred_messages  (private per-user bookmark)
-- ---------------------------------------------------------------------------
create table if not exists public.starred_messages (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);
create index if not exists idx_starred_messages_user on public.starred_messages(user_id);
create index if not exists idx_starred_messages_message on public.starred_messages(message_id);
alter table public.starred_messages enable row level security;

create policy "stars: own only, read"
  on public.starred_messages for select
  using (user_id = auth.uid());

create policy "stars: own + participant, add"
  on public.starred_messages for insert
  with check (user_id = auth.uid() and public._msg_is_participant(message_id));

create policy "stars: own, remove"
  on public.starred_messages for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- pinned_messages  (shared, per-conversation; either participant may pin/unpin)
-- ---------------------------------------------------------------------------
create table if not exists public.pinned_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  pinned_by uuid not null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (conversation_id, message_id)
);
create index if not exists idx_pinned_messages_conversation on public.pinned_messages(conversation_id);
alter table public.pinned_messages enable row level security;

create policy "pins: participants can read"
  on public.pinned_messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
  ));

create policy "pins: participants can add"
  on public.pinned_messages for insert
  with check (
    pinned_by = auth.uid()
    and public._msg_is_participant(message_id)
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
    )
  );

create policy "pins: participants can remove"
  on public.pinned_messages for delete
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
  ));

-- realtime
alter publication supabase_realtime add table public.message_reactions;
alter publication supabase_realtime add table public.starred_messages;
alter publication supabase_realtime add table public.pinned_messages;
