import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Image as ImageIcon, Video, Clock, Sparkles, Plus, Globe, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm'];
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

const AddPost = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch user profile for avatar
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const displayName = profile?.display_name || profile?.full_name || user?.email?.split("@")[0] || "User";
  const avatarUrl = profile?.avatar_url;

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please select an image file.', variant: 'destructive' });
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast({ title: 'File too large', description: 'Image must be less than 10MB.', variant: 'destructive' });
      return;
    }

    if (selectedVideo) removeVideo();

    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleVideoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
      toast({ title: 'Invalid video format', description: 'Please select an MP4 or WebM video file.', variant: 'destructive' });
      return;
    }

    if (file.size > MAX_VIDEO_SIZE) {
      toast({ title: 'File too large', description: 'Video must be less than 100MB.', variant: 'destructive' });
      return;
    }

    if (selectedImage) removeImage();

    setSelectedVideo(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const removeVideo = () => {
    if (videoPreview) URL.revokeObjectURL(videoPreview);
    setSelectedVideo(null);
    setVideoPreview(null);
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const uploadMedia = async (userId: string): Promise<{ url: string; mediaType: 'image' | 'video' } | null> => {
    if (selectedImage) {
      const fileExt = selectedImage.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('post-images').upload(fileName, selectedImage);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(fileName);
      return { url: urlData.publicUrl, mediaType: 'image' };
    }

    if (selectedVideo) {
      const fileExt = selectedVideo.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('post-videos').upload(fileName, selectedVideo, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('post-videos').getPublicUrl(fileName);
      return { url: urlData.publicUrl, mediaType: 'video' };
    }
    return null;
  };

  const handlePost = async () => {
    if (!content.trim() && !selectedImage && !selectedVideo) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      let mediaUrl: string | null = null;
      let mediaType: string = 'image';

      if (selectedImage || selectedVideo) {
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
        status: 'published',
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Post published successfully!' });
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Post error:', error);
      toast({ title: 'Error', description: error.message || 'Failed to create post', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const hasContent = content.trim().length > 0 || !!selectedImage || !!selectedVideo;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-3">
             <Avatar className="h-10 w-10">
              <AvatarImage src={avatarUrl || undefined} alt={displayName} />
              <AvatarFallback className="bg-gray-200 text-gray-600">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <button className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-full text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              <Globe className="h-3.5 w-3.5" />
              <span>Anyone</span>
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-gray-500 hover:text-gray-700 transition-colors">
            <Clock className="h-6 w-6" />
          </button>
          <Button 
            onClick={handlePost} 
            disabled={!hasContent || loading}
            className={`rounded-full px-4 py-1.5 h-8 font-semibold text-sm transition-all ${
              hasContent 
                ? 'bg-[#0a66c2] hover:bg-[#004182] text-white shadow-sm' 
                : 'bg-gray-100 text-gray-400 hover:bg-gray-100 cursor-not-allowed'
            }`}
          >
            {loading ? 'Posting...' : 'Post'}
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="flex-1 p-4">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share your thoughts..."
            className="w-full h-full min-h-[200px] border-none focus-visible:ring-0 resize-none text-lg p-0 placeholder:text-gray-500 leading-relaxed"
            style={{ boxShadow: 'none' }}
          />

          {/* Media Previews */}
          {(imagePreview || videoPreview) && (
            <div className="mt-4 relative rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
              {imagePreview && (
                <img src={imagePreview} alt="Preview" className="w-full h-auto max-h-[400px] object-contain" />
              )}
              {videoPreview && (
                <video src={videoPreview} controls className="w-full h-auto max-h-[400px]" />
              )}
              <button
                onClick={selectedImage ? removeImage : removeVideo}
                className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 pb-6 safe-area-bottom">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-600 font-medium text-sm transition-colors group">
            <Sparkles className="h-4 w-4 text-amber-500 group-hover:scale-110 transition-transform" />
            <span>Rewrite with AI</span>
          </button>
          
          <div className="flex items-center gap-2">
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
            
            <button 
              onClick={() => imageInputRef.current?.click()}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ImageIcon className="h-6 w-6" />
            </button>
            <button 
              onClick={() => videoInputRef.current?.click()}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Video className="h-6 w-6" />
            </button>
            <button className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
              <Plus className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPost;
