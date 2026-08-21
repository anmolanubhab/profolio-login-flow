import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PostCard from './PostCard';
import { useToast } from '@/hooks/use-toast';
import { ReactionType } from './ReactionBar';
import { PollData, buildPollSummary, buildReactionSummary, REACTION_WEIGHTS } from '@/lib/postAggregation';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  user_id: string;
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
  // post_reactions.user_id is a profiles.id (unlike the old post_likes.user_id,
  // which stored a raw auth uid).
  post_reactions: { id: string; user_id: string; reaction_type: ReactionType }[];
  // post_id is UNIQUE on polls -- PostgREST detects the 1:1 relationship and
  // embeds it as a single object (null for non-poll posts), not an array.
  polls: PollData | null;
}

// A post the user explicitly marked "Interested" (via PostOptionsMenu) gets
// a flat boost to its weighted-reaction sum before decay is applied --
// roughly equivalent to a couple of extra "insightful" reactions (the
// heaviest weight in REACTION_WEIGHTS), enough to noticeably outrank
// similarly-aged unmarked posts without completely overriding recency/decay.
const INTERESTED_BOOST = 10;

// Reddit/HN-style decayed score: weighted reaction sum divided by an
// increasing power of age in hours, so a heavily-reacted-to post can rank
// above a slightly newer one, but recency still matters.
const computeForYouScore = (post: Post, isInterested: boolean) => {
  const weightedSum = (post.post_reactions || []).reduce(
    (sum, r) => sum + (REACTION_WEIGHTS[r.reaction_type] || 1),
    0
  ) + (isInterested ? INTERESTED_BOOST : 0);
  const hoursOld = Math.max(0, (Date.now() - new Date(post.created_at).getTime()) / 36e5);
  return (weightedSum + 1) / Math.pow(hoursOld + 2, 1.5);
};

interface FeedProps {
  refresh?: number;
  mode?: 'foryou' | 'following';
}

// Posts fetched per page/batch, for both modes. 'following' pages are a
// straightforward chronological window. 'foryou' pages are also fetched
// as a recent-first, fixed-size window (NOT the whole table) -- see the
// tradeoff note above computeForYouScore's call site below.
const PAGE_SIZE = 24;

// Filter/preference data that only needs to be computed once per feed
// "session" (i.e. once per reset, not once per page) -- hidden/blocked/
// snoozed users, following audience, and Interested/Not-Interested ids all
// come from tables that don't change mid-scroll, so recomputing them on
// every "Load More" click would just be wasted round-trips.
interface FilterContext {
  currentUserProfileId: string | null;
  hiddenPostIds: string[];
  blockedUserIds: string[];
  snoozedUserIds: string[];
  followingAuthUserIds: string[] | null;
  followedCompanyIds: string[] | null;
  interestedPostIds: string[];
  notInterestedPostIds: string[];
}

// Keyset cursor for pagination: (created_at, id) instead of a bare offset
// (.range()) so that posts created *during* the user's session don't shift
// already-fetched rows and cause duplicates/skips across pages.
interface PostCursor {
  created_at: string;
  id: string;
}

