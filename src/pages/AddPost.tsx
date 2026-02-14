import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Image as ImageIcon, Video, Clock, Sparkles, Plus, Globe, ChevronDown, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';

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
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        if (error) {
          console.error("Profile fetch error:", error);
          return null;
        }
        return data;
      } catch (error) {
        console.error("Profile fetch error:", error);
        return null;
      }
    },
    enabled: !!user?.id,
  });

  const displayName = profile?.display_name || profile?.full_name || user?.email?.split("@")[0] || "User";
  const avatarUrl = profile?.avatar_url;

  const [viewportHeight, setViewportHeight] = useState(
    window.visualViewport?.height || window.innerHeight
  );

  useEffect(() => {
    const handleResize = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      } else {
        setViewportHeight(window.innerHeight);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      window.visualViewport.addEventListener("scroll", handleResize);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
        window.visualViewport.removeEventListener("scroll", handleResize);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, []);

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
              const errorMessage = error.message === 'Failed to fetch' 
                ? 'Network error: Unable to connect to server. Please check your internet connection.' 
                : (error.message || 'Failed to create post');
              
              toast({ 
                title: 'Error', 
                description: errorMessage, 
                variant: 'destructive' 
              });
            } finally {
      setLoading(false);
    }
  };

  const hasContent = content.trim().length > 0 || !!selectedImage || !!selectedVideo;

  return (
    <div 
      className="fixed inset-0 bg-white flex flex-col overflow-hidden"
      style={{ height: `${viewportHeight}px` }}
    >
      {/* Universal Page Hero Section (Subtle version for editor) */}
      <div className="relative w-full overflow-hidden border-b border-gray-100 flex-none">
        <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-5 animate-gradient-shift" />
        <header className="flex items-center justify-between px-6 py-4 relative z-50">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => navigate(-1)} 
              className="text-gray-400 hover:text-gray-900 transition-all hover:scale-110 p-2 hover:bg-gray-100 rounded-full"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="flex items-center gap-3">
               <Avatar className="h-12 w-12 rounded-2xl ring-4 ring-white shadow-sm">
                <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 font-bold">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-bold text-gray-900">{displayName}</span>
                <button className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-100/50 hover:bg-gray-100 border border-gray-200 rounded-full text-[10px] font-bold text-gray-500 transition-all uppercase tracking-wider w-fit">
                  <Globe className="h-3 w-3" />
                  <span>Public</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-[#833AB4] transition-all p-2 hover:bg-[#833AB4]/5 rounded-full">
              <Clock className="h-6 w-6" />
            </button>
            <Button 
              onClick={handlePost} 
              disabled={!hasContent || loading}
              className={`rounded-full px-8 h-12 font-bold text-base transition-all duration-300 shadow-lg ${
                hasContent 
                  ? 'bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white hover:opacity-90 shadow-[#833AB4]/20' 
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-100 cursor-not-allowed shadow-none'
              }`}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Publishing...</span>
                </div>
              ) : 'Post Now'}
            </Button>
          </div>
        </header>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto overscroll-y-contain bg-gray-50/30">
        <div className="max-w-3xl mx-auto py-8 px-0 sm:px-4 min-h-full">
          <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden min-h-[400px] flex flex-col">
            <CardContent className="px-4 py-6 sm:px-8 sm:pb-8 flex-1 flex flex-col">
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What's on your mind? Share an update, photo, or insight with your professional network..."
                className="w-full flex-1 border-none focus-visible:ring-0 resize-none text-xl p-0 placeholder:text-gray-300 leading-relaxed bg-transparent min-h-[200px]"
                style={{ boxShadow: 'none' }}
              />

              {/* Media Previews */}
              {(imagePreview || videoPreview) && (
                <div className="mt-8 relative rounded-[2rem] overflow-hidden bg-gray-50 border-2 border-gray-100 group">
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="w-full h-auto max-h-[500px] object-contain" />
                  )}
                  {videoPreview && (
                    <video src={videoPreview} controls className="w-full h-auto max-h-[500px]" />
                  )}
                  <button
                    onClick={selectedImage ? removeImage : removeVideo}
                    className="absolute top-4 right-4 p-2.5 bg-black/50 hover:bg-red-500 rounded-full text-white transition-all duration-300 shadow-lg backdrop-blur-md opacity-0 group-hover:opacity-100"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="flex-none bg-white border-t border-gray-100 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="relative p-[1px] rounded-full overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-50 group-hover:opacity-100 transition-opacity" />
            <button className="relative flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 rounded-full text-gray-700 font-bold text-sm transition-all">
              <Sparkles className="h-5 w-5 text-[#833AB4] group-hover:scale-125 transition-transform" />
              <span>AI Smart Write</span>
            </button>
          </div>
          
          <div className="flex items-center gap-3">
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
              className="p-3 text-gray-400 hover:text-[#0077B5] hover:bg-[#0077B5]/5 rounded-2xl transition-all"
              title="Add Image"
            >
              <ImageIcon className="h-7 w-7" />
            </button>
            <button 
              onClick={() => videoInputRef.current?.click()}
              className="p-3 text-gray-400 hover:text-[#833AB4] hover:bg-[#833AB4]/5 rounded-2xl transition-all"
              title="Add Video"
            >
              <Video className="h-7 w-7" />
            </button>
            <div className="w-px h-8 bg-gray-100 mx-2" />
            <button className="p-3 text-gray-400 hover:text-[#E1306C] hover:bg-[#E1306C]/5 rounded-2xl transition-all">
              <Plus className="h-7 w-7" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddPost;
