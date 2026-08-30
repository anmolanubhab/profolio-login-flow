import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Pencil, Trash2, Share2, Link as LinkIcon, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  /** absolute or relative path used for Copy link / native share */
  shareUrl: string;
  shareTitle: string;
  isOwner: boolean;
  onEdit?: () => void;
  onDelete?: () => Promise<void>;
  deleteLabel?: string;
  deleteConfirmTitle?: string;
  deleteConfirmBody?: string;
  align?: 'start' | 'end';
  triggerClassName?: string;
}

export default function InsightMoreMenu({
  shareUrl,
  shareTitle,
  isOwner,
  onEdit,
  onDelete,
  deleteLabel = 'Delete',
  deleteConfirmTitle = 'Delete this?',
  deleteConfirmBody = 'This cannot be undone.',
  align = 'end',
  triggerClassName,
}: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const absoluteUrl = shareUrl.startsWith('http')
    ? shareUrl
    : `${window.location.origin}${shareUrl}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: 'Could not copy link', variant: 'destructive' });
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: absoluteUrl });
      } catch {
        /* user dismissed */
      }
    } else {
      copyLink();
    }
  };

  const runDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
      setConfirmOpen(false);
    } catch (err: any) {
      toast({
        title: 'Delete failed',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="More options"
            className={cn(
              'inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
              triggerClassName,
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-52">
          <DropdownMenuItem onClick={share} className="gap-2">
            <Share2 className="h-4 w-4" /> Share
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyLink} className="gap-2">
            <LinkIcon className="h-4 w-4" /> Copy link
          </DropdownMenuItem>
          {isOwner && (onEdit || onDelete) && <DropdownMenuSeparator />}
          {isOwner && onEdit && (
            <DropdownMenuItem onClick={onEdit} className="gap-2">
              <Pencil className="h-4 w-4" /> Edit
            </DropdownMenuItem>
          )}
          {isOwner && onDelete && (
            <DropdownMenuItem
              onClick={() => setConfirmOpen(true)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" /> {deleteLabel}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !deleting && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{deleteConfirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                runDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {deleteLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
