import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, MessageCircle, Share, MoreHorizontal, User } from 'lucide-react';

interface PostCardProps {
  post: {
    id: string;
    user: {
      name: string;
      avatar?: string;
    };
    content: string;
    image?: string;
    timeAgo: string;
    likes: number;
    comments: number;
    isLiked?: boolean;
  };
}

const PostCard = ({ post }: PostCardProps) => {
  return (
    <Card className="mb-4">
      <CardContent className="p-4">
        {/* Post Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.user.avatar} />
              <AvatarFallback className="bg-muted">
                {post.user.name.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            
            <div>
              <div className="font-semibold text-sm">{post.user.name}</div>
              <div className="text-xs text-muted-foreground">{post.timeAgo}</div>
            </div>
          </div>
          
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        {/* Post Content */}
        <div className="mb-3">
          <p className="text-sm leading-relaxed">{post.content}</p>
        </div>

        {/* Post Image */}
        {post.image && (
          <div className="mb-3 rounded-lg overflow-hidden">
            <img 
              src={post.image} 
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
            className={`flex items-center gap-2 ${post.isLiked ? 'text-red-500' : 'text-muted-foreground'}`}
          >
            <Heart className={`h-4 w-4 ${post.isLiked ? 'fill-current' : ''}`} />
            <span className="text-xs">Like</span>
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