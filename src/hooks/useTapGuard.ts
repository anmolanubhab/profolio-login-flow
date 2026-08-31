import { useCallback, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, SyntheticEvent } from 'react';

// Browser "tap slop": movement under this is finger jitter and still counts as
// a tap; movement over it is a pan/scroll and must NOT trigger the action.
// 10px matches the common platform touch-slop (~8dp Android / ~10px iOS) and
// keeps buttons feeling responsive.
const MOVE_THRESHOLD_PX = 10;

/**
 * Distinguishes an intentional tap from a scroll/drag that merely began on the
 * element, so feed action buttons (Like / Comment / Repost / Share) don't fire
 * while the user is scrolling on mobile.
 *
 * How it works (Pointer Events, no per-move React state):
 *  - pointerdown  -> record start x/y in a ref, clear the "moved" flag
 *  - pointermove  -> if travel exceeds the threshold, set moved = true (ref)
 *  - pointercancel-> the browser took the gesture over for scrolling -> moved
 *  - the wrapped onClick runs the real handler only when `moved` is false
 *  - a keyboard-driven click (no preceding pointerdown) always passes through
 *
 * Desktop is unaffected: a mouse press+release with < 10px travel is a tap.
 *
 * Usage (plain button):
 *   const tap = useTapGuard();
 *   <button {...tap.bind} onClick={tap.onTap(handleClick)} />
 *
 * Usage (Radix trigger that opens on pointerdown -- make the menu `open`
 * controlled and stop Radix opening on touch-start):
 *   <button
 *     {...tap.bind}
 *     onPointerDown={(e) => { tap.bind.onPointerDown(e); e.preventDefault(); }}
 *     onClick={tap.onTap(() => setOpen((o) => !o))}
 *   />
 * (preventDefault on pointerdown suppresses Radix's open-on-pointerdown but
 *  NOT the click event; keyboard open still works via Radix's keydown.)
 */
export function useTapGuard() {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const usedPointer = useRef(false);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    usedPointer.current = true;
    moved.current = false;
    start.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (moved.current || !start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    if (dx * dx + dy * dy > MOVE_THRESHOLD_PX * MOVE_THRESHOLD_PX) {
      moved.current = true;
    }
  }, []);

  const onPointerUp = useCallback(() => {
    start.current = null;
  }, []);

  const onPointerCancel = useCallback(() => {
    // Browser hijacked the pointer for scrolling -> definitely not a tap.
    moved.current = true;
    start.current = null;
  }, []);

  const onTap = useCallback(
    <E extends SyntheticEvent>(fn: (e: E) => void) =>
      (e: E) => {
        const fromPointer = usedPointer.current;
        usedPointer.current = false;
        const wasScroll = fromPointer && moved.current;
        moved.current = false;
        if (wasScroll) return; // swallow the stray click that followed a scroll
        fn(e);
      },
    [],
  );

  const bind = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel };

  return { bind, onTap };
}
