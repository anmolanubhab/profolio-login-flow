import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PostCard from './PostCard';
import { useToast } from '@/hooks/use-toast';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  post_likes: { id: string; user_id: string }[];
}

interface FeedProps {
  refresh?: number;
}

const Feed = ({ refresh }: FeedProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPosts = async () => {
    try {
      // Get current user and their filters
      const { data: { user } } = await supabase.auth.getUser();
      let currentUserProfileId: string | null = null;
      let hiddenPostIds: string[] = [];
      let blockedUserIds: string[] = [];
      let snoozedUserIds: string[] = [];
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        currentUserProfileId = profile?.id || null;
        
        if (currentUserProfileId) {
          // Fetch hidden posts
          const { data: hiddenData } = await supabase
            .from('hidden_posts')
            .select('post_id')
            .eq('user_id', currentUserProfileId);
          hiddenPostIds = hiddenData?.map((h) => h.post_id) || [];

          // Fetch blocked users
          const { data: blockedData } = await supabase
            .from('blocked_users')
            .select('blocked_user_id')
            .eq('user_id', currentUserProfileId);
          
          // Convert blocked profile IDs to user IDs for filtering
          if (blockedData && blockedData.length > 0) {
            const blockedProfileIds = blockedData.map((b) => b.blocked_user_id);
            const { data: blockedProfiles } = await supabase
              .from('profiles')
              .select('id, user_id')
              .in('id', blockedProfileIds);
            blockedUserIds = blockedProfiles?.map((p) => p.user_id) || [];
          }

          // Fetch snoozed users (not expired)
          const { data: snoozedData } = await supabase
            .from('snoozed_users')
            .select('snoozed_user_id')
            .eq('user_id', currentUserProfileId)
            .gt('snoozed_until', new Date().toISOString());
          
          // Convert snoozed profile IDs to user IDs
          if (snoozedData && snoozedData.length > 0) {
            const snoozedProfileIds = snoozedData.map((s) => s.snoozed_user_id);
            const { data: snoozedProfiles } = await supabase
              .from('profiles')
              .select('id, user_id')
              .in('id', snoozedProfileIds);
            snoozedUserIds = snoozedProfiles?.map((p) => p.user_id) || [];
          }
        }
      }

      // First get posts, then get profile info for each post
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          post_likes (id, user_id)
        `)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Get unique user IDs
      const userIds = [...new Set(postsData?.map(post => post.user_id) || [])];
      
      // Get profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profilesMap = new Map();
      profilesData?.forEach(profile => {
        profilesMap.set(profile.user_id, profile);
      });

      // Combine posts with profiles and filter
      const postsWithProfiles = postsData
        ?.filter(post => {
          // Filter out hidden posts
          if (hiddenPostIds.includes(post.id)) return false;
          // Filter out posts from blocked users
          if (blockedUserIds.includes(post.user_id)) return false;
          // Filter out posts from snoozed users
          if (snoozedUserIds.includes(post.user_id)) return false;
          return true;
        })
        .map(post => ({
          ...post,
          profiles: profilesMap.get(post.user_id) || null
        })) || [];

      setPosts(postsWithProfiles);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error loading posts",
        description: "Could not load the feed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [refresh]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
  }, []);

  const handleLike = async (postId: string, isLiked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (isLiked) {
        // Like
        await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id,
          });
      } else {
        // Unlike
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      }

      // Refresh posts to update like counts
      fetchPosts();
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Could not update like. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeletePost = (postId: string) => {
    setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
  };

  const handleHidePost = () => {
    // Refresh the feed to apply the new filters
    fetchPosts();
  };

  if (loading) {
    return (
      <div className="feed">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="post-card p-4 animate-pulse">
            <div className="flex gap-3 mb-3">
              <div className="w-10 h-10 bg-muted rounded-full" />
              <div className="flex-1">
                <div className="h-4 bg-muted rounded w-32 mb-2" />
                <div className="h-3 bg-muted rounded w-20" />
              </div>
            </div>
            <div className="h-4 bg-muted rounded w-full mb-2" />
            <div className="h-4 bg-muted rounded w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="centered py-12 subtle">
        <p>No posts yet. Be the first to share something!</p>
      </div>
    );
  }

  return (
    <div className="feed">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          id={post.id}
          user={{
            id: post.profiles?.id,
            name: post.profiles?.display_name || 'Unknown User',
            avatar: post.profiles?.avatar_url,
          }}
          content={post.content}
          image={post.image_url || undefined}
          timestamp={post.created_at}
          likes={post.post_likes.length}
          initialIsLiked={currentUserId ? post.post_likes.some((l) => l.user_id === currentUserId) : false}
          onLike={(isLiked) => handleLike(post.id, isLiked)}
          onDelete={() => handleDeletePost(post.id)}
          onHide={handleHidePost}
        />
      ))}
    </div>
  );
};

export default Feed;