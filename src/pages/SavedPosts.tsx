import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, Loader2, AlertTriangle } from "lucide-react";
import PostCard from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import EmptyFeedState from "@/components/feed/EmptyFeedState";

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  media_type: string | null;
  created_at: string;
  user_id: string;
  posted_as: string;
  company_id: string | null;
  company_name: string | null;
  company_logo: string | null;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
    profession: string | null;
  } | null;
  post_likes: { id: string; user_id: string }[];
  comments?: { count: number }[];
}

const SavedPosts = () => {
  const { user, signOut } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSavedPosts = useCallback(async (signal?: AbortSignal) => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch current profile ID (profiles.id) for the authenticated user (auth.uid())
      const { data: profile, error: profileError } = await (supabase as any)
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .abortSignal(signal!)
        .maybeSingle();

      if (profileError) {
        const code = (profileError as any)?.code;
        if (code === 'ABORTED') return;
        throw profileError;
      }

      const profileId = profile?.id;

      if (!profileId) {
        setPosts([]);
        setLoading(false);
        return;
      }

      // Single optimized query: saved_posts -> posts (includes profiles, likes, comments count)
      const { data, error: qError } = await (supabase as any)
        .from('saved_posts')
        .select(`
          post:posts (
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
            profiles:profiles!posts_profiles_fk (
              display_name,
              avatar_url,
              profession
            ),
            post_likes (
              id,
              user_id
            ),
            comments (
              count
            )
          )
        `)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false, referencedTable: 'posts' })
        .abortSignal(signal!);

      if (qError) {
        const code = (qError as any)?.code;
        if (code === 'ABORTED') return;
        throw qError;
      }

      const rows = (data ?? []) as Array<{ post: any | null }>;
      const formatted: Post[] = rows
        .map((row) => row.post)
        .filter((p): p is any => !!p)
        .map((p) => ({
          id: p.id,
          content: p.content,
          image_url: p.image_url,
          media_type: p.media_type,
          created_at: p.created_at,
          user_id: p.user_id,
          posted_as: p.posted_as || 'user',
          company_id: p.company_id,
          company_name: p.company_name,
          company_logo: p.company_logo,
          profiles: p.profiles || {
            display_name: 'Unknown',
            avatar_url: null,
            profession: null
          },
          post_likes: p.post_likes || [],
          comments: p.comments || [],
        }));

      setPosts(formatted);
    } catch (err: unknown) {
      const rec = (err as Record<string, any>) || {};
      const isAbort = rec?.name === 'AbortError' || rec?.code === 'ABORTED';
      if (isAbort) return;

      console.error('Error fetching saved posts:', err);
      const message = typeof rec?.message === 'string'
        ? rec.message
        : 'Failed to load saved posts';
      setError(message);
      toast({
        title: "Error",
        description: "Failed to load saved posts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();
    fetchSavedPosts(controller.signal);

    return () => controller.abort();
  }, [user, fetchSavedPosts]);

  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleLike = async (postId: string, isLiked: boolean) => {
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

    try {
      if (isLiked) {
        await supabase.from('post_likes').insert({ post_id: postId, user_id: user.id });
      } else {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      fetchSavedPosts(); // Revert on error
    }
  };

  return (
    <Layout>
      {/* Universal Page Hero Section */}
      <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 border-b">
        <div className="max-w-5xl mx-auto px-4 pt-6 pb-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Bookmark className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            Saved Content
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Access your bookmarked posts and industry insights anytime, anywhere.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
          <p className="text-gray-500">Retrieving your collection...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Something went wrong
            </h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => fetchSavedPosts()} variant="default">
              Try Again
            </Button>
          </div>
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16">
          <EmptyFeedState />
        </div>
      ) : (
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          {posts.map((post, index) => (
            <PostCard
              key={`${post.id}-${index}`}
              id={post.id}
              user={{
                name: post.profiles?.display_name || 'Unknown',
                avatar: post.profiles?.avatar_url || undefined,
                subtitle: post.profiles?.profession || undefined
              }}
              content={post.content}
              image={post.image_url || undefined}
              mediaType={post.media_type === 'video' ? 'video' : 'image'}
              timestamp={post.created_at}
              likes={post.post_likes.length}
              comments={post.comments?.[0]?.count}
              initialIsLiked={post.post_likes.some(l => l.user_id === user?.id)}
              onLike={(isLiked) => handleLike(post.id, isLiked)}
              onDelete={() => handleDeletePost(post.id)}
              onHide={() => {}}
              postedAs={(post.posted_as as 'user' | 'company') || 'user'}
              companyId={post.company_id}
              companyName={post.company_name}
              companyLogo={post.company_logo}
            />
          ))}
        </div>
      )}
    </Layout>
  );
};

export default SavedPosts;
