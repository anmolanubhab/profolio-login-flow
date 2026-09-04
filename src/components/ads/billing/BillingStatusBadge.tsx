import { Badge } from '@/components/ui/badge';
import { BILLING_STATUS_META, type BillingProfileStatus } from '@/lib/ads/billing';

const TONE_CLASS: Record<string, string> = {
  muted: 'text-muted-foreground',
  warning: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400',
  success: 'bg-success/15 text-success border-success/30',
  destructive: 'bg-destructive/15 text-destructive border-destructive/30',
};

export function BillingStatusBadge({ status }: { status: BillingProfileStatus | null | undefined }) {
  const meta = status ? BILLING_STATUS_META[status] : BILLING_STATUS_META.setup_required;
  return (
    <Badge variant="outline" className={TONE_CLASS[meta.tone]}>
      {meta.label}
    </Badge>
  );
}
