import { useState, useEffect } from 'react';
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

// Reddit/HN-style decayed score: weighted reaction sum divided by an
// increasing power of age in hours, so a heavily-reacted-to post can rank
// above a slightly newer one, but recency still matters.
const computeForYouScore = (post: Post) => {
  const weightedSum = (post.post_reactions || []).reduce(
    (sum, r) => sum + (REACTION_WEIGHTS[r.reaction_type] || 1),
    0
  );
  const hoursOld = Math.max(0, (Date.now() - new Date(post.created_at).getTime()) / 36e5);
  return (weightedSum + 1) / Math.pow(hoursOld + 2, 1.5);
};

interface FeedProps {
  refresh?: number;
  mode?: 'foryou' | 'following';
}

const Feed = ({ refresh, mode = 'foryou' }: FeedProps) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [followingIsEmpty, setFollowingIsEmpty] = useState(false);
  const { toast } = useToast();

  const fetchPosts = async () => {
    try {
      setFollowingIsEmpty(false);

      // Get current user and their filters
      const { data: { user } } = await supabase.auth.getUser();
      let currentUserProfileId: string | null = null;
      let hiddenPostIds: string[] = [];
      let blockedUserIds: string[] = [];
      let snoozedUserIds: string[] = [];
      // Auth user ids (posts.user_id) of people this user follows or is
      // connected with -- only populated/used when mode === 'following'.
      let followingAuthUserIds: string[] | null = null;
      // Companies this user follows -- their posts show up in "Following"
      // too, alongside people. Posts made "as a company" still carry the
      // posting admin's own auth id in posts.user_id, so this needs its own
      // filter rather than folding into followingAuthUserIds.
      let followedCompanyIds: string[] | null = null;

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        currentUserProfileId = profile?.id || null;

        if (currentUserProfileId) {
          // Fetch hidden posts
          const { data: hiddenData } = await supabase
            .from('hidden_posts')
            .select('post_id')
            .eq('user_id', currentUserProfileId);
          hiddenPostIds = hiddenData?.map((h) => h.post_id) || [];

          // Fetch blocked users
          const { data: blockedData } = await supabase
            .from('blocked_users')
            .select('blocked_user_id')
            .eq('user_id', currentUserProfileId);

          // Convert blocked profile IDs to user IDs for filtering
          if (blockedData && blockedData.length > 0) {
            const blockedProfileIds = blockedData.map((b) => b.blocked_user_id);
            const { data: blockedProfiles } = await supabase
              .from('profiles')
              .select('id, user_id')
              .in('id', blockedProfileIds);
            blockedUserIds = blockedProfiles?.map((p) => p.user_id) || [];
          }

          // Fetch snoozed users (not expired)
          const { data: snoozedData } = await supabase
            .from('snoozed_users')
            .select('snoozed_user_id')
            .eq('user_id', currentUserProfileId)
            .gt('snoozed_until', new Date().toISOString());

          // Convert snoozed profile IDs to user IDs
          if (snoozedData && snoozedData.length > 0) {
            const snoozedProfileIds = snoozedData.map((s) => s.snoozed_user_id);
            const { data: snoozedProfiles } = await supabase
              .from('profiles')
              .select('id, user_id')
              .in('id', snoozedProfileIds);
            snoozedUserIds = snoozedProfiles?.map((p) => p.user_id) || [];
          }

          if (mode === 'following') {
            // "Following" audience = people you're connected with (accepted,
            // either direction) UNION people you explicitly follow, UNION
            // companies you follow.
            const [{ data: connectionsData }, { data: followingData }, { data: companyFollowsData }] = await Promise.all([
              supabase
                .from('connections')
                .select('user_id, connection_id')
                .eq('status', 'accepted')
                .or(`user_id.eq.${currentUserProfileId},connection_id.eq.${currentUserProfileId}`),
              supabase
                .from('followers')
                .select('following_id')
                .eq('follower_id', currentUserProfileId),
              supabase
                .from('company_followers')
                .select('company_id')
                .eq('user_id', currentUserProfileId),
            ]);

            const connectedProfileIds = (connectionsData || []).map((c) =>
              c.user_id === currentUserProfileId ? c.connection_id : c.user_id
            );
            const followedProfileIds = (followingData || []).map((f) => f.following_id);
            const audienceProfileIds = [...new Set([...connectedProfileIds, ...followedProfileIds])];
            followedCompanyIds = [...new Set((companyFollowsData || []).map((c) => c.company_id))];

            if (audienceProfileIds.length === 0 && followedCompanyIds.length === 0) {
              // Nobody and nothing to show yet -- skip the posts query entirely.
              setPosts([]);
              setFollowingIsEmpty(true);
              setLoading(false);
              return;
            }

            if (audienceProfileIds.length > 0) {
              const { data: audienceProfiles } = await supabase
                .from('profiles')
                .select('user_id')
                .in('id', audienceProfileIds);
              followingAuthUserIds = (audienceProfiles || []).map((p) => p.user_id);
            } else {
              followingAuthUserIds = [];
            }

            if (followingAuthUserIds.length === 0 && followedCompanyIds.length === 0) {
              setPosts([]);
              setFollowingIsEmpty(true);
              setLoading(false);
              return;
            }
          }
        }
      }

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
        .order('created_at', { ascending: false });

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

      const { data: postsData, error: postsError } = await postsQuery;

      if (postsError) throw postsError;

      // Get unique user IDs
      const userIds = [...new Set(postsData?.map(post => post.user_id) || [])];
      
      // Get profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, user_id, display_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profilesMap = new Map();
      profilesData?.forEach(profile => {
        profilesMap.set(profile.user_id, profile);
      });

      // Combine posts with profiles and filter
      const postsWithProfiles = postsData
        ?.filter(post => {
          // Filter out hidden posts
          if (hiddenPostIds.includes(post.id)) return false;
          // Filter out posts from blocked users
          if (blockedUserIds.includes(post.user_id)) return false;
          // Filter out posts from snoozed users
          if (snoozedUserIds.includes(post.user_id)) return false;
          return true;
        })
        .map(post => ({
          ...post,
          profiles: profilesMap.get(post.user_id) || null
        })) || [];

      // Phase 5: "For You" is reaction-weighted + recency-decayed, not
      // strictly chronological. "Following" stays purely chronological --
      // it's meant to be a reliable "everything from people I follow", not
      // an algorithmic re-ordering.
      if (mode === 'foryou') {
        postsWithProfiles.sort((a, b) => computeForYouScore(b) - computeForYouScore(a));
      }

      setPosts(postsWithProfiles);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error loading posts",
        description: "Could not load the feed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
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

      const { data: existing } = await supabase
        .from('post_reactions')
        .select('id, reaction_type')
        .eq('post_id', postId)
        .eq('user_id', profile.id)
        .maybeSingle();

      if (type === null) {
        if (existing) {
          await supabase.from('post_reactions').delete().eq('id', existing.id);
        }
      } else if (existing) {
        if (existing.reaction_type === type) {
          // Same reaction picked again -- remove it.
          await supabase.from('post_reactions').delete().eq('id', existing.id);
        } else {
          // Switching reaction -- update the existing row in place.
          await supabase.from('post_reactions').update({ reaction_type: type }).eq('id', existing.id);
        }
      } else {
        await supabase.from('post_reactions').insert({
          post_id: postId,
          user_id: profile.id,
          reaction_type: type,
        });
      }

      // Refresh posts to update reaction counts
      fetchPosts();
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
          // Already voted -- just refresh so the UI reflects the existing vote.
          fetchPosts();
          return;
        }
        throw error;
      }

      fetchPosts();
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
    // Refresh the feed to apply the new filters
    fetchPosts();
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
        />
      ))}
    </div>
  );
};

export default Feed;