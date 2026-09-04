# Advertising Data privacy hardening — Steps 1–3 implementation report

**Date:** 2026-09-04
**Scope:** `profiles` public-read surface only. `user_settings` table, RMW-race fix, dedup, orphan-key cleanup, ad rewiring, `SettingsRow` — **not touched** (separate tasks). `advertisingDataConfig.ts` / `useAdvertisingDataSettings.ts` (behaviour) / `AdvertisingDataDetailPage.tsx` / `advertisingDataSummary.ts` — **not redesigned** (the only edit to `useAdvertisingDataSettings.ts` is a mechanical read-path swap, pre-approved in the Step-3 scope question).

---

## 1. Dependency inventory (Step 1)

Searched every `.from('profiles')` in `src/` (122 sites), every embedded `profiles(...)` join (14), and every `SECURITY DEFINER` function referencing `profiles` (53).

**Key facts that shaped the fix**

| Fact | Consequence |
|---|---|
| No logged-out profile view exists (every route behind `RequireAal2`; `ProfilePage` redirects logged-out users) | `anon` can lose `profiles` **entirely** |
| Postgres column privileges are **role-wide**, not row-scoped | revoking a column from `authenticated` also blocks the **owner** → needs `get_my_settings()` |
| Column-level restriction only applies when the role has **no table-level SELECT** | must `REVOKE SELECT ON TABLE ... FROM authenticated` then `GRANT SELECT (safe cols)` — and `SELECT *` then errors, so `select('*')` call sites had to change |
| All 53 SECURITY DEFINER functions read `profiles` as `postgres` | `search_people`, `get_profile_contact_info`, `list_followers`, every `notify_*` trigger, recruiter RPCs, ad audience matching — **all unaffected** |

**Non-owner direct reads of `profiles`**

| # | Site | Columns | Sensitive? | Action |
|---|---|---|---|---|
| N1 | `ProfilePage.tsx:230` | `*` | **yes** (`preferences`, `expected_salary`, `notice_period`, recruiter flags, `*_visibility`) | → `get_public_profile()` RPC |
| N2 | `use-mention-search.ts:59` | `id, display_name, avatar_url, profession, preferences` (uses only `.mentions_from`) | **yes** (`preferences`) | → `search_mentionable_people()` RPC |
| N3 | `ChatInterface.tsx:239` | `…, email, …` (Connect "search by email") | `email` | `email` **kept granted** — see §6 |
| N4–N19 | Feed / comments / notifications / stories / interviews / search / etc. | narrow safe columns only (`id, user_id, display_name, avatar_url, profession, headline, last_name_visibility`) | no | none |

**Owner direct reads of sensitive columns** — all `.eq('user_id', me)`: `useProfileSettings` (init + `updatePrefKey`), `useNotificationPreferences` (×2), `usePersonalization`, `useAdvertisingDataSettings` (×3), `DownloadDataPage` (`select('*')`), `ProfilePage` self-branch (`select('*')`). → all repointed to `get_my_settings()` / explicit safe-column lists.

---

## 2. Safe public-profile column set

**Returned by `get_public_profile()`** (display-safe): `id, user_id, display_name, full_name, headline, profession, avatar_url, photo_url, cover_url, cover_position, bio, location, pronouns, open_to_work, skills, projects, experience, education, achievements, website, linkedin_url, github_url, twitter_url, address, created_at, last_active_at, profile_visibility, photo_visibility, last_name_visibility, profile_discovery` + **derived** `show_active_status` (bool), `has_verified_email` (bool). Block / `private` / `connections_only`-not-connected → returns no row (mirrors the old RLS gate; uses `public.connections`, same table as `profiles_select_respecting_visibility` and `get_profile_contact_info`).

