import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Globe, User } from 'lucide-react';
import { PostOptionsMenu } from '@/components/PostOptionsMenu';

interface PostHeaderProps {
  postId: string;
  user: {
    id?: string;
    name: string;
    avatar?: string;
    subtitle?: string;
  };
  timestamp: string;
  isPromoted?: boolean;
  currentUserProfileId: string | null;
  isOwnPost: boolean;
  onDelete?: () => void;
  onHide?: () => void;
}

const PostHeader = ({
  postId,
  user,
  timestamp,
  isPromoted,
  currentUserProfileId,
  isOwnPost,
  onDelete,
  onHide,
}: PostHeaderProps) => {
  const navigate = useNavigate();

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - postTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    return `${diffInWeeks}w`;
  };

  const handleProfileClick = () => {
    if (user.id) {
      navigate(`/profile/${user.id}`);
    }
  };

  return (
    <div className="px-4 pt-3 pb-2 flex items-start gap-3">
      {/* Avatar */}
      <div 
        className="cursor-pointer flex-shrink-0"
        onClick={handleProfileClick}
      >
        <Avatar className="h-12 w-12 ring-2 ring-white shadow-sm hover:ring-primary/20 transition-all duration-200">
          <AvatarImage src={user.avatar} className="object-cover" />
          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold text-lg">
            {user.name.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* User info */}
      <div className="flex-1 min-w-0 pt-0.5">
        <div 
          className="cursor-pointer group"
          onClick={handleProfileClick}
        >
          <h4 className="font-semibold text-foreground text-[15px] leading-5 group-hover:text-primary group-hover:underline decoration-primary/50 transition-colors truncate">
            {user.name}
          </h4>
          {user.subtitle && (
            <p className="text-[13px] text-muted-foreground/80 truncate mt-0.5 leading-4">
              {user.subtitle}
            </p>
          )}
          <div className="flex items-center gap-1 text-[12px] text-muted-foreground/70 mt-1">
            <span>{formatTimeAgo(timestamp)}</span>
            <span className="text-muted-foreground/50">•</span>
            <Globe className="w-3 h-3" />
            {isPromoted && (
              <>
                <span className="text-muted-foreground/50">•</span>
                <Badge variant="outline" className="text-[10px] font-normal px-1.5 py-0 h-4 border-muted-foreground/30 text-muted-foreground/70">
                  Promoted
                </Badge>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Options menu */}
      <PostOptionsMenu
        postId={postId}
        postUserId={user.id || ''}
        postUserName={user.name}
        currentUserProfileId={currentUserProfileId}
        isOwnPost={isOwnPost}
        onDelete={onDelete}
        onHide={onHide}
      />
    </div>
  );
};

export default PostHeader;
