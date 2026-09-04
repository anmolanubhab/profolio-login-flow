-- Phase K3-A fix: pin search_path on the two guard/immutability trigger fns
-- (_ad_provider_config_guard, _ad_billing_ledger_immutable). Both now carry
-- `set search_path = ''` inline in 20260902131655; this migration patches
-- environments that ran the earlier version.
create or replace function public._ad_provider_config_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.active_provider <> 'simulated' or new.test_mode is not true then
    raise exception 'K3-C production charging is not enabled: active_provider must be simulated and test_mode must be true' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create or replace function public._ad_billing_ledger_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'ad_billing_ledger is append-only' using errcode = 'P0001'; end;
$$;
revoke all on function public._ad_provider_config_guard() from public, anon, authenticated;
revoke all on function public._ad_billing_ledger_immutable() from public, anon, authenticated;
