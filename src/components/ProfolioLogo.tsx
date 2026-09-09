import { cn } from '@/lib/utils';
import logoSrc from '@/assets/logo/profolio-logo.png';
import iconSrc from '@/assets/logo/profolio-icon.png';

/**
 * The one source of truth for the Profolio brand mark. Import this component —
 * never the images.
 *
 *   variant="lockup" (default)  rainbow ribbon "P" + "Profolio" wordmark
 *                               (src/assets/logo/profolio-logo.png)
 *   variant="icon"              the ribbon "P" only, for tight / square slots
 *                               (src/assets/logo/profolio-icon.png)
 *
 * Sizing: set the HEIGHT via `className` (e.g. `h-7`, `h-10`); width tracks the
 * intrinsic ratio automatically, so the mark never distorts.
 */

// Intrinsic pixel sizes — drive layout / avoid CLS.
const LOCKUP_W = 880;
const LOCKUP_H = 349;
const ICON_W = 221;
const ICON_H = 256;

interface ProfolioLogoProps {
  /** Height utility + any extra classes. Defaults to `h-7`. */
  className?: string;
  /** `lockup` (P + wordmark) or `icon` (P only). Defaults to `lockup`. */
  variant?: 'lockup' | 'icon';
  /**
   * Wrap the mark in a light rounded card. Use on dark or photographic
   * backgrounds (auth screens) where the dark wordmark would lose contrast —
   * the artwork itself is never altered. Ignored for `variant="icon"` (the
   * full-colour "P" reads on any background).
   */
  boxed?: boolean;
  /**
   * Accessible name. Defaults to "Profolio". Pass "" when the mark is
   * decorative because visible/adjacent text already says "Profolio".
   */
  alt?: string;
}

export function ProfolioLogo({ className, variant = 'lockup', boxed = false, alt = 'Profolio' }: ProfolioLogoProps) {
  const isIcon = variant === 'icon';

  const img = (
    <img
      src={isIcon ? iconSrc : logoSrc}
      alt={alt}
      width={isIcon ? ICON_W : LOCKUP_W}
      height={isIcon ? ICON_H : LOCKUP_H}
      decoding="async"
      draggable={false}
      className={cn('block h-7 w-auto max-w-full select-none', className)}
    />
  );

  // The full-colour "P" alone has enough contrast on light AND dark — no card.
  if (isIcon) return img;

  // Explicit card — for coloured / photographic backgrounds (auth screens).
  if (boxed) {
    return (
      <span className="inline-flex items-center rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-black/5">
        {img}
      </span>
    );
  }

  // Chrome usage: bare in light; a compact white card ONLY under `.dark`, so
  // the dark-navy wordmark keeps contrast on dark surfaces. Remove once a
  // white-wordmark dark asset exists (see src/assets/logo/README.md).
  return (
    <span className="inline-flex items-center rounded-lg dark:bg-white dark:px-2.5 dark:py-1.5 dark:shadow-sm dark:ring-1 dark:ring-black/5">
      {img}
    </span>
  );
}
