-- Consent Audit Log / Record of Consent
--
-- Purpose: keep an auditable, per-user history of changes to Advertising Data
-- consent / personalisation preferences. This is NOT an advertising system and
-- activates no ad provider, tracking, measurement, billing or Ads Manager code.
-- It records ONLY the user's own preference toggles.
--
-- Audited signals (10) -- every one is written through exactly one function,
-- public.update_my_preferences_patch(jsonb); nothing else writes them:
--   data_use.connections          (Advertising data -> "Connections")
--   data_use.companies_followed   (Advertising data -> linked row)
--   data_use.groups
--   data_use.education_skills
--   data_use.job_information
--   data_use.employer
--   data_use.profile_location
--   data_use.ads_off_profolio     (future row; disabled switch, no writer yet)
--   data_use.measure_ad_success   (future row; disabled switch, no writer yet)
--   personalized_recommendations  (Advertising data -> "Interests and traits";
--                                  single canonical writer since B4)
--
-- NOT audited here (deliberately): mentions_from, show_active_status,
-- share_profile_updates, notifications.*, last_profile_update_broadcast_at, and
-- the profile-visibility / recruiter-sharing columns. Those are a separate
-- Visibility domain, several are written as direct profiles column updates
-- rather than through the preferences RPC, and none is an advertising or
-- personalisation consent. They can get their own log later if needed.
--
-- One row per real change of one signal. We never store the whole preferences
-- blob -- only { signal_key, old_value, new_value }.

create table public.consent_audit_log (
  id             uuid primary key default gen_random_uuid(),
  -- Identity is always the server's auth.uid(); the client never supplies it.
  user_id        uuid not null references auth.users (id) on delete cascade,
  -- Dotted path of the single changed signal, e.g. 'data_use.connections'.
  signal_key     text not null,
  -- Previous / new JSON value of just that signal. old_value is null when the
  -- signal had never been set. new_value is always present for a real change.
  old_value      jsonb,
  new_value      jsonb not null,
  -- Context of the change. Only 'settings_patch' exists today; leaves room for
  -- 'admin', 'import', 'account_reset' etc. without a schema change.
  source         text not null default 'settings_patch',
  -- Bumped only if the stored value representation ever changes.
  schema_version smallint not null default 1,
  occurred_at    timestamptz not null default now(),
  constraint consent_audit_log_signal_key_check check (
    signal_key in (
      'data_use.connections',
      'data_use.companies_followed',
      'data_use.groups',
      'data_use.education_skills',
      'data_use.job_information',
      'data_use.employer',
      'data_use.profile_location',
      'data_use.ads_off_profolio',
      'data_use.measure_ad_success',
      'personalized_recommendations'
    )
  )
);

comment on table public.consent_audit_log is
  'Per-user history of Advertising Data consent / personalisation toggle changes. Written only by update_my_preferences_patch() in the same transaction as the preference update. Readable by the owning user only.';

create index consent_audit_log_user_time_idx
  on public.consent_audit_log (user_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Privileges + RLS
--
-- anon: nothing. authenticated: SELECT own rows only, via RLS. No INSERT /
-- UPDATE / DELETE policy exists for any client role, so a user can never forge,
-- alter or erase consent history. The only writer is the SECURITY DEFINER
-- function update_my_preferences_patch (definer = postgres), which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.consent_audit_log enable row level security;

revoke all on table public.consent_audit_log from anon, authenticated;
grant select on table public.consent_audit_log to authenticated;

create policy "consent_audit_log: owner can read own history"
  on public.consent_audit_log
  for select
  to authenticated
  using (user_id = auth.uid());

-- Documented read contract (mirrors get_my_settings()). The RLS policy above is
-- sufficient on its own; this accessor gives the frontend a stable, typed call
-- and a natural place to bound the row count.
create or replace function public.get_my_consent_history(limit_n integer default 200)
returns setof public.consent_audit_log
language sql
stable
security definer
set search_path to ''
as $$
  select *
  from public.consent_audit_log
  where user_id = auth.uid()
  order by occurred_at desc
  limit greatest(1, least(coalesce(limit_n, 200), 1000));
$$;

revoke all on function public.get_my_consent_history(integer) from public, anon;
grant execute on function public.get_my_consent_history(integer) to authenticated;
