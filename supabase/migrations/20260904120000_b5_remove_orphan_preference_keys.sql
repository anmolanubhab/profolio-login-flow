-- B5: remove orphan keys from profiles.preferences.
--
-- These six top-level keys were written by the old src/pages/AccountPreferences.tsx
-- settings screen, which was deleted when the Settings tree was rebuilt. Audit
-- (repo grep + git history + every SECURITY DEFINER function body that reads
-- `preferences` + full DB scan) confirms they now have:
--   * no reader (frontend / hook / RPC / trigger / edge function)
--   * no writer
--   * no user-facing UI
--   * no current or planned feature
-- They are only stale values in existing rows, and they pollute the owner's
-- GDPR data export (get_my_settings returns the whole blob) as if they were
-- live settings. `app_lock_enabled` is also mild account recon.
--
-- Removed keys and the values they held at migration time (for the record):
--   17cd516a-871a-4b4f-bd1e-925320626454:
--     app_lock_enabled=true, hide_profile_strength=true, sound_effects=true,
--     push_notifications=true,
--     localization={"region":"IN","language":"en"},
--     job_preferences={"roles":[],"job_type":[],"locations":[],"experience_level":"entry"}
--   eae73434-faba-4e37-b6fc-e454b7571c1c:
--     hide_profile_strength=true, push_notifications=true
--
-- Idempotent (`jsonb - text[]` is a no-op when the keys are absent), touches
-- only rows that currently carry at least one of the keys, deletes no rows,
-- and preserves every other preference key. Re-running matches zero rows.

update public.profiles
set preferences = preferences - array[
  'app_lock_enabled',
  'hide_profile_strength',
  'sound_effects',
  'push_notifications',
  'localization',
  'job_preferences'
]
where preferences ?| array[
  'app_lock_enabled',
  'hide_profile_strength',
  'sound_effects',
  'push_notifications',
  'localization',
  'job_preferences'
];
