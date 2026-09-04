# B5 (orphan preference keys) + B6 (server-side preference validation)

**Date:** 2026-09-04
**Scope:** `profiles.preferences` orphan cleanup + validation inside `update_my_preferences_patch` **only**. No frontend changes. Not touched: `advertisingDataConfig.ts`, `AdvertisingDataDetailPage.tsx`, `advertisingDataSummary.ts`, `get_public_profile()`, `get_my_settings()`, `search_people` consent logic, Feed personalization, the profiles privilege hardening, the B3 atomic-merge flow.

---

## 1. Complete preference schema inventory

Sources checked: every `.from('profiles')` / `preferences` reference in `src/`, all 4 settings hooks + `notificationCategories.ts` + `mySettings.ts` + `profileNav.ts`, all 6 `SECURITY DEFINER` functions whose body references `preferences`, all `supabase/migrations/*.sql`, all `supabase/functions/*`, git history (`git log -S`), and a full scan of `profiles.preferences` in the live DB (3 rows).

| Preference path | In DB? | Read by | Written by | User-facing? | Required? | Action |
|---|---|---|---|---|---|---|
| `mentions_from` | no live row (default used) | `useProfileSettings` init; `search_mentionable_people` RPC (other users) | `useProfileSettings.updateMentionsFrom` → `updatePrefKey` → `patchMyPreferences` | Yes — Visibility → Mentions & tags | **Yes** | **KEEP** |
| `show_active_status` | 1 row | `useProfileSettings` init; `ProfilePage.mergeOwnerProfile`; `ProfileHeaderCard`; `get_public_profile` RPC (other users) | `useProfileSettings.toggleShowActiveStatus` | Yes — Visibility → Active status | **Yes** | **KEEP** |
| `share_profile_updates` | no live row | `useProfileSettings` init; `broadcast_profile_update` RPC | `useProfileSettings.toggleShareProfileUpdates` | Yes — Visibility → Share profile updates | **Yes** | **KEEP** |
| `last_profile_update_broadcast_at` | no live row | `broadcast_profile_update` RPC (24 h throttle) | `broadcast_profile_update` RPC (`jsonb_set` in SET expr) | No — internal throttle marker | **Yes** | **KEEP** |
| `personalized_recommendations` | 1 row | `useAdvertisingDataSettings` init; `usePersonalization` → `Feed.tsx:428` | `useAdvertisingDataSettings.setPersonalizedRecommendations` | Yes — Advertising data → Interests and traits | **Yes** | **KEEP** |
| `data_use` (object) | 1 row | `useAdvertisingDataSettings.mergePrefs` | `useAdvertisingDataSettings.setDataUsePref` | Yes — Advertising data rows | **Yes** | **KEEP** |
| `data_use.connections` | 1 row | `useAdvertisingDataSettings`; **`search_people` RPC** (Grow ranking gate) | `setDataUsePref('connections')` | Yes | **Yes** | **KEEP** |
| `data_use.companies_followed` / `groups` / `education_skills` / `job_information` / `employer` / `profile_location` | not yet written | `useAdvertisingDataSettings` (settings screen) | `setDataUsePref(<key>)` | Yes — Advertising data rows (Step-6 honest copy) | **Yes** (stored consent) | **KEEP** |
| `data_use.ads_off_profolio` / `measure_ad_success` | not written (control disabled) | `useAdvertisingDataSettings.mergePrefs` (default `false`) | — (`future` rows, disabled switch) | Yes — future rows | **Yes** (reserved) | **KEEP** |
| `notifications` (object) | 1 row | `useNotificationPreferences`; `notificationCategories.mutedNotificationTypes` | `useNotificationPreferences.setCategory` | Yes — Notifications settings | **Yes** | **KEEP** |
| `notifications.{jobs,network,insights,mentions,messages,profile_activity,reactions_comments}` | 1 row | `useNotificationPreferencesValue` → `NotificationBell` filter | `setCategory(<key>)` | Yes | **Yes** | **KEEP** |
| **`app_lock_enabled`** | 1 row (`=true`) | **none** | **none** | **no** — from deleted `AccountPreferences.tsx` | **No** | **CLEANUP** |
| **`hide_profile_strength`** | 2 rows (`=true`) | **none** | **none** | **no** | **No** | **CLEANUP** |
| **`sound_effects`** | 1 row (`=true`) | **none** | **none** | **no** | **No** | **CLEANUP** |
| **`push_notifications`** | 2 rows (`=true`) | **none** — Notifications settings only has the 7 `notifications.*` categories | **none** | **no** | **No** | **CLEANUP** |
| **`localization`** (obj: `language`, `region`) | 1 row (`{IN,en}`) | **none** — Appearance uses `next-themes` (localStorage); no i18n system in the repo | **none** | **no** | **No** | **CLEANUP** |
| **`job_preferences`** (obj: `roles`, `job_type`, `locations`, `experience_level`) | 1 row (empty arrays) | **none** — job search reads the top-level `open_to_roles` / `preferred_locations` / `job_type` **columns**, not this key | **none** | **no** | **No** | **CLEANUP** |

