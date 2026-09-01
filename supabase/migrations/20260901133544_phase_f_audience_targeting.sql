-- =====================================================================
-- Phase F — Audience & Targeting
--
-- Advertisers describe an audience with aggregate professional criteria
-- (stored in ad_audiences.spec jsonb). They NEVER receive matching profile
-- rows — only:
--   * the targeting controls they typed, and
--   * a single server-computed integer "estimated reach".
--
-- Estimated reach and the >= 300 minimum-audience gate are enforced only
-- inside SECURITY DEFINER functions here. No client value is trusted.
--
-- Eligible population for any count: a profile is counted only if it is
-- publicly visible AND discoverable, i.e. it respects the member's own
-- Visibility / Privacy settings:
--   profile_visibility in ('public') or is null   (Visibility)
--   profile_discovery is true                     (Discovery / searchable)
-- Only attributes that appear on a public profile are used
-- (location, profession, skills, experience, education). Never email /
-- phone / address / connections / salary / job-seeking fields.
--
-- No ad creative, delivery, tracking, analytics, billing or reviewer
-- system here.
--
-- spec (jsonb, v1) — every key optional; absent/empty = dimension not applied:
--   { "v":1,
--     "locations":        ["patna"],
--     "skills":           ["react","javascript"],
--     "job_titles":       ["developer","manager"],
--     "companies":        ["akl tech"],
--     "fields_of_study":  ["computer science"],
--     "schools":          ["magadh university"],
--     "min_years_experience": 2 }
-- Matching is AND across the dimensions that are present, OR (case-insensitive
-- substring) within a dimension.
-- =====================================================================

-- ---------- internal helpers (NOT granted to anon/authenticated; only the
--            SECURITY DEFINER wrappers below call them, as the function owner) --

create or replace function public._ad_like_terms(_arr jsonb)
returns text[]
language sql
immutable
as $$
  select case
    when _arr is null or jsonb_typeof(_arr) <> 'array' or jsonb_array_length(_arr) = 0 then null
    else (
      select nullif(array_agg('%' || lower(btrim(x)) || '%'), '{}')
      from jsonb_array_elements_text(_arr) x
      where btrim(x) <> ''
    )
  end;
$$;

create or replace function public._ad_profile_years_experience(_profile_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    round(extract(epoch from (now() - min(e.start_date))) / 31557600.0, 1),
    0
  )
  from public.experience e
  where e.user_id = _profile_id and e.start_date is not null;
$$;

-- The aggregate count. SECURITY DEFINER so it can scan the eligible
-- population regardless of the caller's row-level view. Returns an integer
-- only — no ids, names or rows ever leave this function.
create or replace function public._ad_audience_count(_spec jsonb)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _loc     text[]  := public._ad_like_terms(_spec -> 'locations');
  _skill   text[]  := public._ad_like_terms(_spec -> 'skills');
  _title   text[]  := public._ad_like_terms(_spec -> 'job_titles');
  _comp    text[]  := public._ad_like_terms(_spec -> 'companies');
  _field   text[]  := public._ad_like_terms(_spec -> 'fields_of_study');
  _school  text[]  := public._ad_like_terms(_spec -> 'schools');
  _minyrs  numeric := nullif(_spec ->> 'min_years_experience', '')::numeric;
  _n       integer;
begin
  select count(*) into _n
  from public.profiles p
  where (p.profile_visibility is null or p.profile_visibility = 'public')
    and p.profile_discovery is true
    and (_loc is null or lower(coalesce(p.location, '')) ilike any (_loc))
    and (
      _title is null
      or lower(coalesce(p.profession, '')) ilike any (_title)
      or exists (
        select 1 from public.experience e
        where e.user_id = p.id and lower(coalesce(e.role, '')) ilike any (_title)
      )
    )
    and (
      _skill is null
      or exists (
        select 1 from public.skills s
        where s.user_id = p.id and lower(coalesce(s.skill_name, '')) ilike any (_skill)
      )
    )
    and (
      _comp is null
      or exists (
        select 1 from public.experience e
        where e.user_id = p.id and lower(coalesce(e.company, '')) ilike any (_comp)
      )
    )
    and (
      _field is null
      or exists (
        select 1 from public.education ed
        where ed.user_id = p.id and lower(coalesce(ed.field_of_study, '')) ilike any (_field)
      )
    )
    and (
      _school is null
      or exists (
        select 1 from public.education ed
        where ed.user_id = p.id and lower(coalesce(ed.institution, '')) ilike any (_school)
      )
    )
    and (_minyrs is null or public._ad_profile_years_experience(p.id) >= _minyrs);

  return coalesce(_n, 0);
end;
$$;

-- ---------- public RPCs -------------------------------------------------

