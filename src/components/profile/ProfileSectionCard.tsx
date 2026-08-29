import type { ReactNode } from "react";
import { Plus, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProfileSectionCardProps {
  id?: string;
  title: string;
  /** shown only when isOwner is true */
  onAdd?: () => void;
  addLabel?: string;
  isOwner: boolean;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** rendered when not loading / not error and children resolve to nothing */
  empty?: boolean;
  emptyText?: string;
  children?: ReactNode;
  headerExtra?: ReactNode;
}

export const ProfileSectionCard = ({
  id,
  title,
  onAdd,
  addLabel = "Add",
  isOwner,
  loading = false,
  error = null,
  onRetry,
  empty = false,
  emptyText,
  children,
  headerExtra,
}: ProfileSectionCardProps) => {
  return (
    <Card id={id} className="border-0 shadow-card scroll-mt-24">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <div className="flex items-center gap-2">
            {headerExtra}
            {isOwner && onAdd && (
              <Button
                size="sm"
                variant="outline"
                onClick={onAdd}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>{addLabel}</span>
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-2/3 bg-muted rounded" />
            <div className="h-3 w-1/2 bg-muted rounded" />
            <div className="h-3 w-1/3 bg-muted rounded" />
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
          <p className="text-sm text-muted-foreground py-4">
            {emptyText ??
              (isOwner
                ? `Add your ${title.toLowerCase()} to complete your profile.`
                : `No ${title.toLowerCase()} added yet.`)}
          </p>
        ) : (
          <div className="space-y-1">{children}</div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProfileSectionCard;
