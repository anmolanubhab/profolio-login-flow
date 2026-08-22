import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StoryUploadDialog } from '@/components/StoryUploadDialog';
import { Plus } from 'lucide-react';

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
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [currentProfile, setCurrentProfile] = useState<{ avatar_url: string | null; display_name: string | null } | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const navigate = useNavigate();

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
      const { data: { user } } = await supabase.auth.getUser();

      // Stories from authors this user has muted (Story Viewer's "Mute
      // Story") shouldn't reappear in the tray either -- same list used by
      // the dedicated viewer's sidebar filtering.
      let mutedUserIds: string[] = [];
      if (user) {
        const { data: muted } = await supabase
          .from('muted_story_authors')
          .select('muted_user_id')
          .eq('user_id', user.id);
        mutedUserIds = muted?.map((m) => m.muted_user_id) || [];
      }

      const { data: storiesData, error } = await supabase
        .from('stories')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const visibleStories = (storiesData || []).filter((s) => !mutedUserIds.includes(s.user_id));

      // Fetch profiles separately
      const userIds = [...new Set(visibleStories.map(s => s.user_id))];
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, display_name, avatar_url')
          .in('user_id', userIds);

        const profileMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
        const enrichedStories = visibleStories.map(story => ({
          ...story,
          profile: profileMap.get(story.user_id),
        }));

        setStories(enrichedStories);
      } else {
        setStories([]);
      }
    } catch (error) {
      console.error('Error fetching stories:', error);
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
  }, {} as Record<string, { profile?: Story['profile']; stories: Story[] }>);

  return (
    <>
      <div className="rounded-xl border border-border bg-card shadow-card overflow-x-auto">
        <div className="flex gap-2 sm:gap-2.5 p-3">
          {/* Add Story -- a card of the exact same shape/size as the real
              story cards below (not a standalone circular button floating
              above them), so the row reads as one continuous carousel. */}
          <button
            onClick={() => {
              // If the current user already has an active story, clicking
              // their own tray card opens the dedicated Story Viewer on it
              // (matches "Your story" in the viewer's sidebar) -- only
              // falls back to the upload flow when they have none yet.
              const own = currentUser ? groupedStories[currentUser.id] : undefined;
              if (own && own.stories.length > 0) {
                navigate(`/story/${own.stories[own.stories.length - 1].id}`);
              } else {
                setShowUpload(true);
              }
            }}
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
              <span className="text-[10px] sm:text-[12px] font-semibold text-foreground">
                {currentUser && groupedStories[currentUser.id]?.stories.length ? 'Your Story' : 'Add Story'}
              </span>
            </div>
          </button>

          {/* Stories -- same card shape, own media as the background, small
              avatar badge top-left and name overlaid at the bottom, matching
              the Add Story card's dimensions so the whole row aligns. */}
          {Object.entries(groupedStories)
            .filter(([userId]) => userId !== currentUser?.id)
            .map(([userId, data]) => {
            const story = data.stories[0];
            return (
              <button
                key={userId}
                onClick={() => navigate(`/story/${story.id}`)}
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

      <StoryUploadDialog open={showUpload} onOpenChange={setShowUpload} onUploaded={fetchStories} />
    </>
  );
};

export default Stories;