The 6 SECURITY DEFINER functions that touch `preferences`: `broadcast_profile_update` (r/w `share_profile_updates`, `last_profile_update_broadcast_at`), `get_my_settings` (returns whole blob, owner), `get_public_profile` (`show_active_status`), `search_mentionable_people` (`mentions_from`), `search_people` (`data_use.connections`), `update_my_preferences_patch` (writer). **None reference any CLEANUP key.**

---

## 2. B5 orphan-key findings

| Candidate | Live UI? | Live reader? | Live writer? | In any RPC/fn? | Needed by a feature? | Just stale data? | Verdict |
|---|---|---|---|---|---|---|---|
| `job_preferences` | No (`AccountPreferences.tsx` deleted) | No | No | No | No — job search uses top-level columns | Yes (1 row, empty arrays) | **CLEANUP** |
| `app_lock_enabled` | No | No | No | No | No — no app-lock feature, no native shell (no Capacitor/android/ios) | Yes (1 row) | **CLEANUP** |
| `localization` | No | No | No | No | No — Appearance = `next-themes`; no i18n dep (`grep i18next\|react-i18next` = 0) | Yes (1 row) | **CLEANUP** |
| `hide_profile_strength` | No | No (`ProfileStrength` / `useProfileStrength` have no hide/dismiss logic) | No | No | No | Yes (2 rows) | **CLEANUP** |
| `sound_effects` | No | No | No | No | No | Yes (1 row) | **CLEANUP** |
| `push_notifications` | No | No (Notifications settings only has 7 `notifications.*`) | No | No | No | Yes (2 rows) | **CLEANUP** |

**Evidence:** `grep -rn '<key>' src supabase` = **0 hits** for every candidate; `git log -S '<key>'` shows all 6 last lived in `src/pages/AccountPreferences.tsx`, which was **removed** when the Settings tree was rebuilt (`AccountSettings.tsx` / `NotificationsSettings.tsx` / `VisibilitySettings.tsx` do not carry them); no migration ever created or maintained them; not in any of the 6 preference-touching functions; not in any edge function.

---

## 3. B5 migration

**Options weighed:** (A) delete the keys from existing rows; (B) stop writing/exposing but keep the values; (C) migrate elsewhere.
(C) has no target — no current or planned feature wants this data. (B) is already the de-facto state (no code touches them) but leaves the stale values in the owner's row where `get_my_settings()` surfaces them in the GDPR export as if they were live settings, and `app_lock_enabled` is mild recon. So **(A)** — remove the 6 confirmed-orphan keys.

**`20260904120000_b5_remove_orphan_preference_keys.sql`**
```sql
update public.profiles
set preferences = preferences - array['app_lock_enabled','hide_profile_strength',
  'sound_effects','push_notifications','localization','job_preferences']
where preferences ?| array['app_lock_enabled','hide_profile_strength',
  'sound_effects','push_notifications','localization','job_preferences'];
```
- **Rows affected: 2** (`17cd516a` — 6 keys removed; `eae73434` — `hide_profile_strength` + `push_notifications` removed). `139fe3c2` had `{}`, untouched.
- **No rows deleted.** Only the named top-level keys removed; every other key preserved.
- **Idempotent** — `jsonb - text[]` is a no-op when keys are absent; the `WHERE` matches 0 rows on re-run.
- **Removed values recorded** in the migration header for auditability.

**Post-migration verification (live):**

