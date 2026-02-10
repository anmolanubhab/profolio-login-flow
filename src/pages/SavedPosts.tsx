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
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Saved Posts</h1>
        
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-card text-card-foreground shadow-sm">
            <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error loading saved posts</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchSavedPosts} variant="outline">Try Again</Button>
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-card text-card-foreground shadow-sm">
            <Bookmark className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No saved posts</h3>
            <p className="text-sm text-muted-foreground">
              Posts you save will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
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
                onHide={() => {}} // No hide functionality needed for saved posts specifically, or maybe remove from list?
                postedAs={post.posted_as as 'user' | 'company'}
                companyId={post.company_id}
                companyName={post.company_name}
                companyLogo={post.company_logo}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SavedPosts;
