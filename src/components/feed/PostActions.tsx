import { ThumbsUp, MessageSquare, Repeat2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PostActionsProps {
  isLiked: boolean;
  onLike: () => void;
  onComment: () => void;
  onRepost?: () => void;
  onShare: () => void;
}

const PostActions = ({ isLiked, onLike, onComment, onRepost, onShare }: PostActionsProps) => {
  const actionButtonClass = cn(
    "flex-1 flex items-center justify-center gap-2",
    "py-3.5 min-h-[52px]",
    "rounded-[1.5rem] text-[14px] font-bold",
    "transition-all duration-300 transform active:scale-95",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#833AB4]/30"
  );
  
  return (
    <div className="border-t border-[#E8EBEF]/60">
      <div className="flex items-center px-2 py-1 gap-1">
        {/* Like Button */}
        <button
          onClick={onLike}
          className={cn(
            actionButtonClass,
            isLiked 
              ? "bg-gradient-to-r from-[#0077B5]/10 to-[#E1306C]/10 text-[#833AB4]" 
              : "text-[#5E6B7E] hover:bg-gray-50 hover:text-[#1D2226]"
          )}
        >
          <ThumbsUp className={cn("w-5 h-5 transition-all duration-300", isLiked ? "fill-[#833AB4] text-[#833AB4] scale-110" : "group-hover:scale-110")} strokeWidth={2.5} />
          <span className="hidden sm:inline">Like</span>
        </button>
        
        {/* Comment Button */}
        <button
          onClick={onComment}
          className={cn(actionButtonClass, "text-[#5E6B7E] hover:bg-gray-50 hover:text-[#1D2226]")}
        >
          <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
          <span className="hidden sm:inline">Comment</span>
        </button>
        
        {/* Repost Button */}
        <button
          onClick={onRepost}
          className={cn(actionButtonClass, "text-[#5E6B7E] hover:bg-gray-50 hover:text-[#1D2226]")}
        >
          <Repeat2 className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" strokeWidth={2.5} />
          <span className="hidden sm:inline">Repost</span>
        </button>
        
        {/* Send/Share Button */}
        <button
          onClick={onShare}
          className={cn(actionButtonClass, "text-[#5E6B7E] hover:bg-gray-50 hover:text-[#1D2226]")}
        >
          <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" strokeWidth={2.5} />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );
};

export default PostActions;
