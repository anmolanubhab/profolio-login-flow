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
    if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAdAccount(id: string): Promise<AdAccount | null> {
  const { data, error } = await supabase.from('ad_accounts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
  return data;
}

export async function submitCampaignForReview(campaignId: string): Promise<Campaign> {
  const { data, error } = await supabase.rpc('submit_campaign_for_review', {
    _campaign_id: campaignId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Campaign;
}

export async function withdrawCampaignSubmission(campaignId: string): Promise<Campaign> {
  const { data, error } = await supabase.rpc('withdraw_campaign_submission', {
    _campaign_id: campaignId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as Campaign;
}

// =====================================================================
// Phase F — audiences & targeting
//
// The advertiser only ever sends targeting criteria (spec) and receives a
// single server-computed integer reach. Estimated reach and the >= 300
// minimum are enforced only in the SECURITY DEFINER RPCs
// (ad_audience_preview_reach / ad_audience_recompute_reach /
// attach_audience_to_ad_set). No API here returns matching profile rows.
// =====================================================================

export type AdAudience = Database['public']['Tables']['ad_audiences']['Row'];
export type AdSet = Database['public']['Tables']['ad_sets']['Row'];

/** Minimum eligible profiles before an audience can be attached / used. */
export const MIN_AUDIENCE_SIZE = 300;

/** Versioned targeting spec stored in `ad_audiences.spec`. All keys optional. */
export interface AudienceSpec {
  v?: 1;
  locations?: string[];
  skills?: string[];
  job_titles?: string[];
  companies?: string[];
  fields_of_study?: string[];
  schools?: string[];
  min_years_experience?: number;
}

export type AudienceListDimension =
  | 'locations'
  | 'skills'
  | 'job_titles'
  | 'companies'
  | 'fields_of_study'
  | 'schools';

/**
 * Each targeting dimension, its real Profolio data source, and how it is
 * matched. Documented here so the UI copy and the report stay in sync with
 * the SQL in 20260901160000_phase_f_audience_targeting.sql.
 */
export const TARGETING_DIMENSIONS: {
  key: AudienceListDimension;
  label: string;
  placeholder: string;
  help: string;
}[] = [
  {
    key: 'locations',
    label: 'Location',
    placeholder: 'e.g. Patna, Bengaluru',
    help: "Matched against the location on a member's public profile.",
  },
  {
    key: 'job_titles',
    label: 'Job title / profession',
    placeholder: 'e.g. Software Engineer, Sales Manager',
    help: "Matched against a member's profession and the roles in their experience.",
  },
  {
    key: 'skills',
    label: 'Skills',
    placeholder: 'e.g. React, Project Management',
    help: 'Matched against the skills listed on a member profile.',
  },
  {
    key: 'companies',
    label: 'Companies',
    placeholder: 'e.g. Acme, akl tech',
    help: "Matched against a member's current or past employers in their experience.",
  },
  {
    key: 'fields_of_study',
    label: 'Field of study',
    placeholder: 'e.g. Computer Science',
    help: "Matched against the field of study in a member's education.",
  },
  {
    key: 'schools',
    label: 'School / institution',
    placeholder: 'e.g. Magadh University',
    help: "Matched against the institutions in a member's education.",
  },
];

export function audienceCriteriaCount(spec: AudienceSpec): number {
  let n = 0;
  for (const d of TARGETING_DIMENSIONS) n += (spec[d.key]?.length ?? 0);
  if (typeof spec.min_years_experience === 'number' && spec.min_years_experience > 0) n += 1;
  return n;
}

export async function listAudiences(adAccountId: string): Promise<AdAudience[]> {
  const { data, error } = await supabase
    .from('ad_audiences')
    .select('*')
    .eq('ad_account_id', adAccountId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getAudienceWithAccount(
  audienceId: string,
): Promise<{ audience: AdAudience; adAccount: AdAccount } | null> {
  const { data: audience, error } = await supabase
    .from('ad_audiences')
    .select('*')
    .eq('id', audienceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!audience) return null;
  const adAccount = await getAdAccount(audience.ad_account_id);
  if (!adAccount) return null;
  return { audience, adAccount };
}

export async function createAudience(
  adAccountId: string,
  name: string,
  spec: AudienceSpec,
): Promise<AdAudience> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('ad_audiences')
    .insert({
      ad_account_id: adAccountId,
      name: name.trim(),
      spec: { v: 1, ...spec } as never,
      created_by: user?.id ?? null,
      // estimated_reach left null — only the server RPC may set it
    })
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updateAudience(
  audienceId: string,
  patch: { name?: string; spec?: AudienceSpec },
): Promise<AdAudience> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.spec !== undefined) {
    row.spec = { v: 1, ...patch.spec };
    // invalidate the stored reach until the server recomputes it
    row.estimated_reach = null;
    row.estimated_reach_at = null;
  }
  const { data, error } = await supabase
    .from('ad_audiences')
    .update(row)
    .eq('id', audienceId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/**
 * Server-side live estimate for an unsaved spec. Returns a privacy-safe
 * integer only: `0` means "fewer than MIN_AUDIENCE_SIZE — exact size
 * withheld"; any other value is `>= MIN_AUDIENCE_SIZE`, floored to the
 * nearest 100. The server never returns a value in 1..MIN_AUDIENCE_SIZE-1.
 */
export async function previewAudienceReach(
  adAccountId: string,
  spec: AudienceSpec,
): Promise<number> {
  const { data, error } = await supabase.rpc('ad_audience_preview_reach', {
    _ad_account_id: adAccountId,
    _spec: spec as never,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/** Recompute + persist a saved audience's reach from its own stored spec. */
export async function recomputeAudienceReach(audienceId: string): Promise<AdAudience> {
  const { data, error } = await supabase.rpc('ad_audience_recompute_reach', {
    _audience_id: audienceId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as AdAudience;
}

export async function getCampaignAdSet(campaignId: string): Promise<AdSet | null> {
  const { data, error } = await supabase
    .from('ad_sets')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}

export async function attachAudienceToCampaign(
  campaignId: string,
  audienceId: string,
): Promise<AdSet> {
  const { data, error } = await supabase.rpc('attach_audience_to_ad_set', {
    _campaign_id: campaignId,
    _audience_id: audienceId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as AdSet;
}

export async function detachAudienceFromCampaign(campaignId: string): Promise<AdSet> {
  const { data, error } = await supabase.rpc('detach_audience_from_ad_set', {
    _campaign_id: campaignId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as AdSet;
}

// =====================================================================
// Phase G — ads & creatives
//
// campaign -> ad_set -> ad -> ad_creative (one creative per ad). Create /
// edit-draft are plain client writes gated by the Phase C `ads` /
// `ad_creatives` RLS (advertiser = is_ad_set_admin / is_ad_admin) and never
// touch `ads.review_status`. draft <-> pending is the only advertiser hop,
// via submit_ad_for_review / withdraw_ad_submission (SECURITY DEFINER); the
// Phase C ad_status_guard blocks direct client writes to review_status.
// Creative images upload to the 'ad-creatives' bucket at
// <ad_account_id>/<file>, write-gated to ad-account admins.
// =====================================================================

export type Ad = Database['public']['Tables']['ads']['Row'];
export type AdCreative = Database['public']['Tables']['ad_creatives']['Row'];
export type AdReviewStatus = Database['public']['Enums']['ad_review_status'];
export type AdFormat = Database['public']['Enums']['ad_format'];

export const AD_CREATIVES_BUCKET = 'ad-creatives';
export const AD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const AD_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];

/** Field limits — DB CHECK constraints; the lower number is the recommendation. */
export const CREATIVE_LIMITS = {
  headline: 200,
  headlineRecommended: 70,
  body: 600,
  bodyRecommended: 150,
  cta: 40,
  destinationUrl: 2000,
} as const;

export const AD_FORMATS: {
  value: AdFormat;
  label: string;
  description: string;
  needsImage: boolean;
}[] = [
  {
    value: 'single_image',
    label: 'Single image',
    description: 'One image with a headline, text and a call-to-action.',
    needsImage: true,
  },
  {
    value: 'text',
    label: 'Text',
    description: 'A compact headline-and-text unit with no image.',
    needsImage: false,
  },
  {
    value: 'spotlight',
    label: 'Spotlight',
    description: 'A small right-rail unit with an image, headline and CTA.',
    needsImage: true,
  },
];

export function adFormatMeta(f: AdFormat) {
  return AD_FORMATS.find((x) => x.value === f) ?? AD_FORMATS[0];
}

/** Fixed CTA choices (stored as free text in ad_creatives.cta_label). */
export const AD_CTA_OPTIONS = [
  'Learn more',
  'Sign up',
  'Register',
  'Subscribe',
  'Download',
  'Get quote',
  'Contact us',
  'Apply now',
  'View',
  'Visit',
] as const;

export const AD_REVIEW_STATUS_META: Record<
  AdReviewStatus,
  { label: string; tone: 'neutral' | 'info' | 'success' | 'danger' }
> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'In review', tone: 'info' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

/** Client-side destination URL check. Server also enforces `^https?://` via CHECK. */
export function validateDestinationUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return 'Enter a destination URL.';
  if (v.length > CREATIVE_LIMITS.destinationUrl) return 'That URL is too long.';
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return 'Enter a full URL, including https://';
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'The URL must use http:// or https://';
  if (/[<>#%{}[\]]/.test(v)) return 'Remove special characters ( < > # % { } [ ] ) from the URL.';
  return null;
}

export function validateCreativeImageFile(file: File): string | null {
  if (!AD_IMAGE_MIME.includes(file.type)) return 'Use a JPG, PNG or WebP image.';
  if (file.size > AD_IMAGE_MAX_BYTES) return 'The image must be 5 MB or smaller.';
  return null;
}

export interface AdContext {
  ad: Ad;
  creative: AdCreative | null;
  adSet: AdSet;
  campaign: Campaign;
  adAccount: AdAccount;
}

export async function getOrCreateCampaignAdSet(campaignId: string): Promise<AdSet> {
  const { data, error } = await supabase.rpc('get_or_create_campaign_ad_set', {
    _campaign_id: campaignId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as AdSet;
}

export async function listAdsForCampaign(campaignId: string): Promise<Ad[]> {
  const set = await getCampaignAdSet(campaignId);
  if (!set) return [];
  const { data, error } = await supabase
    .from('ads')
    .select('*')
    .eq('ad_set_id', set.id)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Creatives keyed by ad id — for thumbnails in a campaign's ad list. */
export async function listCreativesForAds(adIds: string[]): Promise<Record<string, AdCreative>> {
  if (adIds.length === 0) return {};
  const { data, error } = await supabase.from('ad_creatives').select('*').in('ad_id', adIds);
  if (error) throw new Error(error.message);
  const byAd: Record<string, AdCreative> = {};
  for (const c of data ?? []) if (!byAd[c.ad_id]) byAd[c.ad_id] = c;
  return byAd;
}

export async function getAdContext(adId: string): Promise<AdContext | null> {
  const { data: ad, error } = await supabase.from('ads').select('*').eq('id', adId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!ad) return null;

  const [creativeRes, adSetRes] = await Promise.all([
    supabase.from('ad_creatives').select('*').eq('ad_id', adId).order('created_at').limit(1),
    supabase.from('ad_sets').select('*').eq('id', ad.ad_set_id).maybeSingle(),
  ]);
  if (adSetRes.error) throw new Error(adSetRes.error.message);
  const adSet = adSetRes.data;
  if (!adSet) return null;

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', adSet.campaign_id)
    .maybeSingle();
  if (!campaign) return null;
  const adAccount = await getAdAccount(campaign.ad_account_id);
  if (!adAccount) return null;

  return { ad, creative: creativeRes.data?.[0] ?? null, adSet, campaign, adAccount };
}

export interface CreativeInput {
  format: AdFormat;
  headline: string;
  body: string | null;
  ctaLabel: string | null;
  destinationUrl: string | null;
  mediaUrl: string | null;
}

function creativeRow(adId: string, input: CreativeInput) {
  return {
    ad_id: adId,
    format: input.format,
    headline: input.headline.trim(),
    body: input.body?.trim() || null,
    cta_label: input.ctaLabel?.trim() || null,
    destination_url: input.destinationUrl?.trim() || null,
    media_url: input.mediaUrl || null,
    media_type: input.mediaUrl ? 'image' : null,
  };
}

export async function createAdWithCreative(
  adSetId: string,
  name: string,
  creative: CreativeInput,
): Promise<Ad> {
  const { data: ad, error } = await supabase
    .from('ads')
    .insert({ ad_set_id: adSetId, name: name.trim() }) // review_status defaults to 'draft'
    .select('*')
    .single();
  if (error) throw new Error(error.message);

  const { error: crErr } = await supabase.from('ad_creatives').insert(creativeRow(ad.id, creative));
  if (crErr) {
    await supabase.from('ads').delete().eq('id', ad.id); // drop the orphan ad
    throw new Error(crErr.message);
  }
  return ad;
}

export async function updateAdName(adId: string, name: string): Promise<Ad> {
  const { data, error } = await supabase
    .from('ads')
    .update({ name: name.trim() })
    .eq('id', adId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function upsertCreative(
  adId: string,
  existing: AdCreative | null,
  input: CreativeInput,
): Promise<AdCreative> {
  const row = creativeRow(adId, input);
  if (existing) {
    const { data, error } = await supabase
      .from('ad_creatives')
      .update(row)
      .eq('id', existing.id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data;
  }
  const { data, error } = await supabase.from('ad_creatives').insert(row).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}

/** Upload a creative image to <ad_account_id>/<uuid>.<ext>; returns its public URL. */
export async function uploadCreativeImage(adAccountId: string, file: File): Promise<string> {
  const invalid = validateCreativeImageFile(file);
  if (invalid) throw new Error(invalid);
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${adAccountId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(AD_CREATIVES_BUCKET)
    .upload(path, file, { cacheControl: '3600', contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(AD_CREATIVES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function submitAdForReview(adId: string): Promise<Ad> {
  const { data, error } = await supabase.rpc('submit_ad_for_review', { _ad_id: adId });
  if (error) throw new Error(error.message);
  return data as unknown as Ad;
}

export async function withdrawAdSubmission(adId: string): Promise<Ad> {
  const { data, error } = await supabase.rpc('withdraw_ad_submission', { _ad_id: adId });
  if (error) throw new Error(error.message);
  return data as unknown as Ad;
}
