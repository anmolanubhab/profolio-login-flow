import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  SW_WAITING_EVENT,
  activateWaitingWorker,
  type SWWaitingDetail,
} from "@/lib/pwa";

/**
 * Non-blocking "a new version is available" prompt.
 *
 * Listens for the `profolio:sw-waiting` event emitted by registerServiceWorker()
 * when a redeployed service worker is installed and waiting. Tapping "Update"
 * activates it; src/lib/pwa.ts then reloads the page exactly once on
 * `controllerchange`. Dismissing keeps the current session untouched -- the
 * new version still activates automatically on the next cold start.
 */
export function SWUpdatePrompt() {
  const shownRef = useRef(false);

  useEffect(() => {
    const onWaiting = (e: Event) => {
      if (shownRef.current) return;
      const detail = (e as CustomEvent<SWWaitingDetail>).detail;
      if (!detail?.waiting) return;
      shownRef.current = true;

      toast("A new version of Profolio is available", {
        description: "Reload to get the latest update.",
        duration: Infinity,
        action: {
          label: "Update",
          onClick: () => activateWaitingWorker(detail.waiting),
        },
        onDismiss: () => {
          // Allow the prompt to reappear if another update lands later.
          shownRef.current = false;
        },
      });
    };

    window.addEventListener(SW_WAITING_EVENT, onWaiting);
    return () => window.removeEventListener(SW_WAITING_EVENT, onWaiting);
  }, []);

  return null;
}
