import { Eye, MousePointerClick, Percent, Users, Info, Wallet } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatCtr, type AnalyticsSummary } from '@/lib/ads/analytics';
import { formatMoney } from '@/lib/ads/spend';

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-card sm:p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
        {hint && (
          <Tooltip>
            <TooltipTrigger aria-label={`About ${label}`}>
              <Info className="h-3 w-3" />
            </TooltipTrigger>
            <TooltipContent className="max-w-[240px] text-xs">{hint}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground sm:text-2xl">{value}</p>
    </div>
  );
}

export function AnalyticsStatCards({ summary }: { summary: AnalyticsSummary }) {
  const uv = summary.uniqueViewersWithheld
    ? '—'
    : summary.uniqueViewers == null
      ? '0'
      : `${summary.uniqueViewers.toLocaleString()}+`;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5 sm:gap-3">
      <StatCard
        icon={<Eye className="h-3.5 w-3.5" />}
        label="Impressions"
        value={summary.impressions.toLocaleString()}
      />
      <StatCard
        icon={<MousePointerClick className="h-3.5 w-3.5" />}
        label="Clicks"
        value={summary.clicks.toLocaleString()}
      />
      <StatCard
        icon={<Percent className="h-3.5 w-3.5" />}
        label="CTR"
        value={formatCtr(summary.ctr)}
        hint="Click-through rate — clicks divided by impressions."
      />
      <StatCard
        icon={<Users className="h-3.5 w-3.5" />}
        label="Unique viewers"
        value={uv}
        hint={
          summary.uniqueViewersWithheld
            ? 'Hidden to protect privacy: fewer than 300 distinct people saw this in the selected range.'
            : 'Distinct people who saw this, reported only in privacy-safe bands of 100+.'
        }
      />
      <StatCard
        icon={<Wallet className="h-3.5 w-3.5" />}
        label="Spend"
        value={formatMoney(summary.spendMicros, summary.currency ?? 'USD')}
        hint="Internal advertising spend for this range. No payment is taken — real billing arrives in a later phase."
      />
    </div>
  );
}
