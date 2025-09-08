import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Share, MoreHorizontal, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PostCardProps {
  id: string;
  user: {
    name: string;
    avatar?: string;
  };
  content: string;
  image?: string;
  timestamp: string;
  likes: number;
  onLike?: (isLiked: boolean) => void;
}

const PostCard = ({ id, user, content, image, timestamp, likes, onLike }: PostCardProps) => {
  const [isLiked, setIsLiked] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setCurrentUser(authUser);
    };
    checkUser();
  }, []);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - postTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    onLike?.(!isLiked);
  };

  const handleProfileClick = () => {
    navigate('/profile');
  };

  return (
    <div className="post-card">
      <div className="post-header">
        <div 
          className="flex items-center gap-4 cursor-pointer group"
          onClick={handleProfileClick}
        >
          <div className="relative">
            <Avatar className="h-12 w-12 ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all duration-300 group-hover:scale-105">
              <AvatarImage src={user.avatar} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                {user.name.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="flex-1">
            <div className="post-title group-hover:text-primary transition-colors duration-200">
              {user.name}
            </div>
            <div className="post-meta mt-0.5">{formatTimeAgo(timestamp)}</div>
          </div>

          <button className="menu-button">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="post-body">
        <p>{content}</p>
      </div>

      {image && (
        <div className="px-4 sm:px-5">
          <div className="rounded-xl overflow-hidden border border-border/50 mb-4">
            <img 
              src={image} 
              alt="Post content" 
              className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>
      )}

      <div className="post-divider" />

      <div className="post-actions">
        <button className={`action-btn ${isLiked ? 'text-red-500 bg-red-50' : ''}`} onClick={handleLike}>
          <Heart className={`icon ${isLiked ? 'fill-current' : ''}`} />
          <span>Like</span>
          <span>({likes})</span>
        </button>
        <button className="action-btn">
          <MessageCircle className="icon" />
          <span>Comment</span>
        </button>
        <button className="action-btn">
          <Share className="icon" />
          <span>Share</span>
        </button>
      </div>
    </div>
  );
};

export default PostCard;