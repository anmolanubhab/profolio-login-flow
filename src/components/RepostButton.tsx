import { useState } from 'react';
import { Repeat2, PenLine, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTapGuard } from '@/hooks/useTapGuard';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import RepostComposerDialog, { type RepostOriginalPost } from './RepostComposerDialog';

interface RepostButtonProps {
  /** Original post data, used for the "repost with your thoughts" preview. */
  post: RepostOriginalPost;
  repostCount: number;
  hasReposted: boolean;
  myCommentary: string | null;
  busy: boolean;
  /** Create a repost, or update commentary if one already exists. */
  onRepost: (commentary?: string | null) => Promise<boolean>;
  onRemoveRepost: () => Promise<boolean>;
  /** Trigger button classes; defaults to the shared `.action-btn` style. */
  className?: string;
  /** Show the repost count next to the label when > 0. */
  showCount?: boolean;
}

const RepostButton = ({
  post,
  repostCount,
  hasReposted,
  myCommentary,
  busy,
  onRepost,
  onRemoveRepost,
  className = 'action-btn',
  showCount = false,
}: RepostButtonProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const tap = useTapGuard();

  const runInstantRepost = async () => {
    setMenuOpen(false);
    await onRepost(null);
  };

  const runUndo = async () => {
    setMenuOpen(false);
    await onRemoveRepost();
  };

  const handleComposerSubmit = async (commentary: string | null) => {
    const ok = await onRepost(commentary);
    if (ok) setComposerOpen(false);
  };

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={hasReposted ? 'Repost options — you reposted this' : 'Repost'}
            aria-haspopup="menu"
            aria-pressed={hasReposted}
            {...tap.bind}
            // Stop Radix opening the menu on pointerdown (touch-start) -- that
            // fires before a scroll can be detected. It still opens from the
            // guarded click below, and from keyboard via Radix's keydown.
            onPointerDown={(e) => { tap.bind.onPointerDown(e); e.preventDefault(); }}
            onClick={tap.onTap((e) => { e.stopPropagation(); setMenuOpen((o) => !o); })}
            className={cn(className, hasReposted && 'active')}
          >
            <Repeat2 className={cn('icon', hasReposted && 'stroke-[2.5]')} />
            <span>{hasReposted ? 'Reposted' : 'Repost'}</span>
            {showCount && repostCount > 0 && (
              <span className="text-xs tabular-nums">{repostCount}</span>
            )}
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="center" className="w-64" onClick={(e) => e.stopPropagation()}>
          {!hasReposted ? (
            <DropdownMenuItem
              className="flex-col items-start gap-0.5 py-2.5"
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                runInstantRepost();
              }}
            >
              <span className="flex items-center gap-2 font-medium">
                <Repeat2 className="w-4 h-4" /> Repost
              </span>
              <span className="text-xs text-muted-foreground pl-6">
                Instantly bring this post to others' feeds
              </span>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              className="flex-col items-start gap-0.5 py-2.5 text-destructive focus:text-destructive"
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                runUndo();
              }}
            >
              <span className="flex items-center gap-2 font-medium">
                <X className="w-4 h-4" /> Undo repost
              </span>
              <span className="text-xs text-muted-foreground pl-6">
                Remove this repost from your activity
              </span>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem
            className="flex-col items-start gap-0.5 py-2.5"
            disabled={busy}
            onSelect={(e) => {
              e.preventDefault();
              setMenuOpen(false);
              setComposerOpen(true);
            }}
          >
            <span className="flex items-center gap-2 font-medium">
              <PenLine className="w-4 h-4" />
              {hasReposted && myCommentary ? 'Edit your repost' : 'Repost with your thoughts'}
            </span>
            <span className="text-xs text-muted-foreground pl-6">
              Create a repost with your own commentary
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RepostComposerDialog
        open={composerOpen}
        onOpenChange={setComposerOpen}
        post={post}
        initialCommentary={hasReposted ? myCommentary : ''}
        mode={hasReposted && myCommentary ? 'edit' : 'create'}
        submitting={busy}
        onSubmit={handleComposerSubmit}
      />
    </>
  );
};

export default RepostButton;
