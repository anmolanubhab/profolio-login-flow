import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import PostCard, { type RepostContext } from './PostCard';
import { useToast } from '@/hooks/use-toast';
import { ReactionType } from './ReactionBar';
import { PollData, buildPollSummary, buildReactionSummary, REACTION_WEIGHTS } from '@/lib/postAggregation';
import { usePersonalizationValue } from '@/hooks/usePersonalization';

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
  // post_reposts.user_id is a profiles.id.
  post_reposts: { id: string; user_id: string; commentary: string | null }[];
  // Aggregate-only embed: PostgREST returns [{ count }] for comments(count).
  // Used to seed the Comment button; the full thread loads on demand.
  comments: { count: number }[];
  // Set only for post_type === 'insight' -- the published Insight article this
  // feed card represents. The article itself stays the source of truth.
  insight_article: {
    slug: string;
    title: string;
    subtitle: string | null;
    reading_minutes: number | null;
    cover_url: string | null;
    insight: { slug: string; title: string } | null;
  } | null;
}

interface RepostFeedItem {
  repostId: string;
  createdAt: string;
  commentary: string | null;
  reposter: { profileId: string; userId: string; name: string; avatar?: string };
  post: Post;
}

type TimelineEntry =
  | { kind: 'post'; key: string; ts: number; post: Post }
  | { kind: 'repost'; key: string; ts: number; item: RepostFeedItem };

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
  blockedCompanyIds: string[];
  snoozedCompanyIds: string[];
  followingAuthUserIds: string[] | null;
  followedCompanyIds: string[] | null;
  interestedPostIds: string[];
  notInterestedPostIds: string[];
  dismissedPostIds: string[];
  // Always populated (both modes) -- profiles.id / companies.id the current
  // user already follows, used to mark a card "Suggested" and to seed its
  // Follow/Following button without a per-card fetch.
  followedProfileIds: string[];
  followedCompanyIdSet: string[];
}

// Keyset cursor for pagination: (created_at, id) instead of a bare offset
// (.range()) so that posts created *during* the user's session don't shift
// already-fetched rows and cause duplicates/skips across pages.
interface PostCursor {
  created_at: string;
  id: string;
}

