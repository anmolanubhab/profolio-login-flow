import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PostContentProps {
  content: string;
  maxLength?: number;
  className?: string;
  isCompact?: boolean;
}

const PostContent = ({ content, maxLength = 280, className, isCompact = false }: PostContentProps) => {
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
            className="text-[#0077B5] hover:text-[#0077B5]/80 font-medium hover:underline break-all transition-colors"
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
          <span key={index} className="text-[#833AB4] font-bold cursor-pointer hover:text-[#833AB4]/80 transition-colors">
            {part}
          </span>
        );
      }
      return renderContent(part);
    });
  };

  return (
    <div className={cn(
      isCompact ? "px-4 pb-3" : "px-4 sm:px-8 pb-4 sm:pb-6",
      "group/content",
      className
    )}>
      <p className={cn(
        isCompact ? "text-[15px] leading-[1.5]" : "text-[17px] leading-[1.6]",
        "text-[#1D2226] whitespace-pre-wrap break-words text-left font-medium tracking-tight group-hover/content:text-black transition-colors duration-500"
      )}>
        {renderWithHashtags(displayContent)}
      </p>
      
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[#5E6B7E] hover:text-[#833AB4] text-[14px] font-black uppercase tracking-widest mt-3 transition-all duration-300 flex items-center gap-1 group/more"
        >
          <span>{isExpanded ? 'Show less' : 'See more'}</span>
          <div className="h-px w-0 group-hover/more:w-4 bg-gradient-to-r from-[#833AB4] to-[#E1306C] transition-all duration-300" />
        </button>
      )}
    </div>
  );
};

export default PostContent;
