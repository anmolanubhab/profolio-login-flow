import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark, Loader2, AlertTriangle } from "lucide-react";
import PostCard from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import EmptySavedPosts from "@/components/empty-states/EmptySavedPosts";

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

const PAGE_SIZE = 10;

const SavedPosts = () => {
  const { user, signOut } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const { toast } = useToast();

  const fetchSavedPosts = useCallback(async (pageNumber = 0, options?: { signal?: AbortSignal }) => {
    const signal = options?.signal;
    if (!user) return;

    try {
      if (pageNumber === 0) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      let profileQuery = (supabase as any)
        .from('profiles')
        .select('id')
        .eq('user_id', user.id);

      if (signal) {
        profileQuery = profileQuery.abortSignal(signal as any);
      }

      const { data: profile, error: profileError } = await profileQuery.maybeSingle();

      if (profileError) {
        const code = (profileError as any)?.code;
        if (code === 'ABORTED' || code === 20 || code === '20') return;
        throw profileError;
      }

      const profileId = profile?.id;

      if (!profileId) {
        setPosts([]);
        setLoading(false);
        return;
      }

      const from = pageNumber * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // Single optimized query: saved_posts -> posts (includes profiles, likes, comments count)
      let postsQuery = (supabase as any)
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
        .range(from, to);

      if (signal) {
        postsQuery = postsQuery.abortSignal(signal as any);
      }

      const { data, error: qError } = await postsQuery;

      if (qError) {
        const code = (qError as any)?.code;
        if (code === 'ABORTED' || code === 20 || code === '20') return;
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

      setPosts(prev =>
        pageNumber === 0
          ? formatted
          : [...prev, ...formatted]
      );

      setHasMore(formatted.length === PAGE_SIZE);
      setPage(pageNumber);
    } catch (err: unknown) {
      const rec = (err as Record<string, any>) || {};
      const message = typeof rec?.message === 'string' ? rec.message : '';
      const isAbort =
        rec?.name === 'AbortError' ||
        rec?.code === 'ABORTED' ||
        rec?.code === 20 ||
        rec?.code === '20' ||
        message.includes('net::ERR_ABORTED') ||
        message.toLowerCase().includes('abort');
      if (isAbort) return;

      console.error('Error fetching saved posts:', err);
      setError(message || 'Failed to load saved posts');
      toast({
        title: "Error",
        description: "Failed to load saved posts. Please try again.",
        variant: "destructive",
      });
    } finally {
      if (pageNumber === 0) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [user, toast]);

  useEffect(() => {
    if (!user) return;

    const controller = new AbortController();
    fetchSavedPosts(0, { signal: controller.signal });

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
      fetchSavedPosts(0); // Revert on error (reload first page)
    }
  };

  return (
    <Layout>
      <div 
        className="min-h-screen"
        style={{ background: "radial-gradient(1000px 300px at 0% 0%, #e9d5ff 0%, #fce7f3 40%, #dbeafe 80%)" }}
      >
        {/* Universal Page Hero Section */}
        <div className="relative w-full bg-gradient-to-r from-indigo-300 via-pink-200 to-blue-200 rounded-b-3xl py-14 px-8 overflow-hidden">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-center">
              <div className="text-center animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4 shadow-sm">
                  <Bookmark className="w-8 h-8 text-[#833AB4]" />
                </div>
                <h1 className="page-title mb-3">
                  Saved Content
                </h1>
                <p className="text-lg text-[#5E6B7E] max-w-2xl mx-auto">
                  Access your bookmarked posts and industry insights anytime, anywhere.
                </p>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -top-20 -right-32 w-[400px] h-[400px] bg-white/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-16 w-[300px] h-[300px] bg-white/20 rounded-full blur-3xl" />
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in-up">
            <Loader2 className="w-12 h-12 text-[#833AB4] animate-spin mb-4" />
            <p className="text-[#5E6B7E]">Retrieving your collection...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 animate-fade-in-up">
            <div className="bg-white/70 backdrop-blur-md border border-gray-100 rounded-[2rem] p-8 max-w-md text-center shadow-card">
              <AlertTriangle className="w-12 h-12 text-[#833AB4] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[#1D2226] mb-2">
                Something went wrong
              </h3>
              <p className="text-[#5E6B7E] mb-4">{error}</p>
              <Button onClick={() => fetchSavedPosts()} className="rounded-full px-6">
                Try Again
              </Button>
            </div>
          </div>
        ) : posts.length === 0 ? (
          <EmptySavedPosts />
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
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={() => fetchSavedPosts(page + 1)}
                  disabled={loadingMore}
                  className="rounded-full px-6"
                >
                  {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Load more
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SavedPosts;
