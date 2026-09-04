# Consent Audit Log / Record of Consent

**Status:** implemented & verified · server-side only · no advertising / tracking / billing infrastructure activated
**Date:** 2026-09-04
**Migrations:** `20260904130000_consent_audit_log.sql`, `20260904130100_audit_consent_changes_in_patch_rpc.sql`, `20260904130150_audit_consent_lock_preimage.sql`
**Frontend changes:** none

---

## 1. What this is

A per-user, append-only history of changes to **Advertising Data consent / personalisation** preferences. When a user flips one of the audited toggles, one row is written to `public.consent_audit_log` recording *which signal*, its *old* and *new* value, and *when* — in the **same database transaction** as the preference change itself.

It is **not** an advertising system. It starts no ad provider, no tracking, no measurement, no affiliate sharing, no Stripe/billing, no Ads Manager. It only records the user's own toggle history.

---

## 2. PART 1 — Which preferences are consent changes

Every audited signal is written through **exactly one** function, `public.update_my_preferences_patch(jsonb)`. Nothing else writes `data_use.*` or `personalized_recommendations` — not a trigger, not an edge function, not a direct client `UPDATE` (the Steps 1–3 privilege model blocks that). This is what makes precise auditing possible.

| Preference | User-facing consent? | Current writer | Actual consumer today | Should audit? |
|---|---|---|---|---|
| `data_use.connections` | Yes — Advertising data ▸ "Connections" | `useAdvertisingDataSettings.setDataUsePref` → `update_my_preferences_patch` | `search_people` mutual-connection ranking (real, since Step 5) | **Yes** |
| `data_use.companies_followed` | Yes — Advertising data ▸ linked row | `setDataUsePref` → RPC | none yet (copy: "records your choice") | **Yes** (recorded consent) |
| `data_use.groups` | Yes — linked row | `setDataUsePref` → RPC | none yet | **Yes** |
| `data_use.education_skills` | Yes — linked row | `setDataUsePref` → RPC | none yet | **Yes** |
| `data_use.job_information` | Yes — linked row | `setDataUsePref` → RPC | none yet | **Yes** |
| `data_use.employer` | Yes — linked row | `setDataUsePref` → RPC | none yet | **Yes** |
| `data_use.profile_location` | Yes — linked row | `setDataUsePref` → RPC | none yet | **Yes** |
| `data_use.ads_off_profolio` | Future — `future` row, `<Switch disabled>`, **no `onCheckedChange`** | **none today** | none | **Yes** — mechanism ready, 0 events until a writer ships |
| `data_use.measure_ad_success` | Future — `future` row, disabled, no writer | **none today** | none | **Yes** — ready, 0 events |
| `personalized_recommendations` | Yes — Advertising data ▸ "Interests and traits" | `useAdvertisingDataSettings.setPersonalizedRecommendations` → RPC (single canonical writer since B4) | Feed "For You" personalisation | **Yes** |
| `mentions_from` | No — interaction control (who may @mention me) | `useProfileSettings.updatePrefKey` → RPC | `search_mentionable_people` | No — not an advertising/personalisation consent; possible future extension |
| `show_active_status` | No — presence visibility | `updatePrefKey` → RPC | `get_public_profile` | No |
| `share_profile_updates` | No — "notify my connections of updates" | `updatePrefKey` → RPC | `broadcast_profile_update` | No |
| `notifications.*` (7 keys) | No — notification category prefs | `useNotificationPreferences.setCategory` → RPC | notification fan-out | No |
| `last_profile_update_broadcast_at` | No — internal throttle timestamp | `broadcast_profile_update` (writes the column directly, **not** via this RPC) | throttle guard | No — never a user choice |
| `*_visibility` columns, recruiter-sharing flags, `autoplay_videos`, `cover_position` | No — a separate profile **Visibility** domain; written as direct `profiles` column `UPDATE`s, not through the preferences RPC | various | No — out of scope; could get their own parallel log later |

**Audited signal set = 10 keys:** the 7 active `data_use.*` + 2 future `data_use.*` + `personalized_recommendations`.

Nothing else in `preferences` is audited. This is deliberately **not** a generic "log every preferences change" system.

---

## 3. PART 2 — Existing infrastructure & schema

### 3.1 Existing audit/log tables (checked — none reusable)

