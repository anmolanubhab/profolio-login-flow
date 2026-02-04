create table if not exists public.story_likes (
  id uuid default gen_random_uuid() primary key,
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(story_id, user_id)
);

alter table public.story_likes enable row level security;

create policy "Users can view story likes"
  on public.story_likes for select
  using (true);

create policy "Users can toggle their own likes"
  on public.story_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own likes"
  on public.story_likes for delete
  using (auth.uid() = user_id);
