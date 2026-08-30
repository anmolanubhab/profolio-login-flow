import { useState } from 'react';
import { Bell, Check, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { subscribeToInsight, unsubscribeFromInsight } from '@/lib/insights/api';

interface Props {
  insightId: string;
  initialFollowing: boolean;
  /** false when the viewer is the owner or signed out without a profile */
  canFollow?: boolean;
  size?: 'sm' | 'default';
  variant?: 'solid' | 'compact';
  onChange?: (following: boolean, delta: number) => void;
  className?: string;
}

/**
 * "Follow / Get updates" for an Insight — subscribes the viewer so they're
 * notified of new articles. Optimistic with rollback on failure.
 */
export default function InsightFollowButton({
  insightId,
  initialFollowing,
  canFollow = true,
  size = 'default',
  variant = 'solid',
  onChange,
  className,
}: Props) {
  const { toast } = useToast();
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  if (!canFollow) return null;

  const toggle = async () => {
    if (busy) return;
    const next = !following;
    setBusy(true);
    setFollowing(next);
    onChange?.(next, next ? 1 : -1);
    try {
      if (next) await subscribeToInsight(insightId);
      else await unsubscribeFromInsight(insightId);
    } catch (err: any) {
      setFollowing(!next);
      onChange?.(!next, next ? -1 : 1);
      toast({
        title: 'Something went wrong',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  if (following) {
    return (
      <Button
        type="button"
        size={size}
        variant="outline"
        onClick={toggle}
        disabled={busy}
        aria-pressed
        className={cn('gap-1.5 rounded-full', className)}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Following
      </Button>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant === 'compact' ? 'ghost' : 'default'}
      onClick={toggle}
      disabled={busy}
      aria-pressed={false}
      className={cn(
        'gap-1.5 rounded-full',
        variant === 'compact' && 'text-primary hover:text-primary hover:bg-primary/10',
        className,
      )}
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : variant === 'compact' ? (
        <Plus className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {variant === 'compact' ? 'Follow' : 'Get updates'}
    </Button>
  );
}