| Table | Purpose | Reusable? |
|---|---|---|
| `auth.audit_log_entries` | Supabase GoTrue internal (sign-in / token events) | No — not ours, not preference-related |
| `public.ad_billing_ops_log` | K3-C billing reconciliation sweep output | No — billing, do not touch |
| `public.ad_billing_events`, `ad_billing_webhook_events`, `ad_delivery_events`, `ad_spend_events` | Advertising subsystem | No |
| `public.hiring_application_events` | Recruiting pipeline stage history | No |
| `public.rate_limit_events` | Server-side rate-limit counters | No |

There is **no** general consent / settings-change audit table. A new table is justified.

### 3.2 New table

```sql
create table public.consent_audit_log (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  signal_key     text not null,          -- 'data_use.connections' | 'personalized_recommendations' | ...
  old_value      jsonb,                  -- previous JSON value; null = signal had never been set
  new_value      jsonb not null,         -- new JSON value; always present for a real change
  source         text not null default 'settings_patch',
  schema_version smallint not null default 1,
  occurred_at    timestamptz not null default now(),
  constraint consent_audit_log_signal_key_check check (signal_key in ( ...the 10 keys... ))
);
create index consent_audit_log_user_time_idx on public.consent_audit_log (user_id, occurred_at desc);
```

Design choices:

* **One row per changed signal.** For `data_use.*` the row records the *individual* key (`data_use.connections`), never the whole `data_use` object and **never the whole `preferences` blob**.
* **`old_value` / `new_value` as `jsonb`** — today always JSON `true` / `false` / `null`, but jsonb keeps the mechanism ready for a future non-boolean consent without a column-type migration.
* **`signal_key` CHECK** lists the 10 known keys. Consistent with the B6 validator's "a new setting always ships with a code change, so the same PR extends the list" rule. Client can't insert anyway (see §4); the CHECK is defence in depth.
* **`source`** — only `'settings_patch'` exists today; leaves room for `'admin'`, `'import'`, `'account_reset'` without a schema change.
* **`schema_version`** — bumped only if the stored value representation ever changes.
* **No IP / user-agent / device / geo.** Minimum necessary metadata (see §8).

---

## 4. PART 3 & 9 — Security model: in-function vs trigger, RLS, privileges

### 4.1 In-function (chosen) vs trigger

| | In `update_my_preferences_patch` (**chosen**) | `AFTER UPDATE` trigger on `profiles` |
|---|---|---|
| Atomic (update + audit succeed/fail together) | **Yes** — one plpgsql body = one transaction | **Yes** — trigger runs in the same transaction |
| Fires only for real consent changes | **Yes** — this RPC is the *sole* writer of every audited signal | **No** — also fires on `last_active_at` heartbeats, avatar/bio edits, the `broadcast_profile_update` throttle write, and every direct visibility-column `UPDATE`; must re-derive the diff on all of them |
| Overhead on unrelated writes | none | diff computation on every `profiles` update |
| Logic locality | next to the deep-merge it depends on | split across two objects |

Atomicity is **not** the tiebreaker (both are atomic). Precision and overhead are — so the audit lives inside the RPC.

### 4.2 RLS & privileges

```sql
alter table public.consent_audit_log enable row level security;
revoke all on table public.consent_audit_log from anon, authenticated;
grant select on table public.consent_audit_log to authenticated;      -- SELECT only

create policy "consent_audit_log: owner can read own history"
  on public.consent_audit_log for select to authenticated
  using (user_id = auth.uid());
-- No INSERT / UPDATE / DELETE policy or grant exists for any client role.
```

* **anon** — no grant at all: cannot read, write, or call the accessor.
* **authenticated** — `SELECT` only, and RLS restricts it to `user_id = auth.uid()`.
* **INSERT / UPDATE / DELETE** — no grant and no policy for `anon` or `authenticated`, so a user can never forge, alter, or erase consent history.
* **The only writer** is `update_my_preferences_patch` (`SECURITY DEFINER`, definer = `postgres`), which bypasses RLS to insert.
* **Identity** is always `auth.uid()`, taken server-side. The RPC signature is `update_my_preferences_patch(patch jsonb)` — there is **no `user_id` parameter**, so a client physically cannot submit another user's id.

### 4.3 Read accessor

