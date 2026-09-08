import { useEffect } from 'react';

/**
 * Publishes the *visual* viewport height as `--app-vvh` on <html> for as long
 * as this is mounted (mount it once, app-wide).
 *
 * Why not just `100dvh`: `dvh` tracks retractable browser chrome but NOT the
 * on-screen keyboard. In the Capacitor Android shell (no `@capacitor/keyboard`
 * plugin) the IME can overlay the page without resizing the layout viewport,
 * which would leave a fixed bottom action bar sitting behind the keyboard.
 * `window.visualViewport.height` shrinks in that case too, so any surface that
 * caps its height at `var(--app-vvh, 100dvh)` stays inside the region actually
 * visible above the keyboard -- consistently in Chrome, the installed PWA and
 * the APK.
 *
 * Consumers MUST keep the `100dvh` fallback for engines without
 * `visualViewport` (older WebViews) and for the first paint:
 *   max-h-[calc(var(--app-vvh,100dvh)-2rem)]
 */
export function useViewportSizeVar(): void {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const apply = () => root.style.setProperty('--app-vvh', `${Math.round(vv.height)}px`);
    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      root.style.removeProperty('--app-vvh');
    };
  }, []);
}

/** Renderless helper so it can be dropped into the App tree without a hook body. */
export function ViewportSizeVar(): null {
  useViewportSizeVar();
  return null;
}
