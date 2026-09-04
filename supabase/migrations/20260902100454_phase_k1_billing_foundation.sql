-- =====================================================================
-- Phase K1 — Billing Foundation
--
-- Establishes a production-grade billing DATA MODEL and permission model
-- for advertiser ad accounts. It does NOT charge money, connect a payment
-- provider, create payment intents, or store card/bank credentials.
--
-- What K1 adds:
--   * ad_billing_profiles     — one per ad account: legal/tax/contact/address
--   * ad_payment_methods       — tokenised provider references + display
--                                metadata only (brand / last4 / expiry).
--                                NEVER a PAN, CVV, or bank credential.
--   * ad_billing_events        — append-only audit of billing changes
--   * ad_invoices              — schema only (0 rows in K1; K2/K3 populate)
--   * ad_billing_transactions  — schema only (0 rows in K1; K2/K3 populate)
--
-- Permission model: billing is managed only by the OWNER or a SUPER-ADMIN
-- of the company that owns the ad account (public.is_company_owner_or_super_admin).
-- Ordinary company members (content_admin) — who CAN manage campaigns/ads —
-- do NOT get billing access. Platform admins (app_role 'admin') can read
-- billing profile / status / invoices / transactions for support, but have
-- NO policy on ad_payment_methods — i.e. no automatic access to payment
-- references.
--
-- Currency is NOT stored here — it is inherited from ad_accounts.currency
-- (immutable after account creation) and copied onto invoices/transactions
-- when those are later generated.
-- =====================================================================

-- ---------- enums ------------------------------------------------------
create type public.ad_billing_profile_status as enum (
  'setup_required',        -- required profile fields missing
  'payment_method_required', -- profile complete, no payment method yet
  'ready',                  -- profile complete + >=1 payment method
  'restricted'             -- set by Profolio/admin only; never auto-derived
);

create type public.ad_payment_provider as enum (
  'none',                  -- no provider wired yet (the K1 state)
  'stripe',
  'manual'                 -- offline / invoice-settled
);

create type public.ad_payment_method_type as enum (
  'card',
  'paypal',
  'bank_account',
  'other'
);

create type public.ad_billing_event_type as enum (
  'profile_created',
  'profile_updated',
  'status_changed',
  'payment_method_added',
  'payment_method_removed',
  'payment_method_default_changed'
);

create type public.ad_invoice_status as enum (
  'draft', 'open', 'paid', 'void', 'uncollectible'
);

create type public.ad_billing_txn_type as enum (
  'charge', 'refund', 'adjustment', 'credit'
);

create type public.ad_billing_txn_status as enum (
  'pending', 'succeeded', 'failed', 'canceled'
);

