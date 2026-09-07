-- User-directed policy change: every email category should default OFF,
-- not just job_alert_emails. Sending unsolicited "message"/"network" emails
-- to accounts that never explicitly opted in is not appropriate, even if
-- in-app notifications for those categories are on. email_notifications_enabled
-- (the master switch) also flips to false-by-default so a brand-new/existing
-- row grants nothing until the user visits Settings and opts in.
--
-- This changes the COLUMN DEFAULT for future rows/back-fills only; it also
-- explicitly resets every existing profile's values to false so no account
-- silently retains an opt-in it never asked for.
alter table public.profiles
  alter column email_notifications_enabled set default false,
  alter column application_emails set default false,
  alter column message_emails set default false,
  alter column network_emails set default false;
  -- job_alert_emails and marketing_emails were already false-by-default; unchanged.

update public.profiles set
  email_notifications_enabled = false,
  application_emails = false,
  message_emails = false,
  network_emails = false;
