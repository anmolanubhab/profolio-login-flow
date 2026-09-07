-- Phase 5: generalized, reusable email outbox -- NOT job-alert-specific, so
-- future email types (application updates, messages, connections, etc.)
-- can reuse this same infrastructure without a new table. Fully server-
-- only: RLS enabled with NO policies at all (default-deny for every role,
-- including authenticated) -- only SECURITY DEFINER functions (owner,
-- bypasses RLS) and the Edge Function (service-role client, also bypasses
-- RLS) ever touch this table. No client role can insert/read/send an
-- email job under any circumstance.
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_email text not null,
  email_type text not null,
  entity_type text,
  entity_id uuid,
  dedup_key text not null,
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','skipped')),
  attempt_count int not null default 0,
  next_attempt_at timestamptz not null default now(),
  sent_at timestamptz,
  failed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (dedup_key)
);

comment on table public.email_outbox is 'Phase 5: reusable email outbox/queue for ALL future transactional email types (job_alert now; application/message/network/etc. later), not job-alert-specific. Drained by process_pending_email_outbox() (pg_cron) -> send-job-alert-email Edge Function -> Resend. dedup_key enforces idempotency at the DB level.';

alter table public.email_outbox enable row level security;
-- Deliberately zero policies -- default-deny for every role.

revoke all on public.email_outbox from public, anon, authenticated;

create index idx_email_outbox_pending on public.email_outbox (next_attempt_at) where status = 'pending';
create index idx_email_outbox_user on public.email_outbox (user_id);
