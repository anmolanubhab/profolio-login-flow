-- =====================================================================
-- Phase K3-C Remediation — R5 / E13 + E12
--
-- E13  ad_provider_secrets holds the webhook signing secret. Move it out
--      of the PostgREST-exposed `public` schema into a `private` schema
--      no API role can reach, and expose the one value the edge runtime
--      needs through a SECURITY DEFINER accessor granted to service_role
--      only.
-- E12  Drop the duplicate index on ad_billing_transactions
--      (account_idx == account_time_idx, same columns / order).
--
-- Still simulated / test mode only — the secret is the HMAC key for the
-- simulated provider's signed webhooks, not a production credential.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to postgres, service_role;

alter table if exists public.ad_provider_secrets set schema private;

-- keep RLS on (defence in depth) but no role can select through the API
alter table private.ad_provider_secrets enable row level security;
revoke all on private.ad_provider_secrets from anon, authenticated;

create or replace function public._ad_get_webhook_secret()
returns text
language sql
stable
security definer
set search_path to 'private', 'public'
as $$
  select webhook_secret from private.ad_provider_secrets where id = 1
$$;

comment on function public._ad_get_webhook_secret() is
  'Returns the current provider webhook signing secret. SECURITY DEFINER; execute granted to service_role only. Used by the ad-billing edge functions.';

revoke all on function public._ad_get_webhook_secret() from public, anon, authenticated;
grant execute on function public._ad_get_webhook_secret() to service_role;

-- E12 — duplicate index
drop index if exists public.ad_billing_transactions_account_idx;
