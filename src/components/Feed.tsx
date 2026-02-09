import { useState, useEffect, useCallback, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PostCard from './PostCard';
import PostCardSkeleton from './feed/PostCardSkeleton';
import EmptyFeedState from './feed/EmptyFeedState';
import { useToast } from '@/hooks/use-toast';
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, RefreshCcw } from "lucide-react";

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
  original_post_id: string | null;
  post_type: string;
  original_post: {
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
      display_name: string | null;
      avatar_url: string | null;
      profession: string | null;
    } | null;
  } | null;
}

interface FeedProps {
  refresh?: number;
  userId?: string;
}

const POSTS_PER_PAGE = 10;

const Feed = ({ refresh, userId }: FeedProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPosts = async (pageNumber: number, isRefresh = false) => {
    try {
      if (pageNumber === 0) {
        setLoading(true);
        setError(null);
      } else {
        setLoadingMore(true);
      }

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
          .maybeSingle();
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

      // Helper to process and set posts data
      const handlePostsData = async (data: any[], pageNum: number) => {
        const postsData = data as unknown as Post[];
        
        const userIds = [...new Set([
          ...(postsData?.map(post => post.user_id) || []),
          ...(postsData?.map(post => post.original_post?.user_id).filter(Boolean) || [])
        ])];
        
        let profilesData: any[] = [];
        if (userIds.length > 0) {
          const { data, error: profilesError } = await supabase
            .from('profiles')
            .select('id, user_id, display_name, avatar_url, profession')
            .in('user_id', userIds);
            
          if (profilesError) throw profilesError;
          profilesData = data || [];
        }

        const profilesMap = new Map();
        profilesData?.forEach((profile: any) => {
          profilesMap.set(profile.user_id, profile);
        });

        const newPosts: Post[] = postsData
          ?.filter(post => {
            if (hiddenPostIds.includes(post.id)) return false;
            if (!userId && blockedUserIds.includes(post.user_id)) return false;
            if (!userId && snoozedUserIds.includes(post.user_id)) return false;
            return true;
          })
          .map(post => ({
            ...post,
            posted_as: (post.posted_as as 'user' | 'company') || 'user',
            profiles: profilesMap.get(post.user_id) || null,
            original_post: post.original_post ? {
              ...post.original_post,
              profiles: profilesMap.get(post.original_post.user_id) || null
            } : null
          })) || [];

        setPosts(prev => isRefresh || pageNum === 0 ? newPosts : [...prev, ...newPosts]);
        setHasMore((data?.length || 0) === POSTS_PER_PAGE);
        setPage(pageNum);
      };

      try {
        let query = supabase
          .from('posts')
          .select(`
            *,
            post_likes (id, user_id),
            original_post:posts!original_post_id (
              id,
              content,
              image_url,
              media_type,
              created_at,
              user_id,
              posted_as,
              company_id,
              company_name,
              company_logo,
              profiles:user_id (
                display_name,
                avatar_url,
                profession
              )
            )
          `);

        if (userId) {
          query = query.eq('user_id', userId);
        }

        if (!userId && blockedUserIds.length > 0) {
          query = query.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
        }

        if (pageNumber === 0) {
          query = query.order('created_at', { ascending: false });
        } else {
          query = query
            .order('created_at', { ascending: false })
            .range(pageNumber * POSTS_PER_PAGE, (pageNumber * POSTS_PER_PAGE) + POSTS_PER_PAGE - 1);
        }

        const { data, error } = await query;
        if (error) throw error;
        await handlePostsData(data, pageNumber);

      } catch (error: any) {
        // Fallback for missing relationship (migration not applied)
        if (error.message?.includes('Could not find a relationship') || error.code === 'PGRST200') {
          console.warn('Repost migration not applied, falling back to basic feed');
          
          let fallbackQuery = supabase
            .from('posts')
            .select(`
              *,
              post_likes (id, user_id)
            `);

          if (userId) {
            fallbackQuery = fallbackQuery.eq('user_id', userId);
          }

          if (!userId && blockedUserIds.length > 0) {
            fallbackQuery = fallbackQuery.not('user_id', 'in', `(${blockedUserIds.join(',')})`);
          }

          if (pageNumber === 0) {
            fallbackQuery = fallbackQuery.order('created_at', { ascending: false });
          } else {
            fallbackQuery = fallbackQuery
              .order('created_at', { ascending: false })
              .range(pageNumber * POSTS_PER_PAGE, (pageNumber * POSTS_PER_PAGE) + POSTS_PER_PAGE - 1);
          }

          const { data: fallbackData, error: fallbackError } = await fallbackQuery;
          if (fallbackError) throw fallbackError;

          // Filter out reposts in fallback mode since we can't show them correctly
          const validPosts = (fallbackData as any[]).filter(p => p.post_type !== 'repost');
          await handlePostsData(validPosts, pageNumber);
          
          if (pageNumber === 0) {
            toast({
              title: "Update Required",
              description: "Reposts are hidden until database update.",
              variant: "default",
            });
          }
        } else {
          throw error;
        }
      }

    } catch (error: any) {
      console.error('Error fetching posts:', error);
      // Only set error state if we don't have posts to show (initial load)
      // If loading more fails, we just toast
      if (pageNumber === 0) {
        setError(error.message || "Could not load the feed. Please try again.");
      }
      
      toast({
        title: "Error loading posts",
        description: error.message || "Could not load the feed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPosts(0, true);
  }, [refresh, userId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
  }, []);

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchPosts(page + 1);
    }
  };

  const handleDeletePost = useCallback((postId: string) => {
    setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
  }, []);

  const handleHidePost = useCallback(() => {
    fetchPosts(0, true);
  }, []);

  const handleLike = useCallback(async (postId: string, isLiked: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Optimistic update
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          const newLikes = isLiked 
            ? [...p.post_likes, { id: 'temp', user_id: user.id }]
            : p.post_likes.filter(l => l.user_id !== user.id);
          return { ...p, post_likes: newLikes };
        }
        return p;
      }));

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
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Could not update like. Please try again.",
        variant: "destructive",
      });
      fetchPosts(0, true); // Revert on error
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <PostCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-card rounded-lg border border-border shadow-sm">
        <div className="bg-destructive/10 p-4 rounded-full mb-4">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Error loading feed</h3>
        <p className="text-muted-foreground mb-6 max-w-sm">{error}</p>
        <Button onClick={() => fetchPosts(0, true)} variant="outline" className="gap-2">
          <RefreshCcw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  if (posts.length === 0) {
    return <EmptyFeedState />;
  }

  return (
    <div className="space-y-0 sm:space-y-3 -mx-4 sm:mx-0">
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
          postType={post.post_type}
          originalPost={post.original_post}
        />
      ))}

      {hasMore && (
        <div className="flex justify-center py-4">
          <Button 
            variant="outline" 
            onClick={loadMore} 
            disabled={loadingMore}
            className="w-full md:w-auto"
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More'
            )}
          </Button>
        </div>
      )}
    </div>
  );
};

export default Feed;