const Feed = ({ refresh, mode = 'foryou' }: FeedProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [followingIsEmpty, setFollowingIsEmpty] = useState(false);
  const { toast } = useToast();

  const filterCtxRef = useRef<FilterContext | null>(null);
  const cursorRef = useRef<PostCursor | null>(null);
  // Ids of every post already appended to `posts` this session -- guards
  // against a post appearing twice if pagination and a new post being
  // created race each other (a purely offset-based .range() would be
  // vulnerable to this; the keyset cursor already avoids most of it, this
  // is belt-and-suspenders).
  const seenPostIdsRef = useRef<Set<string>>(new Set());

  const fetchPosts = async (isLoadMore = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setFollowingIsEmpty(false);
        cursorRef.current = null;
        seenPostIdsRef.current = new Set();
        setHasMore(true);
        filterCtxRef.current = null;
      }

      let ctx = filterCtxRef.current;

      if (!ctx) {
        ctx = await buildFilterContext(mode);
        filterCtxRef.current = ctx;

        if (mode === 'following' && ctx.followingAuthUserIds !== null && ctx.followedCompanyIds !== null &&
            ctx.followingAuthUserIds.length === 0 && ctx.followedCompanyIds.length === 0) {
          setPosts([]);
          setFollowingIsEmpty(true);
          setHasMore(false);
          setLoading(false);
          setLoadingMore(false);
          return;
        }
      }

      const {
        hiddenPostIds,
        blockedUserIds,
        snoozedUserIds,
        followingAuthUserIds,
        followedCompanyIds,
        interestedPostIds,
        notInterestedPostIds,
      } = ctx;

      // First get posts, then get profile info for each post.
      // status='published' matters here: posts.status defaults to
      // 'published', but AddPost.tsx can also save a 'draft' -- without this
      // filter, drafts were showing up in everyone's feed.
      let postsQuery = supabase
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
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(PAGE_SIZE);

      if (mode === 'following') {
        // Combine "posts by people I follow/am connected with" with "posts
        // by companies I follow" -- either clause can be empty (e.g. you
        // follow companies but no people yet), so build the .or() string
        // from whichever ones actually have entries.
        const orClauses: string[] = [];
        if (followingAuthUserIds && followingAuthUserIds.length > 0) {
          orClauses.push(`user_id.in.(${followingAuthUserIds.join(',')})`);
        }
        if (followedCompanyIds && followedCompanyIds.length > 0) {
          orClauses.push(`company_id.in.(${followedCompanyIds.join(',')})`);
        }
        if (orClauses.length > 0) {
          postsQuery = postsQuery.or(orClauses.join(','));
        }
      }

      // Keyset pagination: strictly older than the last row of the
      // previous page, using id as a tiebreaker for rows sharing a
      // created_at timestamp (chained .or() calls AND together, so this
      // combines with the 'following' audience clause above rather than
      // replacing it).
      if (cursorRef.current) {
        const { created_at, id } = cursorRef.current;
        postsQuery = postsQuery.or(
          `created_at.lt.${created_at},and(created_at.eq.${created_at},id.lt.${id})`
        );
      }

      const { data: postsData, error: postsError } = await postsQuery;

      if (postsError) throw postsError;

      const fetchedRows = postsData || [];

      // Advance the cursor to the last (oldest) row of this page, and
      // record whether we likely have more (a short page means we hit the
      // end of the table).
      if (fetchedRows.length > 0) {
        const last = fetchedRows[fetchedRows.length - 1];
        cursorRef.current = { created_at: last.created_at, id: last.id };
      }
      setHasMore(fetchedRows.length === PAGE_SIZE);

      // Drop any row we've already appended this session (defensive
      // dedupe -- see seenPostIdsRef above).
      const freshRows = fetchedRows.filter((post) => !seenPostIdsRef.current.has(post.id));
      freshRows.forEach((post) => seenPostIdsRef.current.add(post.id));

      // Get unique user IDs for just this batch
      const userIds = [...new Set(freshRows.map(post => post.user_id))];

      // Get profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url')
        .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profilesMap = new Map();
      profilesData?.forEach(profile => {
        profilesMap.set(profile.user_id, profile);
      });

      // Combine posts with profiles and filter
      const newPostsWithProfiles = freshRows
        .filter(post => {
          // Filter out hidden posts
          if (hiddenPostIds.includes(post.id)) return false;
          // Filter out posts from blocked users
          if (blockedUserIds.includes(post.user_id)) return false;
          // Filter out posts from snoozed users
          if (snoozedUserIds.includes(post.user_id)) return false;
          // "Not Interested" posts are filtered out of the 'foryou' feed
          // entirely, not just down-ranked.
          if (mode === 'foryou' && notInterestedPostIds.includes(post.id)) return false;
          return true;
        })
        .map(post => ({
          ...post,
          profiles: profilesMap.get(post.user_id) || null
        }));

      // Phase 5: "For You" is reaction-weighted + recency-decayed, not
      // strictly chronological. "Following" stays purely chronological --
      // it's meant to be a reliable "everything from people I follow", not
      // an algorithmic re-ordering. Posts explicitly marked "Interested"
      // get a ranking boost (see computeForYouScore/INTERESTED_BOOST).
      //
      // Pagination tradeoff (foryou mode): true "for you" ranking would
      // require scoring ALL published posts globally, since a heavily-
      // reacted-to old post could in principle outrank a page's worth of
      // newer ones -- but scores also shift with decay as time passes, so
      // even a global score isn't stable between page loads. Rather than
      // fetch the entire table (unbounded growth, the exact problem we're
      // fixing) or build a server-side ranking RPC/materialized view (a much
      // larger change, out of scope here), each PAGE_SIZE batch is fetched
      // recency-first and scored+sorted independently, then appended after
      // whatever's already on screen. This means ranking is only "locally"
      // correct within a batch, not globally correct across the whole
      // scroll -- an old, heavily-reacted post that would outscore page 2
      // but not page 1 won't get pulled forward across the page boundary.
      // That's an accepted, documented limitation of client-side scoring,
      // not a bug.
      if (mode === 'foryou') {
        newPostsWithProfiles.sort(
          (a, b) =>
            computeForYouScore(b, interestedPostIds.includes(b.id)) -
            computeForYouScore(a, interestedPostIds.includes(a.id))
        );
      }

      setPosts(prev => (isLoadMore ? [...prev, ...newPostsWithProfiles] : newPostsWithProfiles));
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error loading posts",
        description: "Could not load the feed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Builds the once-per-session filter/audience context described by
  // FilterContext above. Pulled out of fetchPosts so "Load More" can reuse
  // it without re-querying hidden/blocked/snoozed/following tables.
  const buildFilterContext = async (feedMode: 'foryou' | 'following'): Promise<FilterContext> => {
    const ctx: FilterContext = {
      currentUserProfileId: null,
      hiddenPostIds: [],
      blockedUserIds: [],
      snoozedUserIds: [],
      followingAuthUserIds: null,
      followedCompanyIds: null,
      interestedPostIds: [],
      notInterestedPostIds: [],
    };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return ctx;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    ctx.currentUserProfileId = profile?.id || null;

    if (!ctx.currentUserProfileId) return ctx;

    // Fetch hidden posts
    const { data: hiddenData } = await supabase
      .from('hidden_posts')
      .select('post_id')
      .eq('user_id', ctx.currentUserProfileId);
    ctx.hiddenPostIds = hiddenData?.map((h) => h.post_id) || [];

    // Fetch blocked users
    const { data: blockedData } = await supabase
      .from('blocked_users')
      .select('blocked_user_id')
      .eq('user_id', ctx.currentUserProfileId);

    // Convert blocked profile IDs to user IDs for filtering
    if (blockedData && blockedData.length > 0) {
      const blockedProfileIds = blockedData.map((b) => b.blocked_user_id);
      const { data: blockedProfiles } = await supabase
        .from('profiles')
        .select('id, user_id')
        .in('id', blockedProfileIds);
      ctx.blockedUserIds = blockedProfiles?.map((p) => p.user_id) || [];
    }

    // Fetch snoozed users (not expired)
    const { data: snoozedData } = await supabase
      .from('snoozed_users')
      .select('snoozed_user_id')
      .eq('user_id', ctx.currentUserProfileId)
      .gt('snoozed_until', new Date().toISOString());

    // Fetch "Interested"/"Not Interested" feed preferences (set via
    // PostOptionsMenu) -- only relevant to 'foryou' ranking below.
    if (feedMode === 'foryou') {
      const { data: prefsData } = await supabase
        .from('user_feed_preferences')
        .select('interested_posts, not_interested_posts')
        .eq('user_id', ctx.currentUserProfileId)
        .maybeSingle();
      ctx.interestedPostIds = prefsData?.interested_posts || [];
      ctx.notInterestedPostIds = prefsData?.not_interested_posts || [];
    }

    // Convert snoozed profile IDs to user IDs
    if (snoozedData && snoozedData.length > 0) {
      const snoozedProfileIds = snoozedData.map((s) => s.snoozed_user_id);
      const { data: snoozedProfiles } = await supabase
        .from('profiles')
        .select('id, user_id')
        .in('id', snoozedProfileIds);
      ctx.snoozedUserIds = snoozedProfiles?.map((p) => p.user_id) || [];
    }

    if (feedMode === 'following') {
      // "Following" audience = people you're connected with (accepted,
      // either direction) UNION people you explicitly follow, UNION
      // companies you follow.
      const [{ data: connectionsData }, { data: followingData }, { data: companyFollowsData }] = await Promise.all([
        supabase
          .from('connections')
          .select('user_id, connection_id')
          .eq('status', 'accepted')
          .or(`user_id.eq.${ctx.currentUserProfileId},connection_id.eq.${ctx.currentUserProfileId}`),
        supabase
          .from('followers')
          .select('following_id')
          .eq('follower_id', ctx.currentUserProfileId),
        supabase
          .from('company_followers')
          .select('company_id')
          .eq('user_id', ctx.currentUserProfileId),
      ]);

      const connectedProfileIds = (connectionsData || []).map((c) =>
        c.user_id === ctx.currentUserProfileId ? c.connection_id : c.user_id
      );
      const followedProfileIds = (followingData || []).map((f) => f.following_id);
      const audienceProfileIds = [...new Set([...connectedProfileIds, ...followedProfileIds])];
      ctx.followedCompanyIds = [...new Set((companyFollowsData || []).map((c) => c.company_id))];

      if (audienceProfileIds.length > 0) {
        const { data: audienceProfiles } = await supabase
          .from('profiles')
          .select('user_id')
          .in('id', audienceProfileIds);
        ctx.followingAuthUserIds = (audienceProfiles || []).map((p) => p.user_id);
      } else {
        ctx.followingAuthUserIds = [];
      }
    }

    return ctx;
  };

  useEffect(() => {
    fetchPosts(false);
  }, [refresh, mode]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        setCurrentUserProfileId(profile?.id ?? null);
      }
    });
  }, []);

  // Phase 1 rules: one active reaction per user per post -- switching
  // reaction UPDATEs the existing row (never a second insert), and
  // reacting with `null` (or picking the already-active reaction again)
  // removes it.
  const handleReact = async (postId: string, type: ReactionType | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!profile) return;

      if (type === null) {
        // Removing a reaction -- no upsert needed.
        await supabase
          .from('post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', profile.id);
      } else {
        // Reacting for the first time or switching reaction -- a single
        // atomic upsert (post_reactions has a UNIQUE(post_id, user_id)
        // constraint) instead of select-then-branch, which could race
        // under rapid double-clicks or two open tabs.
        //
        // Toggling off by re-picking the same reaction is handled by the
        // caller diffing against the current summary before calling this
        // (see ReactionBar/PostCard); this path always sets/switches.
        await supabase.from('post_reactions').upsert(
          {
            post_id: postId,
            user_id: profile.id,
            reaction_type: type,
          },
          { onConflict: 'post_id,user_id' }
        );
      }

      // Update the reacted-to post in place rather than refetching the
      // whole feed -- with pagination, a full fetchPosts() would reset back
      // to page 1 and drop every page loaded via "Load More" since.
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (post.id !== postId) return post;
          const others = post.post_reactions.filter(r => r.user_id !== profile.id);
          const updatedReactions =
            type === null
              ? others
              : [...others, { id: `local-${profile.id}`, user_id: profile.id, reaction_type: type }];
          return { ...post, post_reactions: updatedReactions };
        })
      );
    } catch (error) {
      console.error('Error updating reaction:', error);
      toast({
        title: "Error",
        description: "Could not update your reaction. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Poll votes are immutable server-side (no UPDATE/DELETE RLS policy on
  // poll_votes) -- once cast, a vote can't be changed, matching real poll
  // UX. A duplicate-vote race (e.g. two tabs) is caught below rather than
  // shown as a generic error.
  const handleVote = async (pollId: string, optionId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!profile) return;

      const { error } = await supabase.from('poll_votes').insert({
        poll_id: pollId,
        option_id: optionId,
        user_id: profile.id,
      });

      if (error) {
        if (error.code === '23505') {
          // Already voted -- nothing to update locally, the existing vote
          // already reflects this choice.
          return;
        }
        throw error;
      }

      // Update the voted-on poll in place -- same reasoning as handleReact:
      // a full refetch would reset pagination back to page 1.
      setPosts(prevPosts =>
        prevPosts.map(post => {
          if (!post.polls || post.polls.id !== pollId) return post;
          return {
            ...post,
            polls: {
              ...post.polls,
              poll_votes: [...post.polls.poll_votes, { id: `local-${profile.id}`, option_id: optionId, user_id: profile.id }],
            },
          };
        })
      );
    } catch (error) {
      console.error('Error casting vote:', error);
      toast({
        title: "Error",
        description: "Could not cast your vote. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeletePost = (postId: string) => {
    setPosts(prevPosts => prevPosts.filter(post => post.id !== postId));
  };

  const handleHidePost = () => {
    // Hiding changes the underlying filter set (hidden_posts), so reset and
    // refetch from page 1 -- this is a rare action, unlike reactions/votes,
    // so resetting scroll position here is an acceptable tradeoff.
    fetchPosts(false);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchPosts(true);
    }
  };

  if (loading) {
    return (
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
    );
  }

  if (posts.length === 0) {
    return (
      <div className="centered py-12 subtle">
        {mode === 'following' && followingIsEmpty ? (
          <>
            <p className="font-medium">Your Following feed is empty</p>
            <p className="text-sm mt-1">Connect with people or follow them from their profile to see their posts here.</p>
          </>
        ) : (
          <p>No posts yet. Be the first to share something!</p>
        )}
      </div>
    );
  }

  return (
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
          onHide={handleHidePost}
          cta={post.cta_enabled && post.cta_label && post.cta_url ? { label: post.cta_label, url: post.cta_url, openNewTab: post.cta_open_new_tab } : null}
          companyId={post.posted_as === 'company' ? post.company_id : null}
        />
      ))}

      {hasMore ? (
        <div className="centered py-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-4 py-2 text-sm text-primary hover:bg-secondary/50 rounded-md transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      ) : (
        <div className="centered py-4 subtle text-sm">
          <p>You're all caught up</p>
        </div>
      )}
    </div>
  );
};

export default Feed;