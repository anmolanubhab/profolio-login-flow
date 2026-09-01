import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CAMPAIGN_STATUS_META, type CampaignStatus } from '@/lib/ads/api';

const TONE: Record<string, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  info: 'bg-primary/10 text-primary border-primary/30',
  success: 'bg-success/15 text-success border-success/30',
  warn: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400',
  danger: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function CampaignStatusBadge({
  status,
  className,
}: {
  status: CampaignStatus;
  className?: string;
}) {
  const meta = CAMPAIGN_STATUS_META[status];
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', TONE[meta.tone], className)}>
      {meta.label}
    </Badge>
  );
}