-- Live estimate while editing (before an audience is saved). Authorises on
-- the ad account, returns an integer only, writes nothing.
create or replace function public.ad_audience_preview_reach(_ad_account_id uuid, _spec jsonb)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_ad_account_admin(_ad_account_id) then
    raise exception 'not authorized for this ad account' using errcode = '42501';
  end if;
  return public._ad_audience_count(coalesce(_spec, '{}'::jsonb));
end;
$$;

-- Recompute + persist an existing audience's reach from ITS OWN stored spec
-- (never a client-supplied number).
create or replace function public.ad_audience_recompute_reach(_audience_id uuid)
returns public.ad_audiences
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.ad_audiences;
begin
  select * into a from public.ad_audiences where id = _audience_id;
  if not found then
    raise exception 'audience not found' using errcode = 'P0002';
  end if;
  if not public.is_ad_account_admin(a.ad_account_id) then
    raise exception 'not authorized for this audience' using errcode = '42501';
  end if;

  update public.ad_audiences
     set estimated_reach = public._ad_audience_count(coalesce(a.spec, '{}'::jsonb)),
         estimated_reach_at = now()
   where id = _audience_id
  returning * into a;

  return a;
end;
$$;

-- Attach an audience to the campaign's ad set (the campaign -> audience
-- foundation). Blocks cross-ad-account attachment and enforces the >= 300
-- minimum with a freshly recomputed count.
create or replace function public.attach_audience_to_ad_set(_campaign_id uuid, _audience_id uuid)
returns public.ad_sets
language plpgsql
security definer
set search_path = public
as $$
declare
  _camp   public.campaigns;
  _aud    public.ad_audiences;
  _reach  integer;
  _set    public.ad_sets;
  _min    constant integer := 300;
begin
  select * into _camp from public.campaigns where id = _campaign_id;
  if not found then
    raise exception 'campaign not found' using errcode = 'P0002';
  end if;
  if not public.is_campaign_admin(_campaign_id) then
    raise exception 'not authorized for this campaign' using errcode = '42501';
  end if;

  select * into _aud from public.ad_audiences where id = _audience_id;
  if not found then
    raise exception 'audience not found' using errcode = 'P0002';
  end if;

  -- cross-company / cross-account guard
  if _aud.ad_account_id <> _camp.ad_account_id then
    raise exception 'that audience belongs to a different ad account' using errcode = '42501';
  end if;

  -- server-side minimum audience threshold, recomputed fresh
  _reach := public._ad_audience_count(coalesce(_aud.spec, '{}'::jsonb));
  update public.ad_audiences
     set estimated_reach = _reach, estimated_reach_at = now()
   where id = _audience_id;

  if _reach < _min then
    raise exception 'audience too small: % eligible profiles, minimum is %', _reach, _min
      using errcode = 'P0001';
  end if;

  -- one Phase-F ad set per campaign; create it or repoint it
  select * into _set from public.ad_sets where campaign_id = _campaign_id order by created_at limit 1;
  if found then
    update public.ad_sets set audience_id = _audience_id where id = _set.id returning * into _set;
  else
    insert into public.ad_sets (campaign_id, audience_id, name)
    values (_campaign_id, _audience_id, left(_camp.name, 90) || ' — audience')
    returning * into _set;
  end if;

  return _set;
end;
$$;

create or replace function public.detach_audience_from_ad_set(_campaign_id uuid)
returns public.ad_sets
language plpgsql
security definer
set search_path = public
as $$
declare
  _set public.ad_sets;
begin
  if not public.is_campaign_admin(_campaign_id) then
    raise exception 'not authorized for this campaign' using errcode = '42501';
  end if;
  select * into _set from public.ad_sets where campaign_id = _campaign_id order by created_at limit 1;
  if not found then
    raise exception 'no ad set for this campaign' using errcode = 'P0002';
  end if;
  update public.ad_sets set audience_id = null where id = _set.id returning * into _set;
  return _set;
end;
$$;

-- ---------- grants ---------------------------------------------------------
revoke all on function public._ad_like_terms(jsonb) from public;
revoke all on function public._ad_profile_years_experience(uuid) from public, anon;
revoke all on function public._ad_audience_count(jsonb) from public, anon;
revoke all on function public.ad_audience_preview_reach(uuid, jsonb) from public, anon;
revoke all on function public.ad_audience_recompute_reach(uuid) from public, anon;
revoke all on function public.attach_audience_to_ad_set(uuid, uuid) from public, anon;
revoke all on function public.detach_audience_from_ad_set(uuid) from public, anon;

grant execute on function public.ad_audience_preview_reach(uuid, jsonb) to authenticated;
grant execute on function public.ad_audience_recompute_reach(uuid) to authenticated;
grant execute on function public.attach_audience_to_ad_set(uuid, uuid) to authenticated;
grant execute on function public.detach_audience_from_ad_set(uuid) to authenticated;
