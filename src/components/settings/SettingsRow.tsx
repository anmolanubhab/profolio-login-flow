import { ReactNode } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SettingsRowProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Current value shown on the right, e.g. "English", "On". */
  value?: string;
  /** 'active' rows are clickable/navigable; 'placeholder' rows show a "Coming soon" badge and no interaction. */
  status?: 'active' | 'placeholder';
  onClick?: () => void;
  /** Custom right-side content (e.g. a Switch) instead of value/chevron. */
  rightElement?: ReactNode;
}

export function SettingsRow({
  icon: Icon,
  title,
  description,
  value,
  status = 'active',
  onClick,
  rightElement,
}: SettingsRowProps) {
  const isPlaceholder = status === 'placeholder';
  const clickable = !isPlaceholder && !!onClick;

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        'flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5',
        clickable && 'cursor-pointer hover:bg-muted/60 focus-visible:outline-none focus-visible:bg-muted/60 transition-colors',
        isPlaceholder && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isPlaceholder ? (
          <Badge variant="secondary" className="text-[10px] font-normal">
            Coming soon
          </Badge>
        ) : rightElement ? (
          rightElement
        ) : (
          <>
            {value && <span className="text-sm text-muted-foreground">{value}</span>}
            {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </>
        )}
      </div>
    </div>
  );
}
