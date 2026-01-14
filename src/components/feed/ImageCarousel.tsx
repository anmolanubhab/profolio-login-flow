import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ImageCarouselProps {
  images: string[];
  alt?: string;
}

const ImageCarousel = ({ images, alt = 'Post content' }: ImageCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState<boolean[]>(images.map(() => true));
  const [hasError, setHasError] = useState<boolean[]>(images.map(() => false));
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const handleImageLoad = (index: number) => {
    setIsLoading((prev) => {
      const newState = [...prev];
      newState[index] = false;
      return newState;
    });
  };

  const handleImageError = (index: number) => {
    setIsLoading((prev) => {
      const newState = [...prev];
      newState[index] = false;
      return newState;
    });
    setHasError((prev) => {
      const newState = [...prev];
      newState[index] = true;
      return newState;
    });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe && currentIndex < images.length - 1) {
      goToNext();
    }
    if (isRightSwipe && currentIndex > 0) {
      goToPrev();
    }
  };

  // Single image - simple display
  if (images.length === 1) {
    return (
      <>
        <div 
          className="relative w-full overflow-hidden -mx-4 sm:mx-0 cursor-pointer"
          onClick={() => setFullscreenOpen(true)}
        >
          {isLoading[0] && (
            <div className="absolute inset-0 bg-gradient-to-br from-muted/60 to-muted/40 animate-pulse" />
          )}
          {hasError[0] ? (
            <div className="w-full h-52 bg-muted/50 flex items-center justify-center text-muted-foreground text-sm">
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Media unavailable
              </span>
            </div>
          ) : (
            <img
              src={images[0]}
              alt={alt}
              className={cn(
                "w-full h-auto max-h-[520px] object-cover transition-all duration-500",
                isLoading[0] ? "opacity-0 scale-105" : "opacity-100 scale-100"
              )}
              loading="lazy"
              onLoad={() => handleImageLoad(0)}
              onError={() => handleImageError(0)}
            />
          )}
        </div>

        {/* Fullscreen Dialog */}
        <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-50 text-white hover:bg-white/20"
              onClick={() => setFullscreenOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            <img
              src={images[0]}
              alt={alt}
              className="w-full h-full object-contain max-h-[90vh]"
            />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Grid preview for 2-4 images
  if (images.length >= 2 && images.length <= 4) {
    return (
      <>
        <div 
          className={cn(
            "grid gap-1 -mx-4 sm:mx-0 overflow-hidden",
            images.length === 2 && "grid-cols-2",
            images.length === 3 && "grid-cols-2",
            images.length === 4 && "grid-cols-2"
          )}
        >
          {images.slice(0, 4).map((image, index) => (
            <div
              key={index}
              className={cn(
                "relative overflow-hidden cursor-pointer",
                images.length === 3 && index === 0 && "row-span-2",
                "aspect-square"
              )}
              onClick={() => {
                setCurrentIndex(index);
                setFullscreenOpen(true);
              }}
            >
              {isLoading[index] && (
                <div className="absolute inset-0 bg-gradient-to-br from-muted/60 to-muted/40 animate-pulse" />
              )}
              <img
                src={image}
                alt={`${alt} ${index + 1}`}
                className={cn(
                  "w-full h-full object-cover transition-all duration-300 hover:scale-105",
                  isLoading[index] ? "opacity-0" : "opacity-100"
                )}
                loading="lazy"
                onLoad={() => handleImageLoad(index)}
                onError={() => handleImageError(index)}
              />
            </div>
          ))}
        </div>

        {/* Fullscreen Carousel Dialog */}
        <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-50 text-white hover:bg-white/20"
              onClick={() => setFullscreenOpen(false)}
            >
              <X className="h-6 w-6" />
            </Button>
            
            <div className="relative flex items-center justify-center h-[90vh]">
              <img
                src={images[currentIndex]}
                alt={`${alt} ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
              
              {currentIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 text-white hover:bg-white/20"
                  onClick={goToPrev}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
              )}
              
              {currentIndex < images.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 text-white hover:bg-white/20"
                  onClick={goToNext}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              )}
              
              {/* Dots indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, index) => (
                  <button
                    key={index}
                    className={cn(
                      "w-2 h-2 rounded-full transition-all",
                      index === currentIndex ? "bg-white w-4" : "bg-white/50"
                    )}
                    onClick={() => setCurrentIndex(index)}
                  />
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Carousel for 5+ images
  return (
    <>
      <div 
        className="relative w-full overflow-hidden -mx-4 sm:mx-0"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Main carousel */}
        <div 
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {images.map((image, index) => (
            <div
              key={index}
              className="min-w-full relative cursor-pointer"
              onClick={() => setFullscreenOpen(true)}
            >
              {isLoading[index] && (
                <div className="absolute inset-0 bg-gradient-to-br from-muted/60 to-muted/40 animate-pulse" />
              )}
              <img
                src={image}
                alt={`${alt} ${index + 1}`}
                className={cn(
                  "w-full h-auto max-h-[520px] object-cover transition-opacity duration-500",
                  isLoading[index] ? "opacity-0" : "opacity-100"
                )}
                loading="lazy"
                onLoad={() => handleImageLoad(index)}
                onError={() => handleImageError(index)}
              />
            </div>
          ))}
        </div>

        {/* Navigation arrows (desktop) */}
        {currentIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background shadow-md hidden sm:flex"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        
        {currentIndex < images.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background shadow-md hidden sm:flex"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}

        {/* Dots indicator */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, index) => (
            <button
              key={index}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                index === currentIndex ? "bg-white w-3 shadow-md" : "bg-white/60"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
            />
          ))}
        </div>

        {/* Counter badge */}
        <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/95 border-none">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-50 text-white hover:bg-white/20"
            onClick={() => setFullscreenOpen(false)}
          >
            <X className="h-6 w-6" />
          </Button>
          
          <div 
            className="relative flex items-center justify-center h-[90vh]"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img
              src={images[currentIndex]}
              alt={`${alt} ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            
            {currentIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 text-white hover:bg-white/20"
                onClick={goToPrev}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
            )}
            
            {currentIndex < images.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 text-white hover:bg-white/20"
                onClick={goToNext}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            )}
            
            {/* Dots indicator */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, index) => (
                <button
                  key={index}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    index === currentIndex ? "bg-white w-4" : "bg-white/50"
                  )}
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageCarousel;