| row | remaining `preferences` keys | still has any orphan? |
|---|---|---|
| `139fe3c2` | `{}` | no |
| `17cd516a` (owner) | `data_use`, `notifications`, `show_active_status`, `personalized_recommendations` | no |
| `eae73434` | `{}` | no |

---

## 4. B6 validation schema

`update_my_preferences_patch(patch)` now calls `public._assert_valid_preference_patch(patch)` (raises `errcode 22023` → HTTP 400) **before** the atomic deep-merge.

**Accepted `patch` shape** (every key optional; the patch is a delta, not the whole blob):

| Key | Type | Constraint |
|---|---|---|
| `mentions_from` | string | one of `everyone` \| `connections` \| `nobody` |
| `show_active_status` | boolean | — |
| `share_profile_updates` | boolean | — |
| `personalized_recommendations` | boolean | — |
| `last_profile_update_broadcast_at` | string | ISO timestamp (normally written by `broadcast_profile_update`, not this RPC) |
| `data_use` | object | every key ∈ `{connections, companies_followed, groups, education_skills, job_information, employer, profile_location, ads_off_profolio, measure_ad_success}`; every value boolean |
| `notifications` | object | every key ∈ `{jobs, network, insights, mentions, messages, profile_activity, reactions_comments}`; every value boolean |

Also: `pg_column_size(patch) ≤ 8192` bytes. Unknown top-level keys and unknown `data_use.*` / `notifications.*` sub-keys are **rejected**. Because only `data_use`/`notifications` may be objects and their values must be booleans, nesting depth is inherently bounded at 2.

**Forward compatibility — unknown keys are rejected, not passed through.** Rationale: adding a setting is always a code change (a new hook/field), so the same change-set adds a one-line array entry in a follow-up migration. This keeps the stored blob exactly the shape the app understands and makes the B5 orphans (and any "arbitrary sensitive structure") impossible to re-introduce through the RPC. A pass-through-unknown-keys design would have re-allowed exactly the junk B5 just cleaned.

**`_assert_valid_preference_patch`** is `revoke all ... from public, anon, authenticated` — only the SD RPC calls it (as `postgres`). `_jsonb_deep_merge` remains locked from `authenticated` (from B3).

---

## 5. Invalid-input test results (live REST, authenticated)

| Input | Status | Message |
|---|---|---|
| `patch = null` | **400** | preferences patch must be a JSON object |
| `patch = []` | **400** | preferences patch must be a JSON object |
| `patch = "hello"` | **400** | preferences patch must be a JSON object |
| `patch = 123` | **400** | preferences patch must be a JSON object |
| `{ app_lock_enabled: true }` (B5 orphan) | **400** | unknown preference key: app_lock_enabled |
| `{ evil: {a:{b:{c:1}}} }` (arbitrary nested object) | **400** | unknown preference key: evil |
| `{ show_active_status: "true" }` | **400** | preference "show_active_status" must be a boolean |
| `{ data_use: { connections: "false" } }` | **400** | data_use."connections" must be a boolean |
| `{ data_use: { hack: true } }` | **400** | unknown data_use key: hack |
| `{ notifications: { spam: false } }` | **400** | unknown notifications key: spam |
| `{ notifications: { jobs: 1 } }` | **400** | notifications."jobs" must be a boolean |
| `{ mentions_from: "anyone" }` | **400** | mentions_from must be one of: everyone, connections, nobody |
| `{ data_use: true }` | **400** | data_use must be an object |
| `{ data_use: { connections: { nested: true } } }` (deep inject) | **400** | data_use."connections" must be a boolean |

No partial write on any rejection — validation raises before the `UPDATE`.

**Valid inputs (all → 200, correct merge):** every `data_use.*` key (9/9), every `notifications.*` key (7/7), `show_active_status`, `share_profile_updates`, `personalized_recommendations`, `mentions_from`.

---

## 6. Atomic concurrency test — B3 still works with B6 in place

Two simultaneous `Promise.all` calls with the validator active:
- A: `{ data_use: { connections: false } }`
- B: `{ notifications: { jobs: false } }`

→ both **200**; read-back: `data_use.connections = false` **and** `notifications.jobs = false` — both disjoint updates survived (`both_disjoint_survived: true`). The flow is still `client → RPC(patch) → validate → deep-merge against CURRENT row → update own row`; no client read-modify-write reintroduced.

