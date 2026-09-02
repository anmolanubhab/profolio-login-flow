-- =====================================================================
-- Phase I — Controlled Ad Delivery (TEST MODE)
--
-- Approved ads on an active, in-schedule campaign become eligible for
-- delivery into the Profolio feed — but ONLY to an explicit allowlist of
-- test profiles. Nothing reaches general users.
--
-- Two independent controls gate every delivery:
--   1. campaign.status = 'active'  — reachable only via activate_campaign()
--      (admin-only). ad_status_guard already blocks any direct client write
--      to campaigns.status.
--   2. the viewer's profile is in ad_delivery_test_users (admin-managed).
--
-- The client never queries ads directly. feed_pick_sponsored_ad() returns
-- at most one ad's render-minimal payload (no ad_set/campaign/account ids,
-- no targeting spec, no audience membership). Impression/click events go
-- through SECURITY DEFINER RPCs that re-check eligibility and dedup — the
-- Phase C ad_delivery_events table is RLS-on / no-policy, so only these
-- functions can write it. No analytics rollup, no billing, no auction.
-- =====================================================================

-- ---------- test-user allowlist -------------------------------------------
create table if not exists public.ad_delivery_test_users (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  added_by   uuid references auth.users(id) on delete set null,
  added_at   timestamptz not null default now()
);
alter table public.ad_delivery_test_users enable row level security;

drop policy if exists ad_delivery_test_users_admin_all on public.ad_delivery_test_users;
create policy ad_delivery_test_users_admin_all on public.ad_delivery_test_users
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------- campaign activation (admin-gated: the delivery control) ------
create or replace function public.activate_campaign(_campaign_id uuid)
returns public.campaigns
language plpgsql security definer set search_path = public
as $$
declare c public.campaigns;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'reviewer access required' using errcode = '42501';
  end if;
  select * into c from public.campaigns where id = _campaign_id;
  if not found then raise exception 'campaign not found' using errcode = 'P0002'; end if;
  if c.status in ('completed', 'rejected') then
    raise exception 'a % campaign cannot be activated', c.status using errcode = 'P0001';
  end if;
  if c.start_at is null then
    raise exception 'set a start date before activating' using errcode = 'P0001';
  end if;
  perform set_config('ad.bypass_status_guard', 'on', true);
  update public.campaigns
     set status = 'active', activated_at = coalesce(activated_at, now())
   where id = _campaign_id
  returning * into c;
  perform set_config('ad.bypass_status_guard', 'off', true);
  return c;
end;
$$;

create or replace function public.pause_campaign(_campaign_id uuid)
returns public.campaigns
language plpgsql security definer set search_path = public
as $$
declare c public.campaigns;
begin
  select * into c from public.campaigns where id = _campaign_id;
  if not found then raise exception 'campaign not found' using errcode = 'P0002'; end if;
  if not (public.has_role(auth.uid(), 'admin') or public.is_campaign_admin(_campaign_id)) then
    raise exception 'not authorized for this campaign' using errcode = '42501';
  end if;
  if c.status <> 'active' then
    raise exception 'only an active campaign can be paused (current: %)', c.status using errcode = 'P0001';
  end if;
  perform set_config('ad.bypass_status_guard', 'on', true);
  update public.campaigns set status = 'paused' where id = _campaign_id returning * into c;
  perform set_config('ad.bypass_status_guard', 'off', true);
  return c;
end;
$$;

revoke all on function public.activate_campaign(uuid) from public, anon;
revoke all on function public.pause_campaign(uuid) from public, anon;
grant execute on function public.activate_campaign(uuid) to authenticated;
grant execute on function public.pause_campaign(uuid) to authenticated;

-- ---------- single-profile audience match (internal; server-only) -------
create or replace function public._ad_profile_matches_audience(_profile_id uuid, _spec jsonb)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare
  _loc    text[]  := public._ad_like_terms(_spec -> 'locations');
  _skill  text[]  := public._ad_like_terms(_spec -> 'skills');
  _title  text[]  := public._ad_like_terms(_spec -> 'job_titles');
  _comp   text[]  := public._ad_like_terms(_spec -> 'companies');
  _field  text[]  := public._ad_like_terms(_spec -> 'fields_of_study');
  _school text[]  := public._ad_like_terms(_spec -> 'schools');
  _minyrs numeric := nullif(_spec ->> 'min_years_experience', '')::numeric;
  _ok     boolean;
