import { useState, useEffect } from 'react';
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
}

const SavedPosts = () => {
  const { user, signOut } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSavedPosts = async (signal?: AbortSignal) => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);

      // Fetch saved post IDs first
      const { data: savedData, error: savedError } = await supabase
        .from('saved_posts')
        .select('post_id')
        .eq('user_id', user.id)
        .abortSignal(signal);

      if (savedError) {
        if (savedError.code === 'ABORTED') return;
        throw savedError;
      }

      const postIds = savedData?.map(item => item.post_id) || [];

      if (postIds.length === 0) {
        setPosts([]);
        setLoading(false);
        return;
      }

      // Fetch the actual posts
      const { data, error: postsError } = await supabase
        .from('posts')
        .select(`
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
          ),
          post_likes (
            id,
            user_id
          )
        `)
        .in('id', postIds)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .abortSignal(signal);

      if (postsError) {
        if (postsError.code === 'ABORTED') return;
        throw postsError;
      }

      // Transform data to match Post interface
      const formattedPosts: Post[] = (data || []).map((post: any) => ({
        ...post,
        posted_as: post.posted_as || 'user',
        profiles: post.profiles || { display_name: 'Unknown', avatar_url: null, profession: null },
        post_likes: post.post_likes || []
      }));

      setPosts(formattedPosts);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.code === 'ABORTED') return;
      console.error('Error fetching saved posts:', err);
      setError(err.message || 'Failed to load saved posts');
      toast({
        title: "Error",
        description: "Failed to load saved posts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      const controller = new AbortController();
      fetchSavedPosts(controller.signal);
      return () => controller.abort();
    }
  }, [user]);

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
    <Layout user={user} onSignOut={signOut}>
      <div className="min-h-screen bg-white">
        {/* Universal Page Hero Section */}
        <div className="relative w-full overflow-hidden border-b border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-5 animate-gradient-shift" />
          <div className="max-w-5xl mx-auto py-16 px-6 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-10">
              <div className="text-center md:text-left animate-in fade-in slide-in-from-left-8 duration-700">
                <h1 className="text-4xl md:text-6xl font-extrabold text-[#1D2226] mb-4 tracking-tight leading-tight">
                  Saved Content
                </h1>
                <p className="text-[#5E6B7E] text-lg md:text-2xl font-medium max-w-2xl mx-auto md:mx-0 leading-relaxed">
                  Access your bookmarked posts and industry insights anytime, anywhere.
                </p>
              </div>
              <div className="flex justify-center animate-in fade-in slide-in-from-right-8 duration-700">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-3xl rounded-full" />
                  <div className="relative h-24 w-24 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center text-[#833AB4]">
                    <Bookmark className="h-12 w-12" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto py-16 px-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 bg-white/50 backdrop-blur-sm rounded-[3rem] border border-gray-100 animate-in fade-in duration-500">
              <div className="h-16 w-16 border-4 border-gray-100 border-t-[#833AB4] rounded-full animate-spin mb-6 shadow-xl shadow-[#833AB4]/10" />
              <p className="text-[#5E6B7E] font-bold text-lg animate-pulse">Retrieving your collection...</p>
            </div>
          ) : error ? (
            <div className="bg-gray-50/50 rounded-[3rem] p-16 text-center border-2 border-dashed border-red-100 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="relative mb-8">
                <div className="absolute inset-0 bg-red-100 blur-3xl rounded-full opacity-50" />
                <div className="relative bg-white h-24 w-24 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-2xl">
                  <AlertTriangle className="h-12 w-12 text-red-400" />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-[#1D2226] mb-3 tracking-tight">Something went wrong</h3>
              <p className="text-[#5E6B7E] font-medium mb-10 max-w-sm mx-auto leading-relaxed">{error}</p>
              <Button 
                onClick={fetchSavedPosts} 
                className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-12 py-5 h-auto font-bold shadow-xl shadow-[#833AB4]/25 transition-all transform hover:scale-105"
              >
                Try Again
              </Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-gray-50/30 rounded-[3rem] p-20 text-center border-2 border-dashed border-gray-100 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="relative mb-10">
                <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-3xl rounded-full" />
                <div className="relative bg-white h-28 w-28 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl">
                  <Bookmark className="h-14 w-14 text-gray-300" />
                </div>
              </div>
              <h3 className="text-3xl font-extrabold text-[#1D2226] mb-4 tracking-tight">Your vault is empty</h3>
              <p className="text-[#5E6B7E] font-medium max-w-sm mx-auto text-lg leading-relaxed">
                Start building your collection by saving insightful posts from your feed.
              </p>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
              {posts.map((post, index) => (
                <div 
                  key={post.id} 
                  className="animate-in fade-in slide-in-from-bottom-4"
                  style={{ animationDelay: `${index * 150}ms` }}
                >
                  <PostCard
                    id={post.id}
                    user={{
                      id: post.user_id,
                      name: post.profiles?.display_name || 'Unknown',
                      avatar: post.profiles?.avatar_url || undefined,
                      subtitle: post.profiles?.profession || undefined
                    }}
                    content={post.content}
                    image={post.image_url || undefined}
                    mediaType={(post.media_type as 'image' | 'video') || 'image'}
                    timestamp={post.created_at}
                    likes={post.post_likes.length}
                    initialIsLiked={post.post_likes.some(l => l.user_id === user?.id)}
                    onLike={(isLiked) => handleLike(post.id, isLiked)}
                    onDelete={() => handleDeletePost(post.id)}
                    onHide={() => {}}
                    postedAs={post.posted_as as 'user' | 'company'}
                    companyId={post.company_id}
                    companyName={post.company_name}
                    companyLogo={post.company_logo}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SavedPosts;
