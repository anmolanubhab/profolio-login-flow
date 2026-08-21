import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PostCard from '@/components/PostCard';
import { ReactionType } from '@/components/ReactionBar';
import { PollData, buildPollSummary, buildReactionSummary } from '@/lib/postAggregation';
import { Bookmark } from 'lucide-react';

interface SavedPost {
  id: string; // posts.id
  content: string;
  image_url: string | null;
  created_at: string;
  post_type: string;
  video_url: string | null;
  document_url: string | null;
  document_name: string | null;
  carousel_urls: string[] | null;
  company_id: string | null;
  company_name: string | null;
  company_logo: string | null;
  posted_as: string;
  profiles: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  post_reactions: { id: string; user_id: string; reaction_type: ReactionType }[];
  polls: PollData | null;
}

const SavedPosts = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/');
        return;
      }
      setUser(authUser);

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', authUser.id)
        .single();

      if (profile) {
        setCurrentUserProfileId(profile.id);
        await fetchSavedPosts(profile.id);
      } else {
        setLoading(false);
      }
    };
    init();
  }, [navigate]);

  const fetchSavedPosts = async (profileId: string) => {
    setLoading(true);
    try {
      const { data: savedData, error: savedError } = await supabase
        .from('saved_posts')
        .select('post_id, created_at')
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });

      if (savedError) throw savedError;

      const postIds = (savedData || []).map((s) => s.post_id);
      if (postIds.length === 0) {
        setPosts([]);
        return;
      }

      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select(`
          *,
          post_reactions (id, user_id, reaction_type),
          polls (
            id,
            question,
            poll_options ( id, option_text, position ),
            poll_votes ( id, option_id, user_id )
          )
        `)
        .in('id', postIds)
        .eq('status', 'published');

      if (postsError) throw postsError;

      const userIds = [...new Set((postsData || []).map((p) => p.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url')
        .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      const profilesMap = new Map();
      (profilesData || []).forEach((p) => profilesMap.set(p.user_id, p));

      // Preserve the "most recently saved first" order from saved_posts,
      // not whatever order postgres returned matching posts in.
      const savedOrder = new Map(postIds.map((id, idx) => [id, idx]));
      const enriched = (postsData || [])
        .map((post) => ({
          ...post,
          profiles: profilesMap.get(post.user_id) || null,
        }))
        .sort((a, b) => (savedOrder.get(a.id) ?? 0) - (savedOrder.get(b.id) ?? 0));

      setPosts(enriched as unknown as SavedPost[]);
    } catch (error) {
      console.error('Error fetching saved posts:', error);
      toast({
        title: 'Error loading saved posts',
        description: 'Could not load your saved posts. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReact = async (postId: string, type: ReactionType | null) => {
    if (!currentUserProfileId) return;
    try {
      if (type === null) {
        await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', currentUserProfileId);
      } else {
        await supabase.from('post_reactions').upsert(
          { post_id: postId, user_id: currentUserProfileId, reaction_type: type },
          { onConflict: 'post_id,user_id' }
        );
      }
      fetchSavedPosts(currentUserProfileId);
    } catch (error) {
      console.error('Error updating reaction:', error);
      toast({ title: 'Error', description: 'Could not update your reaction. Please try again.', variant: 'destructive' });
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    if (!currentUserProfileId) return;
    try {
      const { error } = await supabase.from('poll_votes').insert({
        poll_id: pollId,
        option_id: optionId,
        user_id: currentUserProfileId,
      });
      if (error && error.code !== '23505') throw error;
      fetchSavedPosts(currentUserProfileId);
    } catch (error) {
      console.error('Error casting vote:', error);
      toast({ title: 'Error', description: 'Could not cast your vote. Please try again.', variant: 'destructive' });
    }
  };

  const handleUnsave = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleDeletePost = (postId: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Bookmark className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Saved Posts</h1>
        </div>

        {loading ? (
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
        ) : posts.length === 0 ? (
          <div className="centered py-12 subtle text-center">
            <Bookmark className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No saved posts yet</p>
            <p className="text-sm mt-1 text-muted-foreground">
              Posts you save from the feed will show up here.
            </p>
          </div>
        ) : (
          <div className="feed">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                id={post.id}
                user={
                  post.posted_as === 'company'
                    ? { id: post.company_id || undefined, name: post.company_name || 'Company', avatar: post.company_logo || undefined }
                    : { id: post.profiles?.id, name: post.profiles?.display_name || 'Unknown User', avatar: post.profiles?.avatar_url }
                }
                profileLink={post.posted_as === 'company' && post.company_id ? `/company/${post.company_id}` : undefined}
                content={post.content}
                image={post.image_url || undefined}
                timestamp={post.created_at}
                postType={post.post_type}
                videoUrl={post.video_url || undefined}
                documentUrl={post.document_url || undefined}
                documentName={post.document_name || undefined}
                carouselUrls={post.carousel_urls || undefined}
                poll={buildPollSummary(post.polls, currentUserProfileId)}
                onVote={(optionId) => post.polls && handleVote(post.polls.id, optionId)}
                reactionSummary={buildReactionSummary(post.post_reactions || [], currentUserProfileId)}
                onReact={(type) => handleReact(post.id, type)}
                onDelete={() => handleDeletePost(post.id)}
                onHide={() => handleUnsave(post.id)}
                cta={post.cta_enabled && post.cta_label && post.cta_url ? { label: post.cta_label, url: post.cta_url, openNewTab: post.cta_open_new_tab } : null}
                companyId={post.posted_as === 'company' ? post.company_id : null}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default SavedPosts;
