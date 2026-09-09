import { cn } from '@/lib/utils';
import logoSrc from '@/assets/logo/profolio-logo.png';

/**
 * The one source of truth for the Profolio brand mark: the official rainbow
 * ribbon "P" + "Profolio" wordmark lockup (src/assets/logo/profolio-logo.png,
 * a transparent-margin trim of the supplied master). Import this component —
 * never the image — so sizing, aspect ratio and alt text stay consistent.
 *
 * Sizing: set the HEIGHT via `className` (e.g. `h-7`, `h-10`); width tracks the
 * intrinsic 2.52:1 ratio automatically, so the mark never distorts.
 */

// Intrinsic pixel size of the trimmed lockup — drives layout / avoids CLS.
const INTRINSIC_W = 880;
const INTRINSIC_H = 349;

interface ProfolioLogoProps {
  /** Height utility + any extra classes. Defaults to `h-7`. */
  className?: string;
  /**
   * Wrap the mark in a light rounded card. Use on dark or photographic
   * backgrounds (auth screens) where the dark wordmark would lose contrast —
   * the artwork itself is never altered.
   */
  boxed?: boolean;
  /**
   * Accessible name. Defaults to "Profolio". Pass "" when the mark is
   * decorative because visible/adjacent text already says "Profolio".
   */
  alt?: string;
}

export function ProfolioLogo({ className, boxed = false, alt = 'Profolio' }: ProfolioLogoProps) {
  const img = (
    <img
      src={logoSrc}
      alt={alt}
      width={INTRINSIC_W}
      height={INTRINSIC_H}
      decoding="async"
      draggable={false}
      className={cn('block h-7 w-auto max-w-full select-none', className)}
    />
  );

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
