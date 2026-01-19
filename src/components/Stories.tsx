import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const { toast } = useToast();

  useEffect(() => {
    fetchStories();
    getCurrentUser();
  }, []);

  // Story auto-advance timer
  useEffect(() => {
    if (!selectedStoryGroup) return;
    
    const duration = 5000; // 5 seconds per story
    const interval = 50;
    let elapsed = 0;
    
    const timer = setInterval(() => {
      elapsed += interval;
      setStoryProgress((elapsed / duration) * 100);
      
      if (elapsed >= duration) {
        handleNextStory();
      }
    }, interval);
    
    return () => clearInterval(timer);
  }, [selectedStoryGroup, currentStoryIndex]);

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
    
    if (currentStoryIndex < selectedStoryGroup.length - 1) {
      setCurrentStoryIndex(prev => prev + 1);
      setStoryProgress(0);
    } else {
      // Close viewer after last story
      setSelectedStoryGroup(null);
      setCurrentStoryIndex(0);
    }
  };

  const handlePrevStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(prev => prev - 1);
      setStoryProgress(0);
    }
  };

  const handleStoryViewerClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const isRightSide = clickX > rect.width / 2;
    
    if (isRightSide) {
      handleNextStory();
    } else {
      handlePrevStory();
    }
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

  const currentStory = selectedStoryGroup?.[currentStoryIndex];

  return (
    <>
      {/* Stories Row */}
      <div className="bg-card rounded-xl border border-border/50 shadow-sm p-4">
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
          {/* Add Story Button - Facebook/Instagram Style */}
          <div className="flex flex-col items-center gap-2 min-w-[72px]">
            <button
              onClick={() => setShowUpload(true)}
              className="relative w-16 h-16 rounded-full overflow-hidden group"
            >
              {/* User's profile photo as background */}
              <Avatar className="w-full h-full">
                <AvatarImage src={currentUserProfile?.avatar_url || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground text-xl">
                  {currentUserProfile?.display_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              {/* Plus icon overlay */}
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center border-2 border-white shadow-lg">
                  <Plus className="h-4 w-4 text-primary-foreground" />
                </div>
              </div>
            </button>
            <span className="text-xs font-medium text-center text-muted-foreground">Add Story</span>
          </div>

          {/* User Stories */}
          {Object.entries(groupedStories).map(([userId, data]) => (
            <div key={userId} className="flex flex-col items-center gap-2 min-w-[72px]">
              <button
                onClick={() => handleStoryClick(data.stories)}
                className="relative w-16 h-16 rounded-full p-[3px] bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 hover:scale-105 transition-transform duration-200"
              >
                <Avatar className="w-full h-full border-2 border-background">
                  <AvatarImage src={data.profile?.avatar_url} />
                  <AvatarFallback className="bg-muted">
                    {data.profile?.display_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                {/* Story count indicator */}
                {data.stories.length > 1 && (
                  <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-background">
                    {data.stories.length}
                  </div>
                )}
              </button>
              <span className="text-xs font-medium text-center line-clamp-1 max-w-[72px]">
                {data.profile?.display_name || 'User'}
              </span>
            </div>
          ))}
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
      <Dialog open={!!selectedStoryGroup} onOpenChange={() => setSelectedStoryGroup(null)}>
        <DialogContent className="max-w-lg p-0 bg-black border-none h-[90vh] max-h-[800px]">
          {currentStory && (
            <div 
              className="relative w-full h-full cursor-pointer"
              onClick={handleStoryViewerClick}
            >
              {/* Progress Bars */}
              <div className="absolute top-4 left-4 right-4 z-20 flex gap-1">
                {selectedStoryGroup?.map((_, idx) => (
                  <div key={idx} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full bg-white transition-all duration-100",
                        idx < currentStoryIndex ? "w-full" : idx === currentStoryIndex ? "" : "w-0"
                      )}
                      style={idx === currentStoryIndex ? { width: `${storyProgress}%` } : undefined}
                    />
                  </div>
                ))}
              </div>

              {/* Close Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedStoryGroup(null);
                }}
                className="absolute top-12 right-4 z-20 bg-black/50 hover:bg-black/70 text-white rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>

              {/* User Info */}
              <div className="absolute top-12 left-4 z-20 flex items-center gap-3">
                <Avatar className="h-10 w-10 border-2 border-white">
                  <AvatarImage src={currentStory.profile?.avatar_url} />
                  <AvatarFallback className="bg-muted">
                    {currentStory.profile?.display_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <span className="text-white font-medium text-sm">
                    {currentStory.profile?.display_name || 'User'}
                  </span>
                  <p className="text-white/70 text-xs">
                    {new Date(currentStory.created_at).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>

              {/* Navigation Arrows */}
              {currentStoryIndex > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePrevStory();
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}
              
              {selectedStoryGroup && currentStoryIndex < selectedStoryGroup.length - 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNextStory();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center text-white transition-colors"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}

              {/* Story Content */}
              <div className="w-full h-full flex items-center justify-center bg-black">
                {currentStory.media_type === 'image' ? (
                  <img
                    src={currentStory.media_url}
                    alt="Story"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <video
                    src={currentStory.media_url}
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                    onEnded={handleNextStory}
                  />
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Stories;
