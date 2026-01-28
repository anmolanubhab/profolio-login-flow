import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
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
  const [stories, setStories] = useState<Story[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
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
    fetchStories();
    getCurrentUser();
  }, []);

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

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
    
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url')
        .eq('user_id', user.id)
        .single();
      
      setCurrentUserProfile(profile);
    }
  };

  const fetchStories = async () => {
    try {
      const { data: storiesData, error } = await supabase
        .from('stories')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const userIds = [...new Set(storiesData?.map(s => s.user_id) || [])];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);

        const profileMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
        const enrichedStories = storiesData?.map(story => ({
          ...story,
          profile: profileMap.get(story.user_id),
        })) || [];

        setStories(enrichedStories);
      } else {
        setStories([]);
      }
    } catch (error: any) {
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
      <div className="w-full mb-2">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0">
          {/* Create Story Card - Facebook Style */}
          <div className="flex-shrink-0 relative w-[21vw] sm:w-[100px] aspect-[9/16] rounded-xl overflow-hidden cursor-pointer group shadow-sm border border-border/50 bg-card transition-transform hover:scale-[1.02]" onClick={() => setShowUpload(true)}>
            {/* Top Image Section - 70% height */}
            <div className="h-[70%] w-full relative bg-muted">
              {currentUserProfile?.avatar_url ? (
                <img 
                  src={currentUserProfile.avatar_url} 
                  alt="Profile" 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground text-3xl font-bold">
                  {currentUserProfile?.display_name?.charAt(0) || 'U'}
                </div>
              )}
              <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors" />
            </div>
            
            {/* Bottom White Section - 30% height */}
            <div className="h-[30%] bg-card w-full relative flex flex-col items-center justify-end pb-2">
              {/* Floating Plus Button */}
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-blue-600 border-[3px] border-card flex items-center justify-center shadow-sm z-10 group-hover:bg-blue-700 transition-colors">
                <Plus className="w-4 h-4 text-white" strokeWidth={3} />
              </div>
              <span className="text-[11px] font-semibold text-foreground/90 leading-tight">Create story</span>
            </div>
          </div>

          {/* User Stories */}
          {Object.entries(groupedStories).map(([userId, data]) => {
            const firstStory = data.stories[0];
            const isCompany = false; // Placeholder for company check logic if available later
            
            return (
              <div 
                key={userId} 
                className="flex-shrink-0 relative w-[21vw] sm:w-[100px] aspect-[9/16] rounded-xl overflow-hidden cursor-pointer group shadow-sm transition-transform hover:scale-[1.02]"
                onClick={() => handleStoryClick(data.stories)}
              >
                {/* Background Media */}
                <div className="absolute inset-0 bg-muted">
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
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
                </div>

                {/* Top Left Profile Avatar */}
                <div className={`absolute top-2 left-2 w-8 h-8 rounded-full p-[2px] ${isCompany ? 'bg-white' : 'bg-blue-600'} z-10 overflow-hidden ring-1 ring-black/10`}>
                   <div className="w-full h-full rounded-full border-2 border-transparent overflow-hidden bg-background">
                     <Avatar className="w-full h-full">
                       <AvatarImage src={data.profile?.avatar_url} className="object-cover" />
                       <AvatarFallback className="text-[10px] bg-muted">
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
        <DialogContent className="sm:max-w-md">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Create Story</h2>
            <p className="text-sm text-muted-foreground">
              Share a photo or video that will be visible for 24 hours.
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
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
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Plus className="h-8 w-8 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">
                  {uploading ? 'Uploading...' : 'Click to upload image or video'}
                </span>
              </label>
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
                className="absolute bottom-0 left-0 right-0 z-30 p-4 pb-6 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-auto"
                onClick={(e) => e.stopPropagation()}
              >
                  <div className="flex items-center gap-4 w-full max-w-3xl mx-auto">
                      {/* Like Button */}
                      <button 
                        onClick={handleLike}
                        className="text-white hover:scale-110 transition-transform active:scale-95"
                      >
                          <Heart className={cn("w-8 h-8 transition-colors", isLiked ? "fill-red-500 text-red-500" : "text-white")} />
                      </button>

                      {/* Reply Input */}
                      <div className="relative flex-1">
                          <Input 
                            ref={inputRef}
                            placeholder="Reply to story..." 
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onFocus={() => setIsPaused(true)}
                            onKeyDown={(e) => e.key === 'Enter' && handleReplySubmit()}
                            className="bg-transparent border border-white/30 rounded-full text-white placeholder:text-white/70 focus:border-white/80 focus:ring-0 pr-12 h-11 backdrop-blur-sm"
                          />
                          {replyText.trim() && (
                              <button 
                                onClick={handleReplySubmit}
                                className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-white hover:text-blue-400 transition-colors"
                              >
                                  <Send className="w-5 h-5" />
                              </button>
                          )}
                      </div>
                  </div>
              </div>

              {/* Navigation Arrows */}
              <button
                onClick={(e) => { e.stopPropagation(); handlePrevStory(); }}
                className={cn(
                    "absolute left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-all backdrop-blur-sm",
                    currentStoryIndex === 0 && "opacity-0 pointer-events-none"
                )}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); handleNextStory(); }}
                className={cn(
                    "absolute right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-white transition-all backdrop-blur-sm",
                    !selectedStoryGroup || currentStoryIndex >= selectedStoryGroup.length - 1 ? "opacity-0 pointer-events-none" : ""
                )}
              >
                <ChevronRight className="h-5 w-5" />
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
        <DialogContent className="sm:max-w-md bg-zinc-900 border-zinc-800 text-white">
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Edit Story</h2>
            
            <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Caption</label>
                <Input 
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    placeholder="Add a caption..."
                    className="bg-zinc-800 border-zinc-700 text-white"
                />
            </div>

            <div className="flex flex-col gap-2 pt-4">
                <Button 
                    onClick={handleSaveEdit} 
                    disabled={isSaving}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                    {isSaving ? "Saving..." : "Save Changes"}
                </Button>
                
                <Button 
                    variant="destructive"
                    onClick={handleDeleteStory}
                    disabled={isSaving}
                    className="w-full gap-2"
                >
                    <Trash2 className="w-4 h-4" />
                    Delete Story
                </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Stories;
