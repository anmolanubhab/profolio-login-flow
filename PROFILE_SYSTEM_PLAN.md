# Profolio LinkedIn-Style Profile System — Implementation Plan

Status: **PLAN / AWAITING APPROVAL**. No code or DB changes have been made.
Author: audit + plan pass. Date: 2026-08-28.

---

## 0. Executive summary

Profolio already ships a **partial** profile system. This plan extends it to LinkedIn-level
functionality **without** a blind rewrite, reusing existing tables, RLS, dialog primitives,
`PostCard`/`Feed`, and the follow/connection model. LinkedIn is used only as a UX reference;
no LinkedIn code/assets/APIs are used.

The single biggest architectural issue: **the profile data model is split**. Relational
`experience` / `education` tables exist in the live DB but the current UI reads/writes JSON
arrays on `profiles` instead. `skills` already uses its relational table. This plan
**standardises on relational tables** (the task's stated preference and the only way to get
per-row RLS), with a one-time backfill from the JSON columns.

---

## 1. LinkedIn profile features inspected (reference only)

| Group | Elements observed |
|---|---|
| Header | cover/banner, profile photo, name, verification badge, pronouns, headline, current position, current education, location, "Contact info" link, connection count, follower count, "Open to work" / "Providing services" / "Hiring" cards |
| Header actions | Open to (dropdown: job seeking / services / hiring), Add profile section, Enhance profile / More (dropdown), Edit (pencil) on every section, "More" → Share via message, Save to PDF, Build a resume, About this profile, Report / Block |
| Profile photo | click → viewer (enlarge), "Edit" → reposition/zoom/filters/frames, "Add photo"/"Delete photo", visibility (public / connections / your network), Save/Cancel |
| Cover image | "Edit" → upload / reposition / "Delete", preview, Save/Cancel |
| Add section categories | **Core**: About, Experience, Education, Skills. **Recommended**: Licenses & certifications, Projects, Courses, Volunteer experience, Languages. **Additional**: Publications, Patents, Honors & awards, Test scores, Organizations, Causes |
| About | rich text, ~2,600 char limit, "…see more" truncation, top-skills chips |
| Experience card | logo, title, company, employment type, dates + duration, location, description, media, grouped multiple roles per company, skills tags |
| Education card | logo, school, degree, field of study, dates, grade, activities, description |
| Skills | list, endorsement counts, "top skills" pinning, "Show all", per-skill detail (where used, endorsements), Add/Edit/Delete |
| Certifications | name, issuing org, issue date, expiration date, credential ID, credential URL, skills |
| Projects | name, description, dates, "associated with" (an experience/education), URL, contributors, skills |
| Languages | language, proficiency (Elementary → Native/bilingual) |
| Activity | tabs Posts / Comments / Reposts / Reactions, "Show all activity", follower count |
| Followers/Following | count links → list with search + pagination; unfollow inline |
| Connections | Connect / Pending (withdraw) / Message + connected; "Remove connection"; incoming request accept/ignore; connections list with search |
| Contact info modal | profile URL, email, phone, address, IM, birthday, website(s), Twitter |
| Sharing | "Share profile in a message", "Copy link to profile", public URL edit |
| States | section skeletons, "Add your …" empty prompts, private-profile lock screen |

---

## 2. Current Profolio architecture (audited)

### Routing
- `App.tsx`: `/profile` → `Profile.tsx` (own, protected); `/profile/:userId` → `PublicProfile.tsx` (param is `profiles.id` UUID).
- Profile links elsewhere: search / posts / comments / mentions link to `/profile/:id`. No `@username` handles.

