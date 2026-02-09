import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useIsMobile } from '@/hooks/use-mobile';
import { Repeat2, MessageSquare, PenSquare } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface RepostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRepost: (comment?: string) => void;
  originalPost: {
    user: {
      name: string;
      avatar?: string;
    };
    content: string;
    image?: string;
    created_at: string;
  };
}

export function RepostDialog({ open, onOpenChange, onRepost, originalPost }: RepostDialogProps) {
  const isMobile = useIsMobile();
  const [mode, setMode] = useState<'select' | 'comment'>('select');
  const [comment, setComment] = useState('');

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setMode('select');
      setComment('');
    }, 300);
  };

  const handleRepostImmediate = () => {
    onRepost();
    handleClose();
  };

  const handleRepostWithComment = () => {
    onRepost(comment);
    handleClose();
  };

  const Content = (
    <div className="space-y-4">
      {mode === 'select' ? (
        <div className="grid gap-3 py-2">
          <Button
            variant="outline"
            className="justify-start h-auto py-4 px-4 text-left hover:bg-muted/50 group"
            onClick={handleRepostImmediate}
          >
            <div className="bg-primary/10 p-2 rounded-full mr-4 group-hover:bg-primary/20 transition-colors">
              <Repeat2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Repost</div>
              <div className="text-sm text-muted-foreground">Instantly share with your network</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-4 px-4 text-left hover:bg-muted/50 group"
            onClick={() => setMode('comment')}
          >
            <div className="bg-primary/10 p-2 rounded-full mr-4 group-hover:bg-primary/20 transition-colors">
              <PenSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-foreground">Repost with thoughts</div>
              <div className="text-sm text-muted-foreground">Create a new post with this attached</div>
            </div>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <Textarea
            placeholder="What are your thoughts?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[120px] resize-none focus-visible:ring-1"
            autoFocus
          />
          
          <div className="border rounded-lg p-3 bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={originalPost.user.avatar} />
                <AvatarFallback>{originalPost.user.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{originalPost.user.name}</span>
              <span className="text-xs text-muted-foreground">• {new Date(originalPost.created_at).toLocaleDateString()}</span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {originalPost.content}
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setMode('select')}>Back</Button>
            <Button onClick={handleRepostWithComment} disabled={!comment.trim()}>Post</Button>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{mode === 'select' ? 'Repost' : 'Share your thoughts'}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-8">
            {Content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{mode === 'select' ? 'Repost' : 'Share your thoughts'}</DialogTitle>
        </DialogHeader>
        {Content}
      </DialogContent>
    </Dialog>
  );
}
