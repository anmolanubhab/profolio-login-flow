import { useRef } from 'react';

export interface TapTriggerHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
}

/**
 * Makes a Radix menu / popover *trigger* button open on an INTENTIONAL TAP
 * instead of on `pointerdown`.
 *
 * Why this exists
 * --------------------------------------------------------------------------
 * `@radix-ui/react-dropdown-menu`'s `DropdownMenuTrigger` toggles its menu
 * from inside its own `onPointerDown` handler, with no `pointerType` guard
 * (a touch contact reports `button === 0` just like a left mouse button). On
 * a touchscreen that means the menu pops open the instant a finger lands on
 * the button — so a vertical scroll that merely *starts* over the Repost or
 * Share button opens the menu, and a finger that then lifts over a menu item
 * activates it. That is the "Repost / Share fires while scrolling" bug.
 *
 * Like and Comment don't have this problem because they are plain `onClick`
 * buttons, and the browser never synthesises a `click` after a scroll. This
 * hook restores that same "only a real tap counts" behaviour for a
 * *controlled* Radix trigger.
 *
 * Behaviour
 * --------------------------------------------------------------------------
 * - `pointerType === 'mouse'` (desktop): every handler no-ops, so Radix's
 *   normal open-on-mousedown path is completely untouched.
 * - touch / pen: `pointerdown` is `preventDefault()`-ed, which makes
 *   `composeEventHandlers` skip Radix's composed open handler (it bails once
 *   the event's default has been prevented). `onTap` is then called from
 *   `pointerup` only when ALL of these hold:
 *     a) the gesture was not cancelled (no `pointercancel` — fired by the
 *        browser as soon as it decides the gesture is a scroll),
 *     b) the pointer moved less than `thresholdPx` from where it started,
 *     c) the pointer is still within the trigger button's box,
 *     d) it is the same pointer that went down.
 *   A scroll — whether it triggers `pointercancel` or just drifts past the
 *   threshold — never calls `onTap`.
 *
 * `preventDefault()` on `pointerdown` does not block page scrolling (scroll
 * is governed by `touch-action` and `touchmove`); Radix's own trigger calls
 * it too. The pointer is deliberately NOT captured, so the browser stays
 * free to take the gesture over as a scroll.
 *
 * Keyboard (Enter / Space) still works through Radix's untouched `onKeyDown`.
 */
export function useTapTrigger(onTap: () => void, thresholdPx = 10): TapTriggerHandlers {
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const movedOut = useRef(false);

  return {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse') return; // desktop: let Radix handle it
      origin.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
      movedOut.current = false;
      // Suppress Radix's DropdownMenuTrigger open-on-pointerdown for touch/pen.
      e.preventDefault();
    },
    onPointerMove: (e) => {
      const o = origin.current;
      if (!o || e.pointerId !== o.id) return;
      const dx = e.clientX - o.x;
      const dy = e.clientY - o.y;
      if (dx * dx + dy * dy > thresholdPx * thresholdPx) movedOut.current = true;
    },
    onPointerUp: (e) => {
      if (e.pointerType === 'mouse') return;
      const o = origin.current;
      origin.current = null;
      if (!o || e.pointerId !== o.id) return;
      if (movedOut.current) return; // the gesture was a scroll / drag
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      ) {
        return; // finger drifted off the button before lifting
      }
      onTap();
    },
    onPointerCancel: () => {
      origin.current = null;
      movedOut.current = true;
    },
  };
}