---

## 7. Security regression

| Check | Result |
|---|---|
| anon `POST /rpc/update_my_preferences_patch` | **401** permission denied for function |
| anon direct `GET /profiles?select=preferences` | **401** permission denied for table |
| `has_function_privilege(anon, update_my_preferences_patch)` | **false** |
| `has_function_privilege(anon/authenticated, _assert_valid_preference_patch)` | **false / false** |
| `has_function_privilege(authenticated, _jsonb_deep_merge)` | **false** (still locked) |
| RPC signature | `patch jsonb` only — **no `target_user_id`**; writes `where user_id = auth.uid()` → User B cannot modify User A |
| `has_column_privilege(anon, profiles, preferences, SELECT)` | **false** |
| `has_column_privilege(authenticated, profiles, preferences, SELECT)` | **false** |
| `has_column_privilege(authenticated, profiles, expected_salary, SELECT)` | **false** |
| `has_table_privilege(anon, profiles, SELECT)` | **false** |
| RLS policies on `profiles` | unchanged |

Steps 1–3 privilege model fully intact; non-owners still cannot read or modify preferences.

---

## 8. Build / browser regression

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** (no frontend change; run anyway) |
| `npx vite build` | **success** (only the pre-existing >500 kB chunk advisory) |
| ESLint | n/a — no `src/` files changed |
| Settings → Notifications → toggle Mentions OFF→ON via UI | round-trips through the validated RPC, no console error |
| Advertising data → Connections → toggle OFF→ON via UI | round-trips, no console error |
| Advertising data list + detail pages | render; live data summaries intact |
| Feed → For You | renders |
| Network → Grow | renders (`data_use.connections` still gates ranking) |
| mobile ≈375 px + desktop | settings + advertising render at both |
| DB after full test battery | owner `preferences` restored to the exact clean post-B5 baseline (4 keys); all 3 rows orphan-free |

---

## 9. Remaining gaps

1. **`broadcast_profile_update` writes `last_profile_update_broadcast_at` directly** (`jsonb_set` in its SET expression), bypassing `update_my_preferences_patch` and therefore the validator. This is intentional — it is a trusted server writer, already atomic, and `last_profile_update_broadcast_at` is in the validator's allow-list anyway so a future patch of it would also pass. No change.
2. **Adding a new setting requires a migration** to extend the three allow-list arrays in `_assert_valid_preference_patch`. This is by design (see §4) but is a small extra step every future settings PR must remember.
3. **`hide_profile_strength` / `push_notifications` etc. were removed, not archived.** Their values (`true`, and the localization/job_preferences shapes) are recorded in the migration header only. If any of these is ever revived as a real feature it starts from defaults, not the stale value — acceptable given none had a live consumer.
4. Still deferred (separate tasks, unchanged): `user_settings` typed table, consent audit log, `SettingsRow` semantic-button rewrite.

---

## Acceptance criteria

| | | |
|---|---|---|
| **A** | No genuinely orphaned preference key remains exposed/maintained | **Met** — 6 orphans (proven zero consumers via repo + git + all 6 fn bodies + DB) removed from the 2 rows that carried them; validator now rejects them on any future write |
| **B** | No valid existing settings functionality breaks | **Met** — every live setting (`mentions_from`, `show_active_status`, `share_profile_updates`, `personalized_recommendations`, all 9 `data_use.*`, all 7 `notifications.*`) validates → 200; UI toggles + Feed + Network verified |
| **C** | `update_my_preferences_patch()` rejects malformed data server-side | **Met** — 14 malicious/malformed inputs → clean 400 before any write (§5) |
| **D** | Valid updates remain atomic and concurrency-safe | **Met** — concurrent disjoint `Promise.all` both survive with the validator active (§6); B3 flow unchanged |
| **E** | Non-owners still cannot read or modify preferences | **Met** — anon RPC/read → 401; RPC is own-row-only (no target param); Steps 1–3 column lock intact (§7) |
| **F** | No client-side read-modify-write reintroduced | **Met** — validation is inside the DB RPC; the client still sends only a delta patch |
| **G** | Existing Advertising Data functionality works exactly as before | **Met** — list, detail pages, live summaries, all toggles, and the `connections` ranking gate all verified unchanged |
