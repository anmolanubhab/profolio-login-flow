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
          className="relative w-full overflow-hidden sm:rounded-[2rem] cursor-pointer group/single"
          onClick={() => setFullscreenOpen(true)}
        >
          {isLoading[0] && (
            <div className="absolute inset-0 bg-gradient-to-br from-[#F3F6F8] to-[#E8EBEF] animate-pulse" />
          )}
          {hasError[0] ? (
            <div className="w-full h-72 bg-[#F3F6F8] flex flex-col items-center justify-center text-[#5E6B7E] text-sm gap-4">
              <div className="p-4 rounded-[1.5rem] bg-white shadow-lg border border-[#E8EBEF]/60">
                <svg className="w-10 h-10 text-[#833AB4]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-center space-y-1">
                <span className="font-black uppercase tracking-widest text-[12px] text-[#1D2226]">Media unavailable</span>
                <p className="text-[11px] font-bold text-[#5E6B7E]">We couldn't load this masterpiece</p>
              </div>
            </div>
          ) : (
            <img
              src={images[0]}
              alt={alt}
              className={cn(
                "w-full h-auto max-h-[600px] object-cover transition-all duration-700 group-hover/single:scale-105",
                isLoading[0] ? "opacity-0 scale-105" : "opacity-100 scale-100"
              )}
              loading="lazy"
              onLoad={() => handleImageLoad(0)}
              onError={() => handleImageError(0)}
            />
          )}
          <div className="absolute inset-0 bg-black/0 group-hover/single:bg-black/5 transition-colors duration-500" />
        </div>

        {/* Fullscreen Dialog */}
        <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/98 border-none rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 duration-300 outline-none">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] z-50" />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-6 right-6 z-50 text-white/70 hover:text-white hover:bg-white/10 rounded-2xl h-14 w-14 transition-all backdrop-blur-md"
              onClick={() => setFullscreenOpen(false)}
            >
              <X className="h-8 w-8" strokeWidth={2.5} />
            </Button>
            <div className="w-full h-full flex items-center justify-center p-4">
              <img
                src={images[0]}
                alt={alt}
                className="w-full h-full object-contain max-h-[85vh] rounded-[1.5rem] shadow-2xl"
              />
            </div>
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
            "grid gap-2 overflow-hidden sm:rounded-[2rem]",
            images.length === 2 && "grid-cols-2",
            images.length === 3 && "grid-cols-2",
            images.length === 4 && "grid-cols-2"
          )}
        >
          {images.slice(0, 4).map((image, index) => (
            <div
              key={index}
              className={cn(
                "relative overflow-hidden cursor-pointer group/grid",
                images.length === 3 && index === 0 && "row-span-2",
                "aspect-square"
              )}
              onClick={() => {
                setCurrentIndex(index);
                setFullscreenOpen(true);
              }}
            >
              {isLoading[index] && (
                <div className="absolute inset-0 bg-gradient-to-br from-[#F3F6F8] to-[#E8EBEF] animate-pulse" />
              )}
              <img
                src={image}
                alt={`${alt} ${index + 1}`}
                className={cn(
                  "w-full h-full object-cover transition-all duration-700 group-hover/grid:scale-110",
                  isLoading[index] ? "opacity-0" : "opacity-100"
                )}
                loading="lazy"
                onLoad={() => handleImageLoad(index)}
                onError={() => handleImageError(index)}
              />
              <div className="absolute inset-0 bg-black/0 group-hover/grid:bg-black/10 transition-colors duration-500" />
            </div>
          ))}
        </div>

        {/* Fullscreen Carousel Dialog */}
        <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/98 border-none rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 duration-300 outline-none">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] z-50" />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-6 right-6 z-50 text-white/70 hover:text-white hover:bg-white/10 rounded-2xl h-14 w-14 transition-all backdrop-blur-md"
              onClick={() => setFullscreenOpen(false)}
            >
              <X className="h-8 w-8" strokeWidth={2.5} />
            </Button>
            
            <div className="relative flex items-center justify-center h-[90vh] p-4">
              <img
                src={images[currentIndex]}
                alt={`${alt} ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain rounded-[1.5rem] shadow-2xl transition-all duration-500"
              />
              
              {currentIndex > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-6 h-16 w-16 rounded-[2rem] text-white/70 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md group/nav"
                  onClick={goToPrev}
                >
                  <ChevronLeft className="h-10 w-10 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                </Button>
              )}
              
              {currentIndex < images.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-6 h-16 w-16 rounded-[2rem] text-white/70 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md group/nav"
                  onClick={goToNext}
                >
                  <ChevronRight className="h-10 w-10 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                </Button>
              )}
              
              {/* Dots indicator */}
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3 bg-black/30 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10">
                {images.map((_, index) => (
                  <button
                    key={index}
                    className={cn(
                      "h-2.5 rounded-full transition-all duration-500",
                      index === currentIndex 
                        ? "bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] w-10 shadow-[0_0_15px_rgba(131,58,180,0.5)]" 
                        : "bg-white/30 w-2.5 hover:bg-white/50"
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
        className="relative w-full overflow-hidden sm:rounded-[2rem] group/carousel"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Main carousel */}
        <div 
          className="flex transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1)"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {images.map((image, index) => (
            <div
              key={index}
              className="min-w-full relative cursor-pointer"
              onClick={() => setFullscreenOpen(true)}
            >
              {isLoading[index] && (
                <div className="absolute inset-0 bg-gradient-to-br from-[#F3F6F8] to-[#E8EBEF] animate-pulse" />
              )}
              <img
                src={image}
                alt={`${alt} ${index + 1}`}
                className={cn(
                  "w-full h-auto max-h-[600px] object-cover transition-opacity duration-700",
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
            className="absolute left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-xl bg-white/90 hover:bg-white text-[#1D2226] shadow-xl transition-all duration-300 transform hover:scale-110 active:scale-95 hidden sm:flex"
            onClick={(e) => {
              e.stopPropagation();
              goToPrev();
            }}
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
          </Button>
        )}
        
        {currentIndex < images.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-xl bg-white/90 hover:bg-white text-[#1D2226] shadow-xl transition-all duration-300 transform hover:scale-110 active:scale-95 hidden sm:flex"
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
          >
            <ChevronRight className="h-6 w-6" strokeWidth={2.5} />
          </Button>
        )}

        {/* Dots indicator */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/10 backdrop-blur-sm px-3 py-1.5 rounded-full">
          {images.map((_, index) => (
            <button
              key={index}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                index === currentIndex 
                  ? "bg-white w-6 shadow-sm" 
                  : "bg-white/50 w-1.5 hover:bg-white/80"
              )}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(index);
              }}
            />
          ))}
        </div>

        {/* Counter badge */}
        <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white text-[11px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-white/10">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      {/* Fullscreen Dialog */}
      <Dialog open={fullscreenOpen} onOpenChange={setFullscreenOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/98 border-none rounded-[2.5rem] overflow-hidden animate-in zoom-in-95 duration-300 outline-none">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] z-50" />
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-6 right-6 z-50 text-white/70 hover:text-white hover:bg-white/10 rounded-2xl h-14 w-14 transition-all backdrop-blur-md"
            onClick={() => setFullscreenOpen(false)}
          >
            <X className="h-8 w-8" strokeWidth={2.5} />
          </Button>
          
          <div 
            className="relative flex items-center justify-center h-[90vh] p-4"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img
              src={images[currentIndex]}
              alt={`${alt} ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-[1.5rem] shadow-2xl transition-all duration-500"
            />
            
            {currentIndex > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-6 h-16 w-16 rounded-[2rem] text-white/70 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md group/nav"
                onClick={goToPrev}
              >
                <ChevronLeft className="h-10 w-10 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
              </Button>
            )}
            
            {currentIndex < images.length - 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-6 h-16 w-16 rounded-[2rem] text-white/70 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md group/nav"
                onClick={goToNext}
              >
                <ChevronRight className="h-10 w-10 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
              </Button>
            )}
            
            {/* Dots indicator */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-3 bg-black/30 backdrop-blur-xl px-6 py-3 rounded-full border border-white/10">
              {images.map((_, index) => (
                <button
                  key={index}
                  className={cn(
                    "h-2.5 rounded-full transition-all duration-500",
                    index === currentIndex 
                      ? "bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] w-10 shadow-[0_0_15px_rgba(131,58,180,0.5)]" 
                      : "bg-white/30 w-2.5 hover:bg-white/50"
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
