import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DailyPoint } from '@/lib/ads/analytics';
import { formatMoney } from '@/lib/ads/spend';

function shortDay(d: string) {
  const dt = new Date(d + 'T00:00:00Z');
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Dependency-light daily breakdown: an impressions bar column per day with
 * a clicks marker, plus a toggle to an accessible data table. No external
 * chart lib, so it never mis-sizes on mobile.
 */
export function DailyMetricsChart({
  points,
  currency = 'USD',
}: {
  points: DailyPoint[];
  currency?: string;
}) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const scrollRef = useRef<HTMLDivElement>(null);
  const max = useMemo(
    () => Math.max(1, ...points.map((p) => p.impressions)),
    [points],
  );
  const totals = useMemo(
    () =>
      points.reduce(
        (a, p) => ({
          impressions: a.impressions + p.impressions,
          clicks: a.clicks + p.clicks,
          spendMicros: a.spendMicros + p.spendMicros,
        }),
        { impressions: 0, clicks: 0, spendMicros: 0 },
      ),
    [points],
  );

  // keep the most-recent days in view — that is usually where the data is
  useEffect(() => {
    if (view === 'chart' && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [view, points]);

  return (
    <div className="rounded-lg border bg-card p-3 shadow-card sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary/70" />
            Impressions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-foreground" />
            Clicks
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => setView((v) => (v === 'chart' ? 'table' : 'chart'))}
        >
          {view === 'chart' ? 'View as table' : 'View as chart'}
        </Button>
      </div>

      {view === 'chart' ? (
        <div
          ref={scrollRef}
          className="flex items-end gap-1 overflow-x-auto pb-1"
          style={{ minHeight: 132 }}
        >
          {points.map((p) => {
            const h = Math.round((p.impressions / max) * 110);
            return (
              <div
                key={p.day}
                className="flex min-w-[14px] flex-1 flex-col items-center gap-1"
                title={`${shortDay(p.day)} · ${p.impressions} impressions · ${p.clicks} clicks`}
              >
                <div className="relative flex h-[110px] w-full items-end justify-center border-b border-border">
                  <div
                    className="w-full max-w-[26px] rounded-t bg-primary/70"
                    style={{ height: `${Math.max(p.impressions > 0 ? 3 : 0, h)}px` }}
                  />
                  {p.clicks > 0 && (
                    <span className="absolute -top-0.5 h-1.5 w-1.5 -translate-y-full rounded-full bg-foreground" />
                  )}
                </div>
                <span className="w-full truncate text-center text-[10px] leading-tight text-muted-foreground">
                  {shortDay(p.day)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Day</TableHead>
                <TableHead className="text-right text-xs">Impressions</TableHead>
                <TableHead className="text-right text-xs">Clicks</TableHead>
                <TableHead className="text-right text-xs">Spend</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((p) => (
                <TableRow key={p.day}>
                  <TableCell className="py-1.5 text-xs">{shortDay(p.day)}</TableCell>
                  <TableCell className="py-1.5 text-right text-xs tabular-nums">
                    {p.impressions.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-1.5 text-right text-xs tabular-nums">
                    {p.clicks.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-1.5 text-right text-xs tabular-nums">
                    {p.spendMicros > 0 ? formatMoney(p.spendMicros, currency) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="py-1.5 text-xs font-semibold">Total</TableCell>
                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                  {totals.impressions.toLocaleString()}
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                  {totals.clicks.toLocaleString()}
                </TableCell>
                <TableCell className="py-1.5 text-right text-xs font-semibold tabular-nums">
                  {formatMoney(totals.spendMicros, currency)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
