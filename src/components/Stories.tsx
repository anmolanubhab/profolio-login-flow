import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

const Stories = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<{ avatar_url: string | null; display_name: string | null } | null>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchStories();
    getCurrentUser();
  }, []);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUser(user);
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url, display_name')
        .eq('user_id', user.id)
        .single();
      if (profile) setCurrentProfile(profile);
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

      // Fetch profiles separately
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
      
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Upload to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from('stories')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('stories')
        .getPublicUrl(fileName);

      // Create story record
      const { error: insertError } = await supabase
        .from('stories')
        .insert({
          user_id: currentUser.id,
          media_url: publicUrl,
          media_type: file.type.startsWith('image/') ? 'image' : 'video',
        });

      if (insertError) throw insertError;

      toast({
        title: 'Success',
        description: 'Story uploaded successfully!',
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

  const handleStoryClick = async (story: Story) => {
    setSelectedStory(story);
    
    // Record view if not own story
    if (currentUser && story.user_id !== currentUser.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser.id)
        .single();

      if (currentUser) {
        await supabase.from('story_views').insert({
          story_id: story.id,
          viewer_id: currentUser.id,
        });
      }
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

  return (
    <>
      <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
        <div className="flex gap-2 sm:gap-2.5 p-3">
          {/* Add Story -- a card of the exact same shape/size as the real
              story cards below (not a standalone circular button floating
              above them), so the row reads as one continuous carousel. */}
          <button
            onClick={() => setShowUpload(true)}
            className="relative shrink-0 w-[76px] h-[128px] sm:w-24 sm:h-[158px] rounded-xl overflow-hidden group"
          >
            {currentProfile?.avatar_url ? (
              <img
                src={currentProfile.avatar_url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/60" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/0 to-black/10 group-hover:from-black/55 transition-colors" />

            <div className="absolute left-1/2 -translate-x-1/2 top-[64%] sm:top-[68%] w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-background border-2 border-card shadow-md flex items-center justify-center">
              <Plus className="h-4 w-4 sm:h-5 sm:w-5 text-primary" strokeWidth={2.5} />
            </div>

            <div className="absolute bottom-0 inset-x-0 bg-card py-1.5 sm:py-2">
              <span className="text-[10px] sm:text-[12px] font-semibold text-foreground">Add Story</span>
            </div>
          </button>

          {/* Stories -- same card shape, own media as the background, small
              avatar badge top-left and name overlaid at the bottom, matching
              the Add Story card's dimensions so the whole row aligns. */}
          {Object.entries(groupedStories).map(([userId, data]) => {
            const story = data.stories[0];
            return (
              <button
                key={userId}
                onClick={() => handleStoryClick(story)}
                className="relative shrink-0 w-[76px] h-[128px] sm:w-24 sm:h-[158px] rounded-xl overflow-hidden group"
              >
                {story.media_type === 'image' ? (
                  <img
                    src={story.media_url}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <video
                    src={story.media_url}
                    muted
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/20" />

                <Avatar className="absolute top-2 left-2 h-7 w-7 sm:h-8 sm:w-8 ring-2 ring-primary">
                  <AvatarImage src={data.profile?.avatar_url} />
                  <AvatarFallback className="text-[10px]">
                    {data.profile?.display_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>

                <span className="absolute bottom-1.5 sm:bottom-2 inset-x-1.5 text-[10px] sm:text-[12px] font-semibold text-white text-left line-clamp-2 leading-tight drop-shadow">
                  {data.profile?.display_name || 'User'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent>
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Create Story</h2>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
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
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <Plus className="h-12 w-12 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {uploading ? 'Uploading...' : 'Click to upload image or video'}
                </span>
              </label>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Story Viewer */}
      <Dialog open={!!selectedStory} onOpenChange={() => setSelectedStory(null)}>
        <DialogContent className="max-w-md p-0 bg-black">
          {selectedStory && (
            <div className="relative w-full h-[600px]">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedStory(null)}
                className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
              
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
                <Avatar className="h-10 w-10 border-2 border-white">
                  <AvatarImage src={selectedStory.profile?.avatar_url} />
                  <AvatarFallback>
                    {selectedStory.profile?.display_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span className="text-white font-medium">
                  {selectedStory.profile?.display_name || 'User'}
                </span>
              </div>

              {selectedStory.media_type === 'image' ? (
                <img
                  src={selectedStory.media_url}
                  alt="Story"
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  src={selectedStory.media_url}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Stories;
