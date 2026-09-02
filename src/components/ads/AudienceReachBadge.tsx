import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MIN_AUDIENCE_SIZE } from '@/lib/ads/api';

/**
 * Renders a server-computed reach as a badge. The server never returns a
 * value between 1 and MIN_AUDIENCE_SIZE-1: `null` = not estimated yet,
 * `0` = computed but fewer than the minimum (exact size withheld for
 * privacy), `>= MIN_AUDIENCE_SIZE` = a rounded (floored to 100) estimate.
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
      {ok ? `${reach.toLocaleString()}+ members` : `Under ${MIN_AUDIENCE_SIZE}`}
    </Badge>
  );
}
