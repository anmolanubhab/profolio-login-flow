
create table if not exists public.saved_jobs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, job_id)
);

alter table public.saved_jobs enable row level security;

create policy "Users can view their own saved jobs"
  on public.saved_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own saved jobs"
  on public.saved_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own saved jobs"
  on public.saved_jobs for delete
  using (auth.uid() = user_id);
