-- Phase 5: explicit, category-level email consent. Per explicit product
-- decision: email consent is NEVER inferred from open_to_work/actively_looking
-- or from existing in-app notification preferences -- these are fresh,
-- separate toggles. job_alert_emails and marketing_emails default OFF
-- (genuine opt-in required); the others default ON to match how in-app
-- notifications already behave by default, but can be turned off per user.
alter table public.profiles
  add column if not exists email_notifications_enabled boolean not null default true,
  add column if not exists job_alert_emails boolean not null default false,
  add column if not exists application_emails boolean not null default true,
  add column if not exists message_emails boolean not null default true,
  add column if not exists network_emails boolean not null default true,
  add column if not exists marketing_emails boolean not null default false;

comment on column public.profiles.email_notifications_enabled is 'Phase 5: master email switch. When false, no category email is ever sent regardless of the per-category toggles below.';
comment on column public.profiles.job_alert_emails is 'Phase 5: explicit opt-in for strong-job-match emails. Deliberately NOT inferred from open_to_work/actively_looking or in-app notification prefs -- defaults false.';
comment on column public.profiles.application_emails is 'Phase 5: application status / hiring pipeline emails.';
comment on column public.profiles.message_emails is 'Phase 5: new direct message emails.';
comment on column public.profiles.network_emails is 'Phase 5: connection request / network activity emails.';
comment on column public.profiles.marketing_emails is 'Phase 5: promotional/marketing emails. Defaults false.';
