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
    "py-3 min-h-[48px]", // Touch-friendly height
    "rounded-lg text-[13px] font-medium",
    "transition-all duration-200",
    "hover:bg-secondary/80 active:scale-[0.97]",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
  );
  
  return (
    <div className="border-t border-border/60">
      <div className="flex items-center px-1 py-0.5">
        {/* Like Button */}
        <button
          onClick={onLike}
          className={cn(
            actionButtonClass,
            isLiked 
              ? "text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ThumbsUp className={cn("w-5 h-5 transition-transform", isLiked && "fill-current scale-110")} />
          <span className="hidden sm:inline">Like</span>
        </button>
        
        {/* Comment Button */}
        <button
          onClick={onComment}
          className={cn(actionButtonClass, "text-muted-foreground hover:text-foreground")}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="hidden sm:inline">Comment</span>
        </button>
        
        {/* Repost Button */}
        <button
          onClick={onRepost}
          className={cn(actionButtonClass, "text-muted-foreground hover:text-foreground")}
        >
          <Repeat2 className="w-5 h-5" />
          <span className="hidden sm:inline">Repost</span>
        </button>
        
        {/* Send/Share Button */}
        <button
          onClick={onShare}
          className={cn(actionButtonClass, "text-muted-foreground hover:text-foreground")}
        >
          <Send className="w-5 h-5" />
          <span className="hidden sm:inline">Send</span>
        </button>
      </div>
    </div>
  );
};

export default PostActions;
