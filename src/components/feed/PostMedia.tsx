import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PostMediaProps {
  src: string;
  mediaType: 'image' | 'video';
  alt?: string;
}

const PostMedia = ({ src, mediaType, alt = 'Post content' }: PostMediaProps) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="w-full h-48 bg-muted flex items-center justify-center text-muted-foreground text-sm">
        Media unavailable
      </div>
    );
  }

  if (mediaType === 'video') {
    return (
      <div className="relative w-full bg-black">
        <video
          src={src}
          controls
          className="w-full max-h-[500px] object-contain"
          preload="metadata"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {isLoading && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      <img
        src={src}
        alt={alt}
        className={cn(
          "w-full h-auto object-cover transition-opacity duration-300",
          isLoading ? "opacity-0" : "opacity-100"
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
