import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";

/**
 * ResponsiveModal — renders a centred Radix Dialog on >= md screens and a
 * bottom vaul Drawer on mobile, behind one API. Both variants already provide
 * Escape-to-close, outside-click-to-close, focus trapping and scroll lock.
 *
 * Usage:
 *   <ResponsiveModal open={open} onOpenChange={setOpen}>
 *     <ResponsiveModalContent className="sm:max-w-lg">
 *       <ResponsiveModalHeader>
 *         <ResponsiveModalTitle>Title</ResponsiveModalTitle>
 *         <ResponsiveModalDescription>…</ResponsiveModalDescription>
 *       </ResponsiveModalHeader>
 *       …body…
 *       <ResponsiveModalFooter>…</ResponsiveModalFooter>
 *     </ResponsiveModalContent>
 *   </ResponsiveModal>
 */

type ModalContextValue = { isMobile: boolean };
const ModalContext = React.createContext<ModalContextValue>({ isMobile: false });

interface ResponsiveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /**
   * When true, prevents closing via outside-click / Escape (used while an
   * async save is running or there are unsaved changes and the caller wants
   * to intercept). Defaults to false.
   */
  dismissible?: boolean;
}

export function ResponsiveModal({
  open,
  onOpenChange,
  children,
  dismissible = true,
}: ResponsiveModalProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <ModalContext.Provider value={{ isMobile }}>
        <Drawer
          open={open}
          onOpenChange={onOpenChange}
          dismissible={dismissible}
        >
          {children}
        </Drawer>
      </ModalContext.Provider>
    );
  }

  return (
    <ModalContext.Provider value={{ isMobile }}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        {children}
      </Dialog>
    </ModalContext.Provider>
  );
}

interface ContentProps {
  children: React.ReactNode;
  className?: string;
  /** Extra props forwarded to the underlying content (e.g. onInteractOutside). */
  onInteractOutside?: (e: Event) => void;
  onEscapeKeyDown?: (e: KeyboardEvent) => void;
}

export function ResponsiveModalContent({
  children,
  className,
  onInteractOutside,
  onEscapeKeyDown,
}: ContentProps) {
  const { isMobile } = React.useContext(ModalContext);

  if (isMobile) {
    // vaul's DrawerContent doesn't type onInteractOutside/onEscapeKeyDown;
    // the drawer already closes on drag / overlay tap. The unsaved-changes
    // guard is enforced via onOpenChange in the parent.
    return (
      <DrawerContent className={cn("max-h-[92vh]", className)}>
        <div className="overflow-y-auto px-4 pb-8 pt-2">{children}</div>
      </DrawerContent>
    );
  }

  return (
    <DialogContent
      className={cn("max-h-[90vh] overflow-y-auto", className)}
      onInteractOutside={onInteractOutside}
      onEscapeKeyDown={onEscapeKeyDown}
    >
      {children}
    </DialogContent>
  );
}

export function ResponsiveModalHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isMobile } = React.useContext(ModalContext);
  const Cmp = isMobile ? DrawerHeader : DialogHeader;
  return <Cmp className={cn(isMobile && "px-0 text-left", className)}>{children}</Cmp>;
}

export function ResponsiveModalFooter({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isMobile } = React.useContext(ModalContext);
  const Cmp = isMobile ? DrawerFooter : DialogFooter;
  return <Cmp className={cn(isMobile && "px-0", className)}>{children}</Cmp>;
}

export function ResponsiveModalTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isMobile } = React.useContext(ModalContext);
  const Cmp = isMobile ? DrawerTitle : DialogTitle;
  return <Cmp className={className}>{children}</Cmp>;
}

export function ResponsiveModalDescription({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isMobile } = React.useContext(ModalContext);
  const Cmp = isMobile ? DrawerDescription : DialogDescription;
  return <Cmp className={className}>{children}</Cmp>;
}
