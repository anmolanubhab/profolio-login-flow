import { useState, useEffect } from 'react';
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

  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        {/* Post Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar} />
              <AvatarFallback className="bg-muted">
                {user.name.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <div className="font-semibold text-sm">{user.name}</div>
              <div className="text-xs text-muted-foreground">{formatTimeAgo(timestamp)}</div>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Post Content */}
        <div className="mb-3">
          <p className="text-sm leading-relaxed">{content}</p>
        </div>

        {/* Post Image */}
        {image && (
          <div className="mb-3 rounded-lg overflow-hidden">
            <img 
              src={image} 
              alt="Post content" 
              className="w-full h-auto object-cover"
            />
          </div>
        )}

        {/* Post Actions */}
        <div className="flex items-center gap-4 pt-2 border-t">
          <Button 
            variant="ghost" 
            size="sm" 
            className={`flex items-center gap-2 ${isLiked ? 'text-red-500' : 'text-muted-foreground'}`}
            onClick={handleLike}
          >
            <Heart className={`h-4 w-4 ${isLiked ? 'fill-current' : ''}`} />
            <span className="text-xs">Like ({likes})</span>
          </Button>
          
          <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground">
            <MessageCircle className="h-4 w-4" />
            <span className="text-xs">Comment</span>
          </Button>
          
          <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground">
            <Share className="h-4 w-4" />
            <span className="text-xs">Share</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostCard;