import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AD_ACCOUNT_STATUS_LABEL, type AdAccountStatus } from '@/lib/ads/api';

const STYLES: Record<AdAccountStatus, string> = {
  active: 'bg-success/15 text-success border-success/30',
  suspended: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400',
  closed: 'bg-muted text-muted-foreground border-border',
};

export function AdAccountStatusBadge({
  status,
  className,
}: {
  status: AdAccountStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', STYLES[status], className)}>
      {AD_ACCOUNT_STATUS_LABEL[status]}
    </Badge>
  );
}
