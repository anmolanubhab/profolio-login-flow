import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, Pencil, Trash2, Link2, Flag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ReactionType } from '@/components/ReactionBar';
import type { CommentAuthor, CommentNode, CommentInput } from '@/hooks/use-comments';
import { mentionToPlainText, parseForEditing } from '@/lib/commentMentions';
import CommentReactionButton from './CommentReactionButton';
import CommentComposer from './CommentComposer';
import CommentText from './CommentText';

const formatTimeAgo = (timestamp: string) => {
  const diffMin = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return new Date(timestamp).toLocaleDateString();
};

interface CommentItemProps {
  comment: CommentNode;
  currentProfileId: string | null;
  currentUserId: string | null;
  currentAuthor: CommentAuthor | null;
  isReply?: boolean;
  replyCount?: number;
  repliesExpanded?: boolean;
  onToggleReplies?: () => void;
  onReply?: (input: CommentInput) => Promise<boolean>;
  onEdit: (text: string) => Promise<boolean>;
  onDelete: () => Promise<boolean>;
  onReact: (type: ReactionType | null) => void;
}

const CommentItem = ({
  comment,
  currentProfileId,
  currentUserId,
  currentAuthor,
  isReply = false,
  replyCount = 0,
  repliesExpanded = false,
  onToggleReplies,
  onReply,
  onEdit,
  onDelete,
  onReact,
}: CommentItemProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwn = !!currentProfileId && comment.authorId === currentProfileId;
  const totalReactions = comment.reactions.total_reactions;

  // Editor shows "@Name" (never the uuid); identities are re-attached on save.
  const editable = useMemo(() => parseForEditing(comment.content), [comment.content]);

  const copyLink = async () => {
    const url = `${window.location.origin}/post/${comment.postId}#comment-${comment.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'Comment link copied to clipboard.' });
    } catch {
      toast({ title: 'Error', description: 'Could not copy the link.', variant: 'destructive' });
    }
  };

  const report = async () => {
    if (!currentProfileId) {
      toast({ title: 'Sign in required', description: 'Please sign in to report content.', variant: 'destructive' });
      return;
    }
    try {
      const { error } = await supabase.from('post_reports').insert({
        post_id: comment.postId,
        reporter_id: currentProfileId,
        reason: 'comment',
        description: `Reported comment ${comment.id} by ${comment.author.name}: "${mentionToPlainText(comment.content).slice(0, 200)}"`,
      });
      if (error && error.code !== '23505') throw error;
      toast({ title: 'Reported', description: 'Thanks — our team will review this comment.' });
    } catch (err) {
      console.error('Error reporting comment:', err);
      toast({ title: 'Could not submit report', description: 'Please try again later.', variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    const ok = await onDelete();
    setDeleting(false);
    if (ok) setConfirmDelete(false);
  };

  return (
    <div id={`comment-${comment.id}`} className="flex items-start gap-2">
      <Avatar
        className={`${isReply ? 'h-7 w-7' : 'h-8 w-8'} shrink-0 cursor-pointer`}
        onClick={() => comment.author.id && navigate(`/profile/${comment.author.id}`)}
      >
        <AvatarImage src={comment.author.avatar || undefined} className="object-cover" />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
          {(comment.author.name?.[0] || 'U').toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {editing ? (
          <CommentComposer
            author={currentAuthor}
            currentUserId={currentUserId}
            initialValue={editable.text}
            initialMentions={editable.mentions}
            autoFocus
            compact
            allowImage={false}
            submitLabel="Save"
            cancelLabel="Cancel"
            placeholder="Edit your comment…"
            onCancel={() => setEditing(false)}
            onSubmit={async ({ text }) => {
              const ok = await onEdit(text);
              if (ok) setEditing(false);
              return ok;
            }}
          />
        ) : (
          <>
            <div className="rounded-2xl bg-secondary/60 px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className="text-sm font-semibold hover:underline text-left"
                  onClick={() => comment.author.id && navigate(`/profile/${comment.author.id}`)}
                >
                  {comment.author.name}
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Comment options"
                      aria-haspopup="menu"
                      className="shrink-0 -mr-1 rounded-full p-1 text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {isOwn && (
                      <DropdownMenuItem onClick={() => setEditing(true)} className="gap-2">
                        <Pencil className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={copyLink} className="gap-2">
                      <Link2 className="h-4 w-4" /> Copy link
                    </DropdownMenuItem>
                    {!isOwn && (
                      <DropdownMenuItem onClick={report} className="gap-2">
                        <Flag className="h-4 w-4" /> Report
                      </DropdownMenuItem>
                    )}
                    {isOwn && (
                      <DropdownMenuItem
                        onClick={() => setConfirmDelete(true)}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <CommentText content={comment.content} collapsedLines={4} className="text-sm mt-0.5" />
              {comment.imageUrl && (
                <a
                  href={comment.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block"
                  onClick={(e) => e.stopPropagation()}
                >
                  <img
                    src={comment.imageUrl}
                    alt="Comment attachment"
                    loading="lazy"
                    className="max-h-80 max-w-full rounded-lg border border-border object-contain"
                  />
                </a>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 pl-2 text-xs text-muted-foreground">
              <span>{formatTimeAgo(comment.createdAt)}</span>
              {comment.isEdited && <span aria-label="edited">(edited)</span>}
              <CommentReactionButton
                summary={comment.reactions}
                onReact={onReact}
                disabled={comment.pending}
              />
              {totalReactions > 0 && <span>{totalReactions}</span>}
              {!isReply && onReply && (
                <button
                  type="button"
                  className="font-semibold hover:text-foreground"
                  onClick={() => setReplyOpen((o) => !o)}
                >
                  Reply
                </button>
              )}
            </div>
          </>
        )}

        {replyOpen && onReply && (
          <div className="mt-2">
            <CommentComposer
              author={currentAuthor}
              currentUserId={currentUserId}
              compact
              autoFocus
              submitLabel="Reply"
              placeholder={`Reply to ${comment.author.name}…`}
              onCancel={() => setReplyOpen(false)}
              onSubmit={async (payload) => {
                const ok = await onReply(payload);
                if (ok) setReplyOpen(false);
                return ok;
              }}
            />
          </div>
        )}

        {!isReply && replyCount > 0 && (
          <button
            type="button"
            className="mt-1.5 ml-2 text-xs font-semibold text-primary hover:underline"
            onClick={onToggleReplies}
            aria-expanded={repliesExpanded}
          >
            {repliesExpanded
              ? 'Hide replies'
              : `View ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`}
          </button>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This can’t be undone.{!isReply ? ' Replies to this comment will also be removed.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CommentItem;
