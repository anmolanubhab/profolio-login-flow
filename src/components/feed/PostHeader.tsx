import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Globe, User, Building2 } from 'lucide-react';
import { PostOptionsMenu } from '@/components/PostOptionsMenu';
import { FollowButton } from '@/components/FollowButton';

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
  currentUserId?: string | null;
  isOwnPost: boolean;
  onDelete?: () => void;
  onHide?: () => void;
  // Company post props
  postedAs?: 'user' | 'company';
  companyId?: string | null;
  companyName?: string | null;
  companyLogo?: string | null;
}

const PostHeader = ({
  postId,
  user,
  timestamp,
  isPromoted,
  currentUserProfileId,
  currentUserId,
  isOwnPost,
  onDelete,
  onHide,
  postedAs = 'user',
  companyId,
  companyName,
  companyLogo,
}: PostHeaderProps) => {
  const navigate = useNavigate();
  const isCompanyPost = postedAs === 'company' && !!companyId;

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
    if (isCompanyPost && companyId) {
      navigate(`/company/${companyId}`);
    } else if (user.id) {
      navigate(`/profile/${user.id}`);
    }
  };

  // Determine display info based on post type
  const displayName = isCompanyPost ? companyName : user.name;
  const displayAvatar = isCompanyPost ? companyLogo : user.avatar;
  const displaySubtitle = isCompanyPost 
    ? `${user.name} • Company Page` 
    : user.subtitle;

  return (
    <div className="px-8 pt-8 pb-4 flex items-start gap-5 animate-in fade-in slide-in-from-top-2 duration-500">
      {/* Avatar */}
      <div 
        className="cursor-pointer flex-shrink-0 group/avatar relative"
        onClick={handleProfileClick}
      >
        <div className="absolute -inset-1 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] rounded-[1.5rem] opacity-0 group-hover/avatar:opacity-100 blur-md transition duration-500" />
        <Avatar className={`h-14 w-14 ring-4 ring-white shadow-xl relative transition-all duration-500 transform group-hover/avatar:scale-110 ${isCompanyPost ? 'rounded-2xl' : 'rounded-[1.25rem]'}`}>
          <AvatarImage src={displayAvatar || undefined} className="object-cover" />
          <AvatarFallback className={`bg-gradient-to-br from-[#0077B5]/10 via-[#833AB4]/10 to-[#E1306C]/10 text-[#833AB4] font-black text-xl ${isCompanyPost ? 'rounded-2xl' : 'rounded-[1.25rem]'}`}>
            {isCompanyPost ? (
              <Building2 className="h-6 w-6" />
            ) : (
              displayName?.charAt(0).toUpperCase() || <User className="h-6 w-6" />
            )}
          </AvatarFallback>
        </Avatar>
      </div>

      {/* User/Company info */}
      <div className="flex-1 min-w-0 pt-1">
        <div 
          className="cursor-pointer group/info"
          onClick={handleProfileClick}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-black text-[#1D2226] text-[18px] leading-tight group-hover/info:text-transparent group-hover/info:bg-clip-text group-hover/info:bg-gradient-to-r group-hover/info:from-[#0077B5] group-hover/info:to-[#833AB4] transition-all duration-300 truncate tracking-tight">
              {displayName || 'Unknown'}
            </h4>
            {isCompanyPost && (
              <Badge className="text-[10px] px-2.5 py-0.5 h-5 bg-gradient-to-r from-[#0077B5] to-[#833AB4] text-white border-0 font-black uppercase tracking-widest rounded-full shadow-sm">
                Company
              </Badge>
            )}
            {/* Follow button - show only for user posts when not own post */}
            {!isOwnPost && !isCompanyPost && user.id && (
              <FollowButton 
                targetProfileId={user.id}
                targetName={user.name}
                size="sm"
                variant="ghost"
                showText={false}
                className="h-8 w-8 p-0 ml-1 rounded-xl hover:bg-gradient-to-br hover:from-[#0077B5]/10 hover:to-[#833AB4]/10 hover:text-[#833AB4] transition-all duration-500"
              />
            )}
          </div>
          {displaySubtitle && (
            <p className="text-[14px] font-bold text-[#5E6B7E] truncate mt-1 leading-tight tracking-tight opacity-90">
              {displaySubtitle}
            </p>
          )}
          <div className="flex items-center gap-2 text-[12px] font-black text-[#5E6B7E]/60 mt-2 uppercase tracking-widest">
            <span className="hover:text-[#1D2226] transition-colors">{formatTimeAgo(timestamp)}</span>
            <span className="text-[#5E6B7E]/20 text-[10px]">•</span>
            <Globe className="w-3.5 h-3.5" strokeWidth={2.5} />
            {isPromoted && (
              <>
                <span className="text-[#5E6B7E]/20 text-[10px]">•</span>
                <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 h-5 border-[#833AB4]/30 text-[#833AB4] rounded-full bg-white shadow-sm">
                  Promoted
                </Badge>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Options Menu */}
      <PostOptionsMenu
        postId={postId}
        postUserId={user.id || ''}
        postUserName={user.name}
        currentUserProfileId={currentUserProfileId}
        currentUserId={currentUserId}
        isOwnPost={isOwnPost}
        onDelete={onDelete}
        onHide={onHide}
        isPromoted={isPromoted}
        isCompanyPost={isCompanyPost}
      />
    </div>
  );
};

export default PostHeader;
