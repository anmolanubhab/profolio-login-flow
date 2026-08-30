import { useEffect } from 'react';
import { useSyncExternalStore } from 'react';

// A tiny global counter so app chrome (e.g. the mobile BottomNavigation) can
// step out of the way while a full-screen takeover (the Story composer) is
// mounted. Keeps those overlays at the same z-index as the rest of the app's
// dialogs instead of fighting a z-index arms race.
let count = 0;
const subscribers = new Set<() => void>();
const emit = () => subscribers.forEach((fn) => fn());

export function useFullscreenOverlayActive(): boolean {
  return useSyncExternalStore(
    (cb) => { subscribers.add(cb); return () => subscribers.delete(cb); },
    () => count > 0,
    () => false,
  );
}

export function useLockFullscreenOverlay(active = true): void {
  useEffect(() => {
    if (!active) return;
    count += 1;
    emit();
    return () => { count -= 1; emit(); };
  }, [active]);
}
