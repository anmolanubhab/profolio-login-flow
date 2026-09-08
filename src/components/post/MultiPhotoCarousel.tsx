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
 * LinkedIn-style multi-photo carousel for the post feed / detail view.
 *
 *  - one slide at a time, horizontal swipe on mobile (embla only claims the
 *    gesture once it's clearly horizontal, so vertical page scroll is intact)
 *  - subtle left/right arrows on desktop only, hidden at the ends (no looping)
 *  - a position indicator: dots for <= 5 photos, an "n / N" pill for more
 *  - a fixed aspect-ratio viewport (derived from the first photo, clamped) so
 *    the feed doesn't jump between slides; images are `object-contain` so they
 *    are never cropped or stretched
 *  - current slide loads eagerly + high priority, neighbours eagerly,
 *    everything else lazily
 *  - tap / click / Enter opens the shared full-screen <PhotoLightbox>
 *
 * A single photo still renders here (no arrows / indicator) so tap-to-zoom and
 * photo-tag behaviour are identical everywhere; callers keep using <ImageMedia>
 * for the plain single-image case if they prefer.
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

  // One viewport height for every slide -> no layout jump. Taken from the first
  // photo, clamped to a sane portrait..landscape band; 4:5 when unknown.
  const aspectRatio = useMemo(() => {
    const f = photos[0];
    if (f?.w && f?.h && f.w > 0 && f.h > 0) {
      return Math.min(1.91, Math.max(0.8, f.w / f.h));
    }
    return 0.8;
  }, [photos]);

  if (count === 0) return null;

  const showControls = count > 1;
  // Single photo: match the classic single-image post exactly -- natural
  // height, `object-contain`, never cropped. Multiple photos: a LinkedIn-style
  // fixed-frame carousel with `object-cover` (the uncropped image is one tap
  // away in the full-screen viewer) so slide heights never jump.
  const isSingle = count === 1;
  const lightboxPhotos = photos.map((p) => ({ url: p.url, alt: p.alt }));

  return (
    <div className="post-media post-media--fullbleed md:px-5">
      <Carousel
        className="relative w-full"
        opts={{ align: 'start', loop: false, watchDrag: showControls }}
        setApi={setApi}
      >
        <CarouselContent className="ml-0">
          {photos.map((photo, i) => (
            <CarouselItem key={photo.id || i} className="basis-full pl-0">
              <button
                type="button"
                onClick={() => setLightboxIndex(i)}
                aria-label={`Open photo ${i + 1} of ${count}`}
                className="relative block w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:rounded-[10px]"
              >
                <div
                  className={cn('w-full', isSingle && 'flex justify-center')}
                  style={isSingle ? undefined : { aspectRatio: String(aspectRatio) }}
                >
                  <img
                    src={photo.url}
                    alt={photo.alt || `Photo ${i + 1} of ${count}`}
                    loading={Math.abs(i - selected) <= 1 ? 'eager' : 'lazy'}
                    // Non-standard but widely supported; harmless where ignored.
                    {...{ fetchpriority: i === selected ? 'high' : 'auto' }}
                    decoding="async"
                    className={
                      isSingle
                        ? 'block h-auto w-full max-h-[80vh] object-contain md:max-h-[36rem]'
                        : 'h-full w-full object-cover'
                    }
                  />
                </div>
                {showPhotoTags && photo.id && (photoTags?.[photo.id]?.length ?? 0) > 0 && (
                  <PhotoTagOverlay tags={photoTags![photo.id]} />
                )}
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>

        {showControls && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => api?.scrollPrev()}
              disabled={selected === 0}
              className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-0 md:block"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => api?.scrollNext()}
              disabled={selected === count - 1}
              className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-background/80 p-2 text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-0 md:block"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {count > 5 ? (
              <span
                className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium tabular-nums text-white"
                aria-live="polite"
              >
                {selected + 1} / {count}
              </span>
            ) : (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5"
                role="tablist"
                aria-label={`Photo ${selected + 1} of ${count}`}
              >
                {photos.map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1.5 rounded-full bg-white/50 shadow transition-all',
                      i === selected ? 'w-4 bg-white' : 'w-1.5',
                    )}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {totalPhotoTags > 0 && onToggleTags && (
          <PhotoTagToggle on={showPhotoTags} count={totalPhotoTags} onClick={onToggleTags} />
        )}
      </Carousel>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={lightboxPhotos}
          index={lightboxIndex}
          onIndexChange={(i) => api?.scrollTo(i, true)}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

export default MultiPhotoCarousel;
