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

      if (profile) {
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
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-4 pb-2">
          {/* Add Story Button */}
          <div className="flex flex-col items-center gap-2 min-w-[80px]">
            <button
              onClick={() => setShowUpload(true)}
              className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center hover:scale-105 transition-transform duration-200 border-4 border-background shadow-lg"
            >
              <Plus className="h-6 w-6 text-white" />
            </button>
            <span className="text-xs font-medium text-center">Add Story</span>
          </div>

          {/* Stories */}
          {Object.entries(groupedStories).map(([userId, data]) => (
            <div key={userId} className="flex flex-col items-center gap-2 min-w-[80px]">
              <button
                onClick={() => handleStoryClick(data.stories[0])}
                className="relative w-16 h-16 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 p-[3px] hover:scale-105 transition-transform duration-200 shadow-lg"
              >
                <Avatar className="w-full h-full border-2 border-background">
                  <AvatarImage src={data.profile?.avatar_url} />
                  <AvatarFallback>
                    {data.profile?.display_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              </button>
              <span className="text-xs font-medium text-center line-clamp-1 max-w-[80px]">
                {data.profile?.display_name || 'User'}
              </span>
            </div>
          ))}
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