### Components (`src/components/profile/`)
- `ProfileHeader.tsx` (482 L) — own-profile card, **inline** edit (not a dialog) for name/profession/location/phone/website/bio/visibility; avatar upload via `secureUpload({bucket:'avatars'})`.
- `ProfileTabs.tsx` — `Tabs`: Posts (`<Feed userId>`), Experience, Education, Skills, Social.
- `ExperienceSection.tsx` (409 L) — CRUD against **`profiles.experience` JSON**. Client-generated `exp_<ts>` ids.
- `EducationSection.tsx` (383 L) — CRUD against **`profiles.education` JSON**.
- `SkillsSection.tsx` (429 L) — CRUD against **relational `skills`** + `skill_endorsements`; endorse/unendorse; suggested skills.
- `SocialLinksSection.tsx` (302 L) — `profiles.github_url/linkedin_url/twitter_url/website`.
- `CoverImage.tsx` (130 L) — **orphaned**, not imported anywhere; writes cover to `profiles.photo_url`; uses `avatars` bucket.

### Pages
- `Profile.tsx` (77 L) — loads `auth.getUser()`, fetches `profiles.id`, renders `ProfileHeader` + `ProfileTabs`. No cover, no completion meter, no More menu, no Contact info.
- `PublicProfile.tsx` (627 L) — own connection/follow logic (friend_requests + connections + followers), records `profile_views` + notification, private-profile gate, renders `ProfileTabs` read-only. Duplicates a lot that should be shared with `Profile.tsx`.

### Database (project `ajbhpqbfcpmztjtxqxxk`)
Relevant tables already present (from `types.ts`):
- `profiles` — see §1 audit table above. Has `profile_visibility` in (`public`,`private`,`connections_only`), plus **unused** JSON `experience/education/projects/achievements` and `skills text[]`.
- `experience` (relational, **UI-unused**): company, role, employment_type, start_date, end_date, is_current, location, description, user_id → `profiles.id`.
- `education` (relational, **UI-unused**): institution, degree, field_of_study, start_date, end_date, grade, description, user_id.
- `skills` (relational, **UI-used**): skill_name, proficiency enum, years_of_experience, user_id.
- `skill_endorsements`: skill_id, endorser_id, endorsed_user_id (+ notification trigger).
- `followers`: follower_id, following_id (public read; own write).
- `connections`: user_id, connection_id, status enum (`pending`/`accepted`/`blocked`).
- `friend_requests`: sender_id, receiver_id, status enum.
- `profile_views`: viewer_id, viewed_profile_id, viewed_at.
- `blocked_users`: user_id, blocked_user_id (RLS: manage own).
- `post_reports`: reporter_id, post_id, reason (RLS: create + view own). **No `profile_reports`.**
- `certificates`: file-vault oriented (title/file_url/file_size) — **NOT** LinkedIn certifications.

Storage buckets: `avatars` (public), `post-images`, `post-videos`, `stories` (public), `certificates`/`resumes` (private). **No `covers` bucket.**

