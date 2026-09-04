-- Step 3 of the profiles public-read hardening (Advertising Data privacy).
-- The RLS policy `profiles_select_respecting_visibility` is unchanged; this
-- migration only tightens table/column GRANTS on `public.profiles`.

-- 3a) anon has no legitimate use for `profiles` — every profile route is behind
--     auth and ProfilePage redirects logged-out users. SECURITY DEFINER
--     functions read as `postgres` and are unaffected; handle_new_user still
--     creates the row on sign-up.
revoke all privileges on table public.profiles from anon;

-- 3b) authenticated: column-level restriction only takes effect when the role
--     holds NO table-level SELECT grant. So drop the blanket table SELECT and
--     re-grant SELECT on the display-safe columns only. INSERT / UPDATE / DELETE
--     stay (all RLS-gated to the caller's own row).
--
--     After this, a bare `SELECT *` on public.profiles errors for an
--     authenticated client — call sites must list columns, use
--     public.get_my_settings() (own owner-only columns) or
--     public.get_public_profile() (another member).
revoke select on table public.profiles from authenticated;

grant select (
  id, user_id, display_name, avatar_url, bio, created_at, updated_at,
  profession, location, phone, website, linkedin_url, github_url, twitter_url,
  skills, experience, education, projects, achievements, full_name, email,
  photo_url, address, profile_visibility, cover_url, open_to_work,
  last_name_visibility, profile_discovery, autoplay_videos, cover_position,
  headline, pronouns, photo_visibility, last_active_at
) on table public.profiles to authenticated;

-- Not re-granted to `authenticated` (owner reads them via get_my_settings(),
-- other members never): preferences, expected_salary, notice_period,
-- open_to_roles, preferred_locations, job_type, allow_recruiter_search,
-- allow_recruiter_profile_view, share_pdf_resume_with_recruiters,
-- share_online_resume_with_recruiters, share_professional_links_with_recruiters,
-- email_visibility, phone_visibility, connections_visibility,
-- open_to_work_visibility.
