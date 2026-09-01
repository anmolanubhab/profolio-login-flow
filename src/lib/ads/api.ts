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

// =====================================================================
// Phase E — campaigns
//
// Create + edit-draft are plain client writes gated by the Phase C
// `campaigns` RLS (advertiser = `is_ad_account_admin()`), and never touch
// `status`. The only lifecycle movement is draft <-> pending_review, which
// goes through the SECURITY DEFINER RPCs `submit_campaign_for_review` /
// `withdraw_campaign_submission` — the Phase C `ad_status_guard` blocks any
// direct client write to `campaigns.status`.
// =====================================================================

export type Campaign = Database['public']['Tables']['campaigns']['Row'];
export type CampaignStatus = Database['public']['Enums']['campaign_status'];
export type CampaignObjective = Database['public']['Enums']['campaign_objective'];

export type CampaignObjectiveGroup = 'Awareness' | 'Consideration' | 'Conversions';

export const CAMPAIGN_OBJECTIVES: {
  value: CampaignObjective;
  label: string;
  description: string;
  group: CampaignObjectiveGroup;
}[] = [
  {
    value: 'brand_awareness',
    label: 'Brand awareness',
    description: 'Get your company in front of more people on Profolio.',
    group: 'Awareness',
  },
  {
    value: 'website_visits',
    label: 'Website visits',
    description: 'Send people to a destination off Profolio.',
    group: 'Consideration',
  },
  {
    value: 'post_engagement',
    label: 'Engagement',
    description: 'Get more reactions, comments, shares and follows.',
    group: 'Consideration',
  },
  {
    value: 'profile_visits',
    label: 'Profile visits',
    description: 'Drive people to a member or company profile.',
    group: 'Consideration',
  },
  {
    value: 'company_page_visits',
    label: 'Company Page visits',
    description: 'Grow traffic to your Profolio company page.',
    group: 'Consideration',
  },
  {
    value: 'lead_generation',
    label: 'Lead generation',
    description: 'Collect interest from people using a Profolio form.',
    group: 'Conversions',
  },
  {
    value: 'job_promotion',
    label: 'Job promotion',
    description: 'Put a role in front of relevant candidates.',
    group: 'Conversions',
  },
];

export const CAMPAIGN_OBJECTIVE_GROUP_ORDER: CampaignObjectiveGroup[] = [
  'Awareness',
  'Consideration',
  'Conversions',
];

export function campaignObjectiveLabel(value: CampaignObjective): string {
  return CAMPAIGN_OBJECTIVES.find((o) => o.value === value)?.label ?? value;
}

export const CAMPAIGN_STATUS_META: Record<
  CampaignStatus,
  { label: string; tone: 'neutral' | 'info' | 'success' | 'warn' | 'danger' }
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending_review: { label: 'In review', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  active: { label: 'Active', tone: 'success' },
  paused: { label: 'Paused', tone: 'warn' },
  completed: { label: 'Completed', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

/** cents (bigint in the DB) -> major-unit string for inputs, '' for 0/null. */
export function centsToAmount(cents: number | null | undefined): string {
  if (!cents || cents <= 0) return '';
  return (cents / 100).toString();
}

/** major-unit string -> integer cents. Returns 0 for blank/invalid. */
export function amountToCents(amount: string): number {
  const n = Number.parseFloat(amount);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export async function listCampaigns(adAccountId: string): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/** Campaign plus its parent ad account (for currency + breadcrumb + not-found handling). */
export async function getCampaignWithAccount(
  campaignId: string,
): Promise<{ campaign: Campaign; adAccount: AdAccount } | null> {
  const { data: campaign, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();
  if (error) throw error;
  if (!campaign) return null;

  const adAccount = await getAdAccount(campaign.ad_account_id);
  if (!adAccount) return null;
  return { campaign, adAccount };
}

export interface CampaignDraftInput {
  adAccountId: string;
  name: string;
  objective: CampaignObjective;
  totalBudgetCents: number;
  dailyBudgetCents: number | null;
  startAt: string | null;
  endAt: string | null;
}

export async function createCampaignDraft(input: CampaignDraftInput): Promise<Campaign> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      ad_account_id: input.adAccountId,
      name: input.name.trim(),
      objective: input.objective,
      total_budget_cents: input.totalBudgetCents,
      daily_budget_cents: input.dailyBudgetCents,
      start_at: input.startAt,
      end_at: input.endAt,
      created_by: user?.id ?? null,
      // status intentionally omitted — defaults to 'draft'
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/** Edit a draft. Never sends `status` — the guard would reject it and it isn't ours to set. */
export async function updateCampaignDraft(
  campaignId: string,
  patch: Partial<Omit<CampaignDraftInput, 'adAccountId'>>,
): Promise<Campaign> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.objective !== undefined) row.objective = patch.objective;
  if (patch.totalBudgetCents !== undefined) row.total_budget_cents = patch.totalBudgetCents;
  if (patch.dailyBudgetCents !== undefined) row.daily_budget_cents = patch.dailyBudgetCents;
  if (patch.startAt !== undefined) row.start_at = patch.startAt;
  if (patch.endAt !== undefined) row.end_at = patch.endAt;

  const { data, error } = await supabase
    .from('campaigns')
    .update(row)
    .eq('id', campaignId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function submitCampaignForReview(campaignId: string): Promise<Campaign> {
  const { data, error } = await supabase.rpc('submit_campaign_for_review', {
    _campaign_id: campaignId,
  });
  if (error) throw error;
  return data as unknown as Campaign;
}

export async function withdrawCampaignSubmission(campaignId: string): Promise<Campaign> {
  const { data, error } = await supabase.rpc('withdraw_campaign_submission', {
    _campaign_id: campaignId,
  });
  if (error) throw error;
  return data as unknown as Campaign;
}
