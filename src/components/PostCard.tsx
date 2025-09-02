import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    <Card className="mb-6 shadow-sm hover:shadow-md transition-all duration-300 border-0 bg-card/50 backdrop-blur-sm">
      <CardContent className="p-6">
        {/* Post Header */}
        <div className="flex items-center justify-between mb-4">
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
              <div className="font-semibold text-foreground group-hover:text-primary transition-colors duration-200">
                {user.name}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">{formatTimeAgo(timestamp)}</div>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted/50">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Post Content */}
        <div className="mb-4">
          <p className="text-sm leading-relaxed text-foreground/90">{content}</p>
        </div>

        {/* Post Image */}
        {image && (
          <div className="mb-4 rounded-xl overflow-hidden border border-border/50">
            <img 
              src={image} 
              alt="Post content" 
              className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-border/50 mb-4"></div>

        {/* Post Actions */}
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            className={`flex items-center gap-2 hover:bg-red-50 hover:text-red-600 transition-all duration-200 ${
              isLiked ? 'text-red-500 bg-red-50' : 'text-muted-foreground'
            }`}
            onClick={handleLike}
          >
            <Heart className={`h-4 w-4 transition-transform duration-200 hover:scale-110 ${isLiked ? 'fill-current' : ''}`} />
            <span className="text-xs font-medium">Like ({likes})</span>
          </Button>
          
          <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:bg-blue-50 hover:text-blue-600 transition-all duration-200">
            <MessageCircle className="h-4 w-4 transition-transform duration-200 hover:scale-110" />
            <span className="text-xs font-medium">Comment</span>
          </Button>
          
          <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:bg-green-50 hover:text-green-600 transition-all duration-200">
            <Share className="h-4 w-4 transition-transform duration-200 hover:scale-110" />
            <span className="text-xs font-medium">Share</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostCard;