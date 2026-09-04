# Advertising Data — Step 5 (connections consent enforcement) + Step 6 (honest copy)

**Date:** 2026-09-04
**Not touched:** `useAdvertisingDataSettings.ts`, `AdvertisingDataDetailPage.tsx`, `advertisingDataSummary.ts`, `get_public_profile()`, `get_my_settings()`, the profiles privilege hardening, Ads Manager, Stripe/billing, `ad_provider_config`, monetization, unrelated Settings, `personalized_recommendations` (its Feed.tsx consumer is untouched). `advertisingDataConfig.ts` was edited **only for the 6 copy strings** in Step 6 — no structure, keys, `kind`, `prefKey`, `dataKey`, routing or `DATA_USE_DEFAULTS` change.

---

## 1. `search_people` — before / after

**Before** (`20260831090000_network_unify_and_harden`):

```sql
with me as (select public.current_profile_id() as pid)
select … , public.mutual_connections_count(p.id) as mutual_count , …
from public.profiles p
where …
order by public.mutual_connections_count(p.id) desc, p.created_at desc   -- always mutual-first
limit …
```

`data_use.connections` was **never consulted** — turning it off had no effect on the Network → Grow "People you may know" ordering.

**After** (`20260904100000_search_people_honour_connections_consent`) — two minimal edits:

1. The `me` CTE also resolves the **caller's own** flag:
   ```sql
   coalesce(
     (select (pr.preferences #>> '{data_use,connections}')::boolean
        from public.profiles pr where pr.user_id = auth.uid()),
     true                       -- absent ⇒ true  (see §2)
   ) as use_connections
   ```
2. The mutual-connection ORDER-BY key is gated by it:
   ```sql
   order by
     case when (select use_connections from me)
          then public.mutual_connections_count(p.id)
          else 0
     end desc,
     p.created_at desc
   ```

**Effect on ranking**

| `data_use.connections` | ORDER BY | Result |
|---|---|---|
| `true` **or absent** | `mutual_connections_count(p.id) desc, created_at desc` | **byte-for-byte the previous behaviour** — mutual-connection count is the primary sort key |
| `false` | `0 desc, created_at desc` → effectively `created_at desc` | the caller's mutual-connection signal is **not used for ranking**; results fall back to newest-first |

Everything else is unchanged: same signature `(text, int, int)`, same 11 return columns (incl. `mutual_count`), same `where` filters (self / `profile_discovery` / block / search-text), same `limit/offset` clamping, same `SECURITY DEFINER` + `search_path` + `authenticated`-only grant. `mutual_count` is still returned — the "N mutual connections" hint on a person card is the caller's own information about their own graph, not a ranking behaviour, so it is out of scope for this toggle (see §8).

**Callers:** only `src/hooks/network/usePeopleSearch.ts:43` (`supabase.rpc('search_people', { search, lim, off })`), used by Network → Grow via `GrowPanel`. No signature change ⇒ **no frontend change** for Step 5.

---

## 2. Default behaviour when `data_use.connections` is absent

`src/config/advertisingDataConfig.ts` → `DATA_USE_DEFAULTS.connections = true`, and `useAdvertisingDataSettings.mergePrefs()` treats a missing key as its default (`typeof v === 'boolean' ? v : DATA_USE_DEFAULTS[k]`). The key is only written (as an explicit `true`/`false`) once the user toggles the row; a user who has never opened it has **no** `data_use.connections` key.

The RPC mirrors this exactly: `preferences #>> '{data_use,connections}'` returns `NULL` when the key (or `data_use`, or `preferences`) is absent, and `coalesce(…, true)` makes that `true`. So **absent ⇒ ranking enabled**, identical to `true`. An absent preference is never treated as an opt-out. Verified live (`ABSENT` row in §7).

---

## 3. The six copy changes

Only the **6 `linked` rows with no downstream consumer** were reworded. `connections` (now enforced) and `interests-and-traits` / `personalized_recommendations` (Feed.tsx consumer) were **left exactly as-is**. `not-collected` and `future` rows untouched.

