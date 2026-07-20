// Shared client-side aggregation helpers for turning raw embedded Supabase
// relationships (post_reactions, polls/poll_options/poll_votes) into the
// summary shapes PostCard renders. Used by both Feed.tsx (the main feed)
// and CompanyProfile.tsx (a company's own updates feed) so the two don't
// duplicate this logic.
import { ReactionType, ReactionSummary } from '@/components/ReactionBar';
import { PollSummary } from '@/components/PostCard';

export interface PollOption {
  id: string;
  option_text: string;
  position: number;
}

export interface PollVote {
  id: string;
  option_id: string;
  user_id: string;
}

export interface PollData {
  id: string;
  question: string;
  poll_options: PollOption[];
  poll_votes: PollVote[];
}

export const buildPollSummary = (poll: PollData | null | undefined, myProfileId: string | null): PollSummary | null => {
  if (!poll) return null;

  const votesByOption = new Map<string, number>();
  let userOptionId: string | null = null;

  poll.poll_votes.forEach((v) => {
    votesByOption.set(v.option_id, (votesByOption.get(v.option_id) || 0) + 1);
    if (myProfileId && v.user_id === myProfileId) {
      userOptionId = v.option_id;
    }
  });

  const options = [...poll.poll_options]
    .sort((a, b) => a.position - b.position)
    .map((o) => ({ id: o.id, text: o.option_text, votes: votesByOption.get(o.id) || 0 }));

  return {
    id: poll.id,
    question: poll.question,
    totalVotes: poll.poll_votes.length,
    userOptionId,
    options,
  };
};

// Phase 5: reaction weight feeding into "For You" ranking. Insightful and
// Support carry the most algorithmic weight, per spec. "Love" wasn't given
// an explicit weight in the spec -- grouped with "Celebrate" as a strong
// but casual positive signal.
export const REACTION_WEIGHTS: Record<ReactionType, number> = {
  like: 1,
  funny: 2,
  celebrate: 3,
  love: 3,
  support: 4,
  insightful: 5,
};

export const buildReactionSummary = (
  reactions: { user_id: string; reaction_type: ReactionType }[],
  myProfileId: string | null
): ReactionSummary => {
  const counts: Partial<Record<ReactionType, number>> = {};
  let mine: ReactionType | null = null;

  reactions.forEach((r) => {
    counts[r.reaction_type] = (counts[r.reaction_type] || 0) + 1;
    if (myProfileId && r.user_id === myProfileId) {
      mine = r.reaction_type;
    }
  });

  return {
    total_reactions: reactions.length,
    user_reaction: mine,
    reactions: counts,
  };
};