begin
  select true into _ok
  from public.profiles p
  where p.id = _profile_id
    and (p.profile_visibility is null or p.profile_visibility = 'public')
    and p.profile_discovery is true
    and (_loc is null or lower(coalesce(p.location, '')) ilike any (_loc))
    and (
      _title is null
      or lower(coalesce(p.profession, '')) ilike any (_title)
      or exists (select 1 from public.experience e where e.user_id = p.id and lower(coalesce(e.role, '')) ilike any (_title))
    )
    and (_skill is null or exists (select 1 from public.skills s where s.user_id = p.id and lower(coalesce(s.skill_name, '')) ilike any (_skill)))
    and (_comp is null or exists (select 1 from public.experience e where e.user_id = p.id and lower(coalesce(e.company, '')) ilike any (_comp)))
    and (_field is null or exists (select 1 from public.education ed where ed.user_id = p.id and lower(coalesce(ed.field_of_study, '')) ilike any (_field)))
    and (_school is null or exists (select 1 from public.education ed where ed.user_id = p.id and lower(coalesce(ed.institution, '')) ilike any (_school)))
    and (_minyrs is null or public._ad_profile_years_experience(p.id) >= _minyrs);
  return coalesce(_ok, false);
end;
$$;
revoke execute on function public._ad_profile_matches_audience(uuid, jsonb) from authenticated, anon, service_role, public;

-- ---------- delivery: pick one sponsored ad for the current viewer ------
create or replace function public.feed_pick_sponsored_ad(_session_key text)
returns table (
  ad_id           uuid,
  format          public.ad_format,
  headline        text,
  body            text,
  cta_label       text,
  destination_url text,
  media_url       text,
  sponsor_name    text
)
language plpgsql stable security definer set search_path = public
as $$
declare
  _me        uuid := public.current_profile_id();
  _min_reach constant integer := 300;
  _sk        text := left(coalesce(_session_key, ''), 64);
begin
  if _me is null then return; end if;
  -- TEST MODE: only allowlisted profiles ever receive an ad
  if not exists (select 1 from public.ad_delivery_test_users t where t.profile_id = _me) then
    return;
  end if;

  return query
  select a.id, cr.format, cr.headline, cr.body, cr.cta_label, cr.destination_url, cr.media_url, co.name
  from public.ads a
  join public.ad_sets s       on s.id = a.ad_set_id
  join public.campaigns c     on c.id = s.campaign_id
  join public.ad_accounts ac  on ac.id = c.ad_account_id
  join public.companies co    on co.id = ac.company_id
  join public.ad_creatives cr on cr.ad_id = a.id
  where a.review_status = 'approved'
    and a.status = 'active'
    and c.status = 'active'
    and ac.status = 'active'
    and (c.start_at is null or c.start_at <= now())
    and (c.end_at is null or c.end_at > now())
    and coalesce(btrim(cr.headline), '') <> ''
    and cr.destination_url ~ '^https?://'
    and (cr.format = 'text' or coalesce(btrim(cr.media_url), '') <> '')
    and (
      s.audience_id is null
      or exists (
        select 1 from public.ad_audiences aud
        where aud.id = s.audience_id
          and public._ad_audience_count(coalesce(aud.spec, '{}'::jsonb)) >= _min_reach
          and public._ad_profile_matches_audience(_me, coalesce(aud.spec, '{}'::jsonb))
      )
    )
    -- deterministic, session-scoped frequency cap
    and not exists (
      select 1 from public.ad_delivery_events e
      where e.ad_id = a.id
        and e.viewer_profile_id = _me
        and e.session_key = _sk
        and e.event_type = 'impression'
        and e.occurred_at > now() - interval '30 minutes'
    )
  order by
    (select count(*) from public.ad_delivery_events e
       where e.ad_id = a.id and e.viewer_profile_id = _me and e.event_type = 'impression') asc,
    c.activated_at asc nulls last,
    a.created_at asc,
    a.id asc
  limit 1;
end;
$$;
revoke all on function public.feed_pick_sponsored_ad(text) from public, anon;
grant execute on function public.feed_pick_sponsored_ad(text) to authenticated;

