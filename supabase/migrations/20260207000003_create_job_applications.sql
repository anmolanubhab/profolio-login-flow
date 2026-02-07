
create table if not exists public.job_applications (
  id uuid not null default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  resume_id uuid references public.resumes(id) on delete set null,
  cover_note text,
  status text not null default 'applied' check (status in ('applied', 'viewed', 'shortlisted', 'rejected')),
  created_at timestamptz not null default now(),
  constraint job_applications_pkey primary key (id),
  constraint job_applications_user_job_unique unique (user_id, job_id)
);

alter table public.job_applications enable row level security;

create policy "Users can view their own applications"
on public.job_applications for select
using (auth.uid() = user_id);

create policy "Users can create their own applications"
on public.job_applications for insert
with check (auth.uid() = user_id);

-- Optional: If we want to allow users to update their application (e.g. withdraw?)
-- For now, just select and insert as per requirements.
