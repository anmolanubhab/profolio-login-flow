import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PostCard from './PostCard';
import PostCardSkeleton from './feed/PostCardSkeleton';
import EmptyFeedState from './feed/EmptyFeedState';
import { useToast } from '@/hooks/use-toast';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  media_type: string | null;
  created_at: string;
  user_id: string;
  posted_as: 'user' | 'company';
  company_id: string | null;
  company_name: string | null;
  company_logo: string | null;
  profiles: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    profession: string | null;
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
          const { data: hiddenData } = await supabase
            .from('hidden_posts')
            .select('post_id')
            .eq('user_id', currentUserProfileId);
          hiddenPostIds = hiddenData?.map((h) => h.post_id) || [];

          const { data: blockedData } = await supabase
            .from('blocked_users')
            .select('blocked_user_id')
            .eq('user_id', currentUserProfileId);
          
          if (blockedData && blockedData.length > 0) {
            const blockedProfileIds = blockedData.map((b) => b.blocked_user_id);
            const { data: blockedProfiles } = await supabase
              .from('profiles')
              .select('id, user_id')
              .in('id', blockedProfileIds);
            blockedUserIds = blockedProfiles?.map((p) => p.user_id) || [];
          }

          const { data: snoozedData } = await supabase
            .from('snoozed_users')
            .select('snoozed_user_id')
            .eq('user_id', currentUserProfileId)
            .gt('snoozed_until', new Date().toISOString());
          
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

      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          post_likes (id, user_id)
        `)
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      const userIds = [...new Set(postsData?.map(post => post.user_id) || [])];
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url, profession')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map();
      profilesData?.forEach(profile => {
        profilesMap.set(profile.user_id, profile);
      });

      const postsWithProfiles: Post[] = postsData
        ?.filter(post => {
          if (hiddenPostIds.includes(post.id)) return false;
          if (blockedUserIds.includes(post.user_id)) return false;
          if (snoozedUserIds.includes(post.user_id)) return false;
          return true;
        })
        .map(post => ({
          ...post,
          posted_as: (post.posted_as as 'user' | 'company') || 'user',
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
        await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id,
          });
      } else {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
      }

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
    fetchPosts();
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return <EmptyFeedState />;
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          id={post.id}
          user={{
            id: post.profiles?.id,
            name: post.profiles?.display_name || 'Unknown User',
            avatar: post.profiles?.avatar_url || undefined,
            subtitle: post.profiles?.profession || undefined,
          }}
          content={post.content}
          image={post.image_url || undefined}
          mediaType={(post.media_type as 'image' | 'video') || 'image'}
          timestamp={post.created_at}
          likes={post.post_likes.length}
          initialIsLiked={currentUserId ? post.post_likes.some((l) => l.user_id === currentUserId) : false}
          onLike={(isLiked) => handleLike(post.id, isLiked)}
          onDelete={() => handleDeletePost(post.id)}
          onHide={handleHidePost}
          postedAs={post.posted_as}
          companyId={post.company_id}
          companyName={post.company_name}
          companyLogo={post.company_logo}
        />
      ))}
    </div>
  );
};

export default Feed;
