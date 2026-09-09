import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Flat illustration asset (imported image src). Takes precedence over `icon`. */
  illustration?: string;
  /**
   * Alt text for the illustration. Defaults to `""` (decorative) because the
   * title + description already communicate the meaning. Pass a string only
   * when the art carries information the text does not.
   */
  illustrationAlt?: string;
  /** Fallback visual when no `illustration` is given. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Primary call to action (usually a <Button>). */
  action?: React.ReactNode;
  /** Optional secondary call to action, rendered under the primary one. */
  secondaryAction?: React.ReactNode;
  /**
   * `full` — page-level empty state: large illustration, generous spacing.
   * `compact` — inline/section empty state: smaller, tighter (default when
   * only an `icon` is provided, matching the previous behaviour).
   */
  size?: 'full' | 'compact';
  className?: string;
}

export const EmptyState = ({
  illustration,
  illustrationAlt = '',
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  size,
  className,
}: EmptyStateProps) => {
  const resolvedSize = size ?? (illustration ? 'full' : 'compact');
  const isFull = resolvedSize === 'full';

  return (
    <div
      className={cn(
        'mx-auto flex w-full flex-col items-center justify-center text-center',
        isFull
          ? 'max-w-md gap-4 px-6 py-12 sm:py-16'
          : 'max-w-sm gap-3 px-4 py-12',
        className,
      )}
    >
      {illustration ? (
        <img
          src={illustration}
          alt={illustrationAlt}
          aria-hidden={illustrationAlt ? undefined : true}
          draggable={false}
          className={cn(
            'h-auto select-none',
            isFull
              ? 'w-[240px] max-w-[80vw] sm:w-[300px] md:w-[380px] lg:w-[440px]'
              : 'w-[180px] max-w-[70vw]',
          )}
        />
      ) : (
        Icon && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/50">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>
        )
      )}

      <div className="flex flex-col gap-1">
        <h3
          className={cn(
            'font-semibold text-foreground',
            isFull ? 'text-xl sm:text-2xl' : 'text-lg',
          )}
        >
          {title}
        </h3>
        {description && (
          <p
            className={cn(
              'text-muted-foreground',
              isFull ? 'text-sm sm:text-base' : 'text-sm',
            )}
          >
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction) && (
        <div className="mt-1 flex flex-col items-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
};