`supabase/migrations/` is **incomplete** — `experience`/`education`/`skills` have no create migration (dashboard-created). Treat live DB + `types.ts` as source of truth; new migrations must be idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`).

### Regression-sensitive systems (must not break)
Feed, PostCard, post CRUD, likes, **comments + realtime comments**, **repost / repost-with-thoughts / undo repost**, **3-line "…more" clamp**, notifications, search, messaging, jobs, MyApplications, dashboard, `use-mobile`, `BottomNavigation`/`MobileNavDrawer`.

---

## 3. Target architecture

### 3.1 Component tree (new / refactored)
```
pages/Profile.tsx            → thin wrapper, resolves profileId, renders <ProfilePage self />
pages/PublicProfile.tsx      → thin wrapper, renders <ProfilePage viewerId targetId />
components/profile/
  ProfilePage.tsx            (NEW) shared shell: fetch, loading/error/notfound/private, layout, mobile
  ProfileHeaderCard.tsx      (REWRITE of ProfileHeader) cover + photo + identity + actions + completion
  CoverImage.tsx             (REWIRE) upload / reposition (object-position Y) / remove; bucket 'covers'
  ProfilePhoto.tsx           (NEW) avatar + click → ProfilePhotoDialog
  ProfileActions.tsx         (NEW) Connect/Pending/Message/Follow + MoreMenu (dropdown-menu)
  ProfileCompletion.tsx      (NEW) derived %, checklist popover
  sections/
    ProfileSection.tsx       (NEW) generic card: title, add btn, edit affordance, empty/loading/error
    AboutSection.tsx         (NEW) bio, 3-line clamp reusing existing "…more", edit dialog
    ExperienceSection.tsx    (REWRITE → relational `experience`)
    EducationSection.tsx     (REWRITE → relational `education`)
    SkillsSection.tsx        (KEEP, refactor to ProfileSection shell; add reorder/top-skills)
    CertificationsSection.tsx(NEW → `certifications`)
    ProjectsSection.tsx      (NEW → `projects`)
    LanguagesSection.tsx     (NEW → `languages`)
    ActivitySection.tsx      (NEW) tabs Posts/Comments/Reposts/Reactions → reuse Feed/PostCard
  dialogs/
    EditProfileDialog.tsx    (NEW) tabs: Basics / Contact / Visibility; react-hook-form + zod
    ProfilePhotoDialog.tsx   (NEW) view / replace / reposition / delete / visibility
    ContactInfoDialog.tsx    (NEW) visibility-aware read view + inline edit for owner
    ShareProfileDialog.tsx   (NEW) copy link, share-in-message (reuse messaging), public URL
    AddSectionDialog.tsx     (NEW) category list → opens the matching section dialog
    ExperienceDialog / EducationDialog / CertificationDialog / ProjectDialog / LanguageDialog / SkillDialog (NEW)
    ConnectionsListDialog / FollowersListDialog / FollowingListDialog (NEW) search + infinite page
    ReportProfileDialog / BlockProfileConfirm (NEW)
  hooks/
    useProfile.ts, useProfileSections.ts, useConnectionState.ts, useFollowState.ts,
    useProfileCompletion.ts   (react-query; selective columns; no N+1)
```
All dialogs use the existing `@/components/ui/dialog` (Radix) — has close btn, ESC, outside-click,
focus trap. Mobile: swap to `@/components/ui/drawer` (vaul) under `use-mobile` for large dialogs.

### 3.2 Routing
- Keep `/profile` and `/profile/:userId` (`:userId` = `profiles.id`). No behavioural change → all existing
  links from posts/comments/mentions/search keep working. Direct nav + refresh already work (BrowserRouter).
- **Optional (Phase G, separate approval)**: add `profiles.username citext unique`, route `/u/:username`
  resolving to the same page, keep UUID route as fallback. Not required for parity.

---

## 4. Database plan (migration files only — not applied)

New migrations in `supabase/migrations/`, idempotent, each with **PK, FKs (`on delete cascade`),
indexes on `user_id` + sort keys, `enable row level security`, and explicit policies**.
`user_id` references `profiles.id` to match existing `experience`/`skills` convention.

### 4.1 `..._profile_header_fields.sql`
```sql
alter table public.profiles
  add column if not exists cover_url text,
  add column if not exists cover_position numeric default 50,      -- object-position Y %
  add column if not exists headline text,                          -- distinct from profession
  add column if not exists pronouns text,
  add column if not exists open_to_work boolean default false,
  add column if not exists photo_visibility text default 'public'
    check (photo_visibility in ('public','connections','private')),
  add column if not exists contact_visibility jsonb default '{}'::jsonb; -- per-field: email/phone/address/...
