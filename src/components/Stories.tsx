import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, ChevronLeft, ChevronRight, Heart, MessageCircle, Send, MoreVertical, Edit2, Play, Pause, Trash2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  expires_at: string;
  caption?: string | null;
  profile?: {
    display_name: string;
    avatar_url: string;
  };
}

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

const Stories = () => {
  const { user: currentUser } = useAuth();
  const [stories, setStories] = useState<Story[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [selectedStoryGroup, setSelectedStoryGroup] = useState<Story[] | null>(null);
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  
  // Interaction states
  const [isLiked, setIsLiked] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editCaption, setEditCaption] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Touch state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [touchEndY, setTouchEndY] = useState<number | null>(null);

  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  
  const currentStory = selectedStoryGroup?.[currentStoryIndex];

  useEffect(() => {
    const controller = new AbortController();
    fetchStories(controller.signal);
    if (currentUser) {
      fetchUserProfile(controller.signal);
    }
    return () => controller.abort();
  }, [currentUser]);

  // Like state (local only - story_likes table doesn't exist yet)
  useEffect(() => {
    if (!currentStory) return;
    // Reset like state and reply text when story changes
    setIsLiked(false);
    setReplyText('');
  }, [currentStory]);

  // Story auto-advance timer
  useEffect(() => {
    if (!selectedStoryGroup || isPaused || showEditDialog) return;
    
    const duration = 5000; // 5 seconds per story
    const interval = 50;
    // Calculate elapsed time based on current progress to resume correctly
    let elapsed = (storyProgress / 100) * duration;
    
    const timer = setInterval(() => {
      elapsed += interval;
      setStoryProgress((elapsed / duration) * 100);
      
      if (elapsed >= duration) {
        handleNextStory();
      }
    }, interval);
    
    return () => clearInterval(timer);
  }, [selectedStoryGroup, currentStoryIndex, isPaused, showEditDialog]);

  const fetchUserProfile = async (signal?: AbortSignal) => {
    if (!currentUser) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url')
        .eq('user_id', currentUser.id)
        .abortSignal(signal)
        .maybeSingle();
      
      if (error) {
        if (error.code === 'ABORTED') return;
        throw error;
      }
      setCurrentUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchStories = async (signal?: AbortSignal) => {
    try {
      const { data, error } = await supabase
        .from('stories')
        .select(`
          id,
          user_id,
          media_url,
          media_type,
          created_at,
          expires_at,
          caption,
          profile:profiles!stories_user_id_fkey(display_name, avatar_url)
        `)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return;
        throw error;
      }
      setStories(data as any || []);
    } catch (error) {
      if ((error as any).name === 'AbortError' || (error as any).code === 'ABORTED') return;
      console.error('Error fetching stories:', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    try {
      setUploading(true);
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('stories')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('stories')
        .getPublicUrl(fileName);

      const { error: insertError } = await supabase
        .from('stories')
        .insert({
          user_id: currentUser.id,
          media_url: publicUrl,
          media_type: file.type.startsWith('image/') ? 'image' : 'video',
        });

      if (insertError) throw insertError;

      toast({
        title: 'Story added',
        description: 'Your story is now visible to others.',
      });

      setShowUpload(false);
      fetchStories();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleStoryClick = async (userStories: Story[]) => {
    setSelectedStoryGroup(userStories);
    setCurrentStoryIndex(0);
    setStoryProgress(0);
    setIsPaused(false);
    
    // Record view if not own story
    if (currentUser && userStories[0]?.user_id !== currentUser.id) {
      await supabase.from('story_views').insert({
        story_id: userStories[0].id,
        viewer_id: currentUser.id,
      });
    }
  };

  const handleNextStory = () => {
    if (!selectedStoryGroup) return;
    
    setIsPaused(false); // Reset pause on navigation
    if (currentStoryIndex < selectedStoryGroup.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
      setStoryProgress(0);
    } else {
      setSelectedStoryGroup(null);
      setCurrentStoryIndex(0);
    }
  };

  const handlePrevStory = () => {
    if (currentStoryIndex > 0) {
      setIsPaused(false); // Reset pause on navigation
      setCurrentStoryIndex(prev => prev - 1);
      setStoryProgress(0);
    }
  };

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchEndY(null);
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || !touchStartY || !touchEndY) return;
    
    const distanceX = touchStart - touchEnd;
    const distanceY = touchStartY - touchEndY;
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;
    const isDownSwipe = distanceY < -minSwipeDistance;
    
    if (Math.abs(distanceX) > Math.abs(distanceY)) {
       if (isLeftSwipe) {
          handleNextStory();
       } else if (isRightSwipe) {
          handlePrevStory();
       }
    } else {
       if (isDownSwipe) {
          setSelectedStoryGroup(null);
       }
    }
  };

  const handleStoryViewerClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    
    // Center tap (40% width) toggles pause
    if (clickX > width * 0.3 && clickX < width * 0.7) {
      setIsPaused(!isPaused);
      return;
    }

    // Side taps navigate
    if (clickX > width * 0.7) {
      handleNextStory();
    } else {
      handlePrevStory();
    }
  };

  const handleEditStory = () => {
    // Edit functionality disabled - caption column doesn't exist in schema
    toast({
      title: "Edit not available",
      description: "Story editing is not supported yet.",
    });
  };

  const handleSaveEdit = async () => {
    // Save functionality disabled - caption column doesn't exist
    setShowEditDialog(false);
    setIsPaused(false);
  };

  const handleDeleteStory = async () => {
    if (!currentStory) return;
    
    try {
      setIsSaving(true);
      const { error } = await supabase
        .from('stories')
        .delete()
        .eq('id', currentStory.id);

      if (error) throw error;

      toast({ title: "Story deleted" });
      setShowEditDialog(false);
      
      // Remove from list
      const updatedGroup = selectedStoryGroup?.filter(s => s.id !== currentStory.id) || [];
      if (updatedGroup.length === 0) {
        setSelectedStoryGroup(null);
      } else {
        setSelectedStoryGroup(updatedGroup);
        if (currentStoryIndex >= updatedGroup.length) {
            setCurrentStoryIndex(Math.max(0, updatedGroup.length - 1));
        }
      }
      fetchStories(); // Refresh main list
    } catch (error: any) {
      toast({ 
        title: "Error deleting story", 
        description: error.message,
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLike = async () => {
    if (!currentStory || !currentUser) return;
    
    // Pause instantly
    setIsPaused(true);
    
    // Toggle like locally (story_likes table doesn't exist yet)
    const newLikeStatus = !isLiked;
    setIsLiked(newLikeStatus);
    
    // Show feedback
    toast({
      title: newLikeStatus ? "Liked!" : "Unliked",
      description: newLikeStatus ? "You liked this story" : "Like removed",
    });
  };

  const handleReplySubmit = () => {
    if (!replyText.trim()) return;
    
    // Mock send reply
    toast({
        title: "Reply sent",
        description: "Your message has been sent.",
    });
    
    setReplyText('');
    inputRef.current?.blur();
    // Story remains paused
  };

  // Group stories by user
  const groupedStories = stories.reduce((acc, story) => {
    const userId = story.user_id;
    if (!acc[userId]) {
      acc[userId] = {
        profile: story.profile,
        stories: [],
      };
    }
    acc[userId].stories.push(story);
    return acc;
  }, {} as Record<string, { profile: any; stories: Story[] }>);

  return (
    <>
      {/* Stories Row */}
      <div className="w-full mb-4 sm:mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mx-0 px-4 sm:px-0 lg:mx-0 lg:px-0">
          {/* Create Story Card - Facebook Style */}
          <div className="flex-shrink-0 relative w-[21vw] sm:w-[100px] aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer group shadow-none sm:shadow-sm border-0 sm:border border-[#E8EBEF]/60 bg-white transition-all duration-300 hover:scale-[1.02] hover:shadow-md" onClick={() => setShowUpload(true)}>
            {/* Top Image Section - 70% height */}
            <div className="h-[70%] w-full relative bg-[#F8FAFB]">
              {currentUserProfile?.avatar_url ? (
                <img 
                  src={currentUserProfile.avatar_url} 
                  alt="Profile" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0077B5]/10 to-[#833AB4]/10 text-[#833AB4] text-3xl font-bold">
                  {currentUserProfile?.display_name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors" />
            </div>
            
            {/* Bottom White Section - 30% height */}
            <div className="h-[30%] bg-white w-full relative flex flex-col items-center justify-end pb-2">
              {/* Floating Plus Button */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] border-[3px] border-white flex items-center justify-center shadow-lg z-10 group-hover:scale-110 transition-transform duration-300">
                <Plus className="w-4 h-4 text-white" strokeWidth={3} />
              </div>
              <span className="text-[11px] font-bold text-[#1D2226] leading-tight">Create story</span>
            </div>
          </div>

          {/* User Stories */}
          {Object.entries(groupedStories).map(([userId, data]) => {
            const firstStory = data.stories[0];
            const isCompany = false; // Placeholder for company check logic if available later
            
            return (
              <div 
                key={userId} 
                className="flex-shrink-0 relative w-[21vw] sm:w-[100px] aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer group shadow-none sm:shadow-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md"
                onClick={() => handleStoryClick(data.stories)}
              >
                {/* Background Media */}
                <div className="absolute inset-0 bg-zinc-100">
                  {firstStory.media_type === 'video' ? (
                    <video 
                      src={firstStory.media_url} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <img 
                      src={firstStory.media_url} 
                      alt="Story" 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  )}
                  {/* Dark Gradient Overlay for text readability */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
                </div>

                {/* Top Left Profile Avatar */}
                <div className={`absolute top-2 left-2 w-9 h-9 rounded-full p-[2px] bg-gradient-to-br from-[#0077B5] via-[#833AB4] to-[#E1306C] z-10 overflow-hidden shadow-lg transform transition-transform duration-300 group-hover:scale-110`}>
                   <div className="w-full h-full rounded-full border-[1.5px] border-white overflow-hidden bg-white">
                     <Avatar className="w-full h-full">
                       <AvatarImage src={data.profile?.avatar_url} className="object-cover" />
                       <AvatarFallback className="text-[10px] bg-gradient-to-br from-[#0077B5]/10 to-[#833AB4]/10 text-[#833AB4] font-bold">
                         {data.profile?.display_name?.charAt(0) || 'U'}
                       </AvatarFallback>
                     </Avatar>
                   </div>
                </div>

                {/* Company Badge (if applicable) */}
                {isCompany && (
                   <div className="absolute top-9 left-7 bg-blue-600 text-white text-[8px] px-1 rounded-sm shadow-sm z-20">
                     Company
                   </div>
                )}

                {/* User Name */}
                <div className="absolute bottom-2 left-2 right-2 z-10">
                  <span className="text-white text-[11px] font-semibold leading-tight drop-shadow-md line-clamp-2">
                    {data.profile?.display_name || 'User'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none rounded-[2.5rem] shadow-2xl">
          <div className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] h-2 w-full" />
          <div className="px-8 pt-8 pb-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold text-[#1D2226]">Create Story</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              <p className="text-[15px] text-[#5E6B7E] font-medium leading-relaxed">
                Share a photo or video that will be visible for 24 hours. Express yourself to your professional network.
              </p>
              <div className="relative group">
                <Input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="hidden"
                  id="story-upload"
                />
                <label
                  htmlFor="story-upload"
                  className="cursor-pointer flex flex-col items-center justify-center gap-4 p-12 rounded-[1.5rem] border-2 border-dashed border-[#E8EBEF] bg-[#F8FAFB] hover:border-[#833AB4]/50 hover:bg-[#833AB4]/5 transition-all duration-500 group"
                >
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#0077B5]/10 to-[#833AB4]/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                    <Plus className="h-10 w-10 text-[#833AB4]" />
                  </div>
                  <div className="text-center">
                    <span className="block text-[15px] font-bold text-[#1D2226] mb-1">
                      {uploading ? 'Uploading your story...' : 'Click to upload media'}
                    </span>
                    <span className="text-[13px] text-[#5E6B7E]">
                      Supports images and videos
                    </span>
                  </div>
                </label>
                {uploading && (
                  <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] rounded-[1.5rem] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-[#833AB4] border-t-transparent rounded-full animate-spin" />
                      <span className="text-[14px] font-bold text-[#833AB4]">Uploading...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Full-Screen Story Viewer */}
      <Dialog open={!!selectedStoryGroup} onOpenChange={(open) => {
        if (!open) {
            setSelectedStoryGroup(null);
            setIsPaused(false);
        }
      }}>
        <DialogContent 
            className="w-screen h-screen max-w-none m-0 p-0 bg-black border-none rounded-none flex flex-col focus:outline-none overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Story Viewer</DialogTitle>
          </DialogHeader>
          {currentStory && (
            <div 
              className="relative w-full h-full flex flex-col"
              onClick={handleStoryViewerClick}
            >
              {/* --- Top Area --- */}
              <div className="absolute top-0 left-0 right-0 z-30 p-4 pt-6 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none">
                {/* Progress Bars */}
                <div className="flex gap-1 mb-4 pointer-events-auto">
                  {selectedStoryGroup?.map((_, idx) => (
                    <div key={idx} className="flex-1 h-[2px] bg-white/30 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full bg-white transition-all duration-100 ease-linear",
                          idx < currentStoryIndex ? "w-full" : idx === currentStoryIndex ? "" : "w-0"
                        )}
                        style={idx === currentStoryIndex ? { width: `${storyProgress}%` } : undefined}
                      />
                    </div>
                  ))}
                </div>

                {/* Header Info */}
                <div className="flex items-center justify-between pointer-events-auto">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 ring-1 ring-white/50">
                        <AvatarImage src={currentStory.profile?.avatar_url} />
                        <AvatarFallback className="bg-muted text-xs">
                            {currentStory.profile?.display_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-semibold text-sm shadow-black drop-shadow-sm">
                                    {currentStory.profile?.display_name || 'User'}
                                </span>
                                <span className="text-white/60 text-xs font-normal">
                                    • {new Date(currentStory.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                         {/* Edit Icon (Only for own story) */}
                         {currentUser && currentStory.user_id === currentUser.id && (
                             <button 
                                onClick={(e) => { e.stopPropagation(); handleEditStory(); }}
                                className="text-white/90 hover:text-white transition-colors bg-black/20 p-2 rounded-full backdrop-blur-sm"
                             >
                                 <Edit2 className="w-4 h-4" />
                             </button>
                         )}
                         {/* Close Button */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedStoryGroup(null);
                            }}
                            className="text-white/90 hover:text-white transition-colors ml-2"
                          >
                            <X className="h-6 w-6" />
                          </button>
                    </div>
                </div>
              </div>

              {/* --- Center Content --- */}
              <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden">
                {currentStory.media_type === 'image' ? (
                  <img
                    src={currentStory.media_url}
                    alt="Story"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <video
                    src={currentStory.media_url}
                    autoPlay={!isPaused && !showEditDialog}
                    playsInline
                    className="w-full h-full object-contain"
                    onEnded={handleNextStory}
                    ref={(el) => {
                        if (el) {
                            if (isPaused || showEditDialog) el.pause();
                            else el.play().catch(() => {});
                        }
                    }}
                  />
                )}
                
                {/* Caption Overlay */}
                {currentStory.caption && (
                   <div className="absolute bottom-24 left-0 right-0 p-4 text-center z-20">
                      <span className="text-white text-lg font-medium bg-black/40 px-3 py-1 rounded-lg backdrop-blur-sm">
                        {currentStory.caption}
                      </span>
                   </div>
                )}

                {/* Pause Indicator */}
                {isPaused && !showEditDialog && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                        <div className="bg-black/50 p-4 rounded-full backdrop-blur-sm">
                            <Pause className="w-8 h-8 text-white fill-white" />
                        </div>
                    </div>
                )}
              </div>

              {/* --- Bottom Interaction Bar --- */}
              <div 
                className="absolute bottom-0 left-0 right-0 z-30 p-6 pb-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                  <div className="flex items-center gap-4 w-full max-w-2xl mx-auto">
                      {/* Like Button */}
                      <button 
                        onClick={handleLike}
                        className="group relative flex items-center justify-center w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 transition-all duration-300 active:scale-90 backdrop-blur-md"
                      >
                          <Heart className={cn("w-6 h-6 transition-all duration-300", isLiked ? "fill-[#E1306C] text-[#E1306C] scale-125" : "text-white group-hover:scale-110")} />
                          {isLiked && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E1306C] opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#E1306C]"></span>
                            </span>
                          )}
                      </button>

                      {/* Reply Input */}
                      <div className="relative flex-1 group">
                          <Input 
                            ref={inputRef}
                            placeholder="Type a message..." 
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onFocus={() => setIsPaused(true)}
                            onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit()}
                            className="bg-white/10 border border-white/20 rounded-[1.5rem] text-white placeholder:text-white/60 focus:border-white/40 focus:ring-0 focus:bg-white/15 pr-14 h-12 backdrop-blur-md transition-all duration-300 text-[15px]"
                          />
                          <button 
                            onClick={handleReplySubmit}
                            disabled={!replyText.trim()}
                            className={cn(
                              "absolute right-1.5 top-1/2 -translate-y-1/2 p-2.5 rounded-full transition-all duration-300",
                              replyText.trim() 
                                ? "bg-gradient-to-r from-[#0077B5] to-[#833AB4] text-white scale-100 opacity-100 shadow-lg" 
                                : "text-white/40 scale-90 opacity-0 pointer-events-none"
                            )}
                          >
                              <Send className="w-4 h-4" />
                          </button>
                      </div>
                  </div>
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={(e) => { e.stopPropagation(); handlePrevStory(); }}
                className={cn(
                    "absolute left-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-all duration-300 backdrop-blur-md border border-white/10 group active:scale-90",
                    currentStoryIndex === 0 && "opacity-0 pointer-events-none"
                )}
              >
                <ChevronLeft className="h-6 w-6 group-hover:-translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); handleNextStory(); }}
                className={cn(
                    "absolute right-6 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition-all duration-300 backdrop-blur-md border border-white/10 group active:scale-90",
                    !selectedStoryGroup || currentStoryIndex >= selectedStoryGroup.length - 1 ? "opacity-0 pointer-events-none" : ""
                )}
              >
                <ChevronRight className="h-6 w-6 group-hover:translate-x-0.5 transition-transform" />
              </button>

            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Story Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
          setShowEditDialog(open);
          if (!open) setIsPaused(false); // Resume on close
      }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-none rounded-[2.5rem] shadow-2xl">
          <div className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] h-2 w-full" />
          <div className="px-8 pt-8 pb-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-bold text-[#1D2226]">Edit Story</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
                <div className="space-y-3">
                    <label className="text-[14px] font-bold text-[#5E6B7E] px-1">Story Caption</label>
                    <Input 
                        value={editCaption}
                        onChange={(e) => setEditCaption(e.target.value)}
                        placeholder="Add a caption to your story..."
                        className="h-14 bg-[#F8FAFB] border-[#E8EBEF] rounded-[1.25rem] text-[15px] focus:ring-[#833AB4]/20 focus:border-[#833AB4] transition-all"
                    />
                </div>

                <div className="flex flex-col gap-3 pt-4">
                    <Button 
                        onClick={handleSaveEdit} 
                        disabled={isSaving}
                        className="h-14 rounded-[1.5rem] bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white font-bold text-[16px] shadow-lg shadow-[#833AB4]/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        {isSaving ? (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Saving...</span>
                          </div>
                        ) : "Save Changes"}
                    </Button>
                    
                    <Button 
                        variant="ghost"
                        onClick={handleDeleteStory}
                        disabled={isSaving}
                        className="h-14 rounded-[1.5rem] text-[#E1306C] hover:bg-[#E1306C]/5 font-bold text-[15px] gap-2 transition-all"
                    >
                        <Trash2 className="w-5 h-5" />
                        Delete Story
                    </Button>
                </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Stories;