The visible change is on the **detail page's explanatory card** (`AdvertisingDataDetailPage.tsx:111` renders `topic.detailBody`). The list row still shows the live data summary (`summariseAdvertisingData`), not `listBlurb`, so `listBlurb` was updated for consistency but has minimal UI surface.

| Row | Old `detailBody` (implied an active consumer) | New `detailBody` (honest) |
|---|---|---|
| **Companies you follow** | "The companies you follow **can be used to suggest** similar companies, jobs and posts. This stays inside Profolio — it is not sold or shared for advertising." | "These are the companies you follow on Profolio. **Profolio does not currently use them to personalise** any suggestions, your feed or anything else, and it shows you no third‑party ads. **This switch records your choice**, so that if a feature ever draws on the companies you follow, it starts from your preference. It is never sold or shared with advertisers or partners." |
| **Groups** | "Groups you've joined **can inform** which groups, people and discussions Profolio suggests. Group membership is not used for advertising." | "These are the groups you've joined. **Profolio does not currently use your group memberships to personalise** which groups, people or discussions it shows you, or anything else, and it shows you no third‑party ads. **This switch records your choice**, so that if a feature ever uses group membership, it starts from your preference. It is never sold or shared with advertisers or partners." |
| **Education and skills** | "Your schools, skills and languages **can be used to recommend** jobs, people and content that match your background. They are never used for third‑party advertising." | "This is the education, skills and languages on your profile. **Profolio does not currently use them to personalise** the jobs, people or content it recommends, or anything else, and it shows you no third‑party ads. **This switch records your choice**, so that if a feature ever matches recommendations to your background, it starts from your preference. It is never sold or shared with advertisers or partners." |
| **Job information** | "The roles and experience on your profile **can be used to recommend** relevant jobs, people and posts. This information is not sold or shared for advertising." | "This is the work history on your profile. **Profolio does not currently use your roles and experience to personalise** the jobs, people or posts it recommends, or anything else, and it shows you no third‑party ads. **This switch records your choice**, so that if a feature ever draws on your work history, it starts from your preference. It is never sold or shared with advertisers or partners." |
| **Employer** | "Your current employer (…"I currently work here") **can be used to suggest** colleagues, company updates and relevant content. It is not used for advertising." | "This is the experience on your profile marked "I currently work here". **Profolio does not currently use your current employer to suggest** colleagues, company updates or content, or anything else, and it shows you no third‑party ads. **This switch records your choice**, so that if a feature ever uses your current employer, it starts from your preference. It is never sold or shared with advertisers or partners." |
| **Profile location** | "The city/region you entered on your profile **can be used to recommend** nearby jobs, people and companies. Only what you typed is used — Profolio does not look up a precise location." | "This is the city/region you typed into your profile (Profolio never looks up a precise location). **Profolio does not currently use it to recommend** nearby jobs, people or companies, or anything else, and it shows you no third‑party ads. **This switch records your choice**, so that if a location‑based feature is ever added, it starts from your preference. It is never sold or shared with advertisers or partners." |

`listBlurb` for all 6 changed from `"Use your … to personalise …"` → `"Your choice for if your … is ever used to personalise Profolio"`.

The four states the UI now distinguishes:
1. **Data exists and affects a Profolio behaviour today** → `connections` (search ranking), `interests-and-traits` (For You feed). Copy unchanged — it accurately claims an effect.
2. **Data exists, no current consumer** → the 6 rows above. Copy now says "does not currently use… records your choice for the future."
3. **Not collected** → `customised-display-format`, `inferred-city-location`, `age-range`, `gender`, `data-from-others`, `affiliates-partners`. Unchanged.
4. **Future-only** → `ads-off-profolio`, `measure-ad-success` (`kind: 'future'`, disabled switch). Unchanged.