-- keep profession as-is; headline falls back to profession in the UI
```

### 4.2 `..._experience_education_relational_backfill.sql`
- `experience` / `education` tables already exist. Add if missing: `id uuid pk default gen_random_uuid()`,
  `sort_order int`, `media_url text`, `skills text[]`, `created_at`, `updated_at`.
- Add indexes `(user_id, sort_order)`, `(user_id, start_date desc)`.
- RLS (idempotent `drop policy if exists` then create):
  - select: `true` (profile-visibility enforced at the profile row / page level, same as today's sections)
  - insert/update/delete: `user_id in (select id from public.profiles where user_id = auth.uid())`
- **Backfill** from JSON:
  ```sql
  insert into public.experience (user_id, company, role, employment_type, start_date, end_date, is_current, location, description)
  select p.id, e->>'company', e->>'role', e->>'employment_type',
         nullif(e->>'start_date','')::date, nullif(e->>'end_date','')::date,
         coalesce((e->>'is_current')::bool,false), e->>'location', e->>'description'
  from public.profiles p, jsonb_array_elements(coalesce(p.experience,'[]'::jsonb)) e
  where jsonb_typeof(p.experience) = 'array'
    and not exists (select 1 from public.experience x where x.user_id = p.id);
  -- same shape for education
  ```
- Leave JSON columns in place (read nothing from them post-migration; drop in a later cleanup migration once verified).

### 4.3 `..._certifications.sql`
```sql
create table if not exists public.certifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  issuing_organization text not null,
  issue_date date,
  expiration_date date,
  credential_id text,
  credential_url text,
  skills text[] default '{}',
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists certifications_user_idx on public.certifications(user_id, issue_date desc);
alter table public.certifications enable row level security;
-- select true; write: owner-only (subquery pattern above)
```

### 4.4 `..._projects.sql`
```sql
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  start_date date, end_date date, is_ongoing boolean default false,
  url text,
  associated_experience_id uuid references public.experience(id) on delete set null,
  associated_education_id uuid references public.education(id) on delete set null,
  skills text[] default '{}',
  media_url text,
  sort_order int default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
create index if not exists projects_user_idx on public.projects(user_id, sort_order);
alter table public.projects enable row level security;   -- select true; write owner-only
```
(`profiles.projects` JSON currently unused by UI → no backfill needed; verify then drop later.)

### 4.5 `..._languages.sql`
```sql
create table if not exists public.languages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  proficiency text not null check (proficiency in
    ('elementary','limited_working','professional_working','full_professional','native')),
  sort_order int default 0,
  created_at timestamptz default now(),
  unique (user_id, name)
);
create index if not exists languages_user_idx on public.languages(user_id, sort_order);
alter table public.languages enable row level security;  -- select true; write owner-only
```

### 4.6 `..._profile_reports.sql`
```sql
create table if not exists public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_profile_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text,
  created_at timestamptz default now(),
  unique (reporter_id, reported_profile_id)
);
alter table public.profile_reports enable row level security;
-- insert: reporter_id = my profile; select: reporter only (+ admins via has_role)
```

### 4.7 `..._covers_bucket.sql`
```sql
insert into storage.buckets (id, name, public) values ('covers','covers',true)
  on conflict (id) do nothing;
