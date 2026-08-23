import { Check, X, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ApplicationStage, progressSteps } from '@/lib/applicationStages';

interface ApplicationProgressProps {
  stage: ApplicationStage;
  className?: string;
}

// Contextual progress -- never the same generic 4-step chain for every
// application. A rejected/withdrawn app stops where it actually stopped;
// nothing renders as if a future stage already happened.
export function ApplicationProgress({ stage, className }: ApplicationProgressProps) {
  const steps = progressSteps(stage);

  return (
    <div className={cn('flex items-center flex-wrap gap-x-1 gap-y-1.5', className)}>
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center">
          {i > 0 && <span className="mx-1 text-muted-foreground/40 text-xs">→</span>}
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap',
              step.state === 'done' && 'text-success',
              step.state === 'current' && 'text-primary',
              step.state === 'upcoming' && 'text-muted-foreground/50',
              step.state === 'stopped' && 'text-destructive'
            )}
          >
            {step.state === 'done' && <Check className="h-3 w-3" />}
            {step.state === 'current' && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            {step.state === 'upcoming' && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />}
            {step.state === 'stopped' && (step.label === 'Withdrawn' ? <Undo2 className="h-3 w-3" /> : <X className="h-3 w-3" />)}
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}