**Note on the control label:** `AdvertisingDataDetailPage.tsx` (out of scope to modify) renders a generic `ControlRow` label *"Use my {title} to personalise Profolio"* + hint *"Applies to the people, companies, jobs and posts Profolio suggests to you…"* for every `linked` row. For the 6 no-consumer rows this generic label still slightly overclaims; the reworded `detailBody` card directly above it now states plainly that nothing uses the data yet, which sets the context. Making the control label itself per-row honest would require editing `AdvertisingDataDetailPage.tsx` and adding a field to `advertisingDataConfig.ts` — both explicitly out of scope here (§8).

---

## 4. Files changed

| File | Change |
|---|---|
| `src/config/advertisingDataConfig.ts` | `listBlurb` + `detailBody` strings for the 6 topics `companies-followed`, `groups`, `education-skills`, `job-information`, `employer`, `profile-location`. Nothing else. |
| `supabase/migrations/20260904100000_search_people_honour_connections_consent.sql` | new — `CREATE OR REPLACE FUNCTION public.search_people(...)`. |

No other frontend file changed. `usePeopleSearch.ts` untouched (RPC signature unchanged).

---

## 5. Database migrations

**`20260904100000_search_people_honour_connections_consent.sql`** — `CREATE OR REPLACE FUNCTION public.search_people(text, integer, integer)` with the `use_connections` CTE column + gated ORDER BY (§1); re-applies `REVOKE … FROM anon, public` / `GRANT EXECUTE … TO authenticated`. No schema/table/RLS/grant change beyond re-asserting the existing function grant. Applied and verified live.

Step 6 needs **no migration** (frontend copy only).

---

## 6. Security

- The `use_connections` flag is read from **`where pr.user_id = auth.uid()`** — the caller's own row only. No other user's `preferences` is read.
- The flag is used **only** in the ORDER BY `CASE`; it is **not** in the `RETURNS TABLE` list and never reaches the client.
- `search_people` remains `SECURITY DEFINER`, `SET search_path TO 'public'`, `EXECUTE` granted to `authenticated` only (revoked from `anon`, `public`).
- No RLS policy touched. No change to `profiles` grants (the Steps 1–3 column lock is intact — `search_people` reads `profiles` as `postgres`, unaffected).
- No preference data became public; the Steps 1–3 checks still hold (`anon`/authenticated-non-owner cannot `SELECT preferences` directly).
- Advisors: `search_people` still carries only the pre-existing intentional-accessor advisory; no new `search_path` or anon-exposure finding.

---

## 7. Tests

### Step 5 — ON / OFF / ABSENT behaviour (live, as `authenticated` User A)

To make mutual-count order and `created_at` order **disagree**, the high-mutual candidate was temporarily made the older row, then `search_people('')` was run under each flag value:

| `data_use.connections` | pos 1 | pos 2 | interpretation |
|---|---|---|---|
| `true` | **Anmol** (mutual = 1) | Anushka (mutual = 0) | mutual-count ranking — unchanged from before |
| `false` | **Anushka** (mutual = 0) | Anmol (mutual = 1) | **order flipped** → mutual signal not used; `created_at desc` fallback |
| *absent* (key deleted) | **Anmol** (mutual = 1) | Anushka (mutual = 0) | identical to `true` → default preserved |

Function definition verified live to contain both `use_connections` and the gated `CASE … ORDER BY`.

Also checked: the RPC executes and returns rows in all three states; logged-out callers still get nothing (`current_profile_id()` NULL → `p.id <> NULL` excludes every row, as before); no `preferences` column in the result set.

**Test-data disclosure:** the ON/OFF proof required temporary writes. `execute_sql` did **not** roll back the `DO`-block DML, so three rows were mutated and then **restored to their exact pre-test values**:
- `139fe3c2` (Anmol) `created_at` → `2025-10-05 09:52:22.889957+00` (original, µs-exact)
- `eae73434` (Anushka) `created_at` → `2025-09-06 03:20:29.470802+00` (original, µs-exact)
- `518b923b` (account owner) `preferences.data_use` → `{"connections": true}` (original; all sibling keys — `localization`, `notifications`, `sound_effects`, `job_preferences`, `app_lock_enabled`, `push_notifications`, `show_active_status`, `hide_profile_strength`, `personalized_recommendations` — verified intact)
Only `profiles.updated_at` on the owner row moved forward (unavoidable side-effect of any write; content-identical). No rows deleted.