-- ---------- impression / click foundation ------------------------------
create or replace function public._ad_delivery_eligible_for(_ad_id uuid, _me uuid)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare _ok boolean;
begin
  if _me is null then return false; end if;
  if not exists (select 1 from public.ad_delivery_test_users t where t.profile_id = _me) then
    return false;
  end if;
  select true into _ok
  from public.ads a
  join public.ad_sets s       on s.id = a.ad_set_id
  join public.campaigns c     on c.id = s.campaign_id
  join public.ad_accounts ac  on ac.id = c.ad_account_id
  join public.ad_creatives cr on cr.ad_id = a.id
  where a.id = _ad_id
    and a.review_status = 'approved' and a.status = 'active'
    and c.status = 'active' and ac.status = 'active'
    and (c.start_at is null or c.start_at <= now())
    and (c.end_at is null or c.end_at > now())
    and (
      s.audience_id is null
      or exists (
        select 1 from public.ad_audiences aud
        where aud.id = s.audience_id
          and public._ad_audience_count(coalesce(aud.spec, '{}'::jsonb)) >= 300
          and public._ad_profile_matches_audience(_me, coalesce(aud.spec, '{}'::jsonb))
      )
    );
  return coalesce(_ok, false);
end;
$$;
revoke execute on function public._ad_delivery_eligible_for(uuid, uuid) from authenticated, anon, service_role, public;

create or replace function public._ad_record_event(_ad_id uuid, _session_key text, _kind public.ad_event_type)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  _me uuid := public.current_profile_id();
  _s  public.ad_sets;
  _c  public.campaigns;
  _sk text := left(coalesce(_session_key, ''), 64);
  _bucket text;
begin
  if not public._ad_delivery_eligible_for(_ad_id, _me) then
    raise exception 'ad is not deliverable to you' using errcode = '42501';
  end if;
  select s.* into _s from public.ad_sets s join public.ads a on a.ad_set_id = s.id where a.id = _ad_id;
  select c.* into _c from public.campaigns c where c.id = _s.campaign_id;

  -- impressions dedup per hour, clicks per minute
  _bucket := case when _kind = 'impression'
                  then to_char(date_trunc('hour', now()), 'YYYYMMDDHH24')
                  else to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI') end;

  insert into public.ad_delivery_events
    (ad_id, ad_set_id, campaign_id, ad_account_id, event_type, placement,
     viewer_profile_id, session_key, dedup_key)
  values
    (_ad_id, _s.id, _c.id, _c.ad_account_id, _kind, 'feed_sponsored',
     _me, _sk, _kind::text || ':' || _ad_id || ':' || _me || ':' || nullif(_sk, '') || ':' || _bucket)
  on conflict (dedup_key) do nothing;
end;
$$;
revoke execute on function public._ad_record_event(uuid, text, public.ad_event_type) from authenticated, anon, service_role, public;

create or replace function public.ad_record_impression(_ad_id uuid, _session_key text)
returns void language plpgsql security definer set search_path = public
as $$ begin perform public._ad_record_event(_ad_id, _session_key, 'impression'); end; $$;

create or replace function public.ad_record_click(_ad_id uuid, _session_key text)
returns void language plpgsql security definer set search_path = public
as $$ begin perform public._ad_record_event(_ad_id, _session_key, 'click'); end; $$;

revoke all on function public.ad_record_impression(uuid, text) from public, anon;
revoke all on function public.ad_record_click(uuid, text) from public, anon;
grant execute on function public.ad_record_impression(uuid, text) to authenticated;
grant execute on function public.ad_record_click(uuid, text) to authenticated;

-- ---------- admin: manage the test-user allowlist ---------------------
create or replace function public.set_ad_delivery_test_user(_profile_id uuid, _enabled boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'reviewer access required' using errcode = '42501';
  end if;
  if _enabled then
    insert into public.ad_delivery_test_users (profile_id, added_by)
    values (_profile_id, auth.uid())
    on conflict (profile_id) do nothing;
  else
    delete from public.ad_delivery_test_users where profile_id = _profile_id;
  end if;
end;
$$;
revoke all on function public.set_ad_delivery_test_user(uuid, boolean) from public, anon;
grant execute on function public.set_ad_delivery_test_user(uuid, boolean) to authenticated;
