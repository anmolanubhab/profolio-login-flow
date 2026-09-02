-- =====================================================================
-- Phase H — Ad Review / Approval
--
-- Reviewers are the existing app-role 'admin' (Phase C: "reviewer = app
-- role admin"; every ad_* reviewer_select policy already keys off it).
-- Reviewers are global — any admin can review any ad, like an ad-policy
-- team. The advertiser can NEVER approve/reject: review_ad_approve /
-- review_ad_reject re-check has_role(auth.uid(),'admin') server-side, and
-- the Phase C ad_status_guard still blocks any direct client write to
-- ads.review_status.
--
-- Lifecycle:  draft/rejected --submit--> pending --approve--> approved
--                                              \--reject--> rejected
-- A rejected ad is edited in place (name/creative are plain client writes;
-- review_status is untouched) then resubmitted. Every decision is appended
-- to ad_reviews (ad_id, reviewer_user_id, decision, reason) — the Phase C
-- table, no new store.
--
-- No ad delivery, feed insertion, impressions, clicks, billing or campaign
-- activation here.
-- =====================================================================

-- submit_ad_for_review now also accepts a rejected ad (resubmit).
create or replace function public.submit_ad_for_review(_ad_id uuid)
returns public.ads
language plpgsql
security definer
set search_path = public
as $$
declare
  _ad public.ads;
  _cr public.ad_creatives;
begin
  select * into _ad from public.ads where id = _ad_id;
  if not found then
    raise exception 'ad not found' using errcode = 'P0002';
  end if;
  if not public.is_ad_admin(_ad_id) then
    raise exception 'not authorized for this ad' using errcode = '42501';
  end if;
  if _ad.review_status not in ('draft', 'rejected') then
    raise exception 'only draft or rejected ads can be submitted for review (current: %)', _ad.review_status
      using errcode = 'P0001';
  end if;

  select * into _cr from public.ad_creatives where ad_id = _ad_id order by created_at limit 1;
  if not found then
    raise exception 'add a creative before submitting' using errcode = 'P0001';
  end if;
  if coalesce(btrim(_cr.headline), '') = '' then
    raise exception 'the creative needs a headline' using errcode = 'P0001';
  end if;
  if coalesce(btrim(_cr.destination_url), '') = '' then
    raise exception 'the creative needs a destination URL' using errcode = 'P0001';
  end if;
  if _cr.destination_url !~ '^https?://' then
    raise exception 'the destination URL must start with http:// or https://' using errcode = 'P0001';
  end if;
  if _cr.format in ('single_image', 'spotlight') and coalesce(btrim(_cr.media_url), '') = '' then
    raise exception 'this ad format needs an image' using errcode = 'P0001';
  end if;

  perform set_config('ad.bypass_status_guard', 'on', true);
  update public.ads set review_status = 'pending' where id = _ad_id returning * into _ad;
  perform set_config('ad.bypass_status_guard', 'off', true);
  return _ad;
end;
$$;

-- ---- reviewer: approve --------------------------------------------------
create or replace function public.review_ad_approve(_ad_id uuid)
returns public.ads
language plpgsql
security definer
set search_path = public
as $$
declare
  _ad public.ads;
  _cr public.ad_creatives;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'reviewer access required' using errcode = '42501';
  end if;

  select * into _ad from public.ads where id = _ad_id;
  if not found then
    raise exception 'ad not found' using errcode = 'P0002';
  end if;
  if _ad.review_status <> 'pending' then
    raise exception 'only ads in review can be approved (current: %)', _ad.review_status
      using errcode = 'P0001';
  end if;

  -- re-run the same completeness gate as submit — never approve an invalid ad
  select * into _cr from public.ad_creatives where ad_id = _ad_id order by created_at limit 1;
  if not found then
    raise exception 'cannot approve: the ad has no creative' using errcode = 'P0001';
  end if;
  if coalesce(btrim(_cr.headline), '') = '' then
    raise exception 'cannot approve: the creative has no headline' using errcode = 'P0001';
  end if;
  if coalesce(btrim(_cr.destination_url), '') = '' or _cr.destination_url !~ '^https?://' then
    raise exception 'cannot approve: the destination URL is missing or invalid' using errcode = 'P0001';
  end if;
  if _cr.format in ('single_image', 'spotlight') and coalesce(btrim(_cr.media_url), '') = '' then
    raise exception 'cannot approve: this ad format needs an image' using errcode = 'P0001';
  end if;

  insert into public.ad_reviews (ad_id, reviewer_user_id, decision)
  values (_ad_id, auth.uid(), 'approved');

  perform set_config('ad.bypass_status_guard', 'on', true);
  update public.ads set review_status = 'approved' where id = _ad_id returning * into _ad;
  perform set_config('ad.bypass_status_guard', 'off', true);
  return _ad;
end;
$$;

-- ---- reviewer: reject (reason required) --------------------------------
create or replace function public.review_ad_reject(_ad_id uuid, _reason text)
returns public.ads
language plpgsql
security definer
set search_path = public
as $$
declare
  _ad     public.ads;
  _clean  text := btrim(coalesce(_reason, ''));
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'reviewer access required' using errcode = '42501';
  end if;
  if char_length(_clean) < 3 then
    raise exception 'a rejection reason is required' using errcode = 'P0001';
  end if;
  if char_length(_clean) > 1000 then
    raise exception 'the rejection reason is too long (max 1000 characters)' using errcode = 'P0001';
  end if;

  select * into _ad from public.ads where id = _ad_id;
  if not found then
    raise exception 'ad not found' using errcode = 'P0002';
  end if;
  if _ad.review_status <> 'pending' then
    raise exception 'only ads in review can be rejected (current: %)', _ad.review_status
      using errcode = 'P0001';
  end if;

  insert into public.ad_reviews (ad_id, reviewer_user_id, decision, reason)
  values (_ad_id, auth.uid(), 'rejected', _clean);

  perform set_config('ad.bypass_status_guard', 'on', true);
  update public.ads set review_status = 'rejected' where id = _ad_id returning * into _ad;
  perform set_config('ad.bypass_status_guard', 'off', true);
  return _ad;
end;
$$;

revoke all on function public.review_ad_approve(uuid) from public, anon;
revoke all on function public.review_ad_reject(uuid, text) from public, anon;
grant execute on function public.review_ad_approve(uuid) to authenticated;
grant execute on function public.review_ad_reject(uuid, text) to authenticated;
