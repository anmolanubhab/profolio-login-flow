import { type ReactNode, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CareerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  isDirty: boolean;
  saving: boolean;
  /** the react-hook-form submit handler */
  onSubmit: () => void;
  submitLabel?: string;
  /** disable submit for reasons beyond `saving` (e.g. pristine form) */
  submitDisabled?: boolean;
  children: ReactNode;
}

/**
 * Shared shell for the Add/Edit career dialogs (Experience, Education,
 * Project, Language). Handles the responsive Dialog/Drawer, the unsaved-
 * changes guard, focus/ESC/outside-click, and a consistent footer.
 */
export const CareerFormDialog = ({
  open,
  onOpenChange,
  title,
  description,
  isDirty,
  saving,
  onSubmit,
  submitLabel = "Save",
  submitDisabled = false,
  children,
}: CareerFormDialogProps) => {
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  const requestClose = () => {
    if (isDirty && !saving) setConfirmDiscardOpen(true);
    else onOpenChange(false);
  };

  return (
    <>
      <ResponsiveModal
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
          else onOpenChange(true);
        }}
      >
        <ResponsiveModalContent
          className="sm:max-w-lg"
          onInteractOutside={(e) => {
            e.preventDefault();
            requestClose();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            requestClose();
          }}
        >
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
            {description && (
              <ResponsiveModalDescription>{description}</ResponsiveModalDescription>
            )}
          </ResponsiveModalHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
            className="space-y-4"
          >
            {children}

            <ResponsiveModalFooter className="gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={requestClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || submitDisabled}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving…
                  </>
                ) : (
                  submitLabel
                )}
              </Button>
            </ResponsiveModalFooter>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>

      <AlertDialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits. If you leave now they’ll be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscardOpen(false);
                onOpenChange(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default CareerFormDialog;
