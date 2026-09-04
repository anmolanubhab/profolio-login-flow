import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCtr, type BreakdownLevel, type BreakdownRow } from '@/lib/ads/analytics';
import { formatMoney } from '@/lib/ads/spend';

const LEVEL_HEADER: Record<BreakdownLevel, string> = {
  campaign: 'Campaign',
  ad_set: 'Ad set',
  ad: 'Ad',
};

interface Props {
  level: BreakdownLevel;
  rows: BreakdownRow[];
  currency?: string;
  onRowClick?: (row: BreakdownRow) => void;
}

export function PerformanceBreakdownTable({ level, rows, currency = 'USD', onRowClick }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
        No {LEVEL_HEADER[level].toLowerCase()} activity in this range yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">{LEVEL_HEADER[level]}</TableHead>
            <TableHead className="text-right text-xs">Impr.</TableHead>
            <TableHead className="text-right text-xs">Clicks</TableHead>
            <TableHead className="text-right text-xs">CTR</TableHead>
            <TableHead className="text-right text-xs">Spend</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow
              key={r.id}
              className={onRowClick ? 'cursor-pointer' : undefined}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              <TableCell className="max-w-[160px] truncate py-2 text-sm font-medium text-foreground">
                {r.name}
              </TableCell>
              <TableCell className="py-2 text-right text-sm tabular-nums">
                {r.impressions.toLocaleString()}
              </TableCell>
              <TableCell className="py-2 text-right text-sm tabular-nums">
                {r.clicks.toLocaleString()}
              </TableCell>
              <TableCell className="py-2 text-right text-sm tabular-nums">
                {formatCtr(r.ctr)}
              </TableCell>
              <TableCell className="py-2 text-right text-sm tabular-nums">
                {r.spendMicros > 0 ? formatMoney(r.spendMicros, currency) : '—'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
