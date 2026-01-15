import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PostContentProps {
  content: string;
  maxLength?: number;
}

const PostContent = ({ content, maxLength = 280 }: PostContentProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = content.length > maxLength;
  
  const displayContent = shouldTruncate && !isExpanded 
    ? content.slice(0, maxLength).trim() + '...'
    : content;

  // Convert URLs to clickable links
  const renderContent = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      if (urlRegex.test(part)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  // Convert hashtags to styled text
  const renderWithHashtags = (text: string) => {
    const hashtagRegex = /(#\w+)/g;
    const parts = text.split(hashtagRegex);
    
    return parts.map((part, index) => {
      if (hashtagRegex.test(part)) {
        return (
          <span key={index} className="text-primary font-medium cursor-pointer hover:underline">
            {part}
          </span>
        );
      }
      return renderContent(part);
    });
  };

  return (
    <div className="px-4 pb-3">
      <p className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap break-words text-left">
        {renderWithHashtags(displayContent)}
      </p>
      
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-muted-foreground/80 hover:text-primary text-[14px] font-medium mt-1.5 transition-colors"
        >
          {isExpanded ? '...show less' : '...see more'}
        </button>
      )}
    </div>
  );
};

export default PostContent;
