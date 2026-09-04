# Settings → Advertising Data — final gap analysis + prioritized roadmap

**Date:** 2026-09-04 · **Mode:** audit only, no code changed.
**Verified against the live codebase + live Supabase schema/RLS**, not the prior report.

---

## 0. Re-audit — what's actually true

| Prior report claim | Verified? | Notes |
|---|---|---|
| 16 topics implemented, config-driven | ✅ | `src/config/advertisingDataConfig.ts` — 16 topics, 3 sections, `kind` = linked/personalisation/future/not-collected. Clean. |
| Rows 1–6, 8, 10 "fully functional" | ⚠️ **partly** | Functional = *the toggle persists and reads back*. **Not** functional in the sense of "OFF changes what the app does" — see §4. Only row 10 (`personalized_recommendations`) has a real downstream consumer. |
| `profiles.preferences` JSONB reused, no migration | ✅ | Correct — but see §3, the reuse inherits a live data-exposure bug. |
| Optimistic + rollback + toast persistence | ✅ | `useAdvertisingDataSettings.setDataUsePref` / `setPersonalizedRecommendations` — read-modify-write on the whole `preferences` blob. Works, but non-atomic (§ B3). |
| RLS protects writes (another user can't change your prefs) | ✅ | `profiles_update_own` = `user_id = auth.uid()`. Foreign UPDATE affects 0 rows. |
| Desktop/mobile/nav/persistence/build PASS | ✅ (not re-run) | No reason to doubt; not the risk area. |
| Concern: `preferences` public read exposure | ✅ **confirmed, worse than described** | `anon` (unauthenticated) can `SELECT preferences` — and every other column — of any public profile. §3. |
| Concern: `data_use.*` not enforced | ✅ **confirmed** | 0 downstream consumers for all 7 keys. §4. |
| Concern: `SettingsRow` not a `<button>` | ✅ | `role="button"` div + tabIndex + Enter/Space handler + `focus-visible` bg tint. Acceptable ARIA, weak focus affordance. § C1. |
| Concern: future rows disabled intentionally | ✅ | `ads_off_profolio`, `measure_ad_success` — stored default OFF, `<Switch disabled>`. Correct. §5. |

**Files audited:** `advertisingDataConfig.ts`, `AdvertisingSettings.tsx`, `AdvertisingDataDetailPage.tsx`, `useAdvertisingDataSettings.ts`, `advertisingDataSummary.ts`, `settingsConfig.ts`, `App.tsx` route, `SettingsRow.tsx`, `SettingsShell`/`SettingsSection`, `useProfileSettings.ts`, `useNotificationPreferences.ts`, `usePersonalization.ts`, `Feed.tsx`, `network.ts`, `usePeopleSearch.ts` + `search_people` RPC, `GrowPanel.tsx`, `jobRecommendations.ts`, `Jobs.tsx`, `JobInsightsRail.tsx`, `feed_pick_sponsored_ad` RPC, `profiles` RLS policies + column grants + live `preferences` data.

---

## 1. Category A — MUST FIX BEFORE PRODUCTION

### A1. The whole `profiles` row — including `preferences` — is world-readable

- **Problem.** `profiles_select_respecting_visibility` is a `PERMISSIVE ... FOR SELECT TO public` policy whose `USING` clause is purely **row-level**: `user_id = auth.uid() OR (profile_visibility IN ('public', NULL) OR connections_only+connected) AND NOT is_blocked_by(id)`. There is **no column restriction anywhere** — `anon` and `authenticated` both hold `SELECT` on every column (`has_column_privilege('anon','profiles','preferences','SELECT') = true`). So any unauthenticated client with the anon key can run
  `select preferences, expected_salary, notice_period from profiles where profile_visibility = 'public'`
  and get, per the live data: `app_lock_enabled`, `data_use` (the Advertising-data choices themselves), `job_preferences` (roles/locations/experience_level), `notifications`, `localization`, `personalized_recommendations`, plus `expected_salary` and `notice_period` from top-level columns.
- **Where.** DB: policy `public.profiles / profiles_select_respecting_visibility` + default table/column grants to `anon`,`authenticated`. App: `src/components/profile/ProfilePage.tsx:229` (`.from("profiles").select("*")` for *another* user), `search_people` returns a curated subset (fine) but the raw table is still directly queryable.
- **Why it matters.** The feature ships a page that states *"Only you can see and change this. It is never shared with advertisers or partners."* (`AdvertisingDataDetailPage.tsx:192`). That is currently false for the value itself. Separately, `app_lock_enabled` is security recon (tells an attacker whether an account has a PIN), and `expected_salary` / `notice_period` / `job_preferences` are job-search-intent a user may not want their employer or the public to see. This is a **privacy-correctness + functional-consent** issue, which the Category-A definition covers.
- **Affected.** `public.profiles` (RLS policy, GRANTs), `ProfilePage.tsx`, any non-owner read of `profiles`; new: `advertisingDataConfig.ts` copy relies on the privacy claim.
- **Dependency.** Must inventory every non-owner `profiles` read first (§7 Step 1) — blindly narrowing the policy/grants will break profile viewing, search, feed author cards, mentions, etc.
- **Risk of fixing.** High if done blindly (row-level RLS changes cascade); **low** if foreign reads are first routed through a SECURITY DEFINER accessor (precedent already exists: `get_profile_contact_info`, `get_recruiter_candidate_disclosure`).
- **Recommended solution.** Two-phase (Steps 1–3): (1) `get_public_profile(target uuid)` SECURITY DEFINER RPC / view returning only display-safe columns and applying the `*_visibility` rules server-side; (2) repoint all non-owner reads to it; (3) then revoke `SELECT` on the sensitive columns (`preferences`, `expected_salary`, `notice_period`, recruiter-sharing flags, `*_visibility`, `autoplay_videos`, …) from `anon`/`authenticated`, or split the SELECT policy so those columns are own-row-only. Long-term, move settings entirely out of `profiles` (§6).

### A2. Toggles that claim to control personalisation but control nothing (functional-consent)

- **Problem.** For the 8 "functional" signals, only `personalized_recommendations` is read by any runtime code. The other 7 (`connections`, `companies_followed`, `groups`, `education_skills`, `job_information`, `employer`, `profile_location`) are **write-only** — `setDataUsePref` persists them, `mergePrefs` reads them straight back into the same settings screen, and nothing else in `src/` or in any RPC references `data_use`. Meanwhile the app *does* personalise from at least one of those signals: `search_people` (the Network → Grow "add people" list) `ORDER BY mutual_connections_count(p.id) DESC` — i.e. it ranks suggestions by your connection graph — with no preference check. So a user who turns **Connections → Off** still gets connection-ranked people suggestions.
- **Where.** `advertisingDataConfig.ts:120-227` (the 7 `linked` topics + their `listBlurb` "Use your … to personalise …"), `useAdvertisingDataSettings.ts:168` (`setDataUsePref`, the only touch point), `public.search_people` (unconditioned `mutual_connections_count` ordering), `AdvertisingDataDetailPage.tsx:144` (control copy "Use my … to personalise Profolio").
- **Why it matters.** Shipping consent switches that demonstrably don't change behaviour is misleading-UI / dark-pattern-adjacent and a compliance liability. It only needs to be *honest*, not necessarily *fully wired*.
- **Affected.** `search_people` RPC (for `connections`); `advertisingDataConfig.ts` copy (for the 6 with no consumer at all); `AdvertisingDataDetailPage.tsx` control label.
- **Dependency.** The 6 signals with **no** consumer (companies/groups/education/job-info/employer/location) can't be "enforced" — the surfaces that would use them (suggested companies, suggested groups, similarity-based job/people recs beyond the existing `open_to_roles` column match) **don't exist yet**. Only `connections` has a live consumer to gate.
- **Risk.** Low. Gating `search_people` on a pref is additive; a copy change is trivial.
- **Recommended solution.** (a) `connections`: teach `search_people` to read the caller's `data_use.connections` and, when `false`, drop the `mutual_connections_count` ordering (fall back to recency / relevance). (b) The other 6: **reword** `listBlurb` / `detailBody` to "Profolio isn't using this data to personalise anything today — this sets your choice for when a feature that would needs it," so nothing overclaims. Wiring real enforcement is deferred to when those recommendation surfaces are built (Category C).

> A2 is borderline A/B. It's in A because the Category-A definition explicitly names "functional-consent issue," and at least the `connections` case is a live, user-visible mismatch. If you'd rather ship with honest copy and defer all wiring, A2 collapses to "do the copy pass (B/C)" and only the `connections` gate stays as a fast-follow.

---

## 2. Category B — SHOULD FIX BEFORE FULL FEATURE LAUNCH

### B1. `connections` consent → `search_people`
Covered in A2(a). Small function change; no frontend change. Acceptance: with `data_use.connections = false`, the Grow-tab people list is no longer ordered by mutual count.

### B2. Honest copy for the 6 no-consumer `linked` rows
Covered in A2(b). `advertisingDataConfig.ts` string edits only. Acceptance: no row claims an effect it doesn't have; each still explains the stored choice.

### B3. Read-modify-write race on `profiles.preferences`
- **Problem.** **Four** independent hooks each do `SELECT preferences → {…spread…} → UPDATE preferences` as two separate round trips over the entire jsonb blob, with no `jsonb_set`, no version guard:
  - `useProfileSettings.updatePrefKey` (`mentions_from`, `show_active_status`, `share_profile_updates`, `personalized_recommendations`)
  - `useAdvertisingDataSettings.setDataUsePref` + `setPersonalizedRecommendations` (`data_use.*`, `personalized_recommendations`)
  - `useNotificationPreferences` (`notifications.*`)
  - (orphan keys `localization` / `job_preferences` / `app_lock_enabled` have no current writer)
  Two concurrent edits (two tabs, two devices, or a fast navigation between settings screens) → last write wins on the **whole object**, silently discarding the other change. `personalized_recommendations` is written by **two** of these hooks, so it's the most exposed key.
- **Where.** `useProfileSettings.ts:560-587`, `useAdvertisingDataSettings.ts:176-205` & `217-241`, `useNotificationPreferences.ts:118-135`.
- **Why it matters.** Data-correctness: a user's privacy choice can be silently reverted by an unrelated setting change elsewhere.
- **Affected.** All three hooks; ideally a new server-side writer.
- **Dependency.** Cleanest fix depends on the §6 architecture decision (typed columns remove the problem entirely).
- **Risk.** Medium to change (touches every settings write path). Low to leave for a fast-follow if launch is soft.
- **Recommended solution.** Short term: a single `set_preference(path text[], value jsonb)` SECURITY DEFINER RPC doing `jsonb_set` server-side, used by all three hooks. Long term: `user_settings` with typed columns (§6, Step 4).

### B4. `personalized_recommendations` has two write paths
- **Problem.** `useProfileSettings` (For-You feed settings screen) and `useAdvertisingDataSettings` ("Interests and traits" detail page) both persist the same key with slightly different toasts and both call `publishPersonalizationChange`. Not a bug today, but a divergence risk.
- **Where.** `useProfileSettings.ts:620-635`, `useAdvertisingDataSettings.ts:208-244`.
- **Recommended solution.** Extract one `setPersonalizedRecommendations` (in `usePersonalization.ts` or a tiny shared module) and have both screens call it.

### B5. Orphan / stale keys in `preferences`
- **Problem.** Live `preferences` blobs contain `job_preferences` (roles/job_type/locations/experience_level) and `app_lock_enabled` that **no current `src/` code reads or writes** — job-search intent has moved to top-level columns (`open_to_roles`, `preferred_locations`, `job_type`, `expected_salary`, `notice_period`, `open_to_work`), and there's no app-lock code at all. `localization` similarly has no reader.
- **Where.** DB rows only; `grep -r "job_preferences\|app_lock" src` = 0 hits.
- **Why it matters.** Dead data that's also **leaked** (A1). `app_lock_enabled` is the security-relevant one.
- **Recommended solution.** Confirm no edge function / native shell reads them, then drop these keys in a data migration (or migrate `app_lock_enabled` into `user_settings` if an app-lock feature is genuinely planned). At minimum, ensure the §7-Step-2 public projection never includes them.

### B6. No server-side shape validation for `data_use`
- **Problem.** The client sends an arbitrary object as `preferences`; nothing validates that `data_use` only contains known boolean keys. Own-row only, so blast radius is the user themselves, but a future client bug could write a shape that trips `mergePrefs` / `readPrefBool` elsewhere.
- **Recommended solution.** Falls out of B3's `set_preference` RPC (validate `path` against an allow-list) or the §6 typed columns.

---

## 3. Deep dive — `profiles.preferences` (and neighbours) exposure

**What a viewer can read of someone else's `profiles` row today**

| Actor | Expected access (target = public profile) | Actual access |
|---|---|---|
| Owner | everything | everything ✅ |
| Authenticated other user | display-safe fields, honoring per-field visibility | **entire row**, incl. `preferences`, `expected_salary`, `notice_period`, recruiter-sharing flags, all `*_visibility` values ❌ |
| Unauthenticated (`anon` key) | display-safe fields of public profiles only | **entire row** of every public profile (3/3 profiles are `public`) ❌ |

**Is the whole `preferences` JSON in the public SELECT?** Yes. Row-level policy, no column filter, `SELECT` granted to `anon`+`authenticated` on all 49 columns. Confirmed with `has_column_privilege` and by reading the policy `USING` clause.

**Sensitive keys currently exposed**

| Key | Sensitivity | Why |
|---|---|---|
| `app_lock_enabled` | **High (security)** | Reveals whether an account has app-lock/PIN — targeting recon |
| `job_preferences` {roles, job_type, locations, experience_level} | **High (privacy)** | Job-search intent; "don't tell my employer" |
| `data_use.*` | Medium | Reveals the user's privacy posture |
| `notifications.*`, `push_notifications`, `sound_effects`, `hide_profile_strength`, `localization`, `personalized_recommendations` | Low | Nobody-else's-business config, still shouldn't be public |
| (top-level, same leak) `expected_salary`, `notice_period` | **High (privacy)** | Compensation + availability |

**Which app code reads `profiles.preferences` directly:** `useProfileSettings`, `useNotificationPreferences`, `useAdvertisingDataSettings`, `usePersonalization` (all **own-row**, `.eq('user_id', user.id)`), `Feed.tsx` (own-row, via `usePersonalization`). No component reads a *foreign* user's `preferences` — so removing it from foreign reads breaks nothing in the UI. The exposure is purely at the API/RLS layer.

**Will changing RLS break things?** Only if done before foreign reads are moved off `select('*')`. `ProfilePage.tsx:229` is the one foreign `select('*')`. `search_people` / `mutual_connections_count` / `get_profile_contact_info` are already SECURITY DEFINER with their own column lists. So: route `ProfilePage` foreign fetch through a new accessor, then tighten. Low risk in that order.

**Options considered**

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| Narrow the SELECT *policy* to hide columns | one place | RLS policies can't restrict columns — needs column GRANTs anyway; easy to get wrong | ❌ alone |
| `REVOKE SELECT (sensitive cols)` from `anon`/`authenticated` + keep policy | true column-level control, minimal surface | must enumerate ~15 columns; owner reads need those columns via a separate own-row grant path or an RPC | ✅ as Step 3, **after** Step 2 |
| SECURITY DEFINER `get_public_profile(target)` RPC / view for all foreign reads | server enforces per-field visibility (fixes a second latent bug where `*_visibility` is only client-honored), stable contract, testable | one new function + repoint call sites | ✅ **recommended** (Step 2), pairs with Step 3 |
| Move settings to `user_settings` table | removes the class of bug permanently | bigger migration | ✅ long-term (Step 4 / §6) |

**Recommendation:** Step 2 (accessor) + Step 3 (revoke), then Step 4 (`user_settings`) when there's appetite. Do **not** touch the policy `USING` clause — leave row-level logic alone; operate on GRANTs + the accessor.

---

## 4. `data_use.*` consent-enforcement audit

Traced every key to its would-be consumer:

| Signal | Stored? | UI toggle? | Actual consumer found? | OFF honoured? | Missing wiring |
|---|---|---|---|---|---|
| `connections` | ✅ `preferences.data_use.connections` | ✅ | **Yes** — `search_people` RPC `ORDER BY mutual_connections_count(p.id) DESC` (Network → Grow people list); also `mutual_connections_count` shown on `search_people` / `PublicProfile` cards | ❌ **No** | Add pref check in `search_people`; optionally suppress the "N mutual connections" ranking hint |
| `companies_followed` | ✅ | ✅ | **No** — no "suggested companies" / "similar companies" surface exists (`grep` in `Companies.tsx` / company components = none) | n/a | Consumer doesn't exist yet |
| `groups` | ✅ | ✅ | **No** — no "suggested groups" surface | n/a | Consumer doesn't exist yet |
| `education_skills` | ✅ | ✅ | **Partial/indirect** — `jobRecommendations.ts` + `Jobs.tsx` match on `profiles.skills` (top-level column), not on this pref; `JobInsightsRail` reads `skills` | ❌ (not checked) | If skills-based job/people matching should be gated, add pref check in `jobRecommendations.ts` |
| `job_information` | ✅ | ✅ | **Partial/indirect** — job recs match on `open_to_roles` / `preferred_locations` / `job_type` (top-level columns), no pref check | ❌ (not checked) | Same as above if gating desired |
| `employer` | ✅ | ✅ | **No** — no "colleagues at your company" / employer-based suggestion surface | n/a | Consumer doesn't exist yet |
| `profile_location` | ✅ | ✅ | **Partial/indirect** — `search_people` matches `location` on text search only (not ranking); job recs use `preferred_locations` not profile `location` | ~n/a | Minimal; revisit when location-based recs exist |
| `personalized_recommendations` | ✅ `preferences.personalized_recommendations` | ✅ (this page + For-You settings) | **Yes** — `Feed.tsx:428` `if (mode === 'foryou' && personalizationEnabled)` gates the client-side reaction-weighted re-ranking | ✅ **Yes** | None — this one works |

**Exact offending code path (the one real OFF-is-ignored case):**
`src/hooks/network/usePeopleSearch.ts:43` → `supabase.rpc('search_people', …)` → `public.search_people` body:
`… from public.profiles p … order by public.mutual_connections_count(p.id) desc, p.created_at desc …`
No reference to `preferences` / `data_use`. Turning **Connections → Off** does not change this ordering.

**Net:** 1 of 8 functional signals (`personalized_recommendations`) is genuinely enforced. 1 (`connections`) has a live consumer that ignores it. 6 have no consumer to enforce against yet.

---

## 5. Future advertising features (`ads_off_profolio`, `measure_ad_success`)

**Current infra state**
- There is a real advertiser-side ad system (K1–K3C, test mode, dormant): `feed_pick_sponsored_ad` RPC picks an approved active ad for a viewer, gated by the `ad_delivery_test_users` allowlist (currently empty) and audience matching via `_ad_profile_matches_audience`.
- There is **no** user-facing ad-preferences plumbing: nothing reads `ads_off_profolio` or `measure_ad_success`; `feed_pick_sponsored_ad` does not consult `preferences`; there is no external ad network, no conversion/measurement pixel, no data-sharing pipe.

**What to implement now:** nothing beyond what exists. Keep both as dormant preference keys, default OFF, disabled control. That is the correct, honest state — do **not** stand up a fake "opt out of ads off Profolio" flow when there are no ads off Profolio.

**Target architecture when user-facing ads actually ship:**
1. `measure_ad_success` becomes real the moment `feed_pick_sponsored_ad` serves outside the test allowlist. At that point: `feed_pick_sponsored_ad` (and `ad_record_impression` / `ad_record_click`) must check the viewer's `data_use.measure_ad_success` and, when OFF, either exclude the viewer from per-identity measurement joins or only count them in k-anonymised aggregates (the K3C analytics are already k-anonymised — enforce a floor and drop identified rows for opted-out viewers).
2. `ads_off_profolio` becomes real only if Profolio ever builds/joins an external ad network. Until then it stays dormant. If built: a server-side gate on any outbound audience/segment export keyed on this flag, default-deny.
3. Both should move into `user_settings` (§6) and be enforced **server-side** in the ad-selection / measurement RPCs, never client-side.
4. Add a consent-change audit trail (§ C3) before either goes live, for GDPR "record of consent."

---

## 6. Long-term privacy/settings architecture

| Option | RLS | Privacy | Perf | Maintainability | Migrations | Frontend | GDPR | Per-setting ACL |
|---|---|---|---|---|---|---|---|---|
| **1. status quo** — everything in `profiles` (`preferences` jsonb + scattered `*_visibility` cols) | leaky (§3); row-level only | ❌ public row exposes settings + salary | fine | 4 RMW hooks, lost-update race | none | 4 hooks, ad-hoc keys | export/delete OK, but mixed with public data | none |
| **2. separate `user_settings` (1:1 with user), owner-only RLS, `anon` no grant** | trivially correct (`user_id = auth.uid()`) | ✅ nothing settings-shaped in any public read | 1 extra row fetch per session (cacheable) | one hook, typed columns kill the race | 1 create + backfill | 1 `useUserSettings` | clean, isolated subtree | typed columns or small scoped jsonb |
| **3. multiple domain tables** (`privacy_settings`, `notification_settings`, `ad_settings`, …) | correct | ✅ | several fetches | most code, most joins | many | many hooks | clean but sprawling | yes, granular |
| **4. hybrid** — `profiles` keeps *public* profile fields; **all settings/visibility/prefs → `user_settings`**; foreign profile reads go through `get_public_profile()` which applies visibility server-side | correct + defence-in-depth | ✅✅ (also fixes client-only visibility enforcement) | 1 extra fetch; RPC is `STABLE` | one settings hook + one profile accessor | 1 create + backfill + repoint | `useUserSettings` + `getPublicProfile` | cleanest | typed where useful, scoped jsonb (`notifications`, `data_use`) otherwise |

**Recommendation: Option 4 (hybrid).** Option 2 alone fixes the leak and the race but leaves `*_visibility` enforced only in React; folding in the `get_public_profile()` accessor closes that too and gives one obvious contract for "what a stranger sees." Option 3 is over-engineered for a 3-table-of-settings app. Option 1 is not shippable as a privacy surface.

Concretely, `user_settings` columns: keep booleans/enums typed (`personalized_recommendations bool`, `profile_visibility text`, `email_visibility text`, `open_to_work bool`, `expected_salary text`, `notice_period text`, recruiter-sharing flags, `autoplay_videos bool`, `app_lock_enabled bool`); keep open-ended groups as small jsonb (`notifications jsonb`, `data_use jsonb`, `localization jsonb`). RLS: `SELECT`/`INSERT`/`UPDATE` where `user_id = auth.uid()`, no `anon` grant, no `authenticated`-other grant.

---

## 7. Execution roadmap

> Ordered so nothing breaks: move foreign reads onto a safe accessor **before** tightening the raw table. Each step is independently shippable.

### Step 1 — Dependency analysis + column allow-list (design only)
- **Do:** enumerate every non-owner read of `profiles` (`ProfilePage.tsx:229` `select('*')`; `search_people`, `mutual_connections_count`, `get_profile_contact_info`, `get_recruiter_candidate_disclosure` already curated; feed author cards select only `id,user_id,display_name,avatar_url`; mentions; `PERSON_FIELDS`). List every client-side `*_visibility` check. Produce the definitive "display-safe columns a stranger may see" list and the "own-row-only" list.
- **Files:** none changed. Output: a short design note.
- **DB / migration / RLS:** no / no / no.
- **Tests:** n/a.
- **Acceptance:** every foreign `profiles` read is catalogued; the two column lists are signed off.

### Step 2 — `get_public_profile(target uuid)` accessor
- **Do:** SECURITY DEFINER function (or view + wrapper) returning only the Step-1 display-safe columns, applying `profile_visibility` / `email_visibility` / `phone_visibility` / `open_to_work_visibility` / block checks server-side. Repoint `ProfilePage.tsx` foreign branch (and any other Step-1 call site not already curated) to it.
- **Files:** new migration; `src/components/profile/ProfilePage.tsx`; possibly `src/lib/network.ts` helpers.
- **DB / migration / RLS:** yes / yes / no (RLS untouched this step).
- **Tests:** viewer sees name/headline/avatar/visible contact; viewer cannot obtain `preferences`, `expected_salary`, `notice_period`, `app_lock_enabled` via the accessor; owner page unchanged; blocked viewer gets nothing.
- **Acceptance:** no non-owner code path selects `*` from `profiles`.

### Step 3 — Tighten the raw `profiles` read surface
- **Do:** `REVOKE SELECT (preferences, expected_salary, notice_period, autoplay_videos, allow_recruiter_search, allow_recruiter_profile_view, share_pdf_resume_with_recruiters, share_online_resume_with_recruiters, share_professional_links_with_recruiters, email_visibility, phone_visibility, connections_visibility, last_name_visibility, open_to_work_visibility, profile_visibility, profile_discovery) ON public.profiles FROM anon, authenticated;` Grant those back to the owner path only if the app still needs them own-row (it reads them via `useProfileSettings` — verify those still work; if the revoke also blocks the owner, add a companion own-row `get_my_settings()` RPC or move to Step 4 first).
- **Files:** new migration. Possibly `useProfileSettings.ts` if owner reads regress.
- **DB / migration / RLS:** yes / yes / policy `USING` unchanged, GRANTs changed.
- **Tests:** `anon` + authenticated-other `select preferences from profiles where profile_visibility='public'` → error/empty; own settings screens still load and save; profile view via Step-2 accessor still works.
- **Acceptance:** the §3 exposure table's "Actual access" column matches "Expected access".

### Step 4 — `user_settings` table (§6 Option 4) *(optional but recommended; supersedes B3/B6)*
- **Do:** create `user_settings` (typed cols + `notifications`/`data_use`/`localization` jsonb), owner-only RLS, no `anon` grant. Backfill from `profiles.preferences` + the scattered columns. Collapse `useProfileSettings` prefs + `useNotificationPreferences` + `useAdvertisingDataSettings` persistence + `usePersonalization` into one `useUserSettings` hook writing typed columns / `jsonb_set` via one `set_setting` RPC. Keep `profiles.preferences` readable for a deprecation window, then drop.
- **Files:** new migration(s); new `src/hooks/useUserSettings.ts`; edit the 4 hooks + `AdvertisingDataDetailPage.tsx` / `AdvertisingSettings.tsx` to consume it.
- **DB / migration / RLS:** yes / yes (+ backfill) / yes (new table).
- **Tests:** every setting round-trips; two concurrent writes to different settings both persist (race fixed); GDPR export includes `user_settings`.
- **Acceptance:** no code reads/writes `profiles.preferences`; concurrent-edit test passes.

### Step 5 — Enforce `connections` consent in `search_people`
- **Do:** in `search_people`, read the caller's `data_use.connections` (from `user_settings` post-Step-4, else `profiles.preferences`); when `false`, replace `ORDER BY mutual_connections_count(p.id) DESC` with a neutral order (e.g. `created_at DESC` / text-relevance). Consider hiding the mutual-count hint too.
- **Files:** new migration (function). No frontend.
- **DB / migration / RLS:** yes / yes / no.
- **Tests:** toggle OFF → Grow people list order changes and is no longer connection-weighted; toggle ON → unchanged.
- **Acceptance:** the §4 table's only ❌ row for a live consumer becomes ✅.

### Step 6 — Honest copy for the 6 no-consumer rows
- **Do:** reword `listBlurb` / `detailBody` for `companies-followed`, `groups`, `education-skills`, `job-information`, `employer`, `profile-location` to state Profolio isn't yet using that data to personalise anything and the toggle records the choice for when it does. Adjust the control label in `AdvertisingDataDetailPage.tsx` accordingly.
- **Files:** `src/config/advertisingDataConfig.ts`, `src/pages/settings/AdvertisingDataDetailPage.tsx`.
- **DB / migration / RLS:** no / no / no.
- **Tests:** visual; no row claims an unimplemented effect.
- **Acceptance:** copy review sign-off.

### Step 7 — Retire orphan keys
- **Do:** confirm no edge function / native code reads `job_preferences`, `app_lock_enabled`, `localization`; data migration to drop them from `preferences` (or fold `app_lock_enabled` into `user_settings` if app-lock is real — investigate first).
- **Files:** new migration.
- **DB / migration / RLS:** yes / yes / no.
- **Tests:** nothing reads them → no functional test; verify `mergePrefs` / settings screens unaffected.
- **Acceptance:** `preferences` (or `user_settings`) contains only live keys.

### Step 8 — Polish (Category C, no urgency)
- `SettingsRow` → `<button type="button">` for semantics + a real focus ring (`focus-visible:ring-2 ring-ring`) instead of the bg tint. Files: `src/components/settings/SettingsRow.tsx`.
- Consent-change audit log (append-only `settings_audit` row on each `data_use` / ad-pref change) — prerequisite for launching any real ad feature; GDPR record-of-consent.
- Keep `ads_off_profolio` / `measure_ad_success` dormant until a real user-facing ad product exists; implement per §5 when it does.
- Per-signal enforcement for `companies_followed` / `groups` / `employer` / `education_skills` / `job_information` when (and only when) the corresponding recommendation surfaces are built.

---

## 8. Verdict

**Is the Advertising Data feature production-ready?**
**As a UI/IA and as persisted user preferences — yes.** The config, hook, detail page, summary util, routing, and own-row RLS-protected writes are correct and don't need rewriting.
**As a privacy control — no**, for two verified reasons:
1. **A1** — the values it manages (and `expected_salary` / `notice_period` / `app_lock_enabled`) are readable by any unauthenticated client for every public profile; the page's "only you can see this" claim is currently false.
2. **A2** — 7 of its 8 functional toggles enforce nothing, and at least `Connections → Off` is a live, demonstrable no-op against `search_people`.

**What the next Claude task should be:** **Roadmap Steps 1–3 — harden the `profiles` public-read surface** (dependency inventory → `get_public_profile()` accessor → revoke `SELECT` on the sensitive columns from `anon`/`authenticated`). This is the highest-risk gap, it's the prerequisite for the feature's core promise being true, and it simultaneously closes a broader platform leak. It requires migrations and touches GRANTs (not the RLS `USING` clause) and one frontend call site (`ProfilePage.tsx`). Do it in that order so no read path breaks.
**Then** Step 5 + Step 6 (make the `connections` toggle real, make the other six honest) as a fast follow. **Then** Step 4 (`user_settings`) when there's appetite for the larger refactor — it permanently removes the RMW race and is the right long-term home for every setting.

**Do not** rewrite `advertisingDataConfig.ts` / `useAdvertisingDataSettings.ts` / `AdvertisingDataDetailPage.tsx` / `advertisingDataSummary.ts` — they are correct; the gap is entirely server-side (RLS/GRANTs/RPCs) plus a copy pass.
