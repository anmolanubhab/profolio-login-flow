import { useState } from 'react';
import { CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';

import { useIsMobile } from '@/hooks/use-mobile';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import type {
  ProfileStrengthResult,
  StrengthAction,
  StrengthCategory,
  StrengthRecommendation,
} from '@/lib/profileStrength';

interface ProfileStrengthSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strength: ProfileStrengthResult;
  onAction: (action: StrengthAction) => void;
}

const GROUP_ORDER: { key: StrengthCategory; label: string }[] = [
  { key: 'completeness', label: 'Add information' },
  { key: 'discoverability', label: 'Get discovered' },
  { key: 'quality', label: 'Improve quality' },
];

export const ProfileStrengthSheet = ({
  open,
  onOpenChange,
  strength,
  onAction,
}: ProfileStrengthSheetProps) => {
  const isMobile = useIsMobile();
  const [showCompleted, setShowCompleted] = useState(false);

  const run = (action: StrengthAction) => {
    onOpenChange(false);
    // let the sheet close before the editor / scroll happens
    setTimeout(() => onAction(action), 60);
  };

  const grouped = GROUP_ORDER.map((g) => ({
    ...g,
    recs: strength.recommendations.filter((r) => r.category === g.key),
  })).filter((g) => g.recs.length > 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={
          isMobile
            ? 'max-h-[85vh] overflow-y-auto rounded-t-xl'
            : 'w-full sm:max-w-md overflow-y-auto'
        }
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Profile strength
          </SheetTitle>
        </SheetHeader>

        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{strength.score}%</span>
            <span className="text-sm text-muted-foreground">{strength.level}</span>
          </div>
          <Progress
            value={strength.score}
            className="mt-2 h-2"
            aria-label={`Profile strength ${strength.score} percent, ${strength.level}`}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {strength.pointsEarned} of {strength.pointsAvailable} points
          </p>
        </div>

        {strength.recommendations.length === 0 ? (
          <div className="rounded-lg border border-border bg-secondary/40 p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="text-sm font-medium">Your profile is complete</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Every section is filled in. Keep it fresh as things change.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {grouped.map((g) => (
              <section key={g.key}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.label}
                </h3>
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {g.recs.map((rec) => (
                    <li key={rec.id}>
                      <button
                        type="button"
                        onClick={() => run(rec.action)}
                        className="flex w-full items-start gap-3 p-3 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="mt-0.5 inline-flex h-6 shrink-0 items-center rounded-full bg-primary/10 px-2 text-xs font-semibold text-primary tabular-nums">
                          +{rec.points}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{rec.title}</span>
                          {rec.detail && (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {rec.detail}
                            </span>
                          )}
                        </span>
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        {strength.completed.length > 0 && (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setShowCompleted((v) => !v)}
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
              aria-expanded={showCompleted}
            >
              Completed ({strength.completed.length}) {showCompleted ? '▲' : '▼'}
            </button>
            {showCompleted && (
              <ul className="mt-2 space-y-1.5">
                {strength.completed.map((it) => (
                  <li key={it.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    <span className="line-through">{it.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-6">
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export type { StrengthRecommendation };
export default ProfileStrengthSheet;
