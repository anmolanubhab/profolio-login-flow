import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import PostCard from '@/components/PostCard';
import { FileText } from 'lucide-react';

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
  author: {
    display_name: string | null;
    avatar_url: string | null;
    profession: string | null;
  };
  likes: { user_id: string }[];
  comments_count?: number;
}

interface CompanyPostsFeedProps {
  companyId: string;
  companyName?: string;
}

export const CompanyPostsFeed = ({ companyId, companyName }: CompanyPostsFeedProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchPosts(controller.signal);
    fetchCurrentUser();
    return () => controller.abort();
  }, [companyId]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchPosts = async (signal?: AbortSignal) => {
    try {
      const { data, error } = await supabase
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
            user_id
          ),
          comments (
            count
          )
        `)
        .eq('company_id', companyId)
        .eq('status', 'published')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return;
        throw error;
      }

      const formattedPosts = (data || []).map((post: any) => ({
        id: post.id,
        content: post.content,
        image_url: post.image_url,
        media_type: post.media_type,
        created_at: post.created_at,
        user_id: post.user_id,
        posted_as: post.posted_as,
        company_id: post.company_id,
        company_name: post.company_name,
        company_logo: post.company_logo,
        author: post.profiles || { display_name: null, avatar_url: null, profession: null },
        likes: post.post_likes || [],
        comments_count: Array.isArray(post.comments) ? (post.comments[0]?.count ?? 0) : 0
      }));

      setPosts(formattedPosts);
    } catch (error) {
      console.error('Error fetching company posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!currentUserId) return;

    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const isLiked = post.likes.some(like => like.user_id === currentUserId);

    if (isLiked) {
      await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', currentUserId);
    } else {
      await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: currentUserId });
    }

    // Refresh posts to get updated likes
    fetchPosts();
  };

  const handleDeletePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const handleHidePost = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
            <CardContent className="px-4 py-6 sm:px-8 sm:pb-8">
              <div className="flex items-center gap-4 mb-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-24 w-full rounded-2xl" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
        <CardContent className="px-4 py-16 sm:px-8 sm:pb-8 text-center border-2 border-dashed border-gray-100 rounded-[2rem] bg-gray-50/30 m-4 sm:m-8">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm mx-auto mb-4">
            <FileText className="w-8 h-8 text-gray-300" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No posts yet</h3>
          <p className="text-gray-500 max-w-[260px] mx-auto">
            {companyName || 'This company'} hasn't shared any updates or posts yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          id={post.id}
          user={{
            id: post.user_id,
            name: post.author.display_name || 'Unknown',
            avatar: post.author.avatar_url || undefined,
            subtitle: post.author.profession || undefined
          }}
          content={post.content}
          image={post.image_url || undefined}
          mediaType={post.media_type === 'video' ? 'video' : 'image'}
          timestamp={post.created_at}
          comments={post.comments_count}
          likes={post.likes.length}
          initialIsLiked={post.likes.some(like => like.user_id === currentUserId)}
          onLike={(isLiked) => handleLike(post.id)}
          onDelete={() => handleDeletePost(post.id)}
          onHide={() => handleHidePost(post.id)}
          postedAs={post.posted_as as 'user' | 'company'}
          companyId={post.company_id}
          companyName={post.company_name}
          companyLogo={post.company_logo}
        />
      ))}
    </div>
  );
};