```sql
create function public.get_my_consent_history(limit_n integer default 200)
returns setof public.consent_audit_log
language sql stable security definer set search_path to ''
as $$ select * from public.consent_audit_log
     where user_id = auth.uid()
     order by occurred_at desc
     limit greatest(1, least(coalesce(limit_n, 200), 1000)); $$;
revoke all on function public.get_my_consent_history(integer) from public, anon;
grant execute on function public.get_my_consent_history(integer) to authenticated;
```

The RLS policy alone is sufficient for a future "your consent history" screen; the accessor is the documented, typed read contract (mirrors `get_my_settings()`) and bounds the row count.

---

## 5. PART 4 — Change detection semantics

Inside the RPC:

1. `_assert_valid_preference_patch(patch)` (B6 validator) runs first.
2. `select preferences ... where user_id = auth.uid() for update` — capture the pre-image **under a row lock** (see §7).
3. `update ... set preferences = _jsonb_deep_merge(current, patch) ... returning preferences into merged`.
4. For each of the 10 audited signals, compare `old_p #> path` vs `merged #> path` with `IS DISTINCT FROM`. Insert one row per signal that actually changed.
5. Return `merged`.

Resulting behaviour:

| Transition | Event? |
|---|---|
| `true → false` | **1 event** |
| `false → true` | **1 event** |
| `true → true` (same value re-written) | none |
| `false → false` | none |
| absent → `true`/`false` (first time set) | **1 event**, `old_value = null` |
| unrelated key in the same patch (`notifications.jobs`, `mentions_from`, …) | none |
| empty patch `{}` | none |
| `broadcast_profile_update` throttle write (`last_profile_update_broadcast_at`) | none — it never calls this RPC |
| `last_active_at` heartbeat / avatar / bio | none — not this RPC |

`IS DISTINCT FROM` handles `null` correctly, so absent→set is caught and same-value is ignored.

---

## 6. PART 5 & 6 — Future-only consents and personalisation

* **`data_use.ads_off_profolio` and `data_use.measure_ad_success`** — PART 5 **option 3**: they are in the audited-signal list and the CHECK constraint, so the mechanism is *ready*. They have no writer today (`AdvertisingDataDetailPage.tsx` renders them as a disabled `<Switch>` with no `onCheckedChange`), so they produce **zero events** until a real writer ships. No UI is activated.
* **`personalized_recommendations`** — PART 6: it *is* included. It is a real behavioural preference (controls the Feed "For You" ranking) with a single canonical writer since B4, so it produces exactly one event per real change with no duplication. Old value, new value and timestamp are recorded like any other signal.

---

## 7. PART 7 — Retention model

Recommended (privacy-minimal, no invented legal requirement):

* **Keep for the life of the account.** Rows are tiny (one per real toggle), and their entire purpose is historical — an expiry window would defeat it. No time-based purge job.
* **Account deletion → `ON DELETE CASCADE`.** When `auth.users` row goes, the consent history goes with it. Keeping orphaned consent rows would itself be a data-minimisation problem.
* **User can view** via `get_my_consent_history()` (or a direct RLS-scoped `select`). Export: see §10.
* **Minimum metadata** — signal key, old value, new value, timestamp, and a coarse `source` tag. **No IP address, no user-agent, no device fingerprint, no geolocation.** Adding those later would need an explicit product/legal decision.

---

## 8. PART 8 — Implementation (the smallest safe change)

No new transaction, no trigger, no frontend read-modify-write. The existing atomic patch RPC gains a pre-image snapshot and a diff-driven insert:

```sql
create or replace function public.update_my_preferences_patch(patch jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare uid uuid := auth.uid(); old_p jsonb; merged jsonb;
begin
  perform public._assert_valid_preference_patch(patch);

  select p.preferences into old_p
  from public.profiles p
  where p.user_id = uid
  for update;                                  -- lock the pre-image (see below)
  if not found then
    raise exception 'update_my_preferences_patch: no profile row for the current user';
  end if;

  update public.profiles p
     set preferences = public._jsonb_deep_merge(coalesce(p.preferences, '{}'::jsonb), patch)
   where p.user_id = uid
  returning p.preferences into merged;

  insert into public.consent_audit_log (user_id, signal_key, old_value, new_value, source)
  select uid, sig.key, old_p #> sig.path, merged #> sig.path, 'settings_patch'
  from (values
    ('data_use.connections',         array['data_use','connections']),
    ('data_use.companies_followed',  array['data_use','companies_followed']),
    ('data_use.groups',              array['data_use','groups']),
    ('data_use.education_skills',     array['data_use','education_skills']),
    ('data_use.job_information',      array['data_use','job_information']),
    ('data_use.employer',            array['data_use','employer']),
    ('data_use.profile_location',    array['data_use','profile_location']),
    ('data_use.ads_off_profolio',    array['data_use','ads_off_profolio']),
    ('data_use.measure_ad_success',  array['data_use','measure_ad_success']),
    ('personalized_recommendations', array['personalized_recommendations'])
  ) as sig(key, path)
  where (old_p #> sig.path) is distinct from (merged #> sig.path)
    and (merged #> sig.path) is not null;      -- defends new_value NOT NULL

  return merged;
end; $$;
```

