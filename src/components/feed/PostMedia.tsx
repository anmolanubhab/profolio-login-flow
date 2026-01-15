import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';
import ImageCarousel from './ImageCarousel';

interface PostMediaProps {
  src: string | string[];
  mediaType: 'image' | 'video';
  alt?: string;
}

const PostMedia = ({ src, mediaType, alt = 'Post content' }: PostMediaProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Handle multi-image carousel
  if (Array.isArray(src)) {
    return <ImageCarousel images={src} alt={alt} />;
  }

  if (hasError) {
    return (
      <div className="w-full h-52 bg-muted/50 flex items-center justify-center text-muted-foreground text-sm border-y border-border/50">
        <span className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Media unavailable
        </span>
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className="relative w-full bg-black/95 flex items-center justify-center">
        <video
          src={src}
          controls
          className="w-full max-h-[480px] object-contain mx-auto"
          preload="metadata"
          onError={() => setHasError(true)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />
        {/* Video overlay when not playing */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center shadow-lg">
              <Play className="w-7 h-7 text-white ml-1" fill="white" />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-hidden flex items-center justify-center bg-muted/20">
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-muted/60 to-muted/40 animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        className={cn(
          "w-full h-auto max-h-[520px] object-contain transition-all duration-500 mx-auto",
          isLoading ? "opacity-0 scale-105" : "opacity-100 scale-100"
        )}
        loading="lazy"
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
};

export default PostMedia;
