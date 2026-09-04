# Step 1 — `profiles` read dependency inventory + proposed safe column set

**Date:** 2026-09-04 · **Nothing modified.** Findings only, per the task's Step-1 instruction.
**Verified against:** every `.from('profiles')` call in `src/`, every PostgREST embedded `profiles(...)` join, every `SECURITY DEFINER` function that references `profiles`, `pg_policies`, and `has_column_privilege`.

---

## 0. Key structural facts (they change the plan)

1. **There is no logged-out / anonymous profile view.** Every app route except `/`, `/register`, `/forgot-password`, `/reset-password`, `/mfa-challenge` is inside `<RequireAal2>`, and `ProfilePage` itself does `if (!user) navigate("/")`. So the **`anon` role has no legitimate need to read `profiles` at all** — a full `REVOKE SELECT ON public.profiles FROM anon` is safe and is the single biggest win (kills the unauthenticated-scraper vector).

2. **Postgres column privileges are role-wide, not row-scoped.** `REVOKE SELECT (preferences) FROM authenticated` also stops the **owner** (who is `authenticated`) from reading *their own* `preferences`. RLS restricts rows; GRANTs restrict columns; they're independent. → To make Test B pass ("authenticated non-owner cannot read `preferences`") we must revoke the column from `authenticated`, which means the 4 owner-settings hooks need a server-side read path (`get_my_settings()`). This is a small read-only RPC, **not** the `user_settings` refactor — but it does touch 4 files, so I'm flagging it for your OK before writing it (see §5).

3. **All ~53 `SECURITY DEFINER` functions that read `profiles` are immune to the column revoke** — they execute as the definer (`postgres`), bypassing both RLS and GRANTs. So `search_people`, `get_profile_contact_info`, `get_visible_connections_count`, `list_followers`/`list_following`, `search_candidates`, `get_recruiter_candidate_disclosure`, every `notify_*` trigger, `_ad_profile_matches_audience`, `broadcast_profile_update`, etc. **keep working unchanged.** Only direct PostgREST `.from('profiles').select()` by `anon`/`authenticated` is affected.

4. **Only ONE non-owner direct read pulls `preferences`:** `src/hooks/use-mention-search.ts:59` (reads `preferences.mentions_from` to decide if a person can be @-mentioned). The other three `preferences` readers (`useProfileSettings`, `useNotificationPreferences`, `usePersonalization`, `useAdvertisingDataSettings`) are all `.eq('user_id', user.id)` — owner-only.

5. **Only ONE non-owner direct read is `select('*')`:** `src/components/profile/ProfilePage.tsx:230` (the "view another member" branch). Everything else non-owner already selects a narrow, safe column list.

---

## 1. Full inventory — every `profiles` read

### 1a. Direct `.from('profiles').select(...)` — 122 call sites

**Owner-only reads** (`.eq('user_id', <caller's own id>)` or `.eq('id', <caller's own profile id>)`) — *unaffected by any change below*:

| Columns selected | Sites |
|---|---|
| `id` (just resolve own profile id) | `FeedRightRail:47`, `PostInput:52`, `ProfessionalResourcesManager:74`, `SearchBar:29`, `AddPost:57`, `CompanyProfile:311,338,248`, `Companies:45`, `Dashboard:78`, `Feed:481,626,645,711`, `PostCard:236`, `PostDetail:60`, `Notifications:106,132,160`, `MyApplications:91`, `ApplyJobDialog:34`, `ManageDataPage:48`, `MobileCreateSheet:46`, `SkillsSection:51`, `useCurrentProfileId:19`, `use-post-reposts:74`, `useSavedPosts` (own), `InsightEngagement:38`, `insights/api currentProfileId`, `ads/api:74`, `ads/delivery:131`, `stories/api:57`, `useAdvertisingDataSettings:83` (`id, preferences, location, skills`) |
| `id, display_name, avatar_url` (own author card) | `use-comments:203`, `RepostComposerDialog:80`, `Stories:21`, `Story:905` |
| `id, avatar_url, display_name` | `NavBar:63` |
| `id, display_name, avatar_url, cover_url, profession, location, bio, phone, linkedin_url` | `ProfileSummaryCard:62` |
| `avatar_url, profession, location, skills, open_to_roles` | `JobInsightsRail:33` |
| `id, open_to_roles, preferred_locations, job_type, skills` | `Jobs:98` |
| `avatar_url, photo_url, cover_url, display_name, full_name, headline, profession, bio, location, address, phone, website, linkedin_url, github_url, twitter_url, projects, skills` | `useProfileStrength:57` (`.eq('id', pid)` where pid = own) |
| **full settings set** incl. `preferences`, `email`, all `*_visibility`, recruiter-sharing flags, `autoplay_videos` | `useProfileSettings:110` |
| `preferences` | `useProfileSettings:571`, `useNotificationPreferences:32,122`, `usePersonalization:18`, `useAdvertisingDataSettings:179,220` |
| `*` | `DownloadDataPage:47` (own, for data export), `ProfilePage:203` (self branch), `ProfilePage:214` (insert…select self) |

