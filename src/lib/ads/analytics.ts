import { supabase } from '@/integrations/supabase/client';

/**
 * Phase J — Advertising Analytics (read side).
 *
 * Every call goes through a SECURITY DEFINER RPC that self-authorizes on
 * the scope and returns aggregate counts only — never a viewer id, a
 * session key, or any audience-membership detail. Unique viewers are
 * passed through the Phase F k-anonymity floor server-side: fewer than
 * 300 distinct viewers come back as `null` (withheld).
 */

export type AnalyticsScope = 'account' | 'campaign' | 'ad_set' | 'ad';
export type BreakdownLevel = 'campaign' | 'ad_set' | 'ad';
export type RangePreset = 'today' | '7d' | '30d' | 'custom';

export interface AnalyticsRange {
  /** inclusive, `YYYY-MM-DD` */
  from: string;
  /** inclusive, `YYYY-MM-DD` */
  to: string;
}

export interface AnalyticsSummary {
  impressions: number;
  clicks: number;
  /** click-through rate as a percentage, already rounded to 2dp */
  ctr: number;
  /** `null` when withheld by the privacy floor (or when there is no data) */
  uniqueViewers: number | null;
  /** true when there was traffic but too few unique viewers to report a number */
  uniqueViewersWithheld: boolean;
  /** internal ad-spend for the range, in currency micros (Phase K2) */
  spendMicros: number;
  currency: string | null;
  firstEvent: string | null;
  lastEvent: string | null;
}

export interface DailyPoint {
  day: string;
  impressions: number;
  clicks: number;
  spendMicros: number;
}

export interface BreakdownRow {
  id: string;
  name: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spendMicros: number;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Resolve a preset (or a custom pair) into a concrete inclusive date range. */
export function resolveRange(preset: RangePreset, custom?: Partial<AnalyticsRange>): AnalyticsRange {
  const today = new Date();
  const to = iso(today);
  if (preset === 'today') return { from: to, to };
  if (preset === '7d') {
    const f = new Date(today);
    f.setDate(f.getDate() - 6);
    return { from: iso(f), to };
  }
  if (preset === '30d') {
    const f = new Date(today);
    f.setDate(f.getDate() - 29);
    return { from: iso(f), to };
  }
  // custom
  return {
    from: custom?.from || to,
    to: custom?.to || to,
  };
}

export const RANGE_PRESET_LABEL: Record<RangePreset, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  custom: 'Custom range',
};

export async function fetchAnalyticsSummary(
  scope: AnalyticsScope,
  scopeId: string,
  range: AnalyticsRange,
): Promise<AnalyticsSummary> {
  const { data, error } = await supabase.rpc('ad_analytics_summary', {
    _scope: scope,
    _scope_id: scopeId,
    _from: range.from,
    _to: range.to,
  });
  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  if (!row) {
    return {
      impressions: 0,
      clicks: 0,
      ctr: 0,
      uniqueViewers: null,
      uniqueViewersWithheld: false,
      spendMicros: 0,
      currency: null,
      firstEvent: null,
      lastEvent: null,
    };
  }
  return {
    impressions: Number(row.impressions ?? 0),
    clicks: Number(row.clicks ?? 0),
    ctr: Number(row.ctr ?? 0),
    uniqueViewers: row.unique_viewers == null ? null : Number(row.unique_viewers),
    uniqueViewersWithheld: !!row.unique_viewers_withheld,
    spendMicros: Number((row as { spend_micros?: number }).spend_micros ?? 0),
    currency: ((row as { currency?: string }).currency ?? null) as string | null,
    firstEvent: row.first_event ?? null,
    lastEvent: row.last_event ?? null,
  };
}

export async function fetchAnalyticsDaily(
  scope: AnalyticsScope,
  scopeId: string,
  range: AnalyticsRange,
): Promise<DailyPoint[]> {
  const { data, error } = await supabase.rpc('ad_analytics_daily', {
    _scope: scope,
    _scope_id: scopeId,
    _from: range.from,
    _to: range.to,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    day: r.day as string,
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    spendMicros: Number((r as { spend_micros?: number }).spend_micros ?? 0),
  }));
}

export async function fetchAnalyticsBreakdown(
  scope: AnalyticsScope,
  scopeId: string,
  level: BreakdownLevel,
  range: AnalyticsRange,
): Promise<BreakdownRow[]> {
  const { data, error } = await supabase.rpc('ad_analytics_breakdown', {
    _scope: scope,
    _scope_id: scopeId,
    _level: level,
    _from: range.from,
    _to: range.to,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.entity_id as string,
    name: (r.entity_name as string) ?? 'Untitled',
    impressions: Number(r.impressions ?? 0),
    clicks: Number(r.clicks ?? 0),
    ctr: Number(r.ctr ?? 0),
    spendMicros: Number((r as { spend_micros?: number }).spend_micros ?? 0),
  }));
}

/**
 * Refresh the `ad_daily_metrics` rollup for one ad account from the raw
 * event feed. Idempotent. The dashboard calls this once on load so the
 * persisted rollup stays current; the read RPCs above always compute
 * live from events, so analytics are correct even if this is skipped.
 * Returns the number of (ad, day) rows written.
 */
export async function refreshAccountDailyMetrics(
  adAccountId: string,
  range: AnalyticsRange,
): Promise<number> {
  const { data, error } = await supabase.rpc('ad_rebuild_daily_metrics', {
    _ad_account_id: adAccountId,
    _from: range.from,
    _to: range.to,
  });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/** Fill gaps so a chart shows every day in the range, not just days with events. */
export function fillDailySeries(points: DailyPoint[], range: AnalyticsRange): DailyPoint[] {
  const byDay = new Map(points.map((p) => [p.day, p]));
  const out: DailyPoint[] = [];
  const cursor = new Date(range.from + 'T00:00:00Z');
  const end = new Date(range.to + 'T00:00:00Z');
  // guard against an inverted or absurd range
  let guard = 0;
  while (cursor <= end && guard < 400) {
    const key = cursor.toISOString().slice(0, 10);
    out.push(byDay.get(key) ?? { day: key, impressions: 0, clicks: 0, spendMicros: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return out;
}

export function formatCtr(ctr: number): string {
  return `${ctr.toFixed(2)}%`;
}
