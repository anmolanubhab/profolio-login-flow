-- =====================================================================
-- Phase G — Ad + Creative
--
-- Builds on the Phase C `ads` / `ad_creatives` tables and the Phase F
-- `ad_sets` foundation.  One creative per ad; one ad set per campaign.
--
--  * ads default to review_status 'draft' (added in the previous migration).
--  * draft -> pending is the only advertiser-controlled hop, via the
--    SECURITY DEFINER submit_ad_for_review RPC (mirrors Phase E campaigns).
--    approved / rejected stay reviewer-only — the Phase C ad_status_guard
--    blocks any direct client write to ads.review_status.
--  * creative images live in a dedicated public 'ad-creatives' storage
--    bucket, write-gated to admins of the ad account named by the object
--    path (<ad_account_id>/<file>).
--
-- No ad delivery, Feed integration, tracking, analytics, billing, or
-- reviewer workflow here.
-- =====================================================================

-- ---- ads default to draft --------------------------------------------
alter table public.ads
  alter column review_status set default 'draft'::public.ad_review_status;

-- ---- creative media URL integrity (destination_url already constrained) ----
alter table public.ad_creatives
  drop constraint if exists ad_creatives_media_url_chk;
alter table public.ad_creatives
  add constraint ad_creatives_media_url_chk
  check (media_url is null or media_url ~ '^https?://');

-- ---- storage: dedicated bucket for ad creative images ---------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-creatives', 'ad-creatives', true, 5242880,
        array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "ad creatives are publicly readable" on storage.objects;
create policy "ad creatives are publicly readable" on storage.objects
  for select to public
  using (bucket_id = 'ad-creatives');

drop policy if exists "ad account admins upload ad creatives" on storage.objects;
create policy "ad account admins upload ad creatives" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ad-creatives'
    and array_length(string_to_array(name, '/'), 1) = 2
    and public.is_ad_account_admin((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "ad account admins update ad creatives" on storage.objects;
create policy "ad account admins update ad creatives" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'ad-creatives'
    and public.is_ad_account_admin((storage.foldername(name))[1]::uuid)
  )
  with check (
    bucket_id = 'ad-creatives'
    and public.is_ad_account_admin((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "ad account admins delete ad creatives" on storage.objects;
create policy "ad account admins delete ad creatives" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ad-creatives'
    and public.is_ad_account_admin((storage.foldername(name))[1]::uuid)
  );

-- ---- one ad set per campaign (created lazily so ads can exist before an audience) ----
create or replace function public.get_or_create_campaign_ad_set(_campaign_id uuid)
returns public.ad_sets
language plpgsql
security definer
set search_path = public
as $$
declare
  _camp public.campaigns;
  _set  public.ad_sets;
begin
  select * into _camp from public.campaigns where id = _campaign_id;
  if not found then
    raise exception 'campaign not found' using errcode = 'P0002';
  end if;
  if not public.is_campaign_admin(_campaign_id) then
    raise exception 'not authorized for this campaign' using errcode = '42501';
  end if;

  select * into _set from public.ad_sets where campaign_id = _campaign_id order by created_at limit 1;
  if not found then
    insert into public.ad_sets (campaign_id, name)
    values (_campaign_id, left(_camp.name, 90) || ' — ad set')
    returning * into _set;
  end if;
  return _set;
end;
$$;

-- ---- ad lifecycle: draft <-> pending, advertiser-controlled only --------
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
  if _ad.review_status <> 'draft' then
    raise exception 'only draft ads can be submitted for review (current: %)', _ad.review_status
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

create or replace function public.withdraw_ad_submission(_ad_id uuid)
returns public.ads
language plpgsql
security definer
set search_path = public
as $$
declare
  _ad public.ads;
begin
  select * into _ad from public.ads where id = _ad_id;
  if not found then
    raise exception 'ad not found' using errcode = 'P0002';
  end if;
  if not public.is_ad_admin(_ad_id) then
    raise exception 'not authorized for this ad' using errcode = '42501';
  end if;
  if _ad.review_status <> 'pending' then
    raise exception 'only ads in review can be withdrawn (current: %)', _ad.review_status
      using errcode = 'P0001';
  end if;

  perform set_config('ad.bypass_status_guard', 'on', true);
  update public.ads set review_status = 'draft' where id = _ad_id returning * into _ad;
  perform set_config('ad.bypass_status_guard', 'off', true);
  return _ad;
end;
$$;

revoke all on function public.get_or_create_campaign_ad_set(uuid) from public, anon;
revoke all on function public.submit_ad_for_review(uuid) from public, anon;
revoke all on function public.withdraw_ad_submission(uuid) from public, anon;
grant execute on function public.get_or_create_campaign_ad_set(uuid) to authenticated;
grant execute on function public.submit_ad_for_review(uuid) to authenticated;
grant execute on function public.withdraw_ad_submission(uuid) to authenticated;
