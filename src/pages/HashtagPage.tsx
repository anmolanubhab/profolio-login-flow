import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { Hash } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import PostCard from '@/components/PostCard';
import { ReactionType } from '@/components/ReactionBar';
import { buildPollSummary, buildReactionSummary, type PollData } from '@/lib/postAggregation';
import { useCurrentProfileId } from '@/hooks/network/useCurrentProfileId';
import type { RichDoc } from '@/lib/posts/richText';

const PAGE_SIZE = 15;

interface HashtagPost {
  id: string;
  content: string;
  content_rich: RichDoc | null;
  image_url: string | null;
  created_at: string;
  user_id: string;
  post_type: string;
  video_url: string | null;
  document_url: string | null;
  document_name: string | null;
  carousel_urls: string[] | null;
  media: unknown;
  company_id: string | null;
  company_name: string | null;
  company_logo: string | null;
  posted_as: string;
  cta_enabled: boolean | null;
  cta_label: string | null;
  cta_url: string | null;
  cta_open_new_tab: boolean | null;
  profiles: { id: string; display_name: string | null; avatar_url: string | null } | null;
  post_reactions: { id: string; user_id: string; reaction_type: ReactionType }[];
  polls: PollData | null;
  comments: { count: number }[];
}

/** "#EV" / "ev" / "%23ev" -> "ev". Same rules as the DB normalize_hashtag(). */
function normalizeTag(raw: string | undefined): string {
  return decodeURIComponent(raw ?? '')
    .toLowerCase()
    .replace(/^#+/, '')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 100);
}

const HashtagPage = () => {
  const { tag: rawTag } = useParams<{ tag: string }>();
  const tag = normalizeTag(rawTag);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: currentUserProfileId } = useCurrentProfileId();

  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<HashtagPost[]>([]);
  const [postCount, setPostCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);

  const hashtagIdRef = useRef<string | null>(null);
  const cursorRef = useRef<{ created_at: string; id: string } | null>(null);
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) navigate('/');
      else setUser(authUser);
    });
  }, [navigate]);

  const hydrate = useCallback(async (rows: HashtagPost[]): Promise<HashtagPost[]> => {
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: profs } = await supabase
      .from('profiles')
      .select('id, user_id, display_name, avatar_url')
      .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
    const map = new Map((profs ?? []).map((p) => [p.user_id, p]));
    return rows.map((r) => ({ ...r, profiles: map.get(r.user_id) ?? null }));
  }, []);

  const fetchPage = useCallback(
    async (isMore: boolean) => {
      if (!tag) {
        setError(true);
        setLoading(false);
        return;
      }
      if (isMore) setLoadingMore(true);
      else setLoading(true);
      try {
        if (!isMore) {
          cursorRef.current = null;
          seenRef.current = new Set();
          hashtagIdRef.current = null;

          const { data: ht, error: htErr } = await supabase
            .from('hashtags')
            .select('id, post_count')
            .eq('tag', tag)
            .maybeSingle();
          if (htErr) throw htErr;
          if (!ht) {
            setPosts([]);
            setPostCount(0);
            setHasMore(false);
            setLoading(false);
            return;
          }
          hashtagIdRef.current = ht.id;
          setPostCount(ht.post_count ?? null);
        }

        const hashtagId = hashtagIdRef.current;
        if (!hashtagId) {
          setHasMore(false);
          return;
        }

        let q = supabase
          .from('posts')
          .select(
            `
            id, content, content_rich, image_url, created_at, user_id, post_type,
            video_url, document_url, document_name, carousel_urls, media,
            company_id, company_name, company_logo, posted_as,
            cta_enabled, cta_label, cta_url, cta_open_new_tab,
            post_hashtags!inner ( hashtag_id ),
            post_reactions ( id, user_id, reaction_type ),
            comments (count),
            polls ( id, question, expires_at, poll_options ( id, option_text, position ), poll_votes ( id, option_id, user_id ) )
          `,
          )
          .eq('post_hashtags.hashtag_id', hashtagId)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(PAGE_SIZE);

        if (cursorRef.current) {
          const { created_at, id } = cursorRef.current;
          q = q.or(`created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`);
        }

        const { data, error: qErr } = await q;
        if (qErr) throw qErr;

        const rows = (data ?? []) as unknown as HashtagPost[];
        if (rows.length > 0) {
          const last = rows[rows.length - 1];
          cursorRef.current = { created_at: last.created_at, id: last.id };
        }
        setHasMore(rows.length === PAGE_SIZE);

        const fresh = rows.filter((r) => !seenRef.current.has(r.id));
        fresh.forEach((r) => seenRef.current.add(r.id));
        const hydrated = await hydrate(fresh);
        setPosts((prev) => (isMore ? [...prev, ...hydrated] : hydrated));
        setError(false);
      } catch (err) {
        console.error('Error loading hashtag feed:', err);
        setError(true);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [tag, hydrate],
  );

  useEffect(() => {
    fetchPage(false);
  }, [fetchPage]);

  const handleReact = async (postId: string, type: ReactionType | null) => {
    if (!currentUserProfileId) return;
    try {
      if (type === null) {
        await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', currentUserProfileId);
      } else {
        await supabase
          .from('post_reactions')
          .upsert({ post_id: postId, user_id: currentUserProfileId, reaction_type: type }, { onConflict: 'post_id,user_id' });
      }
      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          const others = p.post_reactions.filter((r) => r.user_id !== currentUserProfileId);
          return {
            ...p,
            post_reactions:
              type === null
                ? others
                : [...others, { id: `local-${currentUserProfileId}`, user_id: currentUserProfileId, reaction_type: type }],
          };
        }),
      );
    } catch (err) {
      console.error('Error updating reaction:', err);
      toast({ title: 'Error', description: 'Could not update your reaction.', variant: 'destructive' });
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    if (!currentUserProfileId) return;
    try {
      const { error: vErr } = await supabase
        .from('poll_votes')
        .insert({ poll_id: pollId, option_id: optionId, user_id: currentUserProfileId });
      if (vErr && vErr.code !== '23505') throw vErr;
      setPosts((prev) =>
        prev.map((p) => {
          if (!p.polls || p.polls.id !== pollId) return p;
          return {
            ...p,
            polls: {
              ...p.polls,
              poll_votes: [
                ...p.polls.poll_votes,
                { id: `local-${currentUserProfileId}`, option_id: optionId, user_id: currentUserProfileId },
              ],
            },
          };
        }),
      );
    } catch (err) {
      console.error('Error casting vote:', err);
      toast({ title: 'Error', description: 'Could not cast your vote.', variant: 'destructive' });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Hash className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">#{tag || 'hashtag'}</h1>
            {postCount != null && (
              <p className="text-sm text-muted-foreground">
                {postCount.toLocaleString()} {postCount === 1 ? 'post' : 'posts'}
              </p>
            )}
          </div>
        </div>

        {loading ? (
          <div className="feed">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="post-card animate-pulse p-4">
                <div className="mb-3 flex gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="mb-2 h-4 w-32 rounded bg-muted" />
                    <div className="h-3 w-20 rounded bg-muted" />
                  </div>
                </div>
                <div className="mb-2 h-4 w-full rounded bg-muted" />
                <div className="h-4 w-3/4 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="centered subtle py-12">
            <p className="font-medium">Couldn’t load posts for this hashtag</p>
            <button
              type="button"
              onClick={() => fetchPage(false)}
              className="mt-2 text-sm font-semibold text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="centered subtle py-12">
            <p className="font-medium">No posts with #{tag} yet</p>
            <p className="mt-1 text-sm">Be the first to post about it.</p>
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
                  contentRich={post.content_rich}
                  image={post.image_url || undefined}
                  timestamp={post.created_at}
                  postType={post.post_type}
                  videoUrl={post.video_url || undefined}
                  documentUrl={post.document_url || undefined}
                  documentName={post.document_name || undefined}
                  carouselUrls={post.carousel_urls || undefined}
                  media={post.media}
                  poll={buildPollSummary(post.polls, currentUserProfileId ?? null)}
                  onVote={(optionId) => post.polls && handleVote(post.polls.id, optionId)}
                  reactionSummary={buildReactionSummary(post.post_reactions || [], currentUserProfileId ?? null)}
                  onReact={(type) => handleReact(post.id, type)}
                  cta={
                    post.cta_enabled && post.cta_label && post.cta_url
                      ? { label: post.cta_label, url: post.cta_url, openNewTab: post.cta_open_new_tab ?? true }
                      : null
                  }
                  companyId={post.posted_as === 'company' ? post.company_id : null}
                  commentCount={post.comments?.[0]?.count ?? 0}
                />
              ))}
            </div>

            {hasMore ? (
              <div className="centered py-4">
                <button
                  onClick={() => !loadingMore && fetchPage(true)}
                  disabled={loadingMore}
                  className="rounded-md px-4 py-2 text-sm text-primary transition-colors hover:bg-secondary/50 disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            ) : (
              <div className="centered subtle py-4 text-sm">
                <p>You’re all caught up</p>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default HashtagPage;