### Why `SELECT ... FOR UPDATE` (migration `...130150`)

Without the lock there is a window between the pre-image read and the `UPDATE`. A concurrent `update_my_preferences_patch` for the **same user** that changes a **different** audited signal can commit inside that window; our `UPDATE` then re-reads under Read Committed and our `merged` includes the other call's change, but our `old_p` predates it — so our diff loop would see that unrelated flip and write a **spurious duplicate event** for a key this call never touched.

`FOR UPDATE` makes the second call block until the first commits, so `old_p` is always the true immediate pre-image of this call's own change. One user's concurrent preference toggles now serialise on that row lock — harmless (a person flips settings one at a time) and it preserves the B3 guarantee that the deep-merge always runs against the current committed row.

### Atomicity

The whole function body is one transaction. If the `INSERT` fails for any reason, the function raises and the `UPDATE` rolls back with it. There can be **no preference change without its audit event**, and **no audit event without its preference change**. The optimistic UI / rollback / toast in `useAdvertisingDataSettings` is unchanged — it already keys off the RPC succeeding or throwing.

---

## 9. PART 10 — Test matrix & results

All run against the live DB as the seed user (`518b923b…`) via JWT-claim role switch and through the real browser UI. Owner `preferences` and all test `consent_audit_log` rows were restored/deleted afterwards (owner back to the exact 4-key baseline; table empty).

| # | Scenario | Expected | Result |
|---|---|---|---|
| T1 | `data_use.connections` true → false | 1 event `true→false` | ✅ |
| T2 | write `connections=false` again | no event | ✅ |
| T3 | `connections` false → true | 1 event `false→true` | ✅ |
| T4 | write `connections=true` again | no event | ✅ |
| T5 | `notifications.jobs` toggled (unrelated) via same RPC | no consent event | ✅ (pref changed, 0 audit rows) |
| T6 | `personalized_recommendations` true → false | 1 event | ✅ |
| T7 | empty patch `{}` | no event | ✅ |
| T8 | one patch sets `data_use.employer` **and** `data_use.groups` (both absent→true) | exactly 2 events, one per key | ✅ (only those two; no other signal logged) |
| T9 | forced audit-insert failure (temp `BEFORE INSERT` trigger raises), then `connections` patch | RPC errors; **`preferences` unchanged**; 0 audit rows | ✅ `connections` stayed `true`, `personalized_recommendations` stayed at prior value, 0 rows |
| T10 | User B reads User A's history — direct `select` + `get_my_consent_history()` | 0 rows | ✅ both return 0 |
| T11 | anon: `select`, `insert`, `get_my_consent_history()`, `update_my_preferences_patch()` | all denied | ✅ all `42501` |
| T12 | authenticated client `INSERT` (as self **and** as another user), `UPDATE`, `DELETE` on the table | all denied | ✅ all `42501` |
| T13 | client forges `user_id` | impossible — RPC has no `user_id` arg, identity is `auth.uid()` | ✅ by construction |
| T14 | concurrent patches to two different audited signals | both changes persist, both events, no duplicate | ✅ serialised by `FOR UPDATE` ⇒ equivalent to sequential ⇒ T8 outcome; disjoint back-to-back patches each logged only their own signal, B3 deep-merge intact |
| B-UI | toggle Connections OFF→ON→ and Interests & traits OFF→ON in the live UI | pref persists + one event each, correct old/new, distinct timestamps | ✅ 4 events: `connections true→false`, `connections false→true`, `personalized_recommendations true→false`, `personalized_recommendations false→true` |

### Regression / build

