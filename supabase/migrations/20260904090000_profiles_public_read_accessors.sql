-- Step 2 of the profiles public-read hardening (Advertising Data privacy).
-- SECURITY DEFINER accessors so owner + non-owner reads of `profiles` can be
-- served WITHOUT exposing `preferences` / salary / notice period / other
-- owner-only columns to a direct client SELECT. RLS policies are unchanged.

-- 1) get_public_profile(target) — display-safe view of ANOTHER member's profile.
--    Accepts either profiles.id or profiles.user_id. Applies block + visibility
--    gates server-side (mirroring get_profile_contact_info; connection check
--    uses `public.connections`, the same table the RLS policy it replaces uses).
--    Returns DERIVED `show_active_status` / `has_verified_email` booleans instead
--    of the raw preferences blob / email address.
create or replace function public.get_public_profile(target_profile_id uuid)
returns table (
  id uuid, user_id uuid, display_name text, full_name text, headline text,
  profession text, avatar_url text, photo_url text, cover_url text,
  cover_position numeric, bio text, location text, pronouns text,
  open_to_work boolean, skills text[], projects jsonb, experience jsonb,
  education jsonb, achievements jsonb, website text, linkedin_url text,
  github_url text, twitter_url text, address text, created_at timestamptz,
  last_active_at timestamptz, profile_visibility text, photo_visibility text,
  last_name_visibility text, profile_discovery boolean,
  show_active_status boolean, has_verified_email boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer uuid := public.current_profile_id();
  t public.profiles%rowtype;
  is_owner boolean;
  is_connected boolean;
begin
  select * into t
  from public.profiles p
  where p.id = target_profile_id or p.user_id = target_profile_id
  limit 1;

  if t.id is null then
    return;
  end if;

  is_owner := t.user_id = auth.uid();

  if not is_owner then
    if public.is_blocked_by(t.id) then
      return;
    end if;
    if t.profile_visibility = 'private' then
      return;
    end if;
  end if;

  is_connected := exists (
    select 1 from public.connections c
    where c.status = 'accepted'
      and ((c.user_id = t.id and c.connection_id = viewer)
        or (c.connection_id = t.id and c.user_id = viewer))
  );

  if not is_owner
     and t.profile_visibility = 'connections_only'
     and not is_connected then
    return;
  end if;

  return query select
    t.id, t.user_id, t.display_name, t.full_name, t.headline, t.profession,
    t.avatar_url, t.photo_url, t.cover_url, t.cover_position, t.bio, t.location,
    t.pronouns, t.open_to_work, t.skills, t.projects, t.experience, t.education,
    t.achievements, t.website, t.linkedin_url, t.github_url, t.twitter_url,
    t.address, t.created_at, t.last_active_at,
    t.profile_visibility, t.photo_visibility, t.last_name_visibility,
    t.profile_discovery,
    coalesce((t.preferences ->> 'show_active_status')::boolean, true) as show_active_status,
    (t.email is not null and length(btrim(t.email)) > 0) as has_verified_email;
end;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to authenticated;

-- 2) get_my_settings() — the CALLER'S OWN settings columns, so the raw columns
--    can be revoked from the `authenticated` role (column grants are role-wide,
--    so a revoke that stops other users also stops the owner without this).
create or replace function public.get_my_settings()
returns table (
  preferences jsonb, expected_salary text, notice_period text,
  open_to_roles text[], preferred_locations text[], job_type text[],
  autoplay_videos boolean, allow_recruiter_search boolean,
  allow_recruiter_profile_view boolean, share_pdf_resume_with_recruiters boolean,
  share_online_resume_with_recruiters boolean,
  share_professional_links_with_recruiters boolean, email_visibility text,
  phone_visibility text, connections_visibility text, open_to_work_visibility text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.preferences, p.expected_salary, p.notice_period,
    p.open_to_roles, p.preferred_locations, p.job_type,
    p.autoplay_videos, p.allow_recruiter_search, p.allow_recruiter_profile_view,
    p.share_pdf_resume_with_recruiters, p.share_online_resume_with_recruiters,
    p.share_professional_links_with_recruiters,
    p.email_visibility, p.phone_visibility, p.connections_visibility,
    p.open_to_work_visibility
  from public.profiles p
  where p.user_id = auth.uid();
$$;

revoke all on function public.get_my_settings() from public;
grant execute on function public.get_my_settings() to authenticated;

-- 3) search_mentionable_people(q) — replaces the direct client read in
--    use-mention-search.ts (which pulled `preferences` to honour mentions_from);
--    also re-applies the block + profile_visibility filtering RLS used to do
--    implicitly for the old direct SELECT.
create or replace function public.search_mentionable_people(q text)
returns table (id uuid, display_name text, avatar_url text, profession text)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select public.current_profile_id() as pid)
  select p.id, p.display_name, p.avatar_url, p.profession
  from public.profiles p
  where coalesce(p.profile_discovery, true) = true
    and p.display_name ilike ('%' || replace(replace(coalesce(q, ''), '%', '\%'), '_', '\_') || '%')
    and (
      p.id = (select pid from me)
      or (
        not public.is_blocked_by(p.id)
        and not exists (
          select 1 from public.blocked_users b
          where b.user_id = (select pid from me) and b.blocked_user_id = p.id
        )
        and (
          p.profile_visibility = 'public'
          or p.profile_visibility is null
          or (
            p.profile_visibility = 'connections_only'
            and exists (
              select 1 from public.friend_requests fr
              where fr.status = 'accepted'
                and ((fr.sender_id = p.id and fr.receiver_id = (select pid from me))
                  or (fr.receiver_id = p.id and fr.sender_id = (select pid from me)))
            )
          )
        )
        and (
          coalesce(p.preferences ->> 'mentions_from', 'everyone') = 'everyone'
          or (
            coalesce(p.preferences ->> 'mentions_from', 'everyone') = 'connections'
            and exists (
              select 1 from public.friend_requests fr
              where fr.status = 'accepted'
                and ((fr.sender_id = p.id and fr.receiver_id = (select pid from me))
                  or (fr.receiver_id = p.id and fr.sender_id = (select pid from me)))
            )
          )
        )
      )
    )
  order by p.display_name asc
  limit 6;
$$;

revoke all on function public.search_mentionable_people(text) from public;
grant execute on function public.search_mentionable_people(text) to authenticated;
