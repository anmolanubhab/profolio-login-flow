import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Image, Video, FileText, MapPin, X } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const AddPost = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast({
        title: 'File too large',
        description: 'Image must be less than 10MB.',
        variant: 'destructive',
      });
      return;
    }

    // Clear video if selecting image
    if (selectedVideo) {
      removeVideo();
    }

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleVideoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      toast({
        title: 'Invalid video format',
        description: 'Please select an MP4 or WebM video file.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > MAX_VIDEO_SIZE) {
      toast({
        title: 'File too large',
        description: 'Video must be less than 100MB.',
        variant: 'destructive',
      });
      return;
    }

    // Clear image if selecting video
    if (selectedImage) {
      removeImage();
    }

    setSelectedVideo(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const removeVideo = () => {
    if (videoPreview) {
      URL.revokeObjectURL(videoPreview);
    }
    setSelectedVideo(null);
    setVideoPreview(null);
    if (videoInputRef.current) {
      videoInputRef.current.value = '';
    }
  };

  const uploadMedia = async (userId: string): Promise<{ url: string; mediaType: 'image' | 'video' } | null> => {
    if (selectedImage) {
      const fileExt = selectedImage.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(fileName, selectedImage);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('post-images')
        .getPublicUrl(fileName);

      return { url: urlData.publicUrl, mediaType: 'image' };
    }

    if (selectedVideo) {
      const fileExt = selectedVideo.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      // Upload with progress tracking
      setUploadProgress(0);
      
      const { error: uploadError } = await supabase.storage
        .from('post-videos')
        .upload(fileName, selectedVideo, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Simulate progress (Supabase JS doesn't provide real progress)
      setUploadProgress(100);

      const { data: urlData } = supabase.storage
        .from('post-videos')
        .getPublicUrl(fileName);

      return { url: urlData.publicUrl, mediaType: 'video' };
    }

    return null;
  };

  const handlePost = async (isDraft = false) => {
    if (!content.trim() && !selectedImage && !selectedVideo && !isDraft) {
      toast({
        title: 'Validation Error',
        description: 'Please enter some content or add media to your post',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let mediaUrl: string | null = null;
      let mediaType: string = 'image';

      // Upload media if selected
      if (selectedImage || selectedVideo) {
        setUploadProgress(10);
        const mediaResult = await uploadMedia(user.id);
        if (mediaResult) {
          mediaUrl = mediaResult.url;
          mediaType = mediaResult.mediaType;
        }
      }

      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: content,
        image_url: mediaUrl,
        media_type: mediaType,
        status: isDraft ? 'draft' : 'published',
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: isDraft ? 'Draft saved successfully!' : 'Post published successfully!',
      });

      setContent('');
      removeImage();
      removeVideo();
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Post error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create post',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const hasContent = content.trim() || selectedImage || selectedVideo;

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-xl font-bold">Create Post</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Share an update</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea 
              placeholder="What do you want to talk about?" 
              className="min-h-32 resize-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={loading}
            />

            {/* Image Preview */}
            {imagePreview && (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="max-h-64 w-full object-cover rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full"
                  onClick={removeImage}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Video Preview */}
            {videoPreview && (
              <div className="relative">
                <video
                  src={videoPreview}
                  controls
                  className="max-h-64 w-full rounded-lg"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8 rounded-full"
                  onClick={removeVideo}
                  disabled={loading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Upload Progress */}
            {loading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Uploading...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Hidden file inputs */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/webm"
              onChange={handleVideoSelect}
              className="hidden"
            />
            
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => imageInputRef.current?.click()}
                disabled={loading || !!selectedVideo}
              >
                <Image className="h-4 w-4 mr-2" />
                Photo
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => videoInputRef.current?.click()}
                disabled={loading || !!selectedImage}
              >
                <Video className="h-4 w-4 mr-2" />
                Video
              </Button>
              <Button variant="ghost" size="sm" disabled={loading}>
                <FileText className="h-4 w-4 mr-2" />
                Document
              </Button>
              <Button variant="ghost" size="sm" disabled={loading}>
                <MapPin className="h-4 w-4 mr-2" />
                Location
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => handlePost(true)}
                disabled={loading || !hasContent}
              >
                {loading ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button 
                onClick={() => handlePost(false)}
                disabled={loading || !hasContent}
              >
                {loading ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default AddPost;
