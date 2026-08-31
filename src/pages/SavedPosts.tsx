import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PostCard from '@/components/PostCard';
import { ReactionType } from '@/components/ReactionBar';
import { buildPollSummary, buildReactionSummary } from '@/lib/postAggregation';
import { useCurrentProfileId } from '@/hooks/network/useCurrentProfileId';
import { useSavedPostIds, useSavedPostsList } from '@/hooks/useSavedPosts';
import { Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SavedPosts = () => {
  const [user, setUser] = useState<User | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const { data: currentUserProfileId } = useCurrentProfileId();
  const { data: savedIds } = useSavedPostIds();
  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSavedPostsList();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) {
        navigate('/');
        return;
      }
      setUser(authUser);
    });
  }, [navigate]);

  // The list pages hold the ORIGINAL posts. We additionally filter against
  // the shared saved-ids set so an unsave from the post menu (which flips
  // that set optimistically) drops the card here instantly -- no refetch,
  // no refresh -- while a still-saved post stays put.
  const posts = useMemo(() => {
    const all = (data?.pages ?? []).flatMap((p) => p.posts);
    if (!savedIds) return all;
    return all.filter((post) => savedIds.has(post.id));
  }, [data, savedIds]);

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
          { onConflict: 'post_id,user_id' },
        );
      }
      refetch();
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
      refetch();
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
          <Bookmark className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Saved Posts</h1>
        </div>

        {isLoading ? (
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
        ) : isError ? (
          <div className="centered py-12 subtle text-center">
            <Bookmark className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Couldn't load your saved posts</p>
            <p className="text-sm mt-1 text-muted-foreground">
              Something went wrong. Please try again.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : posts.length === 0 ? (
          <div className="centered py-12 subtle text-center">
            <Bookmark className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No saved posts yet</p>
            <p className="text-sm mt-1 text-muted-foreground">
              Tap the three-dot menu on any post and choose &ldquo;Save Post&rdquo; &mdash; it&rsquo;ll show up here.
            </p>
          </div>
        ) : (
          <>
            <div className="feed">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  id={post.id}
                  user={
                    post.posted_as === 'company'
                      ? { id: post.company_id || undefined, name: post.company_name || 'Company', avatar: post.company_logo || undefined }
                      : { id: post.profiles?.id, name: post.profiles?.display_name || 'Unknown User', avatar: post.profiles?.avatar_url || undefined }
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
                  poll={buildPollSummary(post.polls, currentUserProfileId ?? null)}
                  onVote={(optionId) => post.polls && handleVote(post.polls.id, optionId)}
                  reactionSummary={buildReactionSummary(post.post_reactions || [], currentUserProfileId ?? null)}
                  commentCount={post.comments?.[0]?.count ?? 0}
                  onReact={(type) => handleReact(post.id, type)}
                  onDelete={() => refetch()}
                  onHide={() => refetch()}
                  cta={post.cta_enabled && post.cta_label && post.cta_url ? { label: post.cta_label, url: post.cta_url, openNewTab: post.cta_open_new_tab ?? true } : null}
                  companyId={post.posted_as === 'company' ? post.company_id : null}
                />
              ))}
            </div>

            {hasNextPage ? (
              <div className="centered py-4">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="px-4 py-2 text-sm text-primary hover:bg-secondary/50 rounded-md transition-colors disabled:opacity-50"
                >
                  {isFetchingNextPage ? 'Loading...' : 'Load more'}
                </button>
              </div>
            ) : (
              <div className="centered py-4 subtle text-sm">
                <p>You're all caught up</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default SavedPosts;
