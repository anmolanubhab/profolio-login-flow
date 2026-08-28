import { useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useComments, type CommentSort } from '@/hooks/use-comments';
import { ReactionType } from '@/components/ReactionBar';
import CommentComposer from './CommentComposer';
import CommentItem from './CommentItem';

interface CommentSectionProps {
  postId: string;
  seedCount?: number;
  onCountChange?: (count: number) => void;
}

const SORT_LABEL: Record<CommentSort, string> = {
  relevant: 'Most relevant',
  recent: 'Most recent',
};

/**
 * Inline (non-modal) comment section: composer on top, then a sort control
 * ("Most relevant" default / "Most recent"), the ranked/paginated top-level
 * comments with one level of replies, per-comment reactions, inline edit /
 * delete, @mention + image support, and live updates while it is open.
 */
const CommentSection = ({ postId, seedCount = 0, onCountChange }: CommentSectionProps) => {
  const c = useComments(postId, seedCount);

  useEffect(() => {
    if (!c.loaded && !c.loading) c.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    onCountChange?.(c.count);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.count]);

  return (
    <div className="px-4 sm:px-5 pb-4 pt-1 space-y-3">
      <CommentComposer
        author={c.currentAuthor}
        currentUserId={c.currentUserId}
        onSubmit={c.addComment}
        placeholder="Add a comment…"
      />

      {c.topLevel.length > 0 && (
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
                aria-label="Sort comments"
              >
                {SORT_LABEL[c.sort]}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem
                onClick={() => c.setSort('relevant')}
                className={c.sort === 'relevant' ? 'font-semibold' : ''}
              >
                Most relevant
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => c.setSort('recent')}
                className={c.sort === 'recent' ? 'font-semibold' : ''}
              >
                Most recent
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {c.loading ? (
        <div className="space-y-3 pt-1">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-start gap-2 animate-pulse">
              <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-muted rounded" />
                <div className="h-3 w-3/4 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : c.topLevel.length === 0 ? (
        <p className="text-sm text-muted-foreground pt-1">No comments yet. Be the first to comment.</p>
      ) : (
        <div className="space-y-4 pt-1">
          {c.topLevel.map((comment) => {
            const expanded = c.expandedReplies.has(comment.id);
            const replies = c.repliesByParent[comment.id] || [];
            return (
              <div key={comment.id} className="space-y-3">
                <CommentItem
                  comment={comment}
                  currentProfileId={c.currentProfileId}
                  currentUserId={c.currentUserId}
                  currentAuthor={c.currentAuthor}
                  replyCount={c.replyCount[comment.id] ?? 0}
                  repliesExpanded={expanded}
                  onToggleReplies={() =>
                    expanded ? c.collapseReplies(comment.id) : c.loadReplies(comment.id)
                  }
                  onReply={(input) => c.addReply(comment.id, input)}
                  onEdit={(text) => c.editComment(comment.id, text)}
                  onDelete={() => c.deleteComment(comment.id)}
                  onReact={(type: ReactionType | null) => c.reactToComment(comment.id, type)}
                />

                {expanded && replies.length > 0 && (
                  <div className="pl-8 space-y-3 border-l border-border/60 ml-3">
                    {replies.map((reply) => (
                      <CommentItem
                        key={reply.id}
                        comment={reply}
                        isReply
                        currentProfileId={c.currentProfileId}
                        currentUserId={c.currentUserId}
                        currentAuthor={c.currentAuthor}
                        onEdit={(text) => c.editComment(reply.id, text)}
                        onDelete={() => c.deleteComment(reply.id)}
                        onReact={(type: ReactionType | null) => c.reactToComment(reply.id, type)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {c.hasMoreTopLevel && (
            <button
              type="button"
              onClick={c.loadMoreTopLevel}
              disabled={c.loadingMore}
              className="text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {c.loadingMore ? 'Loading…' : 'Load more comments'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CommentSection;
