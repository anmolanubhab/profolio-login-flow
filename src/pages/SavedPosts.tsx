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

  const fetchSavedPosts = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);

      // Fetch saved post IDs first
      const { data: savedData, error: savedError } = await supabase
        .from('saved_posts')
        .select('post_id')
        .eq('user_id', user.id);

      if (savedError) throw savedError;

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
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Transform data to match Post interface
      const formattedPosts: Post[] = (data || []).map((post: any) => ({
        ...post,
        posted_as: post.posted_as || 'user',
        profiles: post.profiles || { display_name: 'Unknown', avatar_url: null, profession: null },
        post_likes: post.post_likes || []
      }));

      setPosts(formattedPosts);
    } catch (err: any) {
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
    fetchSavedPosts();
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
          <div className="max-w-4xl mx-auto py-12 px-6 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-extrabold text-[#1D2226] mb-3 tracking-tight">
                  Saved Content
                </h1>
                <p className="text-[#5E6B7E] text-base md:text-xl font-medium max-w-2xl mx-auto md:mx-0">
                  Access your bookmarked posts and insights anytime.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto py-12 px-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-[#833AB4] mb-4" />
              <p className="text-gray-500 font-medium">Loading your saved collection...</p>
            </div>
          ) : error ? (
            <div className="bg-gray-50/50 rounded-[2rem] p-12 text-center border-2 border-dashed border-red-100">
              <div className="bg-white h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <AlertTriangle className="h-10 w-10 text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h3>
              <p className="text-gray-500 mb-8 max-w-xs mx-auto">{error}</p>
              <Button 
                onClick={fetchSavedPosts} 
                className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-8 py-4 h-auto font-bold transition-all"
              >
                Try Again
              </Button>
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-gray-50/50 rounded-[2rem] p-12 text-center border-2 border-dashed border-gray-200">
              <div className="bg-white h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Bookmark className="h-10 w-10 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No saved posts</h3>
              <p className="text-gray-500 max-w-xs mx-auto">
                Posts you save from your feed will appear here for quick access.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );  );
};

export default SavedPosts;
