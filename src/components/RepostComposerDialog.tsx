import { useEffect, useRef, useState } from 'react';
import { Repeat2, Globe, User, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import PostText from './PostText';

export interface RepostOriginalPost {
  id: string;
  author: { name: string; avatar?: string };
  content: string;
  image?: string;
  postType?: string;
  videoUrl?: string;
  documentName?: string;
  carouselUrls?: string[];
  createdAt: string;
}

interface RepostComposerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post: RepostOriginalPost;
  /** Existing commentary when editing an already-created repost. */
  initialCommentary?: string | null;
  mode?: 'create' | 'edit';
  submitting?: boolean;
  onSubmit: (commentary: string | null) => void | Promise<void>;
}

const MAX_COMMENTARY = 3000;

const formatTimeAgo = (timestamp: string) => {
  const diffMin = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d`;
  return `${Math.floor(diffD / 7)}w`;
};

const RepostComposerDialog = ({
  open,
  onOpenChange,
  post,
  initialCommentary,
  mode = 'create',
  submitting = false,
  onSubmit,
}: RepostComposerDialogProps) => {
  const [text, setText] = useState('');
  const [me, setMe] = useState<{ name: string; avatar?: string } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText(initialCommentary ?? '');
      const t = setTimeout(() => textareaRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open, initialCommentary]);

  useEffect(() => {
    if (!open || me) return;
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!active) return;
      setMe({
        name: profile?.display_name || user.email?.split('@')[0] || 'You',
        avatar: profile?.avatar_url || undefined,
      });
    })();
    return () => {
      active = false;
    };
  }, [open, me]);

  const previewImage =
    post.image || (post.carouselUrls && post.carouselUrls[0]) || undefined;
  const overLimit = text.length > MAX_COMMENTARY;

  const handleSubmit = async () => {
    if (submitting || overLimit) return;
    await onSubmit(text.trim() ? text.trim() : null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-base font-semibold">
            {mode === 'edit' ? 'Edit your repost' : 'Repost with your thoughts'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-10 w-10">
              <AvatarImage src={me?.avatar} className="object-cover" />
              <AvatarFallback className="bg-primary/10 text-primary">
                {me?.name?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-tight truncate">{me?.name ?? 'You'}</p>
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Globe className="w-3 h-3" /> Anyone
              </span>
            </div>
          </div>

          <div>
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add your thoughts…"
              aria-label="Add your thoughts about this post"
              className="min-h-[96px] border-0 px-0 text-[15px] shadow-none focus-visible:ring-0 resize-none"
            />
            <div
              className={
                'text-right text-[11px] ' +
                (overLimit ? 'text-destructive' : 'text-muted-foreground/70')
              }
            >
              {text.length}/{MAX_COMMENTARY}
            </div>
          </div>

          {/* Embedded original post preview */}
          <div className="rounded-xl border border-border/70 overflow-hidden">
            <div className="p-3 flex items-start gap-2.5">
              <Avatar className="h-9 w-9">
                <AvatarImage src={post.author.avatar} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {post.author.name?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-tight truncate">{post.author.name}</p>
                <p className="text-[11px] text-muted-foreground/70 leading-tight mt-0.5">
                  {formatTimeAgo(post.createdAt)}
                </p>
              </div>
            </div>
            {post.content && (
              <div className="px-3 pb-3 text-[14px] leading-6">
                <PostText content={post.content} collapsedLines={3} />
              </div>
            )}
            {previewImage && (
              <img src={previewImage} alt="" className="w-full max-h-64 object-cover" />
            )}
            {!previewImage && post.postType === 'video' && post.videoUrl && (
              <div className="px-3 pb-3 text-[12px] text-muted-foreground">🎬 Video attached</div>
            )}
            {post.postType === 'document' && post.documentName && (
              <div className="mx-3 mb-3 flex items-center gap-2 rounded-lg bg-secondary p-2 text-[12px]">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{post.documentName}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="px-4 py-3 border-t border-border sm:justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting || overLimit} className="gap-2">
            {submitting ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Repeat2 className="h-4 w-4" />
            )}
            {mode === 'edit' ? 'Save' : 'Repost'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RepostComposerDialog;
