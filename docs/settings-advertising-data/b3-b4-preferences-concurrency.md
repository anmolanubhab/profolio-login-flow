# B3 (preferences RMW race) + B4 (duplicate personalized_recommendations writer)

**Date:** 2026-09-04
**Not touched:** Ads Manager, Stripe, billing, `ad_provider_config`, Advertising Data UI/structure, `get_public_profile()` / `get_my_settings()` / the profiles privilege hardening / `search_people` consent gate. **Not done** (separate tasks): B5 orphan-key cleanup, B6 server-side schema validation, full `user_settings` migration, consent audit log, `SettingsRow` rewrite.

---

## 1. Complete `profiles.preferences` writer inventory

`user_feed_preferences` is a **separate table** (interested/blocked posts) — not in scope.

| Writer | Setting(s) | Read-before-write? | Whole-JSONB update? | Atomic? | Race possible? |
|---|---|---|---|---|---|
| `useProfileSettings.updatePrefKey` → `updateMentionsFrom` / `toggleShowActiveStatus` / `toggleShareProfileUpdates` | `mentions_from`, `show_active_status`, `share_profile_updates` (top-level) | **Yes** (`fetchMyPreferences()` = `get_my_settings` RPC) | **Yes** (`.update({ preferences: {...currentPrefs, [key]: value} })`) | **No** | **Yes** |
| `useNotificationPreferences.setCategory` | `notifications.<key>` (nested) | **Yes** | **Yes** (`.update({ preferences: {...currentPrefs, notifications: merged} })`) | **No** | **Yes** |
| `useAdvertisingDataSettings.setDataUsePref` | `data_use.<key>` (nested) | **Yes** | **Yes** (`.update({ preferences: {...currentPrefs, data_use: {...currentDataUse, [key]: value}} })`) | **No** | **Yes** |
| `useAdvertisingDataSettings.setPersonalizedRecommendations` | `personalized_recommendations` (top-level) | **Yes** | **Yes** | **No** | **Yes** |
| `useProfileSettings.togglePersonalizedRecommendations` | `personalized_recommendations` (top-level) | **Yes** | **Yes** | **No** | **Yes** — **and B4: this is a 2nd, UNUSED writer for the same key** |
| `broadcast_profile_update()` (RPC, `SECURITY DEFINER`, fired ~4 s after any profile edit by `notifyProfileChanged()`) | `last_profile_update_broadcast_at` (top-level) | reads a local var, **but** the write is `set preferences = jsonb_set(coalesce(preferences,'{}'), …)` — the SET expr reads the **live column** | jsonb_set of one path | **Yes (already)** | No (for its own key) — but it is a concurrent writer the others can clobber |

**Direct `preferences` reads** (all own-row, all via `get_my_settings()` since the Steps 1–3 column lock): `useProfileSettings` init, `useNotificationPreferences.fetchPreferences`, `usePersonalization.fetchValue`, `useAdvertisingDataSettings.load`. `ProfilePage.mergeOwnerProfile` folds the RPC's `preferences` onto the profile row. `search_people` / `search_mentionable_people` read other users' `preferences ->> '<key>'` server-side (SD functions, unaffected).

**No other RPC / trigger writes `preferences`** (verified: `pg_proc` where body updates profiles + mentions preferences ⇒ only `broadcast_profile_update`; triggers on `profiles` are `update_profiles_updated_at` and `trg_sync_candidate_search_index`, neither touches `preferences`).

---

## 2. Confirmed race condition

The 4 client writers all do: **RPC read of the whole `preferences` blob → merge one key in JS → `UPDATE` the whole blob**.

```
Writer A                                    Writer B (another tab / rapid nav)
--------                                    ---------------------------------
p := get_my_settings()  -> V0
                                            p := get_my_settings()  -> V0   (same stale snapshot)
update preferences = {...V0, notifications:{...jobs:false}}   (DB = V0 + jobs:false)
                                            update preferences = {...V0, data_use:{...connections:false}}
                                            -> writes V0's data_use, DROPS "jobs:false", and because the
                                               spread replaces the whole data_use object with V0's stale
                                               copy it can also revert any *real* data_use.* key B didn't
                                               see.
```

