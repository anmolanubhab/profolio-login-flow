import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Play } from 'lucide-react';
import ImageCarousel from './ImageCarousel';

interface PostMediaProps {
  src: string | string[];
  mediaType: 'image' | 'video';
  alt?: string;
  isCompact?: boolean;
}

const PostMedia = ({ src, mediaType, alt = 'Post content', isCompact = false }: PostMediaProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  // Handle multi-image carousel
  if (Array.isArray(src)) {
    return <ImageCarousel images={src} alt={alt} />;
  }

  if (hasError) {
    return (
      <div className={cn(isCompact ? "mx-4 mb-4" : "w-full mb-4 sm:mb-6")}>
        <div className={cn(
          "w-full h-64 bg-[#F3F6F8] flex flex-col items-center justify-center text-[#5E6B7E] text-sm gap-4 border-0 sm:border sm:border-[#E8EBEF]/60",
          isCompact && "h-48"
        )}>
          <div className="p-4 bg-white rounded-2xl shadow-sm">
            <svg className="w-8 h-8 text-[#833AB4]/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-black uppercase tracking-wider text-[11px]">Media unavailable</span>
        </div>
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className={cn(isCompact ? "mx-4 mb-4" : "w-full mb-4 sm:mb-6")}>
        <div className={cn(
          "relative w-full bg-[#1D2226] flex items-center justify-center overflow-hidden group/video shadow-none sm:shadow-lg",
          isCompact && ""
        )}>
          <video
            src={src as string}
            controls
            className="w-full max-h-[600px] object-contain mx-auto block max-w-none transition-transform duration-700 group-hover/video:scale-[1.02]"
            preload="metadata"
            onError={() => setHasError(true)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          {/* Video overlay when not playing */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300">
              <div className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-xl flex items-center justify-center shadow-2xl border border-white/20 group-hover/video:scale-110 transition-transform duration-500">
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#0077B5] via-[#833AB4] to-[#E1306C] flex items-center justify-center shadow-xl">
                  <Play className="w-6 h-6 text-white ml-1 fill-white" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn(isCompact ? "mx-4 mb-4" : "w-full mb-4 sm:mb-6")}>
      <div className={cn(
        "relative w-full overflow-hidden flex items-center justify-center bg-[#F3F6F8]/50 group/media border-0 sm:border sm:border-[#E8EBEF]/40 shadow-none sm:shadow-sm",
        isCompact && ""
      )}>
        {isLoading && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#F3F6F8] via-white to-[#F3F6F8] animate-pulse" />
        )}
        <img
          src={src as string}
          alt={alt}
          className={cn(
            "w-full h-auto max-h-[700px] object-cover block max-w-none transition-all duration-700 mx-auto group-hover/media:scale-105",
            isLoading ? "opacity-0 scale-105" : "opacity-100 scale-100"
          )}
          loading="lazy"
          onLoad={() => setIsLoading(false)}
          onError={() => {
            setIsLoading(false);
            setHasError(true);
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover/media:opacity-100 transition-opacity duration-700 pointer-events-none" />
        <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/5 transition-colors duration-700" />
      </div>
    </div>
  );
};

export default PostMedia;
