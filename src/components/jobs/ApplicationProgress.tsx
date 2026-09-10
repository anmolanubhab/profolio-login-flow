import { Check, X, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApplicationStage, progressSteps } from '@/lib/applicationStages';

interface ApplicationProgressProps {
  stage: ApplicationStage;
  className?: string;
  /** `false` hides the text under each node (tight layouts). Defaults to true. */
  showLabels?: boolean;
}

// A LinkedIn-style horizontal hiring timeline: filled nodes for completed
// stages, a ringed node for the current one, muted for what's still ahead,
// and a red/grey terminal node when the application stopped (rejected /
// withdrawn / declined). The steps themselves are contextual -- a closed
// application never renders future stages as if they were still coming
// (see progressSteps()).
export function ApplicationProgress({ stage, className, showLabels = true }: ApplicationProgressProps) {
  const steps = progressSteps(stage);

  return (
    <div className={cn('flex w-full items-start', className)}>
      {steps.map((step, i) => {
        const done = step.state === 'done';
        const current = step.state === 'current';
        const stopped = step.state === 'stopped';
        const stoppedWithdrawn = stopped && step.label === 'Withdrawn';

        return (
          <div key={step.label} className="flex min-w-0 flex-1 flex-col items-center first:items-start last:items-end">
            <div className="flex w-full items-center">
              {/* left connector */}
              {i > 0 && (
                <span
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    done || current || stopped ? 'bg-primary/60' : 'bg-border',
                  )}
                />
              )}
              {/* node */}
              <span
                className={cn(
                  'grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition-colors',
                  done && 'border-primary bg-primary text-primary-foreground',
                  current && 'border-primary bg-background',
                  step.state === 'upcoming' && 'border-border bg-background',
                  stopped && !stoppedWithdrawn && 'border-destructive bg-destructive text-destructive-foreground',
                  stoppedWithdrawn && 'border-muted-foreground/50 bg-muted text-muted-foreground',
                )}
              >
                {done && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                {current && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                {stopped && !stoppedWithdrawn && <X className="h-2.5 w-2.5" strokeWidth={3} />}
                {stoppedWithdrawn && <Undo2 className="h-2.5 w-2.5" strokeWidth={2.5} />}
              </span>
              {/* right connector */}
              {i < steps.length - 1 && (
                <span
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    done ? 'bg-primary/60' : 'bg-border',
                  )}
                />
              )}
            </div>
            {showLabels && (
              <span
                className={cn(
                  'mt-1.5 truncate text-[11px] leading-none',
                  done && 'text-foreground',
                  current && 'font-semibold text-primary',
                  step.state === 'upcoming' && 'text-muted-foreground/60',
                  stopped && !stoppedWithdrawn && 'font-medium text-destructive',
                  stoppedWithdrawn && 'text-muted-foreground',
                )}
              >
                {step.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
