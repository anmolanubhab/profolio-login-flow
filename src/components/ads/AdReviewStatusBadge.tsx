import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AD_REVIEW_STATUS_META, type AdReviewStatus } from '@/lib/ads/api';

const TONE: Record<string, string> = {
  neutral: 'bg-muted text-muted-foreground border-border',
  info: 'bg-primary/10 text-primary border-primary/30',
  success: 'bg-success/15 text-success border-success/30',
  danger: 'bg-destructive/10 text-destructive border-destructive/30',
};

export function AdReviewStatusBadge({
  status,
  className,
}: {
  status: AdReviewStatus;
  className?: string;
}) {
  const meta = AD_REVIEW_STATUS_META[status];
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', TONE[meta.tone], className)}>
      {meta.label}
    </Badge>
  );
}