**Owner UPDATE-only** (30 sites — `useProfileSettings` visibility setters, `EditProfileDialog:194`, `CoverImage`, `ProfilePhoto`, `ProjectsSection:63`, `SocialLinksSection:62`, `usePresenceHeartbeat:23`, `useAutoplayPreference`, the 3 settings hooks' writes) — *unaffected; `UPDATE` privilege is separate from `SELECT` and stays.*

**Non-owner reads** (read another member's row):

| # | Site | Columns | Contains sensitive? | Needs after change |
|---|---|---|---|---|
| N1 | `components/profile/ProfilePage.tsx:230` | `*` | **YES** — `preferences`, `expected_salary`, `notice_period`, recruiter flags, all `*_visibility` | **route through `get_public_profile(target)`** |
| N2 | `hooks/use-mention-search.ts:59` | `id, display_name, avatar_url, profession, preferences` | **YES** — `preferences` (uses only `.mentions_from`) | **route through a `search_mentionable_people(q)` RPC** (or promote `mentions_from` to a column) |
| N3 | `components/connect/ChatInterface.tsx:239` | `id, user_id, display_name, full_name, email, avatar_url, profession` | `email` (Connect "search people by email") | keep `email` publicly readable **or** move Connect search server-side (see §6 gap) |
| N4 | `Feed.tsx:369` | `id, user_id, display_name, avatar_url` | no | safe as-is |
| N5 | `Feed.tsx:205, 206` | `id, user_id, display_name, avatar_url` | no | safe as-is |
| N6 | `Feed.tsx:506, 569, 604` | `id, user_id` / `user_id` | no | safe as-is |
| N7 | `useSavedPosts.ts:224` | `id, user_id, display_name, avatar_url` | no | safe as-is |
| N8 | `use-comments.ts:256` | `id, display_name, avatar_url` | no | safe as-is |
| N9 | `PostDetail.tsx:101` | `id, display_name, avatar_url` | no | safe as-is |
| N10 | `Notifications.tsx:132` | `display_name, avatar_url` | no | safe as-is |
| N11 | `use-interview-rounds.ts:96, 227, 284` | `id, display_name, avatar_url` / `id, display_name` / `id, user_id, display_name` | no | safe as-is |
| N12 | `connect/ChatInterface.tsx:275, 324` | `id, user_id, display_name, avatar_url, profession` | no | safe as-is |
| N13 | `connect/InterviewInterface.tsx:108` | `display_name, avatar_url` | no | safe as-is |
| N14 | `SearchBar.tsx:63` | `id, display_name, profession, last_name_visibility` (`.eq('profile_discovery', true)`) | no (visibility flag only) | safe as-is |
| N15 | `FeedRightRail.tsx:97` | `id, display_name, avatar_url, profession` (`.eq('profile_discovery', true)`) | no | safe as-is |
| N16 | `FeedPreferences.tsx:62, 96, 190` | `id, display_name, avatar_url` / `user_id, display_name` | no | safe as-is |
| N17 | `stories/api.ts:86, 319, 362, 468` | `user_id, display_name, avatar_url` / `id, user_id, display_name, avatar_url` | no | safe as-is |
| N18 | `ads/delivery.ts:101` | `id, display_name, full_name` (admin allowlist view) | no | safe as-is |
| N19 | `useProfileSettings.ts:186` | `id, display_name` (blocked/snoozed list) | no | safe as-is |

### 1b. PostgREST embedded `profiles(...)` joins — all narrow, all safe

| Site | Embedded columns |
|---|---|
| `jobs/CompanyTeamManager.tsx:68` | `full_name, avatar_url` |
| `jobs/HiringPipeline.tsx:151` | `display_name, avatar_url, profession` |
| `SearchBar.tsx:55` | `display_name` |
| `network/useInvitations.ts:57,63` | `PERSON_FIELDS` = `id, user_id, display_name, full_name, headline, profession, location, avatar_url, last_name_visibility` |
| `insights/api.ts` (9 sites) | `AUTHOR_COLS` = `id, display_name, avatar_url, headline` |

*(Embedded joins run under the parent query's role + the same RLS/GRANT rules. All safe columns → unaffected.)*

### 1c. `SECURITY DEFINER` functions reading `profiles` — 53, all immune

`current_profile_id`, `is_blocked_by`, `mutual_connections_count`, `get_profile_contact_info`, `get_visible_connections_count`, `search_people`, `search_connections`, `search_candidates`, `is_authorized_search_recruiter`, `is_any_authorized_recruiter`, `get_recruiter_candidate_disclosure`, `get_application_resume`, `get_application_candidate_resources`, `list_followers`, `list_following`, `can_view_story`, `compute_match_score`, `_ad_audience_count`, `_ad_profile_matches_audience`, `broadcast_profile_update`, `handle_new_user`, and 32 `notify_*` / interview / company-membership / application triggers.
→ **No change needed to any of these.** They read `profiles` as `postgres`.

---

## 2. Proposed safe public-profile column set (for `get_public_profile`)

Derived from what N1 (`ProfilePage` → `ProfileHeaderCard` + `ProfileTabs` + sections + `ContactInfoDialog` non-owner branch) actually renders.

### RETURN (display-safe — any authenticated viewer of a non-gated profile)

| Column | Consumed by | Notes |
|---|---|---|
| `id`, `user_id` | everywhere | identity |
| `display_name`, `full_name` | `profileDisplayName()` | name (last-name masking still client-side via `last_name_visibility`) |
| `headline`, `profession` | `profileHeadline()` | |
| `avatar_url`, `photo_url` | `ProfilePhoto` | photo gate is `photo_visibility` + relationship (keep that flag) |
| `cover_url`, `cover_position` | `CoverImage` | |
| `bio` | About section | |
| `location` | header | |
| `pronouns` | header | |
| `open_to_work` | "Open to work" badge | (the *visibility* of this badge is `open_to_work_visibility` — see below) |
| `skills` (array), `projects` (jsonb) | Skills / Projects sections | rendered publicly today |
| `experience`, `education`, `achievements` (jsonb) | legacy; sections now use tables, but not sensitive | keep for safety / back-compat |
| `website`, `linkedin_url`, `github_url`, `twitter_url` | `SocialLinksSection`, `ContactInfoDialog` non-owner branch | shown ungated today ("shared if present") |
| `address` | `ContactInfoDialog` non-owner branch | **shown ungated today** — see §6 gap (arguably should be visibility-gated) |
| `created_at` | "member since" (if used) | |
| `last_active_at` | "Active now" dot | gated further by the next field |
| `profile_visibility` | `isGated` computation | flag |
| `photo_visibility` | photo gate | flag |
| `last_name_visibility` | name masking | flag |
| `profile_discovery` | search/suggestion opt-out | flag |
| **DERIVED** `show_active_status` (bool) | `ProfileHeaderCard:54` (currently reads `preferences.show_active_status`) | return the scalar, **not** the `preferences` blob |
| **DERIVED** `has_verified_email` (bool) | `ProfileHeaderCard:141` (currently `!!profile.email`) | return `email IS NOT NULL`, not the address |

The function also applies, server-side, the same gate `get_profile_contact_info` uses:
`is_blocked_by(target)` → return nothing; `profile_visibility='private'` and not owner → return nothing; `profile_visibility='connections_only'` and not connected and not owner → return nothing.
(Owner and connected-viewer variance for `last_active_at` / `open_to_work` visibility can also be resolved inside the function so the client stops doing it.)

### DO NOT RETURN (owner-only — never in a non-owner read)

| Column | Why | Current non-owner readers |
|---|---|---|
| `preferences` | privacy posture + `app_lock_enabled` (security recon) + `job_preferences` + `notifications` | only N2 (`use-mention-search`, `.mentions_from`) — handled separately |
| `expected_salary` | compensation | **none** (only `useProfileSettings`? → not even there; nothing reads it) |
| `notice_period` | availability | **none** |
| `open_to_roles`, `preferred_locations`, `job_type` | job-search intent | only owner (`Jobs.tsx`, `JobInsightsRail` — both `.eq('user_id', me)`) |
| `email`, `phone` | PII | via `get_profile_contact_info` (gated) for display; `email` also N3 (Connect search) — see §6 |
| `email_visibility`, `phone_visibility`, `connections_visibility`, `open_to_work_visibility` | config; no non-owner UI need (RPCs handle the gating) | owner only |
| `autoplay_videos` | playback pref | owner only (`useAutoplayPreference`) |
| `allow_recruiter_search`, `allow_recruiter_profile_view`, `share_pdf_resume_with_recruiters`, `share_online_resume_with_recruiters`, `share_professional_links_with_recruiters` | recruiter-consent flags | owner + recruiter RPCs (SECURITY DEFINER, immune) |
| `updated_at` | minor; no non-owner need | — |

---

## 3. Proposed privilege changes (Step 3)

Split into **3a** (zero owner impact, ship first) and **3b** (needs the owner RPC from §5).

### 3a — `anon` loses `profiles` entirely
```
REVOKE SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profiles FROM anon;
```
No `anon`-context code path touches `profiles` (§0.1). Closes the unauthenticated scrape of `preferences` / `expected_salary` / `notice_period` / everything.

### 3b — `authenticated` loses SELECT on the sensitive columns
```
REVOKE SELECT (preferences, expected_salary, notice_period,
               open_to_roles, preferred_locations, job_type,
               autoplay_videos,
               allow_recruiter_search, allow_recruiter_profile_view,
               share_pdf_resume_with_recruiters, share_online_resume_with_recruiters,
               share_professional_links_with_recruiters,
               email_visibility, phone_visibility, connections_visibility, open_to_work_visibility,
               updated_at)
ON public.profiles FROM authenticated;
```
`UPDATE (...)` privileges are **kept** (settings writes still work). Owner **reads** of these move to `get_my_settings()` (§5).
`email` / `phone` are **kept** granted (N3 Connect search + verified-badge; the sensitive part — showing the value on a profile — is already gated by `get_profile_contact_info`). Revoking them is a separate call with a behaviour decision (§6).

*(Also revoke `INSERT/DELETE/TRUNCATE/REFERENCES/TRIGGER` from `authenticated` — nothing uses them, RLS already blocks the row, and it shrinks the surface. Optional, low-risk.)*

---

## 4. `get_public_profile(target_profile_id uuid)` — proposed shape (Step 2)

`plpgsql`, `STABLE`, `SECURITY DEFINER`, `SET search_path = ''` (fully-qualified names), modelled on `get_profile_contact_info`:

- Look up target `user_id, profile_visibility`; if not found → return no rows.
- If not owner: `is_blocked_by(target)` → return nothing; `profile_visibility='private'` → return nothing; `profile_visibility='connections_only'` and not connected → return nothing.
- Return exactly the **RETURN** columns from §2, plus derived `show_active_status boolean`, `has_verified_email boolean`, and resolve the `last_active_at` / `open_to_work` viewer-variance server-side.
- `GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;` (not `anon`).
- No new tables exposed; only reads `profiles` + `connections` + `blocked_users` (already reachable via existing SD helpers).

**`ProfilePage.tsx` change:** the `mode !== 'self'` branch (line 220–235) swaps `.from("profiles").select("*").or('id.eq…,user_id.eq…')` for `supabase.rpc('get_public_profile', { target_profile_id })`. The route param can be `profiles.id` **or** `profiles.user_id` today (line 227–232) — the RPC needs to accept both, or the client resolves `user_id → id` first via a tiny existing path. Self branch (line 202) is unchanged. `ProfileHeaderCard:54` changes `(profile.preferences as …).show_active_status === false` → `profile.show_active_status === false`; `:141` `profile.email` → `profile.has_verified_email`.

---

## 5. The wrinkle that needs your call — `get_my_settings()`

Because a column `REVOKE ... FROM authenticated` also hits owners (§0.2), Step 3b requires the four settings hooks to stop reading `preferences` / the sensitive columns off the raw table. Minimal fix:

- New read-only `get_my_settings()` `SECURITY DEFINER` → returns the caller's own `preferences` + the sensitive columns for `auth.uid()`'s row only. `GRANT EXECUTE TO authenticated`.
- Repoint the **reads** in `useProfileSettings.ts` (2 reads), `useNotificationPreferences.ts` (2), `usePersonalization.ts` (1), `useAdvertisingDataSettings.ts` (2). **Writes stay exactly as they are** (`UPDATE ... WHERE user_id = auth.uid()`, `UPDATE` privilege retained).
- This is a thin accessor, **not** the `user_settings` table / RMW-race / dedup work you deferred — but it does edit 4 hook files.

**Options:**
- **(A) Do 3a + 3b + `get_my_settings()` now** — fully satisfies Test A **and** Test B, ~5 files touched, all read-path only.
- **(B) Do 3a now, defer 3b** — `anon` fully blocked (the scary vector). Authenticated non-owner can still hand-craft a query for another row's `preferences` (needs a login, rate-limited, logged). Test B would be "partially" — closed for `anon`, open for `authenticated`. `get_public_profile` + `use-mention-search` fix + `ProfilePage` repoint still ship (they're independent of the revoke).
- I recommend **(A)** — it's the acceptance criterion, and `get_my_settings()` is genuinely small and read-only. Confirm and I'll proceed to Steps 2–3.

---

## 6. Remaining gaps / decisions surfaced (not blockers, but you should know)

1. **`address` is shown to any viewer ungated** (`ContactInfoDialog` non-owner branch, line 96). It's not in your named list, but it's arguably as sensitive as `phone`. Options: leave as-is (status quo), or fold it into `get_profile_contact_info`'s gating. Recommend: leave for this task, note for later.
2. **Connect "search people by email"** (`ChatInterface.tsx:232`, N3) is the only thing keeping `email` readable by `authenticated` non-owners. If you want `email` fully owner-only, that search must move to a `SECURITY DEFINER` RPC (like `search_people`). Out of scope for Steps 1–3 unless you want it in.
3. **`experience` / `education` / `projects` / `achievements` jsonb on `profiles`** appear partly legacy (the profile sections read dedicated tables). Not sensitive, so kept in the safe set; a later cleanup could drop the unused columns.
4. **`use-mention-search`** needs `search_mentionable_people(q)` (a `search_people`-style SD RPC that filters out `mentions_from='nobody'` / non-connections server-side) — or promote `mentions_from` to a top-level column. The RPC is cleaner and matches existing patterns; I'll build it in Step 2 alongside `get_public_profile`.
5. **`profiles_select_respecting_visibility` policy `USING` clause** — left untouched, as instructed. All row-level logic stays; we only change GRANTs + add accessors.

---

## 7. What I'll do on your go-ahead (Steps 2–3)

1. Migration: `get_public_profile(uuid)` + `search_mentionable_people(text)` + (if Option A) `get_my_settings()`. `SET search_path`, `SECURITY DEFINER`, `EXECUTE` granted to `authenticated` only.
2. Migration: `REVOKE` per §3 (3a always; 3b if Option A).
3. `ProfilePage.tsx` foreign branch → `get_public_profile`; `ProfileHeaderCard.tsx` two field renames; `use-mention-search.ts` → `search_mentionable_people`; (Option A) 7 read sites in the 4 settings hooks → `get_my_settings()`.
4. Security tests A–E (SQL: anon + authenticated-other cannot read the columns; owner can via RPC; public profile renders; visibility enforced).
5. Regression: `tsc`, `vite build`, eslint, browser (own profile, other profile, gated profile, Network, Feed, Settings, Advertising Data, direct `/profile/:id`), mobile + desktop.
6. Report per the deliverable spec (§1–9).

**No** `user_settings` table, **no** RMW-race fix, **no** dedup, **no** orphan-key cleanup, **no** `SettingsRow` change, **no** edits to `advertisingDataConfig.ts` / `useAdvertisingDataSettings.ts` / `AdvertisingDataDetailPage.tsx` / `advertisingDataSummary.ts`.
