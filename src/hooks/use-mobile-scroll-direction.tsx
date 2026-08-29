import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

export type MobileScrollDirection = 'top' | 'scrolling-up' | 'scrolling-down';

/** scrollY at/below this is treated as "at the top" -- chrome always shows. */
const TOP_THRESHOLD = 8;
/** Travel (px) needed in one direction before the state flips -- kills touch jitter. */
const SCROLL_THRESHOLD = 10;
/** Below this width the mobile chrome auto-hides; at/above it, always 'top'. */
const LG_BREAKPOINT = 1024;

const MobileScrollDirectionContext = createContext<MobileScrollDirection>('top');

/**
 * Single source of truth for the mobile header + bottom-nav auto-hide.
 *
 * Profolio scrolls the document (no inner scroll container -- see the notes in
 * index.css about keeping overflow off #root/body), so this listens to `window`.
 * One rAF-throttled passive listener feeds both consumers via context, so there
 * is exactly one listener and the two bars can never disagree.
 *
 * - `scrollY <= TOP_THRESHOLD` -> always 'top'
 * - otherwise, flips to 'scrolling-down' / 'scrolling-up' only after
 *   SCROLL_THRESHOLD px of accumulated travel in that direction
 * - resets to 'top' on every route change (a new page starts scrolled up)
 * - always 'top' at >= lg, so desktop consumers never transform
 */
export function MobileScrollDirectionProvider({ children }: { children: ReactNode }) {
  const [direction, setDirection] = useState<MobileScrollDirection>('top');
  const { pathname } = useLocation();

  const lastY = useRef(0);
  const accum = useRef(0);
  const ticking = useRef(false);
  const currentRef = useRef<MobileScrollDirection>('top');

  // New route -> back to the top state, drop any stale "hidden" from the last page.
  useEffect(() => {
    lastY.current = Math.max(0, window.scrollY);
    accum.current = 0;
    currentRef.current = 'top';
    setDirection('top');
  }, [pathname]);

  useEffect(() => {
    const belowLg = window.matchMedia(`(max-width: ${LG_BREAKPOINT - 1}px)`);

    const set = (next: MobileScrollDirection) => {
      if (currentRef.current !== next) {
        currentRef.current = next;
        setDirection(next);
      }
    };

    const update = () => {
      ticking.current = false;
      const y = Math.max(0, window.scrollY);

      // Desktop: never hide.
      if (!belowLg.matches) {
        lastY.current = y;
        set('top');
        return;
      }

      if (y <= TOP_THRESHOLD) {
        accum.current = 0;
        lastY.current = y;
        set('top');
        return;
      }

      const delta = y - lastY.current;
      lastY.current = y;
      if (delta === 0) return;

      // Direction reversed since we started accumulating -> start over.
      if ((delta > 0) !== (accum.current > 0)) accum.current = 0;
      accum.current += delta;

      if (accum.current > SCROLL_THRESHOLD) set('scrolling-down');
      else if (accum.current < -SCROLL_THRESHOLD) set('scrolling-up');
    };

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(update);
    };

    lastY.current = Math.max(0, window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    belowLg.addEventListener('change', update);

    return () => {
      window.removeEventListener('scroll', onScroll);
      belowLg.removeEventListener('change', update);
    };
  }, []);

  return (
    <MobileScrollDirectionContext.Provider value={direction}>
      {children}
    </MobileScrollDirectionContext.Provider>
  );
}

/** Current shared scroll-direction state. `'top'` on desktop / near the top. */
export function useMobileScrollDirection(): MobileScrollDirection {
  return useContext(MobileScrollDirectionContext);
}

/** Convenience: true only when the mobile chrome should be slid out of view. */
export function useMobileChromeHidden(): boolean {
  return useMobileScrollDirection() === 'scrolling-down';
}
