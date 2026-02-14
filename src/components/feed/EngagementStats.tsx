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
    <div className="px-4 sm:px-8 py-3 sm:py-4 flex items-center justify-between text-[13px] font-bold text-[#5E6B7E] border-b border-[#E8EBEF]/40">
      {/* Reaction icons with count */}
      <div className="flex items-center gap-2">
        {likes > 0 && (
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="flex -space-x-2.5">
              <span className="inline-flex items-center justify-center w-[24px] h-[24px] rounded-full bg-gradient-to-br from-[#0077B5] to-[#0077B5]/80 text-white ring-2 ring-white shadow-md z-10 transition-transform group-hover:scale-110">
                <ThumbsUp className="w-3.5 h-3.5" fill="currentColor" strokeWidth={3} />
              </span>
              <span className="inline-flex items-center justify-center w-[24px] h-[24px] rounded-full bg-gradient-to-br from-[#E1306C] to-[#E1306C]/80 text-white ring-2 ring-white shadow-md z-0 transition-transform group-hover:scale-110 group-hover:z-20">
                <Heart className="w-3.5 h-3.5" fill="currentColor" strokeWidth={3} />
              </span>
            </div>
            <span className="group-hover:text-[#833AB4] transition-colors font-black tracking-tight">
              {formatCount(likes)}
            </span>
          </div>
        )}
      </div>
      
      {/* Comments and reposts */}
      <div className="flex items-center gap-3 text-[#5E6B7E]/90 font-bold">
        {comments > 0 && (
          <button 
            onClick={onCommentsClick}
            className="hover:text-[#833AB4] hover:underline underline-offset-4 transition-all"
          >
            {formatCount(comments)} {comments === 1 ? 'comment' : 'comments'}
          </button>
        )}
        {comments > 0 && reposts > 0 && (
          <span className="text-[#E8EBEF] font-black">•</span>
        )}
        {reposts > 0 && (
          <span className="hover:text-[#833AB4] hover:underline underline-offset-4 cursor-pointer transition-all">
            {formatCount(reposts)} {reposts === 1 ? 'repost' : 'reposts'}
          </span>
        )}
      </div>
    </div>
  );
};

export default EngagementStats;
