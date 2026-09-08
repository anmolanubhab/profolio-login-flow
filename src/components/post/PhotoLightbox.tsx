import { useCallback, useEffect, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { useLockFullscreenOverlay } from '@/hooks/useFullscreenOverlay';

export interface LightboxPhoto {
  url: string;
  alt: string;
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[];
  /** Index to open on. */
  index: number;
  /** Called with the new index as the user swipes / navigates. */
  onIndexChange?: (index: number) => void;
  onClose: () => void;
}

/**
 * Full-screen dark media viewer, reused by every carousel surface (feed card,
 * post detail). Built on the Radix Dialog primitive so it gets, for free: a
 * body-scroll lock while open (the feed can't scroll behind it), focus trap,
 * `aria-modal`, and ESC-to-close on desktop. `useLockFullscreenOverlay` also
 * steps the mobile BottomNavigation out of the way.
 *
 * Controls sit inside `env(safe-area-inset-*)` so nothing lands under the
 * Android status/navigation bars in the Capacitor shell.
 */
export function PhotoLightbox({ photos, index, onIndexChange, onClose }: PhotoLightboxProps) {
  useLockFullscreenOverlay(true);

  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(index);
  const count = photos.length;

  useEffect(() => {
    if (!api) return;
    const sync = () => {
      const i = api.selectedScrollSnap();
      setSelected(i);
      onIndexChange?.(i);
    };
    sync();
    api.on('select', sync);
    api.on('reInit', sync);
    return () => {
      api.off('select', sync);
      api.off('reInit', sync);
    };
  }, [api, onIndexChange]);

  // Desktop keyboard navigation (ESC is handled by Radix).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        api?.scrollPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        api?.scrollNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) onClose();
    },
    [onClose],
  );

  return (
    <DialogPrimitive.Root open onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/95 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-label="Photo viewer"
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-[100] flex flex-col text-white outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          {/* Top bar: position + close. Pushed below the status-bar inset. */}
          <div className="flex items-center justify-between px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <span className="text-sm font-medium tabular-nums" aria-live="polite">
              {count > 1 ? `${selected + 1} / ${count}` : ''}
            </span>
            <DialogPrimitive.Close
              aria-label="Close photo viewer"
              className="rounded-full p-2 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <X className="h-6 w-6" />
            </DialogPrimitive.Close>
          </div>

          <Carousel
            className="relative min-h-0 flex-1"
            opts={{ loop: false, startIndex: index, watchDrag: count > 1 }}
            setApi={setApi}
          >
            <CarouselContent className="ml-0 h-full">
              {photos.map((p, i) => (
                <CarouselItem key={i} className="flex h-full items-center justify-center pl-0">
                  <img
                    src={p.url}
                    alt={p.alt || `Photo ${i + 1} of ${count}`}
                    loading={Math.abs(i - selected) <= 1 ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable={false}
                    className="max-h-full max-w-full select-none object-contain"
                  />
                </CarouselItem>
              ))}
            </CarouselContent>

            {count > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() => api?.scrollPrev()}
                  disabled={selected === 0}
                  className="absolute left-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-0 md:block"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() => api?.scrollNext()}
                  disabled={selected === count - 1}
                  className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:pointer-events-none disabled:opacity-0 md:block"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </Carousel>

          {/* Clears the Android gesture/nav area. */}
          <div className="pb-[env(safe-area-inset-bottom)]" aria-hidden />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export default PhotoLightbox;
