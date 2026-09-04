import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchAnalyticsBreakdown,
  fetchAnalyticsDaily,
  fetchAnalyticsSummary,
  fillDailySeries,
  refreshAccountDailyMetrics,
  resolveRange,
  type AnalyticsRange,
  type AnalyticsScope,
  type AnalyticsSummary,
  type BreakdownLevel,
  type BreakdownRow,
  type DailyPoint,
  type RangePreset,
} from '@/lib/ads/analytics';
import { AnalyticsRangePicker } from './AnalyticsRangePicker';
import { AnalyticsStatCards } from './AnalyticsStatCards';
import { DailyMetricsChart } from './DailyMetricsChart';
import { PerformanceBreakdownTable } from './PerformanceBreakdownTable';

interface Props {
  scope: AnalyticsScope;
  scopeId: string;
  /** show a child-entity performance table below the chart */
  breakdownLevel?: BreakdownLevel;
  /** when set, refresh the persisted ad_daily_metrics rollup for this account on load */
  refreshAccountId?: string;
  onBreakdownRowClick?: (row: BreakdownRow) => void;
  /** heading text; omit to render without a heading */
  title?: string;
  className?: string;
}

type Load =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | {
      state: 'ready';
      summary: AnalyticsSummary;
      daily: DailyPoint[];
      breakdown: BreakdownRow[];
    };

export function AdAnalyticsPanel({
  scope,
  scopeId,
  breakdownLevel,
  refreshAccountId,
  onBreakdownRowClick,
  title,
  className,
}: Props) {
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [range, setRange] = useState<AnalyticsRange>(() => resolveRange('30d'));
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const refreshedFor = useRef<string | null>(null);

  const run = useCallback(
    async (r: AnalyticsRange) => {
      setLoad({ state: 'loading' });
      try {
        // keep the persisted rollup warm (best-effort, once per account)
        if (refreshAccountId && refreshedFor.current !== refreshAccountId) {
          refreshedFor.current = refreshAccountId;
          refreshAccountDailyMetrics(refreshAccountId, resolveRange('30d')).catch(() => {
            refreshedFor.current = null;
          });
        }
        const [summary, daily, breakdown] = await Promise.all([
          fetchAnalyticsSummary(scope, scopeId, r),
          fetchAnalyticsDaily(scope, scopeId, r),
          breakdownLevel
            ? fetchAnalyticsBreakdown(scope, scopeId, breakdownLevel, r)
            : Promise.resolve([] as BreakdownRow[]),
        ]);
        setLoad({
          state: 'ready',
          summary,
          daily: fillDailySeries(daily, r),
          breakdown,
        });
      } catch (e) {
        setLoad({
          state: 'error',
          message: e instanceof Error ? e.message : 'Could not load analytics.',
        });
      }
    },
    [scope, scopeId, breakdownLevel, refreshAccountId],
  );

  useEffect(() => {
    run(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, scopeId, breakdownLevel, range.from, range.to]);

  const onRange = (p: RangePreset, r: AnalyticsRange) => {
    setPreset(p);
    setRange(r);
  };

  const hasData =
    load.state === 'ready' && (load.summary.impressions > 0 || load.summary.clicks > 0);

  return (
    <section className={className}>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="text-[15px] font-bold text-foreground">{title ?? 'Analytics'}</h2>
        </div>
        <AnalyticsRangePicker preset={preset} range={range} onChange={onRange} />
      </div>

      {load.state === 'loading' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[68px] rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-[168px] w-full rounded-lg" />
        </div>
      )}

      {load.state === 'error' && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <span className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {load.message}
          </span>
          <Button size="sm" variant="outline" onClick={() => run(range)}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      )}

      {load.state === 'ready' && (
        <div className="space-y-3">
          <AnalyticsStatCards summary={load.summary} />

          {hasData ? (
            <DailyMetricsChart points={load.daily} currency={load.summary.currency ?? 'USD'} />
          ) : (
            <div className="rounded-lg border border-dashed bg-card p-8 text-center shadow-card">
              <BarChart3 className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">No delivery data yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                This {scopeLabel(scope)} hasn&apos;t served any impressions or clicks in the selected
                range. Metrics appear here once it starts delivering.
              </p>
            </div>
          )}

          {breakdownLevel && hasData && (
            <PerformanceBreakdownTable
              level={breakdownLevel}
              rows={load.breakdown}
              currency={load.summary.currency ?? 'USD'}
              onRowClick={onBreakdownRowClick}
            />
          )}
        </div>
      )}
    </section>
  );
}

function scopeLabel(scope: AnalyticsScope): string {
  switch (scope) {
    case 'account':
      return 'ad account';
    case 'campaign':
      return 'campaign';
    case 'ad_set':
      return 'ad set';
    case 'ad':
      return 'ad';
  }
}
