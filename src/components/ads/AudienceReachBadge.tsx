import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MIN_AUDIENCE_SIZE } from '@/lib/ads/api';

/**
 * Renders a server-computed reach as a badge. `reach` of `null` means "not
 * estimated yet". Below MIN_AUDIENCE_SIZE it reads as a warning — that
 * audience can't be attached to a campaign.
 */
export function AudienceReachBadge({
  reach,
  className,
}: {
  reach: number | null | undefined;
  className?: string;
}) {
  if (reach == null) {
    return (
      <Badge variant="outline" className={cn('text-[11px] font-medium text-muted-foreground', className)}>
        Not estimated
      </Badge>
    );
  }
  const ok = reach >= MIN_AUDIENCE_SIZE;
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[11px] font-medium',
        ok
          ? 'bg-success/15 text-success border-success/30'
          : 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400',
        className,
      )}
    >
      {reach.toLocaleString()} {reach === 1 ? 'member' : 'members'}
      {!ok && ` · under ${MIN_AUDIENCE_SIZE}`}
    </Badge>
  );
}
