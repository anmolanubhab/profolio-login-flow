import { useState } from 'react';
import { CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';

import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ProfileStrengthSheet } from '@/components/profile/ProfileStrengthSheet';
import { useProfileStrength } from '@/hooks/useProfileStrength';
import type { StrengthAction } from '@/lib/profileStrength';

interface ProfileStrengthProps {
  profileId: string;
  authUserId: string;
  /** dispatch a recommendation action to the real editor / route */
  onAction: (action: StrengthAction) => void;
}

/**
 * Owner-only Profile Strength widget. Score, level, progress, the top few
 * actionable recommendations, and "View all improvements" -> detail sheet.
 * All numbers come from useProfileStrength -> calculateProfileStrength on real
 * profile data. Responsive: tighter on mobile, no separate component.
 */
export const ProfileStrength = ({ profileId, authUserId, onAction }: ProfileStrengthProps) => {
  const { data: strength, isLoading, isError, refetch } = useProfileStrength({
    profileId,
    authUserId,
  });
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card/60 p-3 sm:p-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-2 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (isError || !strength) {
    return (
      <div className="rounded-lg border bg-card/60 p-3 sm:p-4">
        <p className="text-sm text-muted-foreground">Couldn't load your profile strength.</p>
        <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-xs" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const top = strength.recommendations.slice(0, 3);
  const complete = strength.score >= 100;

  return (
    <div className="rounded-lg border bg-card/60 p-3 sm:p-4">
      {/* header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 shrink-0 text-primary" />
          Profile strength
          <span className="font-normal text-muted-foreground">· {strength.level}</span>
        </div>
        <span className="text-lg font-bold tabular-nums sm:text-xl">{strength.score}%</span>
      </div>

      <Progress
        value={strength.score}
        className="mt-2 h-2"
        aria-label={`Profile strength ${strength.score} percent, ${strength.level}`}
      />

      {complete ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          Your profile is complete — nice work.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            {strength.recommendations.length} improvement
            {strength.recommendations.length === 1 ? '' : 's'} to strengthen your profile
          </p>

          <ul className="mt-2 space-y-1">
            {top.map((rec) => (
              <li key={rec.id}>
                <button
                  type="button"
                  onClick={() => onAction(rec.action)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1 truncate">{rec.title}</span>
                  <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-xs font-semibold text-primary tabular-nums">
                    +{rec.points}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>

          <Button
            variant="ghost"
            size="sm"
            className="mt-1 h-7 w-full justify-start px-2 text-xs text-primary hover:text-primary"
            onClick={() => setSheetOpen(true)}
          >
            View all improvements ({strength.recommendations.length})
          </Button>
        </>
      )}

      <ProfileStrengthSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        strength={strength}
        onAction={onAction}
      />
    </div>
  );
};

export default ProfileStrength;