-- ---------- authorization helper ------------------------------------------
-- Billing manager = owner or super_admin of the company that owns the account.
create or replace function public.is_ad_account_billing_manager(_ad_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_company_owner_or_super_admin(
    (select company_id from public.ad_accounts where id = _ad_account_id)
  );
$$;

revoke all on function public.is_ad_account_billing_manager(uuid) from public, anon;
grant execute on function public.is_ad_account_billing_manager(uuid) to authenticated;

-- ---------- ad_billing_profiles -----------------------------------------
create table public.ad_billing_profiles (
  id                   uuid primary key default gen_random_uuid(),
  ad_account_id        uuid not null unique references public.ad_accounts(id) on delete cascade,
  status               public.ad_billing_profile_status not null default 'setup_required',
  legal_name           text,
  billing_email        text,
  billing_contact_name text,
  billing_country      text,          -- ISO 3166-1 alpha-2
  address_line1        text,
  address_line2        text,
  city                 text,
  state_region         text,
  postal_code          text,
  tax_id_type          text,          -- 'gst' | 'vat' | 'abn' | ... (nullable)
  tax_id_value         text,
  provider             public.ad_payment_provider not null default 'none',
  created_by           uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint ad_billing_profiles_country_chk
    check (billing_country is null or billing_country ~ '^[A-Za-z]{2}$'),
  constraint ad_billing_profiles_email_chk
    check (billing_email is null or billing_email ~ '^[^@%[:space:]]+@[^@%[:space:]]+\.[^@%[:space:]]+$'),
  constraint ad_billing_profiles_tax_pair_chk
    check ((tax_id_value is null) or (tax_id_type is not null))
);

alter table public.ad_billing_profiles enable row level security;

-- ---------- ad_payment_methods ----------------------------------------
create table public.ad_payment_methods (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts(id) on delete cascade,
  provider       public.ad_payment_provider not null default 'none',
  provider_ref   text,               -- tokenised provider id (e.g. 'pm_...'); never a card number
  method_type    public.ad_payment_method_type not null default 'card',
  display_brand  text,               -- 'visa' | 'mastercard' | ... (display only)
  display_last4  text,               -- last 4 only (PCI out-of-scope, shown on receipts)
  exp_month      int,
  exp_year       int,
  billing_name   text,
  is_default     boolean not null default false,
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint ad_payment_methods_last4_chk
    check (display_last4 is null or display_last4 ~ '^[0-9]{4}$'),
  -- defence in depth: never let a full card number land in the token column
  constraint ad_payment_methods_provider_ref_not_pan_chk
    check (provider_ref is null or provider_ref !~ '^[0-9 -]{12,25}$'),
  constraint ad_payment_methods_exp_month_chk
    check (exp_month is null or exp_month between 1 and 12),
  constraint ad_payment_methods_exp_year_chk
    check (exp_year is null or exp_year between 2000 and 2100)
);

create index ad_payment_methods_account_idx on public.ad_payment_methods (ad_account_id);
create unique index ad_payment_methods_one_default_idx
  on public.ad_payment_methods (ad_account_id) where is_default;

alter table public.ad_payment_methods enable row level security;

-- ---------- ad_billing_events (append-only audit) --------------------
create table public.ad_billing_events (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts(id) on delete cascade,
  event_type     public.ad_billing_event_type not null,
  actor_user_id  uuid references auth.users(id) on delete set null,
  summary        text not null,
  metadata       jsonb not null default '{}'::jsonb,   -- non-sensitive detail only
  created_at     timestamptz not null default now()
);

create index ad_billing_events_account_idx on public.ad_billing_events (ad_account_id, created_at desc);
alter table public.ad_billing_events enable row level security;

-- ---------- ad_invoices (schema only in K1) -------------------------
create table public.ad_invoices (
  id             uuid primary key default gen_random_uuid(),
  ad_account_id  uuid not null references public.ad_accounts(id) on delete cascade,
  invoice_number text unique,
  status         public.ad_invoice_status not null default 'draft',
  currency       text not null,               -- copied from ad_accounts.currency at creation
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents      bigint not null default 0 check (tax_cents >= 0),
  total_cents    bigint not null default 0 check (total_cents >= 0),
  period_start   date,
  period_end     date,
  issued_at      timestamptz,
  due_at         timestamptz,
  paid_at        timestamptz,
  provider       public.ad_payment_provider not null default 'none',
  provider_ref   text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index ad_invoices_account_idx on public.ad_invoices (ad_account_id, created_at desc);
alter table public.ad_invoices enable row level security;

-- ---------- ad_billing_transactions (schema only in K1) ------------
create table public.ad_billing_transactions (
  id                uuid primary key default gen_random_uuid(),
  ad_account_id     uuid not null references public.ad_accounts(id) on delete cascade,
  invoice_id        uuid references public.ad_invoices(id) on delete set null,
  payment_method_id uuid references public.ad_payment_methods(id) on delete set null,
  txn_type          public.ad_billing_txn_type not null,
  status            public.ad_billing_txn_status not null default 'pending',
  amount_cents      bigint not null check (amount_cents >= 0),
  currency          text not null,
  provider          public.ad_payment_provider not null default 'none',
  provider_ref      text,
  idempotency_key   text,
  failure_reason    text,
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index ad_billing_transactions_account_idx
  on public.ad_billing_transactions (ad_account_id, occurred_at desc);
create unique index ad_billing_transactions_idem_idx
  on public.ad_billing_transactions (ad_account_id, idempotency_key)
  where idempotency_key is not null;
alter table public.ad_billing_transactions enable row level security;

-- ---------- updated_at triggers -------------------------------------
create trigger trg_ad_billing_profiles_updated_at
  before update on public.ad_billing_profiles
  for each row execute function public.update_updated_at_column();
create trigger trg_ad_payment_methods_updated_at
  before update on public.ad_payment_methods
  for each row execute function public.update_updated_at_column();
create trigger trg_ad_invoices_updated_at
  before update on public.ad_invoices
  for each row execute function public.update_updated_at_column();
create trigger trg_ad_billing_transactions_updated_at
  before update on public.ad_billing_transactions
  for each row execute function public.update_updated_at_column();

-- ---------- derived billing status --------------------------------
-- Recompute ad_billing_profiles.status from field completeness + payment
-- method presence. 'restricted' is administrative and never auto-cleared.
create or replace function public._ad_billing_apply_status(_p public.ad_billing_profiles)
returns public.ad_billing_profile_status
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _complete boolean;
  _has_pm boolean;
begin
  if _p.status = 'restricted' then
    return 'restricted';
  end if;
  _complete := coalesce(nullif(btrim(_p.legal_name), ''), null) is not null
           and coalesce(nullif(btrim(_p.billing_email), ''), null) is not null
           and coalesce(nullif(btrim(_p.billing_country), ''), null) is not null;
  _has_pm := exists (select 1 from public.ad_payment_methods pm where pm.ad_account_id = _p.ad_account_id);
  if not _complete then
    return 'setup_required';
  elsif not _has_pm then
    return 'payment_method_required';
  else
    return 'ready';
  end if;
end;
$$;

create or replace function public._ad_billing_profile_status_biu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.status := public._ad_billing_apply_status(new);
  return new;
end;
$$;

create trigger trg_ad_billing_profile_status
  before insert or update on public.ad_billing_profiles
  for each row execute function public._ad_billing_profile_status_biu();

-- keep status current when payment methods come and go
create or replace function public._ad_billing_touch_profile_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _acct uuid := coalesce(new.ad_account_id, old.ad_account_id);
begin
  update public.ad_billing_profiles
     set updated_at = now()          -- BEFORE-update trigger recomputes status
   where ad_account_id = _acct;
  return null;
end;
$$;

create trigger trg_ad_pm_profile_status
  after insert or delete on public.ad_payment_methods
  for each row execute function public._ad_billing_touch_profile_status();

-- ---------- single-default payment method -------------------------
create or replace function public._ad_payment_method_default_biu()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- first method for the account is default by definition
  if tg_op = 'INSERT'
     and not exists (select 1 from public.ad_payment_methods pm where pm.ad_account_id = new.ad_account_id) then
    new.is_default := true;
  end if;

  if new.is_default then
    update public.ad_payment_methods
       set is_default = false
     where ad_account_id = new.ad_account_id
       and id <> new.id
       and is_default;
  end if;
  return new;
end;
$$;

create trigger trg_ad_pm_default_biu
  before insert or update on public.ad_payment_methods
  for each row execute function public._ad_payment_method_default_biu();

create or replace function public._ad_payment_method_default_ad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- if the removed method was the default, promote the newest remaining one
  if old.is_default then
    update public.ad_payment_methods
       set is_default = true
     where id = (
       select id from public.ad_payment_methods
        where ad_account_id = old.ad_account_id
        order by created_at desc
        limit 1
     );
  end if;
  return null;
end;
$$;

create trigger trg_ad_pm_default_ad
  after delete on public.ad_payment_methods
  for each row execute function public._ad_payment_method_default_ad();

-- ---------- billing audit trail ---------------------------------
create or replace function public._ad_billing_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _acct uuid;
  _etype public.ad_billing_event_type;
  _summary text;
  _meta jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'ad_billing_profiles' then
    if tg_op = 'INSERT' then
      _acct := new.ad_account_id; _etype := 'profile_created';
      _summary := 'Billing profile created';
    elsif tg_op = 'UPDATE' then
      _acct := new.ad_account_id;
      if new.status is distinct from old.status then
        _etype := 'status_changed';
        _summary := 'Billing status changed to ' || new.status;
        _meta := jsonb_build_object('from', old.status, 'to', new.status);
      elsif (to_jsonb(new) - 'updated_at') is distinct from (to_jsonb(old) - 'updated_at') then
        _etype := 'profile_updated';
        _summary := 'Billing profile updated';
      else
        return null;
      end if;
    end if;

  elsif tg_table_name = 'ad_payment_methods' then
    if tg_op = 'INSERT' then
      _acct := new.ad_account_id; _etype := 'payment_method_added';
      _summary := 'Payment method added'
        || coalesce(' (' || nullif(new.display_brand, '') || ' •••• ' || coalesce(new.display_last4, '') || ')', '');
      _meta := jsonb_build_object('method_type', new.method_type, 'provider', new.provider, 'is_default', new.is_default);
    elsif tg_op = 'DELETE' then
      _acct := old.ad_account_id; _etype := 'payment_method_removed';
      _summary := 'Payment method removed'
        || coalesce(' (' || nullif(old.display_brand, '') || ' •••• ' || coalesce(old.display_last4, '') || ')', '');
    elsif tg_op = 'UPDATE' and new.is_default and not old.is_default then
      _acct := new.ad_account_id; _etype := 'payment_method_default_changed';
      _summary := 'Default payment method changed';
    else
      return null;
    end if;
  else
    return null;
  end if;

  insert into public.ad_billing_events (ad_account_id, event_type, actor_user_id, summary, metadata)
  values (_acct, _etype, auth.uid(), _summary, _meta);
  return null;
end;
$$;

create trigger trg_ad_billing_profiles_audit
  after insert or update on public.ad_billing_profiles
  for each row execute function public._ad_billing_audit();
create trigger trg_ad_payment_methods_audit
  after insert or update or delete on public.ad_payment_methods
  for each row execute function public._ad_billing_audit();

-- ---------- RLS policies ---------------------------------------
-- ad_billing_profiles: billing managers manage; platform admins read
create policy ad_billing_profiles_mgr_all on public.ad_billing_profiles
  for all to authenticated
  using (public.is_ad_account_billing_manager(ad_account_id))
  with check (public.is_ad_account_billing_manager(ad_account_id));
create policy ad_billing_profiles_admin_select on public.ad_billing_profiles
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ad_payment_methods: billing managers ONLY — no platform-admin policy
create policy ad_payment_methods_mgr_all on public.ad_payment_methods
  for all to authenticated
  using (public.is_ad_account_billing_manager(ad_account_id))
  with check (public.is_ad_account_billing_manager(ad_account_id));

-- ad_billing_events: read-only to billing managers + platform admins; writes via trigger only
create policy ad_billing_events_mgr_select on public.ad_billing_events
  for select to authenticated
  using (public.is_ad_account_billing_manager(ad_account_id));
create policy ad_billing_events_admin_select on public.ad_billing_events
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ad_invoices / ad_billing_transactions: read-only foundation; no client writes at all
create policy ad_invoices_mgr_select on public.ad_invoices
  for select to authenticated
  using (public.is_ad_account_billing_manager(ad_account_id));
create policy ad_invoices_admin_select on public.ad_invoices
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy ad_billing_transactions_mgr_select on public.ad_billing_transactions
  for select to authenticated
  using (public.is_ad_account_billing_manager(ad_account_id));
create policy ad_billing_transactions_admin_select on public.ad_billing_transactions
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- ---------- lock anon / internal helpers ---------------------
revoke all on public.ad_billing_profiles       from anon;
revoke all on public.ad_payment_methods        from anon;
revoke all on public.ad_billing_events         from anon;
revoke all on public.ad_invoices               from anon;
revoke all on public.ad_billing_transactions   from anon;

revoke all on function public._ad_billing_apply_status(public.ad_billing_profiles) from public, anon, authenticated;
-- NOTE: the billing trigger functions are locked down from PostgREST in the
-- immediately following migration 20260902100714_phase_k1_lock_trigger_functions.
