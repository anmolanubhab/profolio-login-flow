import type { ReactNode } from "react";
import { Plus, AlertCircle, Pencil, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProfileSectionCardProps {
  id?: string;
  title: string;
  /** optional muted count shown next to the title (e.g. number of entries) */
  count?: number;
  /** icon shown in the empty state tile */
  icon?: LucideIcon;
  /** shown only when isOwner is true */
  onAdd?: () => void;
  addLabel?: string;
  /** optional "manage / reorder" affordance (pencil), owner only */
  onManage?: () => void;
  manageLabel?: string;
  isOwner: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** rendered when not loading / not error and children resolve to nothing */
  empty?: boolean;
  emptyText?: string;
  children?: ReactNode;
  headerExtra?: ReactNode;
  /** optional footer link (LinkedIn-style "Show all N …") */
  showAll?: { label: string; onClick: () => void };
}

export const ProfileSectionCard = ({
  id,
  title,
  count,
  icon: Icon,
  onAdd,
  addLabel = "Add",
  onManage,
  manageLabel = "Manage",
  isOwner,
  loading = false,
  error = null,
  onRetry,
  empty = false,
  emptyText,
  children,
  headerExtra,
  showAll,
}: ProfileSectionCardProps) => {
  return (
    <Card id={id} className="border-0 shadow-card rounded-xl scroll-mt-24">
      <CardContent className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {title}
            {typeof count === "number" && count > 0 && (
              <span className="ml-1.5 text-base font-normal text-muted-foreground">
                {count}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            {headerExtra}
            {isOwner && onManage && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
                onClick={onManage}
                aria-label={manageLabel}
              >
                <Pencil className="h-[18px] w-[18px]" />
              </Button>
            )}
            {isOwner && onAdd && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onAdd}
                className="gap-1.5 rounded-full px-3 text-primary hover:bg-accent hover:text-primary"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">{addLabel}</span>
                <span className="sm:hidden">Add</span>
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4 animate-pulse">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-3">
                <div className="h-11 w-11 rounded-md bg-muted shrink-0" />
                <div className="flex-1 space-y-2 py-0.5">
                  <div className="h-4 w-1/2 bg-muted rounded" />
                  <div className="h-3 w-2/3 bg-muted rounded" />
                  <div className="h-3 w-1/3 bg-muted rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center text-center gap-2 py-6">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-muted-foreground">{error}</p>
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                Try again
              </Button>
            )}
          </div>
        ) : empty ? (
          <div className="flex items-start gap-3 py-2">
            <div className="h-11 w-11 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              {Icon ? (
                <Icon className="h-5 w-5 text-muted-foreground" />
              ) : (
                <Plus className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">
                {emptyText ??
                  (isOwner
                    ? `Add your ${title.toLowerCase()} to complete your profile.`
                    : `No ${title.toLowerCase()} added yet.`)}
              </p>
              {isOwner && onAdd && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAdd}
                  className="mt-3 gap-1.5 rounded-full"
                >
                  <Plus className="h-4 w-4" />
                  {addLabel}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-1">{children}</div>
        )}

        {showAll && !loading && !error && !empty && (
          <button
            type="button"
            onClick={showAll.onClick}
            className={cn(
              "mt-2 -mx-5 sm:-mx-6 flex w-[calc(100%+2.5rem)] sm:w-[calc(100%+3rem)]",
              "items-center justify-center border-t border-border px-5 pt-3 pb-0",
              "text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
            )}
          >
            {showAll.label}
          </button>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfileSectionCard;
