import { useCallback, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  ReactionBar,
  ReactionCountSummary,
  type ReactionType,
} from '@/components/ReactionBar';
import { buildReactionSummary } from '@/lib/postAggregation';
import CommentSection from '@/components/comments/CommentSection';
import { cn } from '@/lib/utils';

interface RawReaction {
  id: string;
  user_id: string;
  reaction_type: ReactionType;
}

/**
 * Reactions + comments for a published Insight article, wired to the SAME
 * `posts` row the feed uses (posts.insight_article_id -> this article). No
 * second reaction/comment system — it reuses ReactionBar, post_reactions,
 * CommentSection and the comments table exactly like PostCard does.
 */
export default function InsightEngagement({ postId }: { postId: string }) {
  const { toast } = useToast();
  const [meId, setMeId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<RawReaction[]>([]);
  const [commentCount, setCommentCount] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    let profileId: string | null = null;
    if (auth.user) {
      const { data: p } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', auth.user.id)
        .maybeSingle();
      profileId = p?.id ?? null;
    }
    setMeId(profileId);

    const [{ data: r }, { count }] = await Promise.all([
      supabase.from('post_reactions').select('id, user_id, reaction_type').eq('post_id', postId),
      supabase.from('comments').select('id', { count: 'exact', head: true }).eq('post_id', postId),
    ]);
    setReactions((r ?? []) as RawReaction[]);
    setCommentCount(count ?? 0);
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleReact = async (type: ReactionType | null) => {
    if (!meId) {
      toast({ title: 'Sign in required', description: 'Please sign in to react.', variant: 'destructive' });
      return;
    }
    // optimistic
    const prev = reactions;
    const others = reactions.filter((x) => x.user_id !== meId);
    setReactions(
      type === null ? others : [...others, { id: `local-${meId}`, user_id: meId, reaction_type: type }],
    );
    try {
      if (type === null) {
        await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', meId);
      } else {
        await supabase
          .from('post_reactions')
          .upsert({ post_id: postId, user_id: meId, reaction_type: type }, { onConflict: 'post_id,user_id' });
      }
    } catch (err) {
      setReactions(prev);
      toast({ title: 'Error', description: 'Could not update your reaction.', variant: 'destructive' });
    }
  };

  const summary = buildReactionSummary(reactions, meId);

  return (
    <section className="mt-10 border-t border-border pt-4">
      <div className="flex items-center justify-between px-1 pb-2 text-xs text-muted-foreground">
        <ReactionCountSummary summary={summary} />
        {commentCount > 0 && (
          <button className="hover:underline" onClick={() => setCommentsOpen(true)}>
            {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1 border-y border-border py-1">
        <div className="flex-1">
          <ReactionBar summary={summary} onReact={handleReact} />
        </div>
        <button
          type="button"
          onClick={() => setCommentsOpen((o) => !o)}
          aria-expanded={commentsOpen}
          className={cn(
            'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            commentsOpen && 'text-primary',
          )}
        >
          <MessageCircle className="h-[18px] w-[18px]" />
          Comment
        </button>
      </div>

      {commentsOpen && (
        <div className="border-b border-border">
          <CommentSection postId={postId} seedCount={commentCount} onCountChange={setCommentCount} />
        </div>
      )}
    </section>
  );
}