**Deterministic SQL proof** (`execute_sql`, run as `authenticated`; scratch keys `_b3_*` so real settings are never at risk; all writes restored after):

| step | `_b3_test_a` (A) | `_b3_test_b` (B) | `data_use._b3_c` (A) | `data_use._b3_d` (B) | real `data_use.connections` |
|---|---|---|---|---|---|
| V0 baseline | – | – | – | – | **true** |
| after Writer A (RPC) | ✓ | – | ✓ | – | true |
| **OLD: stale Writer B shallow-overwrites** | **✗ lost** | ✓ | **✗ lost** | ✓ | **null — real key wiped!** |
| **NEW: A + B both via `update_my_preferences_patch`** | **✓** | **✓** | **✓** | **✓** | **true** |
| RESTORED to V0 | – | – | – | – | true |

The OLD row shows both the lost-update **and** that a stale shallow write on `data_use` reverted the real `connections` key. The NEW row shows every independent change surviving.

---

## 3. Options considered

| Option | Concurrency | RLS/security | Migration | Back-compat | Frontend | Maintainability | Rollback risk | Verdict |
|---|---|---|---|---|---|---|---|---|
| **A. Atomic deep-merge RPC** `update_my_preferences_patch(patch jsonb)` — server merges `patch` into the live row inside the UPDATE | **Safe** — Read Committed re-evaluates `deep_merge(preferences, patch)` against the post-lock row; deep merge keeps disjoint sub-keys | `SECURITY DEFINER` + `where user_id = auth.uid()`; no `target` param; `EXECUTE` = authenticated only; RLS untouched; no new SELECT surface | 1 small migration (2 pure/SD functions) | Full — same `preferences` jsonb, all keys, `get_my_settings()` unchanged | 4 call sites become 1-liners; **removes** read-before-write; net −40 lines | Low — one obvious merge primitive; frontend simpler | Low — `drop function` reverts; no data shape change | **CHOSEN** |
| B. `user_settings` typed table | Safe (typed columns) | New table + RLS + repoint every read *and* write + `get_my_settings` rewrite | Large + data backfill + deprecation window | Breaks `preferences` reads until every consumer moved | Every hook + `ProfilePage` + `DownloadDataPage` | Best long-term | **High** (backfill, dual-write window) | Overkill for "smallest safe fix"; deferred |
| C. Per-path `jsonb_set` updates | Safe if in SET expr | Same as A | Similar to A | Full | Needs a path-array param; `jsonb_set` won't create missing intermediate objects, so nested keys need `coalesce` gymnastics | Fiddlier than A | Low | A is cleaner (handles missing parents natively) |
| D. Optimistic-concurrency token (`preferences_version` col + CAS retry) | Safe | Same | New column + retry loop in every writer | Full | Retry logic in 4 places | More moving parts than A | Low-med | A achieves the same with no retry loop |

---

## 4. Chosen solution — why it is safest

**Option A.** The audit shows a single free-form jsonb column, correct RLS already (`profiles_update_own` = `user_id = auth.uid()`), reads already isolated behind `get_my_settings()`, and only one (already-safe) server writer. The minimal thing that removes the race is to move the merge to the server and make it merge against the **current** row:

```sql
update public.profiles p
   set preferences = public._jsonb_deep_merge(coalesce(p.preferences, '{}'::jsonb), patch)
 where p.user_id = auth.uid();
```

Under `READ COMMITTED` (Supabase default), when two such `UPDATE`s hit the same row, the second waits on the first's row lock and, when it proceeds, **re-reads the just-committed row and re-evaluates the SET expression** against it. So `patch` is always deep-merged onto the latest value — no snapshot, no lost update. Deep merge (vs shallow `||`) means concurrent writes to `data_use.connections` and `data_use.groups`, or `notifications.jobs` and `notifications.network`, both land.

