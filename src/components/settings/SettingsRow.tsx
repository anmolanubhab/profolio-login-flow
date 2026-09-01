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
  /**
   * 'active' rows are clickable/navigable; 'placeholder' rows show a "Coming
   * soon" badge (planned); 'unavailable' rows show a "Not available" badge
   * (deliberately not part of Profolio). Neither non-active state interacts.
   */
  status?: 'active' | 'placeholder' | 'unavailable';
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
  const isUnavailable = status === 'unavailable';
  const inert = isPlaceholder || isUnavailable;
  const clickable = !inert && !!onClick;

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
        inert && 'opacity-60'
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
        {isUnavailable ? (
          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
            Not available
          </Badge>
        ) : isPlaceholder ? (
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
