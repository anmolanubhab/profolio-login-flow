// Shared deep-link into a profile section. ProfileTabs listens for hashchange,
// switches to the Profile tab and scrolls the section anchor into view; the
// user then uses that section's own "Add" button. This is the app's existing
// "Add section" convention (see AddSectionMenu) — recommendations reuse it so
// there is only ever one path into each editor.
export type ProfileSectionKey =
  | 'experience'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'projects'
  | 'languages'
  | 'social';

// Only the most recent scroll request is honoured; a newer call makes any
// in-flight settle-watch loop bail (prevents two loops fighting when a hash
// change triggers both jumpToProfileSection and ProfileTabs' listener).
let pendingScrollKey: ProfileSectionKey | null = null;

/**
 * Scroll a profile section anchor into view, waiting for the Profile page and
 * its asynchronously-loaded section cards to actually mount before scrolling.
 * Single implementation used by:
 *   - jumpToProfileSection()  — "Add section" menu + Profile Strength recs
 *   - ProfileTabs' #hash handler — direct /profile#skills URLs, back/forward
 *
 * Why this is needed: each section card runs its own Supabase query and grows
 * from a skeleton to content height, and the Skills card has no anchor at all
 * until its query resolves. A fixed delay races that hydration, so the scroll
 * lands in the wrong place (or does nothing, if the anchor isn't there yet).
 *
 * Instead we poll real conditions:
 *   Phase 1 — wait until the target anchor is in the DOM AND the page height
 *             has stopped changing for a few consecutive samples (i.e. every
 *             section card has swapped its skeleton for real content), then
 *             scroll to the anchor.
 *   Phase 2 — briefly re-pin to the anchor's scroll-margin offset so the final
 *             resting position is exact after the smooth scroll.
 * The time budget is only a safety cap, never the trigger. A genuine user
 * scroll / key press cancels the assist. Uses setInterval (not rAF) so a
 * section opened in a background tab still resolves when the user returns.
 */
export function scrollToProfileSectionWhenReady(key: ProfileSectionKey) {
  if (typeof window === 'undefined') return;

  pendingScrollKey = key;

  const SAMPLE_MS = 90;
  const STABLE_SAMPLES = 4; // consecutive unchanged samples => "settled"
  const BUDGET_MS = 6000; // safety cap only, counted while the tab is visible

  let deadline: number | null = null; // starts on the first visible sample
  let lastHeight: number | null = null;
  let heightStable = 0;
  let pinnedCount = 0;
  let scrolled = false;
  let interrupted = false;
  let timer = 0;

  // Our own scrollIntoView emits 'scroll' but never these — so listening here
  // lets a genuine user gesture cancel the assist without self-cancelling.
  const onUserGesture = () => {
    interrupted = true;
  };
  const gestures = ['wheel', 'touchmove', 'keydown'] as const;

  const stop = () => {
    window.clearInterval(timer);
    gestures.forEach((g) => window.removeEventListener(g, onUserGesture, true));
    if (pendingScrollKey === key) pendingScrollKey = null;
  };

  const step = () => {
    // Superseded by a newer request, or the user took over.
    if (pendingScrollKey !== key || interrupted) {
      stop();
      return;
    }

    // Don't fight layout in a tab nobody is looking at, and don't let the
    // safety budget tick down while hidden — resume when it becomes visible.
    if (document.hidden) return;
    if (deadline === null) deadline = performance.now() + BUDGET_MS;

    const expired = performance.now() >= deadline;
    const el = document.getElementById(key);

    if (!scrolled) {
      // Phase 1: anchor present AND page height stable for a few samples
      // (every section card has finished loading its content).
      const height = document.documentElement.scrollHeight;
      heightStable = lastHeight === height ? heightStable + 1 : 0;
      lastHeight = height;

      if (expired) {
        stop();
        return;
      }
      if (el && heightStable >= STABLE_SAMPLES) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        scrolled = true;
      }
      return;
    }

    if (!el) {
      stop();
      return;
    }

    // Phase 2: land exactly on the scroll-margin offset once the smooth scroll
    // settles, then stop.
    const top = el.getBoundingClientRect().top;
    const desired =
      parseFloat(window.getComputedStyle(el).scrollMarginTop || '0') || 0;
    if (Math.abs(top - desired) > 2) {
      const before = window.scrollY;
      el.scrollIntoView({ block: 'start' });
      // Couldn't move further (anchor near page bottom) → treat as settled.
      pinnedCount = Math.abs(window.scrollY - before) < 2 ? pinnedCount + 1 : 0;
    } else {
      pinnedCount += 1;
    }
    if (pinnedCount >= STABLE_SAMPLES || expired) stop();
  };

  gestures.forEach((g) =>
    window.addEventListener(g, onUserGesture, { passive: true, capture: true })
  );
  timer = window.setInterval(step, SAMPLE_MS);
  step(); // first sample now, don't wait a full interval
}

export function jumpToProfileSection(key: ProfileSectionKey) {
  if (typeof window === 'undefined') return;
  // Update the hash so ProfileTabs switches to the Profile tab and browser
  // back/forward can return here. When the hash already equals key no
  // hashchange fires, so we drive the scroll directly either way.
  if (window.location.hash.replace('#', '') !== key) {
    window.location.hash = key;
  }
  scrollToProfileSectionWhenReady(key);
}

/** Scroll the profile header (where the photo / cover camera buttons live). */
export function scrollToProfileHeader() {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- profile-changed bus ------------------------------------------------
// Any editor that mutates a profile field or section row fires this; the
// Profile Strength query listens and recomputes. Avoids threading a callback
// through every section component.
export const PROFILE_CHANGED_EVENT = 'profolio:profile-changed';

// Debounce the broadcast RPC across the burst of notifyProfileChanged() calls
// a single save can produce (section refetch + strength recompute + …).
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;

export function notifyProfileChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PROFILE_CHANGED_EVENT));

  // Fire-and-forget "share profile updates". The server function checks the
  // user's own `share_profile_updates` toggle and a 24h throttle before
  // notifying connections, so calling it on every edit is safe. No-ops
  // harmlessly if the migration adding it hasn't been applied yet.
  if (broadcastTimer) clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(() => {
    import('@/integrations/supabase/client')
      .then(({ supabase }) =>
        // `as never`: the function isn't in the generated DB types yet.
        supabase.rpc('broadcast_profile_update' as never),
      )
      .then(() => {}, () => {});
  }, 4000);
}