* `npx tsc --noEmit` — clean.
* `npx vite build` — succeeds (only the pre-existing jspdf dynamic-import and chunk-size warnings).
* `npx eslint` — 99 pre-existing `no-explicit-any` errors, all in files untouched by this task (`Jobs.tsx`, `insights/*`, ads pages from the separate ad-billing branch); every file this session touched is eslint-clean. **This task changed zero frontend files.**
* Browser (mobile viewport, seed user): Advertising Data list, Connections detail, Interests and traits detail, Notifications, Feed "For You" — all render and function unchanged.
* `get_advisors(security)` — 3 notices for the new objects, all benign and matching the rest of the codebase:
  * `pg_graphql_authenticated_table_exposed` on `consent_audit_log` — expected; `authenticated` has RLS-gated `SELECT` (1 of 101 identical project-wide).
  * `authenticated_security_definer_function_executable` on `get_my_consent_history` and `update_my_preferences_patch` — intentional; both filter on `auth.uid()` and pin `search_path` (1 of 115 identical).
  * No new `function_search_path_mutable`, no `rls_enabled_no_policy` for `consent_audit_log` (it has a policy), no `anon_*` exposure.

---

## 10. PART 11 — Data export (`DownloadDataPage.tsx`) — recommendation only, not changed

`src/pages/settings/DownloadDataPage.tsx` builds a client-side JSON bundle from plain authenticated `SELECT`s (`account`, `profile` = `SELF_PROFILE_COLUMNS` + `get_my_settings()`, `posts`). Its own doc comment says the scope is deliberately the subset "whose ownership key is unambiguous" and that other datasets are "intentionally left for a follow-up."

**Recommendation: yes, include consent history in the export — as a follow-up, not in this change.** It is unambiguously the user's own data, small, already RLS-scoped, and a "record of consent" is exactly the kind of thing a data export should contain. Concretely:

* add `get_my_consent_history(1000)` to the `Promise.all`;
* add `consent_history: history ?? []` to the `bundle`;
* add the typed entries for `consent_audit_log` / `get_my_consent_history` to `src/integrations/supabase/types.ts` at the same time (they are **not** added now — nothing consumes them yet).

No change is made here because PART 11 asks only for a recommendation and the export's own convention is to add datasets deliberately in their own change.

---

## 11. PART 12 — Existing behaviour unchanged

* **Advertising Data** list + all detail pages: unchanged (server RPC return contract is identical — still returns the merged `preferences` object).
* **Connections consent** (Step 5 `search_people` ranking): untouched.
* **Feed "For You"**: renders, personalisation path untouched.
* **Notifications**: category toggles work; they flow through the same RPC and correctly produce **no** consent events.
* **Network / Settings**: unchanged.
* **B3 atomic deep-merge**: preserved (the merge still runs against the current committed row; `FOR UPDATE` only serialises same-row concurrent writers).
* **B6 validator**: still runs first, unchanged.

---

## 12. Files

| File | Change |
|---|---|
| `supabase/migrations/20260904130000_consent_audit_log.sql` | new table + index + RLS (SELECT-own-only) + `get_my_consent_history()` accessor |
| `supabase/migrations/20260904130100_audit_consent_changes_in_patch_rpc.sql` | `update_my_preferences_patch` captures pre-image + inserts one audit row per changed audited signal, same transaction |
| `supabase/migrations/20260904130150_audit_consent_lock_preimage.sql` | tighten the pre-image read to `SELECT … FOR UPDATE` (race-free diff) |

No application/frontend files changed.

---

## 13. Acceptance criteria

| | Criterion | Status |
|---|---|---|
| A | Every actual audited consent change produces exactly one event | ✅ T1, T3, T6, T8, B-UI — one row per changed signal |
| B | Writing the same value again produces no event | ✅ T2, T4, T7 |
| C | Preference update and audit event are atomic | ✅ T9 — forced audit failure rolls the preference change back; single-transaction function body |
| D | Users cannot forge another user's audit history | ✅ T12, T13 — no `user_id` param, no client `INSERT`, identity from `auth.uid()` |
| E | Audit records themselves are private | ✅ T10, T11 — RLS `user_id = auth.uid()`, no anon access |
| F | Existing Advertising Data / Feed / Network / Settings behaviour unchanged | ✅ §11, browser checks, tsc/build clean |
| G | No advertising / tracking infrastructure activated | ✅ one table + one function change; future-only signals have no writer and emit nothing |
