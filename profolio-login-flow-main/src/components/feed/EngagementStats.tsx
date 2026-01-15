import { ThumbsUp, Heart } from 'lucide-react';

interface EngagementStatsProps {
  likes: number;
  comments: number;
  reposts?: number;
  onCommentsClick?: () => void;
}

const EngagementStats = ({ likes, comments, reposts = 0, onCommentsClick }: EngagementStatsProps) => {
  const hasStats = likes > 0 || comments > 0 || reposts > 0;
  
  if (!hasStats) return null;
  
  // Format large numbers
  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toLocaleString();
  };
  
  return (
    <div className="px-4 py-2.5 flex items-center justify-between text-[13px] text-muted-foreground">
      {/* Reaction icons with count */}
      <div className="flex items-center gap-1.5">
        {likes > 0 && (
          <div className="flex items-center gap-1.5 group cursor-pointer">
            <div className="flex -space-x-1.5">
              <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-primary text-white ring-2 ring-card">
                <ThumbsUp className="w-2.5 h-2.5" fill="currentColor" />
              </span>
              <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-red-500 text-white ring-2 ring-card">
                <Heart className="w-2.5 h-2.5" fill="currentColor" />
              </span>
            </div>
            <span className="group-hover:text-primary group-hover:underline transition-colors">
              {formatCount(likes)}
            </span>
          </div>
        )}
      </div>
      
      {/* Comments and reposts */}
      <div className="flex items-center gap-2 text-muted-foreground/80">
        {comments > 0 && (
          <button 
            onClick={onCommentsClick}
            className="hover:text-primary hover:underline transition-colors"
          >
            {formatCount(comments)} {comments === 1 ? 'comment' : 'comments'}
          </button>
        )}
        {comments > 0 && reposts > 0 && (
          <span className="text-muted-foreground/50">•</span>
        )}
        {reposts > 0 && (
          <span className="hover:text-primary hover:underline cursor-pointer transition-colors">
            {formatCount(reposts)} {reposts === 1 ? 'repost' : 'reposts'}
          </span>
        )}
      </div>
    </div>
  );
};

export default EngagementStats;
