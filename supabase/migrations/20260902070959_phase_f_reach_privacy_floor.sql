-- =====================================================================
-- Phase F privacy hardening: k-anonymity floor + bucketing on audience reach.
--
-- Problem: ad_audience_preview_reach / ad_audience_recompute_reach returned
-- the exact count(*) of the eligible population. For a narrow spec that can
-- be 1 or 2, and it moves by exactly 1 when a criterion isolating one
-- person is added/removed — a binary-search "is this specific person in the
-- audience?" oracle. The attach() error message also printed the raw count.
--
-- Fix: never expose a count below the 300 minimum, and coarsen everything
-- above it.  _ad_audience_bucket(raw):
--     raw is null -> null
--     raw < 300   -> 0        (withheld: "fewer than 300", exact size never shown)
--     raw >= 300  -> floor(raw / 100) * 100   (>= 300, resolution 100)
-- No value in 1..299 is ever returned or stored. The smallest observable
-- non-zero reach is 300 — three orders of magnitude above a single person —
-- so no query can isolate an individual, and ±1 changes are invisible.
--
-- attach_audience_to_ad_set still evaluates the RAW count internally for the
-- >= 300 decision (precision is needed exactly at the boundary), but never
-- returns it, persists only the bucketed value, and no longer names the
-- count in its error.
--
-- RLS, authorization, search_path, and grants are unchanged.
-- =====================================================================

create or replace function public._ad_audience_bucket(_raw integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when _raw is null then null
    when _raw < 300 then 0
    else (_raw / 100) * 100
  end;
$$;
revoke execute on function public._ad_audience_bucket(integer) from authenticated, anon, service_role, public;

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
  return public._ad_audience_bucket(public._ad_audience_count(coalesce(_spec, '{}'::jsonb)));
end;
$$;

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
     set estimated_reach = public._ad_audience_bucket(
           public._ad_audience_count(coalesce(a.spec, '{}'::jsonb))
         ),
         estimated_reach_at = now()
   where id = _audience_id
  returning * into a;

  return a;
end;
$$;

create or replace function public.attach_audience_to_ad_set(_campaign_id uuid, _audience_id uuid)
returns public.ad_sets
language plpgsql
security definer
set search_path = public
as $$
declare
  _camp   public.campaigns;
  _aud    public.ad_audiences;
  _raw    integer;
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

  if _aud.ad_account_id <> _camp.ad_account_id then
    raise exception 'that audience belongs to a different ad account' using errcode = '42501';
  end if;

  -- raw count used only for the boundary decision; never surfaced
  _raw := public._ad_audience_count(coalesce(_aud.spec, '{}'::jsonb));
  update public.ad_audiences
     set estimated_reach = public._ad_audience_bucket(_raw), estimated_reach_at = now()
   where id = _audience_id;

  if _raw < _min then
    raise exception 'audience too small — needs at least % eligible members', _min
      using errcode = 'P0001';
  end if;

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