### Browser (dev server, signed in)

| Surface | Result |
|---|---|
| Network → Grow "People you may know" | renders, "Anmol A. · Student · patna, india · 1 mutual connection · Pending"; no `search_people` errors; search box present |
| Advertising Data list (`/settings/advertising`) | all 16 rows render; `linked` rows still show live summaries ("1 connection", "Following 2 companies", "3 groups", "2 schools · 6 skills · 1 language", "1 position", "Viswanath Automobile Pvt Ltd"); toggles show "On"; intro card + section headers + navigation unchanged |
| `/settings/advertising/groups` detail | new honest `detailBody`; "This data on your profile — 3 groups" + "View your groups" intact; toggle intact; footer "Only you can see and change this" |
| `/settings/advertising/connections` detail | `detailBody` **unchanged** ("Profolio can use who you're connected to when ranking people, companies and posts…") — now accurate |
| toggle a `data_use` row off→on | (verified in the Steps 1–3 pass — `setDataUsePref` write path unaffected; not re-run here) |
| mobile ≈378 px + desktop | Advertising Data list + detail render cleanly at both |

### Build / lint / types

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint` on `advertisingDataConfig.ts` | **0** |
| `npx vite build` | **success** |
| `npx eslint` on `usePeopleSearch.ts` | 1 **pre-existing** error (`row: any` at line 12, from the original Phase-1 commit `2e94cba`) — file **not modified** by this task |

---

## 8. Remaining gaps (deliberately not implemented)

1. **`search_people` still returns `mutual_count`** and the person card still shows "N mutual connections" when `connections` is OFF. The toggle governs **ranking** (the stated requirement); the mutual-count hint is the caller's own info about their own graph. Hiding it is a visible UX change beyond this task — flagged, not done.
2. **The generic control label** in `AdvertisingDataDetailPage.tsx` ("Use my {title} to personalise Profolio" / "Applies to the people, companies, jobs and posts…") still reads the same for all `linked` rows. Per-row honest control copy needs an edit to that file + a new config field — both out of scope. The reworded `detailBody` card above the control carries the honest message.
3. **The 6 signals still have no consumer.** This task only makes the copy honest; wiring real enforcement waits until the corresponding recommendation surfaces (suggested companies / groups / employer-based / skills-based matching / location-based) actually exist.
4. **`connections`'s `detailBody`** still says "ranking people, companies and posts"; only *people* ranking (via `search_people`) is wired today. It was left unchanged because Step 6 is scoped to the six no-consumer rows and the statement is now substantially true. A future tightening could narrow it to "the people it suggests to you".
5. Everything deferred earlier still stands: `user_settings` table / RMW-race (B3), orphan keys `job_preferences` / `app_lock_enabled` / `localization` (B5), `address` still ungated in `ContactInfoDialog`, `email`/`phone` still `SELECT`-able by `authenticated` for Connect email-search.

---

## Acceptance criterion

> `Connections → OFF` must produce a real server-side behavioral difference in `search_people`, while the six rows without consumers must no longer overclaim what their toggles currently control.

**Met.** §7 shows the Grow people order **flips** between `connections = true` and `= false` (mutual-first → newest-first), server-side, with the preference read only from the caller's own row and never returned to the client; `= absent` behaves as `= true` (default preserved). The six no-consumer rows' `detailBody` now states plainly that Profolio does not currently use the data and the switch records a choice for the future, while their toggles, live data summaries, navigation and row structure are unchanged. `tsc` / `eslint` (new file) / `vite build` are clean.
