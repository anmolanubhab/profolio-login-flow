import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

/**
 * Phase K2 — Budget + Spend Engine (client layer).
 *
 * Spend here is an INTERNAL advertising ledger — no real money moves,
 * no payment provider, no charges. Pricing is a flat, deterministic
 * Profolio implementation choice (not LinkedIn's auction pricing):
 *   max_cpc + bid  -> charge per click
 *   max_cpm + bid  -> charge per 1000 impressions
 *   auto           -> flat default CPM from the server rate card
 *
 * Money is stored server-side in currency MICROS (1 cent = 10,000 micros).
 */

export type BidStrategy = Database['public']['Enums']['ad_bid_strategy'];

export type PacingState =
  | 'no_budget'
  | 'scheduled'
  | 'active_no_spend'
  | 'spending'
  | 'daily_exhausted'
  | 'budget_exhausted'
  | 'paused'
  | 'ended'
  | 'inactive';

export interface CampaignBudgetStatus {
  currency: string;
  dailyBudgetMicros: number | null;
  totalBudgetMicros: number | null;
  spendTodayMicros: number;
  spendTotalMicros: number;
  dailyRemainingMicros: number | null;
  totalRemainingMicros: number | null;
  pacingState: PacingState;
}

export interface BudgetValidation {
  ok: boolean;
  issues: string[];
}

export const BID_STRATEGY_META: Record<
  BidStrategy,
  { label: string; charge: string; needsAmount: boolean; hint: string }
> = {
  auto: {
    label: 'Automatic (maximum delivery)',
    charge: 'Charged per 1,000 impressions at a flat rate',
    needsAmount: false,
    hint: 'Profolio spends the budget at a fixed CPM. No auction or competitive bidding yet.',
  },
  max_cpm: {
    label: 'Manual — cost per 1,000 impressions',
    charge: 'Charged per 1,000 impressions',
    needsAmount: true,
    hint: 'You set the amount charged for every 1,000 times the ad is shown.',
  },
  max_cpc: {
    label: 'Manual — cost per click',
    charge: 'Charged per click',
    needsAmount: true,
    hint: 'You set the amount charged each time someone clicks the ad. Impressions are free.',
  },
};

export const PACING_STATE_META: Record<
  PacingState,
  { label: string; tone: 'muted' | 'warning' | 'success' | 'destructive' }
> = {
  no_budget: { label: 'Budget required', tone: 'warning' },
  scheduled: { label: 'Scheduled', tone: 'muted' },
  active_no_spend: { label: 'Active — no spend yet', tone: 'muted' },
  spending: { label: 'Spending', tone: 'success' },
  daily_exhausted: { label: "Today's budget spent", tone: 'warning' },
  budget_exhausted: { label: 'Budget exhausted', tone: 'destructive' },
  paused: { label: 'Paused', tone: 'muted' },
  ended: { label: 'Ended', tone: 'muted' },
  inactive: { label: 'Not delivering', tone: 'muted' },
};

const MICROS_PER_CENT = 10_000;

/**
 * Minor units per major unit for a currency. Most currencies are 2-decimal
 * (100 minor per major); zero-decimal currencies (JPY, KRW, …) are 1.
 * Mirrors the server-side `_ad_currency_minor_units`.
 */
const ZERO_DECIMAL_CURRENCIES = new Set([
  'JPY', 'KRW', 'VND', 'CLP', 'XOF', 'XAF', 'BIF', 'DJF', 'GNF',
  'ISK', 'KMF', 'PYG', 'RWF', 'UGX', 'VUV', 'XPF',
]);
export function minorUnitsPerMajor(currency: string | null | undefined): number {
  return ZERO_DECIMAL_CURRENCIES.has((currency ?? '').toUpperCase()) ? 1 : 100;
}
function microsPerMajor(currency: string | null | undefined): number {
  return MICROS_PER_CENT * minorUnitsPerMajor(currency);
}

/**
 * micros -> major currency units. Currency-aware: for a 2-decimal currency
 * 1_500_000 micros -> 1.5; for a zero-decimal currency (JPY) 1_500_000 -> 150.
 * `currency` is optional for backwards compatibility (defaults to 2-decimal).
 */
export function microsToMajor(micros: number | null | undefined, currency?: string | null): number {
  return (micros ?? 0) / microsPerMajor(currency);
}

/** integer minor units (cents / yen) -> micros */
export function centsToMicros(cents: number | null | undefined): number {
  return (cents ?? 0) * MICROS_PER_CENT;
}

export function formatMoney(micros: number | null | undefined, currency: string): string {
  const major = microsToMajor(micros, currency);
  const zeroDecimal = minorUnitsPerMajor(currency) === 1;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: zeroDecimal ? 0 : major < 1 && major > 0 ? 4 : 2,
    }).format(major);
  } catch {
    return `${currency} ${major.toFixed(zeroDecimal ? 0 : 2)}`;
  }
}

export async function getCampaignBudgetStatus(campaignId: string): Promise<CampaignBudgetStatus> {
  const { data, error } = await supabase.rpc('ad_campaign_budget_status', { _campaign_id: campaignId });
  if (error) throw new Error(error.message);
  const j = (data ?? {}) as Record<string, unknown>;
  return {
    currency: (j.currency as string) ?? 'USD',
    dailyBudgetMicros: j.daily_budget_micros == null ? null : Number(j.daily_budget_micros),
    totalBudgetMicros: j.total_budget_micros == null ? null : Number(j.total_budget_micros),
    spendTodayMicros: Number(j.spend_today_micros ?? 0),
    spendTotalMicros: Number(j.spend_total_micros ?? 0),
    dailyRemainingMicros: j.daily_remaining_micros == null ? null : Number(j.daily_remaining_micros),
    totalRemainingMicros: j.total_remaining_micros == null ? null : Number(j.total_remaining_micros),
    pacingState: (j.pacing_state as PacingState) ?? 'no_budget',
  };
}

export async function validateCampaignBudget(campaignId: string): Promise<BudgetValidation> {
  const { data, error } = await supabase.rpc('validate_campaign_budget', { _campaign_id: campaignId });
  if (error) throw new Error(error.message);
  const j = (data ?? {}) as Record<string, unknown>;
  return { ok: !!j.ok, issues: Array.isArray(j.issues) ? (j.issues as string[]) : [] };
}

/** Plain RLS update — the advertiser owns their campaign row. Guarded columns (status) are untouched. */
export async function updateCampaignBudget(
  campaignId: string,
  patch: { daily_budget_cents: number | null; total_budget_cents: number },
): Promise<void> {
  const { error } = await supabase.from('campaigns').update(patch).eq('id', campaignId);
  if (error) throw new Error(error.message);
}

export async function updateAdSetBidding(
  adSetId: string,
  patch: { bid_strategy: BidStrategy; bid_amount_cents: number | null },
): Promise<void> {
  const { error } = await supabase.from('ad_sets').update(patch).eq('id', adSetId);
  if (error) throw new Error(error.message);
}
