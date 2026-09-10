-- Increment 2: Forward message + true per-user "Delete for me".
-- Builds on 20260910111532_message_actions_foundation.sql. Reuses the
-- public._msg_is_participant(uuid) helper defined there. No existing RLS
-- is weakened -- message_deletions is a private per-user side table, and
-- messages.is_forwarded is a harmless boolean flag.

-- ---------------------------------------------------------------------------
-- messages: forwarded flag
-- ---------------------------------------------------------------------------
alter table public.messages
  add column if not exists is_forwarded boolean not null default false;

-- ---------------------------------------------------------------------------
-- message_deletions  (true per-user "delete for me"; never touches messages)
-- ---------------------------------------------------------------------------
create table if not exists public.message_deletions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  deleted_at timestamptz not null default now(),
  unique (message_id, user_id)
);
create index if not exists idx_message_deletions_user on public.message_deletions(user_id);
create index if not exists idx_message_deletions_message on public.message_deletions(message_id);
alter table public.message_deletions enable row level security;

create policy "deletions: own, read"
  on public.message_deletions for select
  using (user_id = auth.uid());

create policy "deletions: own + participant, add"
  on public.message_deletions for insert
  with check (user_id = auth.uid() and public._msg_is_participant(message_id));

create policy "deletions: own, remove"
  on public.message_deletions for delete
  using (user_id = auth.uid());

-- realtime
alter publication supabase_realtime add table public.message_deletions;
