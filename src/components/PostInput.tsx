import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Camera, FileText, User, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';

interface PostInputProps {
  user?: {
    email?: string;
    avatar?: string;
  };
  onPostCreated?: () => void;
}

const PostInput = ({ user, onPostCreated }: PostInputProps) => {
  const [postContent, setPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file type",
          description: "Please select an image file.",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePost = async () => {
    if (!postContent.trim() && !selectedImage) return;
    
    // Rate limiting check
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      toast({
        title: "Authentication required",
        description: "Please log in to create a post.",
        variant: "destructive",
      });
      return;
    }

    if (rateLimiter.isRateLimited(`post_create_${currentUser.id}`, RATE_LIMITS.POST_CREATE)) {
      const resetTime = rateLimiter.getTimeUntilReset(`post_create_${currentUser.id}`);
      toast({
        title: "Rate limit exceeded",
        description: `Please wait ${Math.ceil(resetTime / 1000)} seconds before posting again.`,
        variant: "destructive",
      });
      return;
    }
    
    setIsPosting(true);
    try {
      let imageUrl = null;
      
      // Upload image if selected using secure upload
      if (selectedImage) {
        const { secureUpload } = await import('@/lib/secure-upload');
        const result = await secureUpload({
          bucket: 'post-images',
          file: selectedImage,
          userId: currentUser.id
        });

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }
        
        imageUrl = result.url;
      }
      
      // Sanitize content before storing
      const { sanitizeTextContent } = await import('@/lib/input-sanitizer');
      const sanitizedContent = sanitizeTextContent(postContent);
      
      // Create post
      const { error } = await supabase
        .from('posts')
        .insert({
          content: sanitizedContent,
          image_url: imageUrl,
          user_id: currentUser.id,
        });
        
      if (error) throw error;
      
      toast({
        title: "Post created!",
        description: "Your post has been shared successfully.",
      });
      
      setPostContent('');
      removeImage();
      onPostCreated?.();
      
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "Error creating post",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Card className="bg-white rounded-none sm:rounded-[2.5rem] border-0 sm:border border-gray-100 shadow-none sm:shadow-xl sm:shadow-gray-100/50 mb-4 sm:mb-6 overflow-hidden">
      <CardContent className="p-4 sm:p-6">
        {/* Post Input Area */}
        <div className="flex gap-3">
          <Avatar className="h-12 w-12 shrink-0 ring-2 ring-background">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {user?.email?.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>
          
          <button
            onClick={() => {
              const textarea = document.getElementById('post-textarea');
              if (textarea) textarea.focus();
            }}
            className="flex-1 h-12 px-4 text-left text-muted-foreground text-sm border border-border rounded-full hover:bg-secondary/50 transition-colors"
          >
            Start a post
          </button>
        </div>

        {/* Expanded input area when focused or has content */}
        {(postContent || selectedImage) && (
          <div className="mt-4">
            <Textarea
              id="post-textarea"
              placeholder="What do you want to talk about?"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              className="min-h-[100px] resize-none border-0 bg-transparent text-[15px] placeholder:text-muted-foreground focus-visible:ring-0 p-0"
              autoFocus
            />
          </div>
        )}

        {/* Image Preview */}
        {imagePreview && (
          <div className="mt-4 relative rounded-lg overflow-hidden">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-64 w-full object-cover"
            />
            <Button
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background"
              onClick={removeImage}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />

        {/* Action Buttons - Profolio style */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm"
              className="text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg h-10 px-3"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPosting}
            >
              <Camera className="h-5 w-5 text-primary" />
              <span className="hidden sm:inline ml-2 text-sm font-medium">Photo</span>
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm"
              className="text-muted-foreground hover:text-amber-600 hover:bg-amber-50 rounded-lg h-10 px-3"
            >
              <FileText className="h-5 w-5 text-amber-600" />
              <span className="hidden sm:inline ml-2 text-sm font-medium">Certificate</span>
            </Button>
          </div>

          <Button 
            onClick={handlePost} 
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5 h-9 text-sm font-semibold transition-all duration-200 disabled:opacity-40"
            disabled={isPosting || (!postContent.trim() && !selectedImage)}
          >
            {isPosting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Posting
              </span>
            ) : (
              "Post"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostInput;