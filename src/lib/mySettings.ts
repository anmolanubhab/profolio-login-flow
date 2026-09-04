import { supabase } from '@/integrations/supabase/client';

/**
 * The signed-in user's own settings columns.
 *
 * These columns (`preferences`, `expected_salary`, …) were revoked from a
 * direct `SELECT` on `public.profiles` for the `authenticated` role — column
 * grants are role-wide, so a revoke that stops another user from reading them
 * also stops the owner. `get_my_settings()` is a `SECURITY DEFINER` accessor
 * scoped to `auth.uid()`'s own row, so the owner can still read them while a
 * direct client query cannot.
 *
 * Writes are unaffected — `UPDATE (preferences)` is still granted and RLS
 * (`profiles_update_own`) still limits it to the caller's own row, so the
 * existing `.update({ preferences: … }).eq('user_id', uid)` calls stay as-is.
 */
export interface MySettingsRow {
  preferences: Record<string, unknown> | null;
  expected_salary: string | null;
  notice_period: string | null;
  open_to_roles: string[] | null;
  preferred_locations: string[] | null;
  job_type: string[] | null;
  autoplay_videos: boolean | null;
  allow_recruiter_search: boolean | null;
  allow_recruiter_profile_view: boolean | null;
  share_pdf_resume_with_recruiters: boolean | null;
  share_online_resume_with_recruiters: boolean | null;
  share_professional_links_with_recruiters: boolean | null;
  email_visibility: string | null;
  phone_visibility: string | null;
  connections_visibility: string | null;
  open_to_work_visibility: string | null;
}

/** Full settings row for the signed-in user, or null if not signed in. */
export async function fetchMySettings(): Promise<MySettingsRow | null> {
  const { data, error } = await supabase.rpc('get_my_settings');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as MySettingsRow | undefined) ?? null;
}

/** Just the `preferences` JSON for the signed-in user (`{}` when absent). */
export async function fetchMyPreferences(): Promise<Record<string, unknown>> {
  const row = await fetchMySettings();
  return (row?.preferences as Record<string, unknown> | null) ?? {};
}

/** One recorded change to an Advertising Data consent / personalisation toggle. */
export interface ConsentAuditEntry {
  signal_key: string;
  old_value: unknown;
  new_value: unknown;
  source: string;
  occurred_at: string;
}

/**
 * The signed-in user's consent-change history, newest first, via the owner-only
 * `get_my_consent_history()` accessor (scoped to `auth.uid()` server-side — no
 * user id is passed from the client, and the frontend never reads
 * `consent_audit_log` directly). Returns `[]` when there are no recorded
 * changes. `limit` maps to the RPC's `limit_n` (clamped to 1..1000 server-side).
 */
export async function fetchMyConsentHistory(limit = 1000): Promise<ConsentAuditEntry[]> {
  const { data, error } = await supabase.rpc('get_my_consent_history', { limit_n: limit });
  if (error) throw error;
  const rows = (data as Array<Record<string, unknown>> | null) ?? [];
  return rows.map((r) => ({
    signal_key: r.signal_key as string,
    old_value: r.old_value ?? null,
    new_value: r.new_value ?? null,
    source: r.source as string,
    occurred_at: r.occurred_at as string,
  }));
}

/**
 * Atomically deep-merge `patch` into the signed-in user's `profiles.preferences`
 * (via the `update_my_preferences_patch` RPC). The merge happens server-side
 * against the CURRENT row, so two settings writers touching different keys can
 * never silently overwrite each other — replaces the old
 * read-blob → merge-in-JS → write-whole-blob pattern.
 *
 * `patch` is just the delta, e.g. `{ notifications: { jobs: false } }` or
 * `{ data_use: { connections: false } }` or `{ mentions_from: 'nobody' }`.
 * Returns the merged `preferences` object.
 */
export async function patchMyPreferences(
  patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('update_my_preferences_patch', {
    patch: patch as never,
  });
  if (error) throw error;
  return (data as Record<string, unknown> | null) ?? {};
}