**Still granted to `authenticated` for a direct SELECT** (safe, and needed by narrow non-owner reads / owner UI): the 34 columns above **plus** `updated_at`, `email`, `phone`, `autoplay_videos`. (`email`/`phone` values on a profile are still gated by the existing `get_profile_contact_info`; here they cover the verified-badge presence check + Connect email search + owner's own edit dialog.)

**Revoked from `authenticated` entirely** (owner reads via `get_my_settings()`, other members never): `preferences`, `expected_salary`, `notice_period`, `open_to_roles`, `preferred_locations`, `job_type`, `allow_recruiter_search`, `allow_recruiter_profile_view`, `share_pdf_resume_with_recruiters`, `share_online_resume_with_recruiters`, `share_professional_links_with_recruiters`, `email_visibility`, `phone_visibility`, `connections_visibility`, `open_to_work_visibility`.

**`anon`:** all privileges on `public.profiles` revoked.

---

## 3. Migrations

Applied to project `ajbhpqbfcpmztjtxqxxk`; local files in `supabase/migrations/`:

| File | What / why |
|---|---|
| `20260904090000_profiles_public_read_accessors.sql` | Creates 3 `SECURITY DEFINER` functions, `set search_path = ''`, fully-qualified names, `EXECUTE` granted to `authenticated` only: **`get_public_profile(uuid)`** (foreign, safe columns + derived bools, block/visibility gate), **`get_my_settings()`** (caller's own owner-only columns), **`search_mentionable_people(text)`** (mention search honouring `mentions_from` + block + visibility server-side). RLS unchanged. |
| `20260904090100_profiles_lock_sensitive_columns.sql` | `REVOKE ALL ON public.profiles FROM anon`. `REVOKE SELECT ON public.profiles FROM authenticated`, then `GRANT SELECT (<34 safe columns>) TO authenticated`. INSERT/UPDATE/DELETE for `authenticated` kept (RLS-gated). RLS policy untouched. |
| `20260904090200_revoke_accessor_execute_from_anon.sql` | `REVOKE EXECUTE` on the 3 new functions `FROM anon` (Supabase default privileges had auto-granted them). |

*(The applied history shows 5 rows — during implementation two corrective migrations folded a `friend_requests`→`connections` fix and the table→column-grant fix into the versions above; the 3 local files are the consolidated final state and reproduce the current DB on a fresh `db reset`.)*

**Advisors:** no `function_search_path_mutable` for the new functions; no new `anon`-executable SECURITY DEFINER function; the 3 new `authenticated_security_definer_function_executable` INFO entries are the same intentional-accessor advisory carried by `get_profile_contact_info`, `search_people`, `list_followers`, etc.

---

## 4. `get_public_profile()` — security model

- `SECURITY DEFINER`, `STABLE`, `SET search_path = ''`, all identifiers schema-qualified.
- `EXECUTE`: `authenticated` only (revoked from `public` and `anon`).
- Resolves target by `id` **or** `user_id` (the `/profile/:id` route param can be either).
- Owner (`t.user_id = auth.uid()`) → full row of the returned columns.
- Non-owner: `is_blocked_by(target)` → no rows; `profile_visibility='private'` → no rows; `profile_visibility='connections_only'` and not an accepted `public.connections` link → no rows. Otherwise → the display-safe columns.
- Never selects/returns `preferences`, `email`, `phone`, `expected_salary`, `notice_period`, recruiter flags or `*_visibility`. `show_active_status` = `coalesce((preferences->>'show_active_status')::bool, true)`; `has_verified_email` = `email IS NOT NULL AND trim <> ''`.
- Reads only `profiles`, `connections`, `blocked_users` (all already reachable through existing SD helpers). No new table exposed.

---

## 5. Privilege changes

**`anon`** — `REVOKE ALL PRIVILEGES ON TABLE public.profiles`. `REVOKE EXECUTE` on `get_public_profile`, `get_my_settings`, `search_mentionable_people`.

**`authenticated`** — `REVOKE SELECT ON TABLE public.profiles`; `GRANT SELECT (<34 safe columns>)`. `INSERT` / `UPDATE` / `DELETE` unchanged (RLS `profiles_*_own` still gate them to `user_id = auth.uid()`; `UPDATE (preferences)` etc. retained so the settings writers work untouched). `EXECUTE` granted on the 3 new functions.

**`service_role`, `postgres`** — unchanged (edge functions + SD functions keep full access).

**RLS** — `profiles_select_respecting_visibility` and the other 3 policies are byte-for-byte unchanged.

---

## 6. Frontend changes

| File | Change |
|---|---|
| `src/lib/mySettings.ts` **(new)** | `fetchMySettings()` / `fetchMyPreferences()` — thin wrappers over `supabase.rpc('get_my_settings')`. |
| `src/integrations/supabase/types.ts` | Hand-added `Functions` entries for the 3 new RPCs (no full regen). |
| `src/components/profile/profileTypes.ts` | `ProfileRow` extended with optional `show_active_status` / `has_verified_email`; new `SELF_PROFILE_COLUMNS` constant (the 34 safe columns) for the owner's own fetch. |
| `src/components/profile/ProfilePage.tsx` | **self** branch: `select('*')` → `select(SELF_PROFILE_COLUMNS)` + `fetchMySettings()`, merged by a new `mergeOwnerProfile()` that also derives the two booleans. **insert-new-profile**: `select('*')` → `select(SELF_PROFILE_COLUMNS)`. **foreign** branch: `select('*').or(id/user_id)` → `supabase.rpc('get_public_profile', { target_profile_id })`; empty result → the existing "Profile not found" path (same as the old RLS-blocked-row behaviour). |
| `src/components/profile/ProfileHeaderCard.tsx` | `profile.preferences.show_active_status` → `profile.show_active_status`; `profile.email` (verified badge) → `profile.has_verified_email`. |
| `src/hooks/use-mention-search.ts` | Direct `profiles` select + client-side `mentions_from` / connection resolution → single `supabase.rpc('search_mentionable_people', { q })`. ~55 lines removed. |
| `src/hooks/useProfileSettings.ts` | init: revoked columns now come from `fetchMySettings()` (safe columns still direct); `updatePrefKey` read-before-write → `fetchMyPreferences()` (the `.update()` is unchanged). |
| `src/hooks/useNotificationPreferences.ts` | both `preferences` reads → `fetchMyPreferences()`. |
| `src/hooks/usePersonalization.ts` | `preferences` read → `fetchMyPreferences()`. |
| `src/hooks/useAdvertisingDataSettings.ts` | 3 `preferences` reads → `fetchMyPreferences()` (`id, location, skills` still selected directly). No behaviour/API change. |
| `src/pages/settings/DownloadDataPage.tsx` | GDPR export: `select('*')` → `select(SELF_PROFILE_COLUMNS)` + `fetchMySettings()`, recombined so the export still contains every field. |

`useAutoplayPreference.ts` **not changed** — `autoplay_videos` was deliberately left granted (not sensitive).

---

## 7. Security test results

Run against the live REST API (`/rest/v1`) with a real authenticated JWT and with the `anon` key, plus a `SET ROLE authenticated` PL/pgSQL block:

| Test | Expected | Result |
|---|---|---|
| **A** — anon `GET /profiles?select=display_name` | denied | **401** `permission denied for table profiles` |
| **A** — anon `GET /profiles?select=preferences` | denied | **401** |
| **A** — anon `POST /rpc/get_public_profile` / `get_my_settings` / `search_mentionable_people` | denied | **401** `permission denied for function` (all 3) |
| **B** — auth (User A) `GET /profiles?select=preferences&id=eq.<User B>` | denied | **403** `permission denied for table profiles` |
| **B** — auth `GET /profiles?select=expected_salary&id=eq.<User B>` | denied | **403** |
| **C** — auth `GET /profiles?select=preferences&user_id=eq.<self>` | denied (use RPC) | **403** |
| **C** — auth `POST /rpc/get_my_settings` | own settings returned | **200**, `preferences` + all owner-only columns |
| **D** — auth `GET /profiles?select=display_name,avatar_url,headline,address,website&id=eq.<User B>` | ok | **200** |
| **D** — auth `POST /rpc/get_public_profile { target: <User B> }` | safe columns only | **200**, no `preferences` / `email` / `expected_salary` in the payload |
| **E** — Advertising Data detail page footer | *"Only you can see and change this"* | now factually true (Test B confirms it) |

---

## 8. Regression results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint --max-warnings 0` (11 changed files + `types.ts`) | **0** |
| `npx vite build` | **success** (only the pre-existing >500 kB chunk advisory) |
| Supabase security advisors | no new `search_path` warning; no new anon exposure |
| Browser — **own profile** `/profile` | renders: name, "✓ Verified" (`has_verified_email`), "● Active now" (`show_active_status`), headline, location, "Open to work", "1 connection · 2 followers", Profile Strength 88% |
| Browser — **another member** `/profile/:id` | renders via `get_public_profile`: name, "✓ Verified", headline, "Connected / Following", tabs + sections; no console errors, `0` failed REST calls |
| Browser — **Settings → Visibility** | all controls populated from `get_my_settings()` (Email/Phone visibility = "Connections Only", Connections = "Private", recruiter toggles ON, Active status ON, Mentions = "Everyone") |
| Browser — toggle **Active status** off→on (`updatePrefKey` write path) | "Success" toast both ways, `0` failed REST calls, `preferences` sibling keys all preserved in the DB |
| Browser — **Settings → Advertising data** + detail page + **Connections toggle** off→on (`setDataUsePref` write path) | list shows real data ("1 connection", "Following 2 companies", "3 groups", "2 schools · 6 skills · 1 language"); toggle round-trips; `0` failed REST calls; DB `preferences` intact |
| Browser — **Network** (`/network`, uses `search_people`) | "People you may know" renders with mutual-connection count + masked name; no errors |
| Browser — **Feed** / dashboard | posts + author cards render (narrow safe-column selects); no `profiles` errors |
| Browser — mobile width (~375–549 px) + desktop | profile + settings render correctly at both |
| Test data | user `518b923b`'s `preferences` blob verified intact after all toggle tests (all sibling keys present; `show_active_status:true` added by a toggle test — semantically identical to its prior absent/default state). No rows deleted. |

*Note:* the harness's synthetic keystrokes into contenteditable/textarea fields were unreliable, so the `@mention` dropdown could not be driven through the UI; `search_mentionable_people` was verified returning **200 with correct results** via direct REST and the hook is a 3-line RPC call that type-checks and builds.

---

## 9. Remaining gaps (nothing hidden)

1. **`address` is still shown to any viewer** via `ContactInfoDialog`'s non-owner branch (reads `profile.address` from `get_public_profile`, ungated). It's returned by the accessor because the current UI renders it for everyone; arguably it should be folded into `get_profile_contact_info`'s visibility gating. **Not changed** — out of scope, no regression, flagged for a follow-up.
2. **`email` / `phone` remain SELECT-able by `authenticated`** on the raw table. Kept because (a) the verified badge checks presence, (b) Connect's "search people by email" (`ChatInterface.tsx:239`) filters on `email`. To make them fully owner-only, that Connect search must move to a `SECURITY DEFINER` RPC. **Not in scope** for Steps 1–3.
3. **`experience` / `education` / `projects` / `achievements` jsonb columns on `profiles`** are returned by the accessor (not sensitive) though the profile sections now mostly read dedicated tables — a later cleanup could drop the unused columns.
4. **`@mention` end-to-end UI test** not completed in the harness (see §8 note); RPC verified via REST.
5. The DB `preferences` blob still contains the orphan keys `job_preferences`, `app_lock_enabled`, `localization` (B5 from the gap analysis) — **not touched**, that's a separate task; they are no longer readable by any non-owner client after this change.
6. The read-modify-write race on `preferences` (B3) is **unchanged** — `fetchMyPreferences()` is still a read-then-write; it's now one RPC hop instead of a direct select, same concurrency profile. The `user_settings` refactor (deferred) is what removes it.

---

## Acceptance criterion

> *A public/other-user client can no longer read `profiles.preferences`, `expected_salary`, `notice_period`, or any other sensitive profile field through the direct `profiles` table, while public profile rendering continues to work.*

**Met.** Tests A/B/C confirm `anon` (401) and authenticated non-owner **and** owner (403) are all denied a direct SELECT of `preferences` / `expected_salary` / `notice_period` / the recruiter flags / the `*_visibility` columns. Tests D + the browser run confirm own and foreign profiles, all settings pages, the Advertising Data page and its toggles, Network and Feed still work. `tsc` / `eslint` / `vite build` are clean.
