import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PostCard from '@/components/PostCard';
import { ReactionType } from '@/components/ReactionBar';
import { PollData, buildPollSummary, buildReactionSummary } from '@/lib/postAggregation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DetailPost {
  id: string;
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
  cta_enabled: boolean;
  cta_label: string | null;
  cta_url: string | null;
  cta_open_new_tab: boolean;
  user_id: string;
  profiles: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  post_reactions: { id: string; user_id: string; reaction_type: ReactionType }[];
  polls: PollData | null;
}

// Canonical single-post permalink -- this is where "Copy Link" in
// PostOptionsMenu points. Renders the same PostCard as the feed so every
// action in the three-dot menu behaves identically here.
const PostDetail = () => {
  const { postId } = useParams<{ postId: string }>();
  const [user, setUser] = useState<User | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [post, setPost] = useState<DetailPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setUser(authUser);
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', authUser.id)
          .single();
        setCurrentUserProfileId(profile?.id ?? null);
      }
      await fetchPost();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  const fetchPost = async () => {
    if (!postId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          post_reactions (id, user_id, reaction_type),
          comments (count),
          polls (
            id,
            question,
            poll_options ( id, option_text, position ),
            poll_votes ( id, option_id, user_id )
          )
        `)
        .eq('id', postId)
        .eq('status', 'published')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setNotFound(true);
        setPost(null);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('user_id', data.user_id)
        .maybeSingle();

      setPost({ ...data, profiles: profile || null } as unknown as DetailPost);
    } catch (error) {
      console.error('Error loading post:', error);
      toast({ title: 'Error', description: 'Could not load this post.', variant: 'destructive' });
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const handleReact = async (type: ReactionType | null) => {
    if (!currentUserProfileId || !post) return;
    try {
      if (type === null) {
        await supabase.from('post_reactions').delete()
          .eq('post_id', post.id).eq('user_id', currentUserProfileId);
      } else {
        await supabase.from('post_reactions').upsert(
          { post_id: post.id, user_id: currentUserProfileId, reaction_type: type },
          { onConflict: 'post_id,user_id' }
        );
      }
      fetchPost();
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
      fetchPost();
    } catch (error) {
      console.error('Error casting vote:', error);
      toast({ title: 'Error', description: 'Could not cast your vote. Please try again.', variant: 'destructive' });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Post</h1>
        </div>

        {loading ? (
          <div className="feed">
            <div className="post-card p-4 animate-pulse">
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
          </div>
        ) : notFound || !post ? (
          <div className="centered py-12 subtle text-center">
            <p className="font-medium">This post isn't available</p>
            <p className="text-sm mt-1 text-muted-foreground">
              It may have been deleted, or you may not have permission to view it.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => navigate('/dashboard')}>
              Back to feed
            </Button>
          </div>
        ) : (
          <div className="feed">
            <PostCard
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
              commentCount={(post as { comments?: { count: number }[] }).comments?.[0]?.count ?? 0}
              onReact={handleReact}
              onDelete={() => navigate('/dashboard')}
              onHide={() => navigate('/dashboard')}
              cta={post.cta_enabled && post.cta_label && post.cta_url ? { label: post.cta_label, url: post.cta_url, openNewTab: post.cta_open_new_tab } : null}
              companyId={post.posted_as === 'company' ? post.company_id : null}
            />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default PostDetail;
