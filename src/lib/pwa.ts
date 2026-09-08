/**
 * Service-worker registration + update lifecycle.
 *
 * Design goals (shared by the Chrome PWA and the native Android shell, which
 * both load this same production origin):
 *   - a new Vercel deployment must always be reachable; never permanently
 *     pinned to an old service-worker cache
 *   - no aggressive reload loop: a running session is only reloaded after the
 *     user accepts an "Update" prompt, or on a fresh cold start
 *   - offline fallback (offline.html) stays intact
 *
 * How it works with public/sw.js (which no longer calls skipWaiting on
 * install):
 *   - new SW installs -> enters "waiting" -> we emit `profolio:sw-waiting`
 *     -> <SWUpdatePrompt/> shows a toast -> user taps -> postMessage
 *     SKIP_WAITING -> `controllerchange` -> one reload
 *   - app fully closed & reopened -> no clients -> waiting SW activates by
 *     itself -> newest deployment loads with no prompt
 */

const SW_URL = "/sw.js";
export const SW_WAITING_EVENT = "profolio:sw-waiting";

export interface SWWaitingDetail {
  waiting: ServiceWorker;
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      // updateViaCache: 'none' -> the browser HTTP cache is never consulted
      // for sw.js itself, so a redeployed worker is always detected.
      .register(SW_URL, { updateViaCache: "none" })
      .then((reg) => {
        let reloading = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (reloading) return;
          reloading = true;
          window.location.reload();
        });

        const announceWaiting = () => {
          if (reg.waiting && navigator.serviceWorker.controller) {
            window.dispatchEvent(
              new CustomEvent<SWWaitingDetail>(SW_WAITING_EVENT, {
                detail: { waiting: reg.waiting },
              }),
            );
          }
        };

        // A worker may already be waiting from a previous visit.
        announceWaiting();

        reg.addEventListener("updatefound", () => {
          const incoming = reg.installing;
          if (!incoming) return;
          incoming.addEventListener("statechange", () => {
            if (incoming.state === "installed") announceWaiting();
          });
        });

        // Look for a new deployment periodically and whenever the app returns
        // to the foreground (covers the native-shell "reopen" that is a
        // resume rather than a full process kill).
        const checkForUpdate = () => {
          reg.update().catch(() => {
            /* transient network error; try again next tick */
          });
        };
        window.setInterval(checkForUpdate, 60_000);
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") checkForUpdate();
        });
      })
      .catch(() => {
        /* offline-first is a progressive enhancement; ignore registration errors */
      });
  });
}

/** Called by the update prompt when the user accepts. */
export function activateWaitingWorker(waiting: ServiceWorker): void {
  waiting.postMessage("SKIP_WAITING");
}
