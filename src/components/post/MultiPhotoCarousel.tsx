import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import PhotoTagOverlay, { PhotoTagToggle } from '@/components/post/PhotoTagOverlay';
import { PhotoLightbox } from '@/components/post/PhotoLightbox';
import type { DraftTag } from '@/lib/posts/mediaTags';

export interface CarouselPhoto {
  url: string;
  alt: string;
  /** Stable media id (`posts.media[i].id`) photo tags point at; '' for legacy. */
  id: string;
  w?: number;
  h?: number;
}

interface MultiPhotoCarouselProps {
  photos: CarouselPhoto[];
  /** Read-only photo tags grouped by media id (feed card). */
  photoTags?: Record<string, DraftTag[]>;
  showPhotoTags?: boolean;
  onToggleTags?: () => void;
  totalPhotoTags?: number;
}

/**
 * LinkedIn-style multi-photo post carousel.
 *
 * Design principles taken from the LinkedIn feed carousel (measured, not
 * copied):
 *   - photos are visually SEPARATED, not one continuous strip: each slide is
 *     its own rounded, clipped frame and a small gap (4px) between slides lets
 *     the post/card background show through -- no borders, no shadows
 *   - the active photo does not fill the whole width; the previous / next photo
 *     PEEKS at the sides so it's obvious more photos exist
 *   - a fixed slide frame + `object-cover` keeps every slide the same height
 *     (no feed jump for portrait/landscape/square/mixed); the uncropped image
 *     is one tap away in the full-screen viewer
 *   - a compact "n / N" pill sits over the active photo, top-right
 *   - subtle circular arrows on desktop only (mobile = swipe), hidden at the
 *     ends since navigation doesn't loop
 *   - current slide loads eager + high priority, neighbours eager, rest lazy
 *
 * A SINGLE photo renders with the classic single-image treatment (full-bleed
 * on mobile, `object-contain`, no carousel chrome, no "1 / 1").
 */
export function MultiPhotoCarousel({
  photos,
  photoTags,
  showPhotoTags = false,
  onToggleTags,
  totalPhotoTags = 0,
}: MultiPhotoCarouselProps) {
  const count = photos.length;
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!api) return;
    const sync = () => setSelected(api.selectedScrollSnap());
    sync();
    api.on('select', sync);
    api.on('reInit', sync);
    return () => {
      api.off('select', sync);
      api.off('reInit', sync);
    };
  }, [api]);

  // One frame height for every slide -> no layout jump between photos. Taken
  // from the first photo, clamped to a portrait..landscape band; 4:5 unknown.
  const aspectRatio = useMemo(() => {
    const f = photos[0];
    if (f?.w && f?.h && f.w > 0 && f.h > 0) {
      return Math.min(1.91, Math.max(0.8, f.w / f.h));
    }
    return 0.8;
  }, [photos]);

  if (count === 0) return null;

  const lightboxPhotos = photos.map((p) => ({ url: p.url, alt: p.alt }));
  const openLightbox = (i: number) => setLightboxIndex(i);
  const lightbox = lightboxIndex !== null && (
    <PhotoLightbox
      photos={lightboxPhotos}
      index={lightboxIndex}
      onIndexChange={(i) => api?.scrollTo(i, true)}
      onClose={() => setLightboxIndex(null)}
    />
  );

  // ── Single photo: classic single-image post, no carousel UI ────────────────
  if (count === 1) {
    const p = photos[0];
    return (
      <div className="post-media post-media--fullbleed md:px-5">
        <button
          type="button"
          onClick={() => openLightbox(0)}
          aria-label="Open photo"
          className="relative block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <img
            src={p.url}
            alt={p.alt || 'Post photo'}
            loading="eager"
            decoding="async"
            className="block h-auto w-full max-h-[80vh] rounded-none bg-muted object-contain md:max-h-[36rem] md:rounded-[10px]"
          />
          {showPhotoTags && p.id && (photoTags?.[p.id]?.length ?? 0) > 0 && (
            <PhotoTagOverlay tags={photoTags![p.id]} />
          )}
        </button>
        {totalPhotoTags > 0 && onToggleTags && (
          <PhotoTagToggle on={showPhotoTags} count={totalPhotoTags} onClick={onToggleTags} />
        )}
        {lightbox}
      </div>
    );
  }

  // ── 2-10 photos: LinkedIn-style separated carousel ────────────────────────
  return (
    <div className="post-media post-media--fullbleed md:px-5">
      <Carousel
        className="relative w-full"
        opts={{ align: 'center', loop: false, containScroll: 'trimSnaps' }}
        setApi={setApi}
      >
        {/* `-ml-1` + `pl-1` on each item = a 4px gutter the card background
            shows through (the whole point: separated photos, no strip). Slides
            are < 100% wide so neighbours peek at the sides. `overflow-hidden`
            on the embla viewport clips the peek -> no horizontal page scroll. */}
        <CarouselContent className="-ml-1">
          {photos.map((photo, i) => (
            <CarouselItem key={photo.id || i} className="basis-[88%] pl-1 sm:basis-[84%]">
              <button
                type="button"
                onClick={() => openLightbox(i)}
                aria-label={`Open photo ${i + 1} of ${count}`}
                className="relative block w-full overflow-hidden rounded-[10px] bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="w-full" style={{ aspectRatio: String(aspectRatio) }}>
                  <img
                    src={photo.url}
                    alt={photo.alt || `Photo ${i + 1} of ${count}`}
                    loading={Math.abs(i - selected) <= 1 ? 'eager' : 'lazy'}
                    // Non-standard attr, widely supported, harmless where not.
                    {...{ fetchpriority: i === selected ? 'high' : 'auto' }}
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>

                {/* Position pill -- over the ACTIVE photo, top-right. */}
                {i === selected && (
                  <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/60 px-2 py-[3px] text-[11px] font-semibold leading-none tabular-nums text-white">
                    {selected + 1} / {count}
                  </span>
                )}

                {showPhotoTags && photo.id && (photoTags?.[photo.id]?.length ?? 0) > 0 && (
                  <PhotoTagOverlay tags={photoTags![photo.id]} />
                )}
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>

        {/* Desktop-only circular arrows, vertically centred, inset from the
            viewport edge so they sit over the photo, not the peek. */}
        <button
          type="button"
          aria-label="Previous photo"
          onClick={() => api?.scrollPrev()}
          disabled={selected === 0}
          className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/90 p-1.5 text-foreground shadow-sm ring-1 ring-border transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-0 md:inline-flex"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Next photo"
          onClick={() => api?.scrollNext()}
          disabled={selected === count - 1}
          className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-background/90 p-1.5 text-foreground shadow-sm ring-1 ring-border transition hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-0 md:inline-flex"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        {/* Screen-reader position announcement (the visual pill has no aria-live
            because it re-mounts per slide). */}
        <span className="sr-only" aria-live="polite">
          Photo {selected + 1} of {count}
        </span>

        {totalPhotoTags > 0 && onToggleTags && (
          <PhotoTagToggle on={showPhotoTags} count={totalPhotoTags} onClick={onToggleTags} />
        )}
      </Carousel>

      {lightbox}
    </div>
  );
}

export default MultiPhotoCarousel;
