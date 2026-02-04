import { useState, useEffect, useCallback, useRef } from 'react';

interface ScrollDirectionState {
  showHeader: boolean;
  showBottomNav: boolean;
}

export function useScrollDirection(threshold = 10): ScrollDirectionState {
  const [showHeader, setShowHeader] = useState(true);
  const [showBottomNav, setShowBottomNav] = useState(true);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  const updateScrollDirection = useCallback(() => {
    const scrollY = window.scrollY;
    const diff = scrollY - lastScrollY.current;
    
    // At top of page - always show both
    if (scrollY < 10) {
      setShowHeader(true);
      setShowBottomNav(true);
      lastScrollY.current = scrollY;
      ticking.current = false;
      return;
    }

    // Only trigger if scroll difference exceeds threshold
    if (Math.abs(diff) < threshold) {
      ticking.current = false;
      return;
    }

    if (diff > 0) {
      // Scrolling DOWN - hide bottom nav
      setShowBottomNav(false);
      setShowHeader(true);
    } else {
      // Scrolling UP - hide header
      setShowHeader(false);
      setShowBottomNav(true);
    }

    lastScrollY.current = scrollY;
    ticking.current = false;
  }, [threshold]);

  useEffect(() => {
    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateScrollDirection);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [updateScrollDirection]);

  return { showHeader, showBottomNav };
}
