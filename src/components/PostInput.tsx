import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Camera, FileText, User } from 'lucide-react';

interface PostInputProps {
  user?: {
    email?: string;
    avatar?: string;
  };
}

const PostInput = ({ user }: PostInputProps) => {
  const [postContent, setPostContent] = useState('');

  const handlePost = () => {
    if (postContent.trim()) {
      // Handle post submission
      console.log('Posting:', postContent);
      setPostContent('');
    }
  };

  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        {/* Post Input Area */}
        <div className="flex gap-3 mb-4">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-muted">
              {user?.email?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <Textarea
              placeholder="What's on your mind?"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              className="min-h-[60px] resize-none border-0 bg-muted/50 placeholder:text-muted-foreground focus-visible:ring-1"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
            <Camera className="h-4 w-4 mr-2" />
            Photo
          </Button>
          
          <Button variant="outline" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
            <FileText className="h-4 w-4 mr-2" />
            Document
          </Button>
        </div>

        {postContent.trim() && (
          <Button onClick={handlePost} className="w-full mt-3">
            Post
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default PostInput;