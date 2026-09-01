import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

/**
 * Phase D data layer for the advertiser + ad-account UI.
 *
 * Everything here goes through the anon/publishable client and is gated by the
 * Phase C RLS on `public.ad_accounts` (advertiser = `is_company_admin()`;
 * reviewer = app-role `admin`, SELECT-only). No service-role key, no RLS
 * bypass. The company picker is scoped client-side to companies the user owns
 * or is a member of — the same relationship `is_company_admin()` checks — and
 * the RLS `WITH CHECK` is the real backstop if that list is ever wrong.
 */

export type AdAccount = Database['public']['Tables']['ad_accounts']['Row'];
export type AdAccountStatus = Database['public']['Enums']['ad_account_status'];

export interface AuthorizedCompany {
  id: string;
  name: string;
  logo_url: string | null;
  /** 'owner' | 'member' — how the current user is attached to this company. */
  relation: 'owner' | 'member';
}

/** Currencies offered at ad-account creation. Locked once the account exists. */
export const AD_ACCOUNT_CURRENCIES: { code: string; label: string }[] = [
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'EUR', label: 'EUR — Euro' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'CAD', label: 'CAD — Canadian Dollar' },
  { code: 'AUD', label: 'AUD — Australian Dollar' },
  { code: 'SGD', label: 'SGD — Singapore Dollar' },
  { code: 'AED', label: 'AED — UAE Dirham' },
  { code: 'JPY', label: 'JPY — Japanese Yen' },
];

/** A small, unambiguous set of reporting time zones. */
export const AD_ACCOUNT_TIMEZONES: string[] = [
  'UTC',
  'America/Los_Angeles',
  'America/New_York',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Africa/Johannesburg',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export const AD_ACCOUNT_STATUS_LABEL: Record<AdAccountStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  closed: 'Closed',
};

/**
 * Companies the signed-in user is authorized to advertise for: the ones they
 * own plus the ones they're a `company_members` row of. Both reads are
 * RLS-clean (companies are publicly selectable; `company_members` lets you see
 * your own rows).
 */
export async function getAuthorizedCompanies(): Promise<AuthorizedCompany[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (profileErr) throw profileErr;
  const profileId = profile.id;

  const [ownedRes, memberRes] = await Promise.all([
    supabase.from('companies').select('id, name, logo_url').eq('owner_id', profileId),
    supabase.from('company_members').select('company_id').eq('user_id', profileId),
  ]);
  if (ownedRes.error) throw ownedRes.error;
  if (memberRes.error) throw memberRes.error;

  const byId = new Map<string, AuthorizedCompany>();
  for (const c of ownedRes.data ?? []) {
    byId.set(c.id, { id: c.id, name: c.name, logo_url: c.logo_url, relation: 'owner' });
  }

  const memberOnlyIds = (memberRes.data ?? [])
    .map((r) => r.company_id)
    .filter((id): id is string => !!id && !byId.has(id));

  if (memberOnlyIds.length > 0) {
    const { data: memberCompanies, error } = await supabase
      .from('companies')
      .select('id, name, logo_url')
      .in('id', memberOnlyIds);
    if (error) throw error;
    for (const c of memberCompanies ?? []) {
      byId.set(c.id, { id: c.id, name: c.name, logo_url: c.logo_url, relation: 'member' });
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** All ad accounts the current user can see (RLS-scoped to their companies). */
export async function listAdAccounts(): Promise<AdAccount[]> {
  const { data, error } = await supabase
    .from('ad_accounts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAdAccount(id: string): Promise<AdAccount | null> {
  const { data, error } = await supabase.from('ad_accounts').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export interface CreateAdAccountInput {
  companyId: string;
  name: string;
  currency: string;
  timezone: string;
  /** Must be true — the Ads Agreement checkbox. Persisted as a timestamp. */
  agreementAccepted: boolean;
}

export async function createAdAccount(input: CreateAdAccountInput): Promise<AdAccount> {
  if (!input.agreementAccepted) {
    throw new Error('The Profolio Ads Agreement must be accepted before creating an ad account.');
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('ad_accounts')
    .insert({
      company_id: input.companyId,
      name: input.name.trim(),
      currency: input.currency,
      timezone: input.timezone,
      agreement_accepted_at: new Date().toISOString(),
      created_by: user?.id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Basic settings — name and reporting time zone. Currency is intentionally omitted (immutable). */
export async function updateAdAccountSettings(
  id: string,
  patch: { name?: string; timezone?: string },
): Promise<AdAccount> {
  const { data, error } = await supabase
    .from('ad_accounts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Advertiser-permitted status changes: close an active account, or reopen a closed one. */
export async function setAdAccountStatus(id: string, status: 'active' | 'closed'): Promise<AdAccount> {
  const { data, error } = await supabase
    .from('ad_accounts')
    .update({ status })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