It satisfies every B3 requirement: no lost updates (§2, §8), all existing keys survive (§8, §10), unknown/unrelated keys survive (deep merge only touches keys named in `patch`), RLS intact, owner-only (one arg, `where user_id = auth.uid()`), frontend APIs unchanged (same hook method signatures), no `preferences` exposure to others, no reintroduced direct SELECT (RPC `RETURNING` runs as definer, returns only the caller's own row). And it satisfies acceptance E — the merge is at the DB layer, not more frontend RMW.

---

## 5. Database changes

**`20260904110000_atomic_preferences_deep_merge.sql`**
- `public._jsonb_deep_merge(a jsonb, b jsonb) → jsonb` — `LANGUAGE sql IMMUTABLE`, recursive: objects merged key-by-key, non-objects → `b`, `null` in `b` wins. `revoke all from public, anon`.
- `public.update_my_preferences_patch(patch jsonb) → jsonb` — `LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''`. Guards `jsonb_typeof(patch) = 'object'` (raises `P0001` → HTTP 400 otherwise); `update … set preferences = _jsonb_deep_merge(coalesce(preferences,'{}'), patch) where user_id = auth.uid() returning preferences`; raises if `not found`. `revoke all from public, anon`; `grant execute to authenticated`.

**`20260904110100_lock_jsonb_deep_merge_helper.sql`**
- `revoke execute on function public._jsonb_deep_merge(jsonb, jsonb) from authenticated` — least privilege; the SD RPC calls it as `postgres` so this doesn't break it.

No schema/column/RLS/trigger changes. `broadcast_profile_update` **left as-is** (already merges atomically via `jsonb_set` in its SET expression).

Merge-function unit checks (live): `{a,data_use:{connections,groups},notifications:{jobs}}` + `{data_use:{connections:false}}` → keeps `groups`, `notifications`, `a`; `{data_use:{connections:true}}` + `{data_use:{groups:false}}` → both; `{}` + nested patch → creates structure; 3-level recursion → merges.

---

## 6. Frontend changes

| File | Change |
|---|---|
| `src/lib/mySettings.ts` | **+ `patchMyPreferences(patch)`** — wraps `supabase.rpc('update_my_preferences_patch', { patch })`, returns the merged object. `fetchMySettings` / `fetchMyPreferences` (reads) unchanged. |
| `src/integrations/supabase/types.ts` | + `update_my_preferences_patch: { Args: { patch: Json }; Returns: Json }`. |
| `src/hooks/useProfileSettings.ts` | `updatePrefKey`: `fetchMyPreferences()` + spread `.update({preferences})` → `patchMyPreferences({ [key]: value })`. Dropped `fetchMyPreferences` import. **B4:** removed the unused `togglePersonalizedRecommendations` (function + return-object entry), the `personalized_recommendations` field from the `ProfileSettings` interface / default / init read, and the now-unused `publishPersonalizationChange` import. |
| `src/hooks/useNotificationPreferences.ts` | `setCategory`: `fetchMyPreferences()` + JS merge + `.update({preferences})` → `patchMyPreferences({ notifications: { [key]: enabled } })`. Removed the redundant post-write `setPrefs(merged)/publish(merged)` (the optimistic value already equals the merged value). `normalizeNotificationPreferences` still used for the read. |
| `src/hooks/useAdvertisingDataSettings.ts` | `setDataUsePref` → `patchMyPreferences({ data_use: { [key]: value } })`; `setPersonalizedRecommendations` → `patchMyPreferences({ personalized_recommendations: value })`. `load()` read path unchanged. `publishPersonalizationChange` still called by `setPersonalizedRecommendations`. |

**Hook public APIs unchanged** — every settings component calls the same method names with the same args. Optimistic-UI + rollback-on-error + toasts preserved in all 4.

---

## 7. `personalized_recommendations` — the two write paths

| Path | Where it was wired | Status |
|---|---|---|
| `useAdvertisingDataSettings.setPersonalizedRecommendations` | `AdvertisingDataDetailPage.tsx` → `/settings/advertising/interests-and-traits` (`ControlRow` switch) | **LIVE — kept as the canonical path** |
| `useProfileSettings.togglePersonalizedRecommendations` | defined + exported, but **destructured by zero components** (`VisibilitySettings.tsx` takes every other setter; `DataPrivacySettings.tsx` "Personalization data" is a non-interactive `status="unavailable"` row) | **DEAD — removed** |

Verified every caller: `grep -rn "togglePersonalizedRecommendations" src` → only the definition. `settings.personalized_recommendations` was read only inside that dead function. Removing it leaves **one** write path. `usePersonalization.usePersonalizationValue()` (Feed → For You, `Feed.tsx:428`) is the sole reader; `publishPersonalizationChange` is still invoked by the canonical path so the in-tab Feed cache still updates instantly.

---

## 8. Concurrency test results

### Deterministic (SQL, `authenticated`) — §2 table
OLD shallow write from a stale snapshot: lost Writer A's `_b3_test_a` + `data_use._b3_c`, and wiped the real `data_use.connections`. NEW via `update_my_preferences_patch`: `_b3_test_a`, `_b3_test_b`, `data_use._b3_c`, `data_use._b3_d` **all present**, real `connections`/`notifications.jobs`/`show_active_status` untouched. Row restored to V0.

### Genuinely concurrent (browser, real REST, `Promise.all`)
Two simultaneous `POST /rpc/update_my_preferences_patch`:
- A: `{ _b3_browser_a: 1, data_use: { _b3_bc: "A" } }`
- B: `{ _b3_browser_b: 2, notifications: { _b3_bn: "B" } }`

Result (both HTTP 200), read back via `get_my_settings`:
`has_a=true, has_b=true, has_data_use_bc=true, has_notif_bn=true`, and `data_use.connections`, `notifications.jobs`, `show_active_status` **all still true**. Test keys cleaned afterward.

### Test 1 — unrelated settings (Advertising `data_use.connections` OFF + a notification toggle)
Toggling `notifications.reactions_comments` OFF via the UI: DB shows `reactions_comments:false`, the other 6 `notifications.*` **still true**, `data_use`, `localization`, `job_preferences`, `app_lock_enabled`, `sound_effects`, `personalized_recommendations` **all present**. Then `data_use.connections` OFF via the Advertising Data UI: `data_use.connections:false`, `notifications.reactions_comments` **still true** (not clobbered), keycount 10. Both restored.

### Test 2 — personalization + unrelated
`personalized_recommendations` OFF via Interests-and-traits: DB `personalized_recommendations:false`, `data_use.connections:true`, `notifications.reactions_comments:true`, all 7 checked siblings present. Restored to ON.

### Test 3 — Advertising Data Connections ON → OFF → ON
Each transition persisted; Network → Grow renders throughout (Step-5 ranking gate still driven by the same key).

### Test 4 — Feed For You
`personalized_recommendations` OFF → `/dashboard` For You still renders (recency order per `Feed.tsx:428`), no errors. Toggled back ON.

### Test 6 — sibling-key preservation
After the full battery of UI toggles the account's `preferences` is byte-identical to the pre-test baseline — all present: `data_use`, `localization`, `notifications` (7 sub-keys), `sound_effects`, `job_preferences`, `app_lock_enabled`, `push_notifications`, `show_active_status`, `hide_profile_strength`, `personalized_recommendations` (10 top-level keys). No `_b3_*` / `_sec_probe` residue.

---

## 9. Security test results

| Check | Result |
|---|---|
| **anon** `POST /rpc/update_my_preferences_patch` | **401** `permission denied for function` |
| **anon** EXECUTE on `_jsonb_deep_merge` / `update_my_preferences_patch` | `has_function_privilege` = **false** for both |
| **authenticated**, `patch = 42` (not an object) | **400** `patch must be a JSON object` |
| **authenticated**, valid patch | **200**, merges the **caller's own** row only — the RPC has a single `patch` arg, no `target_user_id`, and writes `where user_id = auth.uid()`, so cross-user writes are structurally impossible |
| Other authenticated user modifying another user's prefs | not possible (no addressing param; own-row-only) |
| `profiles.preferences` readable by non-owners | **still no** — Steps 1–3 column lock unchanged; the RPC only `RETURNING`s the caller's own merged blob (runs as definer, not subject to the `authenticated` column grant) |
| `_jsonb_deep_merge` execute by `authenticated` | revoked (least privilege; SD RPC calls it as `postgres`) |
| RLS policies on `profiles` | unchanged (4 policies, byte-for-byte) |

---

## 10. Build / browser regression

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **0 errors** |
| `npx eslint --max-warnings 0` (6 changed files) | **0** |
| `npx vite build` | **success** (only the pre-existing >500 kB chunk advisory) |
| Settings → Visibility | loads from `get_my_settings()`; `show_active_status` toggle persists via the RPC, all siblings survive |
| Settings → Notifications | 7 categories load; toggling one persists just that sub-key, other 6 + all top-level keys survive |
| Advertising Data list + Connections detail + Interests-and-traits detail | render; toggles persist via the RPC |
| Network → Grow | renders; `data_use.connections` still gates `search_people` ranking (Step 5 intact) |
| Feed → For You | renders; respects `personalized_recommendations` (ON and OFF) |
| mobile ≈375 px + desktop | settings + advertising pages render at both |
| DB after full test battery | `preferences` restored to exact baseline (10 keys), no test residue |

---

## 11. Remaining B3/B4 gaps

1. **`broadcast_profile_update()` not routed through the new helper.** It already merges atomically (`jsonb_set(coalesce(preferences,'{}'), …)` in the SET expression) so it is not a race source, and it is outside the "known hooks" scope. Switching its `jsonb_set` to `_jsonb_deep_merge` would be cosmetic uniformity only — left as-is (smallest change).
2. **No `preferences_version` / optimistic-concurrency token.** Not needed — the deep-merge-in-SET pattern is lost-update-free on its own. A token would only matter for "reject if changed since I read it" semantics, which no settings UI wants.
3. **B6 (server-side schema validation of `patch`)** is explicitly out of scope — the RPC only checks `jsonb_typeof(patch) = 'object'`. A malicious client can still write arbitrary keys into its **own** `preferences` (no escalation: own row, free-form column, no security-relevant key consumed from it). Whitelisting keys is the separate B6 task.
4. **`settings.personalized_recommendations` field fully removed** from `useProfileSettings`; if a future "Personalization" settings screen is built it should consume `usePersonalizationValue()` for display and call `useAdvertisingDataSettings.setPersonalizedRecommendations` (or a shared extraction) to write — not reintroduce a second path.

---

## Acceptance criteria

| | | |
|---|---|---|
| **A** | Two simultaneous preference updates must never silently overwrite each other's unrelated changes | **Met** — deterministic SQL proof + genuinely-concurrent browser `Promise.all` both show all independent keys surviving; OLD pattern demonstrably loses them |
| **B** | `personalized_recommendations` must have one clear canonical write path | **Met** — `useAdvertisingDataSettings.setPersonalizedRecommendations`; the unused `useProfileSettings.togglePersonalizedRecommendations` removed after verifying zero callers |
| **C** | Existing Advertising Data / Notifications / Personalization / Settings functionality keeps working | **Met** — all toggles persist, siblings preserved, Feed + Network behaviour intact; hook APIs unchanged; tsc/eslint/build clean |
| **D** | No privacy regression: `profiles.preferences` inaccessible to non-owners | **Met** — Steps 1–3 lock untouched; RPC is owner-only, returns only the caller's own row |
| **E** | Fix must be concurrency-safe at the DB/server layer, not more frontend RMW | **Met** — the merge is a server-side `UPDATE … SET preferences = deep_merge(preferences, patch)`; the frontend no longer reads-then-writes |
