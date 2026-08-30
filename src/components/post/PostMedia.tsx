import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Post media renderers.
 *
 * IMAGE and VIDEO deliberately have DIFFERENT layout rules on mobile, matching
 * LinkedIn's current mobile feed:
 *
 *   - ImageMedia  -> FULL-BLEED on mobile. The <img> escapes the feed's normal
 *                    horizontal padding / centered max-widths and touches both
 *                    physical viewport edges, with no border-radius. From `md`
 *                    up it reverts to the contained, slightly-rounded desktop
 *                    treatment.
 *   - VideoMedia  -> ALWAYS CONTAINED. Keeps the post's horizontal padding,
 *                    sits inside a rounded, overflow-hidden card with a solid
 *                    background, and preserves the video's natural aspect ratio
 *                    (object-contain, never stretched).
 *
 * The full-bleed escape is done with `width: 100vw; margin-left/right:
 * calc(50% - 50vw)` (see `.post-media--fullbleed` in index.css), which works
 * regardless of how much horizontal padding the ancestor feed containers add,
 * as long as that column is horizontally centred in the viewport (it is on
 * mobile -- the side rails are hidden below `lg`). `html { overflow-x: hidden }`
 * is the backstop against any sub-pixel horizontal scroll.
 */

interface ImageMediaProps {
  src: string;
  alt?: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Single post image. Full-bleed on mobile, contained on desktop. Never crops:
 * `object-contain` preserves the original proportions for portrait / landscape
 * / square uploads alike; `max-h` keeps an extremely tall image from taking
 * over the feed (only then does letterboxing show, against `bg-muted`).
 */
export function ImageMedia({ src, alt = 'Post image', className, onClick }: ImageMediaProps) {
  return (
    <div className={cn('post-media post-media--fullbleed', className)}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onClick={onClick}
        className={cn(
          'block w-full h-auto object-contain bg-muted',
          // Tall-image guard. Roomier cap on mobile (full viewport width) than
          // on the narrower desktop media column.
          'max-h-[80vh] md:max-h-[36rem]',
          // No rounding while full-bleed; pick the rounding back up on desktop.
          'rounded-none md:rounded-[10px]',
          onClick && 'cursor-pointer',
        )}
      />
    </div>
  );
}

interface VideoMediaProps {
  src: string;
  muted?: boolean;
  playsInline?: boolean;
  className?: string;
}

/**
 * Post video. Stays inside the post content container on every breakpoint:
 * horizontal margins, rounded corners, `overflow-hidden`, solid backdrop.
 * `object-contain` + `max-h` keeps the real aspect ratio without stretching.
 * The forwarded ref is the existing scroll-triggered autoplay hook's handle --
 * autoplay / mute / IntersectionObserver behaviour is unchanged.
 */
export const VideoMedia = forwardRef<HTMLVideoElement, VideoMediaProps>(
  ({ src, muted, playsInline, className }, ref) => (
    <div className={cn('post-media px-4 sm:px-5', className)}>
      <div className="overflow-hidden rounded-xl bg-black">
        <video
          ref={ref}
          src={src}
          controls
          muted={muted}
          playsInline={playsInline}
          className="block w-full max-h-[70vh] md:max-h-[32rem] object-contain bg-black"
        />
      </div>
    </div>
  ),
);
VideoMedia.displayName = 'VideoMedia';
