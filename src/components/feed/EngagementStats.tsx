import { ThumbsUp, Heart, Laugh, PartyPopper } from 'lucide-react';

interface EngagementStatsProps {
  likes: number;
  comments: number;
  reposts?: number;
  onCommentsClick?: () => void;
}

const EngagementStats = ({ likes, comments, reposts = 0, onCommentsClick }: EngagementStatsProps) => {
  const hasStats = likes > 0 || comments > 0 || reposts > 0;
  
  if (!hasStats) return null;
  
  return (
    <div className="px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
      {/* Reaction icons with count */}
      <div className="flex items-center gap-1">
        {likes > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-1">
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-white">
                <ThumbsUp className="w-2.5 h-2.5" />
              </span>
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white">
                <Heart className="w-2.5 h-2.5" />
              </span>
            </div>
            <span className="hover:text-primary hover:underline cursor-pointer">
              {likes.toLocaleString()}
            </span>
          </div>
        )}
      </div>
      
      {/* Comments and reposts */}
      <div className="flex items-center gap-3">
        {comments > 0 && (
          <button 
            onClick={onCommentsClick}
            className="hover:text-primary hover:underline"
          >
            {comments} {comments === 1 ? 'comment' : 'comments'}
          </button>
        )}
        {reposts > 0 && (
          <span className="hover:text-primary hover:underline cursor-pointer">
            {reposts} {reposts === 1 ? 'repost' : 'reposts'}
          </span>
        )}
      </div>
    </div>
  );
};

export default EngagementStats;
