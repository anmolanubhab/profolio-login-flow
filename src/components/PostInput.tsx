import { useState, useRef } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Camera, FileText, User, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
    
    setIsPosting(true);
    try {
      let imageUrl = null;
      
      // Upload image if selected
      if (selectedImage && user?.email) {
        const fileName = `${Date.now()}-${selectedImage.name}`;
        const filePath = `${user.email}/${fileName}`;
        
        const { error: uploadError } = await supabase.storage
          .from('post-images')
          .upload(filePath, selectedImage);
          
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('post-images')
          .getPublicUrl(filePath);
          
        imageUrl = publicUrl;
      }
      
      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('User not authenticated');
      
      // Create post
      const { error } = await supabase
        .from('posts')
        .insert({
          content: postContent.trim(),
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

        {/* Image Preview */}
        {imagePreview && (
          <div className="mb-4 relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="max-h-64 w-full object-cover rounded-lg"
            />
            <Button
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2 h-8 w-8"
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

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPosting}
          >
            <Camera className="h-4 w-4 mr-2" />
            Photo
          </Button>
          
          <Button variant="outline" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
            <FileText className="h-4 w-4 mr-2" />
            Document
          </Button>
        </div>

        {(postContent.trim() || selectedImage) && (
          <Button 
            onClick={handlePost} 
            className="w-full mt-3"
            disabled={isPosting}
          >
            {isPosting ? "Posting..." : "Post"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default PostInput;