-- policies mirror the existing 'avatars' policies: public read;
-- write/update/delete require auth.uid()::text = (storage.foldername(name))[1]
```

### 4.8 Skills / endorsements — no schema change
Add `skills.sort_order int default 0` + `skills.is_top boolean default false` (idempotent) for
top-skills pinning & reorder. RLS already correct.

### 4.9 Regenerate `src/integrations/supabase/types.ts` after apply.

---

## 5. RLS / security model (summary)

| Table | SELECT | INSERT / UPDATE / DELETE |
|---|---|---|
| profiles | authenticated (existing) | own row only (existing) |
| experience, education, certifications, projects, languages, skills | `true` | `user_id in (select id from profiles where user_id = auth.uid())` |
| profile_views | own (existing) | insert own viewer_id (existing) |
| profile_reports | reporter or admin | insert with `reporter_id` = my profile |
| followers, connections, friend_requests | existing public/own | existing own-row |
| storage `covers` | public read | path-prefixed to `auth.uid()` |

- **Page-level visibility**: `ProfilePage` enforces `profile_visibility` — `private` → lock screen for
  non-owner/non-connection; `connections_only` → same unless an `accepted` connection exists.
  Section queries return rows (RLS `true`) but the page never renders them when gated. This matches
  the current `PublicProfile.tsx` behaviour; no RLS weakening.
- **Contact info**: `contact_visibility` jsonb per field; `ContactInfoDialog` hides fields the viewer
  isn't allowed to see. Never select `phone`/`address`/`email` into client state for gated viewers —
  do it in a `SECURITY DEFINER` RPC `get_contact_info(target uuid)` that returns only permitted fields.
- A→B edit prevention: verified by the owner-only write policies above + `EditProfileDialog` only
  mounting for `isOwner`.

---

## 6. Phase breakdown & acceptance

| Phase | Deliverable | Done when |
|---|---|---|
| **B** | 7 migration files (§4) + regenerated types | Files reviewed; applied by you; `tsc` green |
| **C** | `ProfilePage` shell, `ProfileHeaderCard`, `CoverImage` rewired, `ProfilePhoto(+Dialog)`, `EditProfileDialog`, `ContactInfoDialog`, `ProfileActions` + More menu, `ProfileCompletion` | Cover upload/reposition/remove; photo view/replace/reposition/delete/visibility; edit dialog saves name/headline/pronouns/location/position/contact/visibility with zod validation + unsaved-changes guard; completion % from real fields; Share dialog copies link |
| **D** | `ProfileSection` + `AboutSection` + relational `ExperienceSection`/`EducationSection` + `Certifications`/`Projects`/`Languages` sections & dialogs; `AddSectionDialog` | Full CRUD each, delete confirm (`alert-dialog`), reorder where noted, empty/loading/error states, "…more" clamp on About & descriptions |
| **E** | All child dialogs finalised; ESC/outside-click/focus/mobile-drawer parity | Manual matrix in §8 passes |
| **F** | `ActivitySection` tabs reuse `Feed`/`PostCard`; profile Posts tab; no new post/comment/repost code | Comments realtime + repost + "…more" still work (regression) |
| **G** | `ConnectionsListDialog`/`Followers`/`Following` (search + `range()` pagination), counts in header, accept/withdraw/remove, unfollow | Lists paginate 20/page; counts match; separate Follow vs Connection preserved |
| **H** | Responsive pass 375/390/768/desktop | No horizontal overflow; cover/photo overlap correct; dialogs → drawers; bottom-nav unaffected |
| **I** | `npm run build`, `npm run lint`, `tsc --noEmit`; browser QA script (§8 of task) | All green; QA notes recorded |

---

## 7. Performance

- react-query per section, `enabled` gated by active tab (sections don't fetch until opened).
- Header query selects only header columns; counts via `head:true, count:'exact'`.
- Activity/Posts reuse `Feed` pagination; never fetch all posts/comments/followers.
- Endorsement counts: single grouped query (fix current per-skill N+1 in `SkillsSection`).
- Indexes per §4. Lists use `.range()`.

## 8. Child-dialog QA matrix (per dialog)
close button �· ESC �· outside-click (non-destructive only) �· focus trap + restore �· mobile
drawer �· scroll lock �· validation errors �· save disabled while pending �· unsaved-changes confirm
(edit dialogs) �· toast on success/error.

## 9. Explicitly out of scope (no fake buttons)
LinkedIn "Enhance profile with AI", "Add to featured", premium analytics, "Who viewed" full history
(basic `profile_views` count only), verification badges, creator mode, publications/patents/awards/
test-scores/organizations (schema pattern is reusable later), `@username` handles (Phase G optional).

## 10. Risks
- Migration folder incompleteness → all new migrations idempotent; you apply against live DB.
- JSON→relational backfill runs once; guarded by `not exists`. JSON columns kept until verified.
- `PublicProfile.tsx` and `Profile.tsx` converging on `ProfilePage` — behavioural diff risk;
  mitigated by porting existing connection/follow/view logic verbatim into hooks first.