const Feed = ({ refresh, mode = 'foryou' }: FeedProps) => {
  // Settings -> Ads & data use -> Personalised recommendations. When off, the
  // "For You" feed is left in its recency-first fetch order (no activity-based
  // re-ranking). Default on.
  const personalizationEnabled = usePersonalizationValue();
  const [posts, setPosts] = useState<Post[]>([]);
  const [repostItems, setRepostItems] = useState<RepostFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [followingIsEmpty, setFollowingIsEmpty] = useState(false);
  // LinkedIn-style inline dismissal: "Not Interested" / "Hide Post" replace the
  // card in place with an Undo strip. The map is post_id -> {label, onUndo};
  // renderPostCard swaps the card for <FeedDismissedStrip> while the id is here.
  // Cleared on a full feed reset (the not_interested/hidden filter then keeps
  // those posts out for real).
  const [dismissed, setDismissed] = useState<Map<string, { label: string; onUndo: () => void | Promise<void> }>>(new Map());
  const dismissedRef = useRef(dismissed);
  useEffect(() => { dismissedRef.current = dismissed; }, [dismissed]);
  const { toast } = useToast();

  const filterCtxRef = useRef<FilterContext | null>(null);
  const cursorRef = useRef<PostCursor | null>(null);
  // Ids of every post already appended to `posts` this session -- guards
  // against a post appearing twice if pagination and a new post being
  // created race each other (a purely offset-based .range() would be
  // vulnerable to this; the keyset cursor already avoids most of it, this
  // is belt-and-suspenders).
  const seenPostIdsRef = useRef<Set<string>>(new Set());

  // Recent reposts -> "<name> reposted this" cards, merged into the timeline
  // by timestamp. Refreshed on first-page loads and after the viewer reposts
  // / undoes from any card. Respects the same hidden/blocked/snoozed context.
  const fetchRepostItems = useCallback(async () => {
    // "<name> reposted this" cards are a For You surface. Following mode stays a
    // strict chronological window of posts by people/companies you follow.
    if (mode !== 'foryou') {
      setRepostItems([]);
      return;
    }
    try {
      const ctx = filterCtxRef.current;
      const { data, error } = await supabase
        .from('post_reposts')
        .select(
          `id, commentary, created_at, user_id, post_id,
           posts:posts!post_reposts_post_id_fkey (
             *,
             post_reactions (id, user_id, reaction_type),
             post_reposts (id, user_id, commentary),
             comments (count),
             polls ( id, question, poll_options ( id, option_text, position ), poll_votes ( id, option_id, user_id ) ),
             insight_article:insight_articles!posts_insight_article_id_fkey (
               slug, title, subtitle, reading_minutes, cover_url,
               insight:insights!insight_articles_insight_id_fkey ( slug, title )
             )
           )`,
        )
        .not('posts', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;

      type Row = {
        id: string; commentary: string | null; created_at: string; user_id: string; post_id: string;
        posts: (Post & { post_reactions: Post['post_reactions']; polls: PollData | null }) | null;
      };
      const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.posts);
      if (rows.length === 0) {
        setRepostItems([]);
        return;
      }

      const reposterIds = [...new Set(rows.map((r) => r.user_id))];
      const authorAuthIds = [...new Set(rows.map((r) => r.posts!.user_id))];
      const [{ data: reposterProfiles }, { data: authorProfiles }] = await Promise.all([
        supabase.from('profiles').select('id, user_id, display_name, avatar_url').in('id', reposterIds),
        supabase.from('profiles').select('id, user_id, display_name, avatar_url').in('user_id', authorAuthIds),
      ]);
      const reposterMap = new Map((reposterProfiles ?? []).map((p) => [p.id, p]));
      const authorMap = new Map((authorProfiles ?? []).map((p) => [p.user_id, p]));

      const items: RepostFeedItem[] = [];
      for (const r of rows) {
        const op = r.posts!;
        if (ctx) {
          if (ctx.hiddenPostIds.includes(op.id)) continue;
          if (ctx.blockedUserIds.includes(op.user_id)) continue;
          if (ctx.snoozedUserIds.includes(op.user_id)) continue;
          if (op.company_id && ctx.blockedCompanyIds.includes(op.company_id)) continue;
          if (op.company_id && ctx.snoozedCompanyIds.includes(op.company_id)) continue;
        }
        const rp = reposterMap.get(r.user_id);
        if (!rp) continue;
        items.push({
          repostId: r.id,
          createdAt: r.created_at,
          commentary: r.commentary ?? null,
          reposter: {
            profileId: rp.id,
            userId: rp.user_id,
            name: rp.display_name || 'Unknown User',
            avatar: rp.avatar_url || undefined,
          },
          post: { ...op, profiles: authorMap.get(op.user_id) || null },
        });
      }
      setRepostItems(items);
    } catch (err) {
      console.error('Error fetching reposts:', err);
    }
  }, [mode]);

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
        // A full reset rebuilds the not_interested/hidden filter, so the
        // inline strips are no longer needed -- those posts are filtered out.
        setDismissed(new Map());
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
        blockedCompanyIds,
        snoozedCompanyIds,
        followingAuthUserIds,
        followedCompanyIds,
        interestedPostIds,
        notInterestedPostIds,
        dismissedPostIds,
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
          post_reposts (id, user_id, commentary),
          comments (count),
          polls (
            id,
            question,
            poll_options ( id, option_text, position ),
            poll_votes ( id, option_id, user_id )
          ),
          insight_article:insight_articles!posts_insight_article_id_fkey (
            slug, title, subtitle, reading_minutes, cover_url,
            insight:insights!insight_articles_insight_id_fkey ( slug, title )
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
          // Filter out posts from blocked/snoozed companies (company posts
          // only -- post.company_id is null for personal posts).
          if (post.company_id && blockedCompanyIds.includes(post.company_id)) return false;
          if (post.company_id && snoozedCompanyIds.includes(post.company_id)) return false;
          // "Not Interested" posts are filtered out of the 'foryou' feed
          // entirely, not just down-ranked.
          if (mode === 'foryou' && notInterestedPostIds.includes(post.id)) return false;
          // Dismissed via the "Suggested" card's X -- stays out of the feed
          // (any mode) until the user undoes it, same lifetime as Hide Post.
          if (dismissedPostIds.includes(post.id)) return false;
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
      if (mode === 'foryou' && personalizationEnabled) {
        newPostsWithProfiles.sort(
          (a, b) =>
            computeForYouScore(b, interestedPostIds.includes(b.id)) -
            computeForYouScore(a, interestedPostIds.includes(a.id))
        );
      }

      setPosts(prev => (isLoadMore ? [...prev, ...newPostsWithProfiles] : newPostsWithProfiles));

      // Recent "<someone> reposted this" activity is surfaced on the first
      // page only (not appended per Load More) -- older reposts still reach
      // the feed via their original post.
      if (!isLoadMore) {
        void fetchRepostItems();
      }
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
      blockedCompanyIds: [],
      snoozedCompanyIds: [],
      followingAuthUserIds: null,
      followedCompanyIds: null,
      interestedPostIds: [],
      notInterestedPostIds: [],
      dismissedPostIds: [],
      followedProfileIds: [],
      followedCompanyIdSet: [],
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

    // Fetch blocked companies
    const { data: blockedCompaniesData } = await supabase
      .from('blocked_companies')
      .select('blocked_company_id')
      .eq('user_id', ctx.currentUserProfileId);
    ctx.blockedCompanyIds = blockedCompaniesData?.map((b) => b.blocked_company_id) || [];

    // Fetch snoozed companies (not expired, covers both "Snooze" and "Hide
    // all from" -- both write to this table, only the duration differs)
    const { data: snoozedCompaniesData } = await supabase
      .from('snoozed_companies')
      .select('snoozed_company_id')
      .eq('user_id', ctx.currentUserProfileId)
      .gt('snoozed_until', new Date().toISOString());
    ctx.snoozedCompanyIds = snoozedCompaniesData?.map((s) => s.snoozed_company_id) || [];

    // Dismissed suggested posts -- filtered out of the feed entirely,
    // regardless of mode (once dismissed, stays dismissed until undone).
    const { data: dismissedData } = await supabase
      .from('dismissed_suggested_posts')
      .select('post_id')
      .eq('user_id', ctx.currentUserProfileId);
    ctx.dismissedPostIds = dismissedData?.map((d) => d.post_id) || [];

    // Who the user already follows -- needed in BOTH modes (not just
    // 'following') so every post card can render "Suggested" + the correct
    // Follow/Following state without a per-card fetch.
    const [{ data: followedProfilesData }, { data: followedCompaniesData }] = await Promise.all([
      supabase.from('followers').select('following_id').eq('follower_id', ctx.currentUserProfileId),
      supabase.from('company_followers').select('company_id').eq('user_id', ctx.currentUserProfileId),
    ]);
    ctx.followedProfileIds = followedProfilesData?.map((f) => f.following_id) || [];
    ctx.followedCompanyIdSet = followedCompaniesData?.map((c) => c.company_id) || [];

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, mode, personalizationEnabled]);

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
    setRepostItems(prev => prev.filter(r => r.post.id !== postId));
  };

  const timeline = useMemo<TimelineEntry[]>(() => {
    const entries: TimelineEntry[] = posts.map((post) => ({
      kind: 'post' as const,
      key: `p:${post.id}`,
      ts: new Date(post.created_at).getTime(),
      post,
    }));
    for (const item of repostItems) {
      entries.push({
        kind: 'repost',
        key: `r:${item.repostId}`,
        ts: new Date(item.createdAt).getTime(),
        item,
      });
    }
    return entries.sort((a, b) => b.ts - a.ts);
  }, [posts, repostItems]);

  const repostSeedFor = (post: Post) => ({
    count: post.post_reposts?.length ?? 0,
    hasReposted:
      !!currentUserProfileId && (post.post_reposts || []).some((r) => r.user_id === currentUserProfileId),
    commentary:
      (post.post_reposts || []).find((r) => r.user_id === currentUserProfileId)?.commentary ?? null,
  });

  const handleHidePost = () => {
    // Hiding changes the underlying filter set (hidden_posts), so reset and
    // refetch from page 1 -- this is a rare action, unlike reactions/votes,
    // so resetting scroll position here is an acceptable tradeoff.
    fetchPosts(false);
  };

  // Called by PostOptionsMenu for "Not Interested" / "Hide Post": swap the card
  // for an inline Undo strip, no refetch, no scroll jump. The DB write already
  // happened in the menu; onUndo reverses it.
  const handleInlineDismiss = useCallback(
    (info: { postId: string; label: string; onUndo: () => void | Promise<void> }) => {
      setDismissed((prev) => new Map(prev).set(info.postId, { label: info.label, onUndo: info.onUndo }));
    },
    [],
  );

  const handleUndoDismiss = useCallback((postId: string) => {
    const entry = dismissedRef.current.get(postId);
    setDismissed((prev) => {
      const next = new Map(prev);
      next.delete(postId);
      return next;
    });
    Promise.resolve(entry?.onUndo?.()).catch((err) => {
      console.error('Error undoing dismissal:', err);
      toast({ title: 'Could not undo', variant: 'destructive' });
    });
  }, [toast]);

  // "X" on a Suggested card -- removes just that card from the current
  // screen immediately (no refetch/scroll reset needed, unlike Hide Post,
  // since dismissal only ever affects this one already-loaded row) and
  // persists it so it stays gone on refresh. Rolls back on failure instead
  // of pretending it worked.
  const handleDismissSuggested = async (postId: string) => {
    if (!currentUserProfileId) return;
    const removed = posts.find((p) => p.id === postId);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
    try {
      const { error } = await supabase.from('dismissed_suggested_posts').insert({
        user_id: currentUserProfileId,
        post_id: postId,
      });
      if (error && error.code !== '23505') throw error;
    } catch (error) {
      console.error('Error dismissing suggested post:', error);
      // Roll back -- put the card back where it was rather than leaving the
      // user thinking dismissal succeeded when it didn't persist.
      if (removed) {
        setPosts((prev) => (prev.some((p) => p.id === postId) ? prev : [...prev, removed].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )));
      }
      toast({
        title: 'Error',
        description: 'Could not dismiss this suggestion. Please try again.',
        variant: 'destructive',
      });
    }
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

  if (timeline.length === 0) {
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

  const ctx = filterCtxRef.current;
  const isSuggestedPost = (post: Post) => {
    if (!ctx) return false;
    if (post.posted_as === 'company') {
      return !!post.company_id && !ctx.followedCompanyIdSet.includes(post.company_id);
    }
    if (post.user_id === currentUserId) return false; // own post
    return !!post.profiles?.id && !ctx.followedProfileIds.includes(post.profiles.id);
  };
  const isFollowingAuthorOf = (post: Post) => {
    if (!ctx) return false;
    if (post.posted_as === 'company') {
      return !!post.company_id && ctx.followedCompanyIdSet.includes(post.company_id);
    }
    return !!post.profiles?.id && ctx.followedProfileIds.includes(post.profiles.id);
  };

  const renderPostCard = (post: Post, repostContext?: RepostContext) => {
    const seed = repostSeedFor(post);
    const cardKey = repostContext ? `r:${repostContext.repostedAt}:${post.id}` : post.id;

    const strip = dismissed.get(post.id);
    if (strip) {
      return (
        <FeedDismissedStrip
          key={cardKey}
          label={strip.label}
          onUndo={() => handleUndoDismiss(post.id)}
        />
      );
    }

    return (
      <PostCard
        key={cardKey}
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
        insight={
          post.post_type === 'insight' && post.insight_article
            ? {
                articleSlug: post.insight_article.slug,
                articleTitle: post.insight_article.title,
                subtitle: post.insight_article.subtitle,
                coverUrl: post.insight_article.cover_url,
                readingMinutes: post.insight_article.reading_minutes,
                insightSlug: post.insight_article.insight?.slug ?? '',
                insightTitle: post.insight_article.insight?.title ?? 'Insight',
              }
            : undefined
        }
        poll={buildPollSummary(post.polls, currentUserProfileId)}
        onVote={(optionId) => post.polls && handleVote(post.polls.id, optionId)}
        reactionSummary={buildReactionSummary(post.post_reactions || [], currentUserProfileId)}
        onReact={(type) => handleReact(post.id, type)}
        onDelete={() => handleDeletePost(post.id)}
        onHide={handleHidePost}
        onInlineDismiss={handleInlineDismiss}
        cta={post.cta_enabled && post.cta_label && post.cta_url ? { label: post.cta_label, url: post.cta_url, openNewTab: post.cta_open_new_tab } : null}
        companyId={post.posted_as === 'company' ? post.company_id : null}
        isSuggested={!repostContext && isSuggestedPost(post)}
        isFollowingAuthor={isFollowingAuthorOf(post)}
        onDismissSuggested={() => handleDismissSuggested(post.id)}
        repostCount={seed.count}
        hasReposted={seed.hasReposted}
        myRepostCommentary={seed.commentary}
        commentCount={post.comments?.[0]?.count ?? 0}
        repostContext={repostContext}
        onRepostChange={fetchRepostItems}
      />
    );
  };

  return (
    <div className="feed">
      {timeline.map((entry) =>
        entry.kind === 'post'
          ? renderPostCard(entry.post)
          : renderPostCard(entry.item.post, {
              reposterName: entry.item.reposter.name,
              reposterAvatar: entry.item.reposter.avatar,
              reposterProfileId: entry.item.reposter.profileId,
              commentary: entry.item.commentary,
              repostedAt: entry.item.createdAt,
              isMine: !!currentUserId && entry.item.reposter.userId === currentUserId,
            }),
      )}

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

// LinkedIn-style inline replacement shown where a "Not Interested" / "Hide
// Post" card used to be. Same outer `.post-card` box (so feed rhythm/edge-to-
// edge is preserved) with a compact message + Undo.
const FeedDismissedStrip = ({ label, onUndo }: { label: string; onUndo: () => void }) => (
  <div className="post-card">
    <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Undo
      </button>
    </div>
  </div>
);

export default Feed;