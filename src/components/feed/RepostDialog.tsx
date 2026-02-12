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
        <div className="grid gap-4 py-2">
          <button
            className="flex items-center w-full p-4 text-left bg-white border border-[#E8EBEF]/60 rounded-2xl hover:bg-[#F3F6F8] hover:border-[#833AB4]/20 hover:shadow-md transition-all duration-300 group"
            onClick={handleRepostImmediate}
          >
            <div className="bg-gradient-to-br from-[#0077B5]/10 to-[#E1306C]/10 p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform duration-300">
              <Repeat2 className="w-6 h-6 text-[#833AB4]" />
            </div>
            <div>
              <div className="font-black text-[#1D2226] text-[16px]">Repost</div>
              <div className="text-[14px] text-[#5E6B7E] font-medium">Instantly share with your network</div>
            </div>
          </button>

          <button
            className="flex items-center w-full p-4 text-left bg-white border border-[#E8EBEF]/60 rounded-2xl hover:bg-[#F3F6F8] hover:border-[#833AB4]/20 hover:shadow-md transition-all duration-300 group"
            onClick={() => setMode('comment')}
          >
            <div className="bg-gradient-to-br from-[#0077B5]/10 to-[#E1306C]/10 p-3 rounded-xl mr-4 group-hover:scale-110 transition-transform duration-300">
              <PenSquare className="w-6 h-6 text-[#833AB4]" />
            </div>
            <div>
              <div className="font-black text-[#1D2226] text-[16px]">Repost with thoughts</div>
              <div className="text-[14px] text-[#5E6B7E] font-medium">Create a new post with this attached</div>
            </div>
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-4">
            <Textarea
              placeholder="What are your thoughts on this?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[140px] resize-none border-none bg-[#F3F6F8]/50 focus-visible:bg-[#F3F6F8] rounded-2xl p-4 font-bold text-[16px] text-[#1D2226] placeholder:text-[#5E6B7E]/60 focus-visible:ring-0 transition-all"
              autoFocus
            />
            
            <div className="border border-[#E8EBEF]/60 rounded-2xl p-5 bg-white shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-8 w-8 rounded-lg ring-2 ring-white shadow-sm">
                  <AvatarImage src={originalPost.user.avatar} className="object-cover" />
                  <AvatarFallback className="bg-gradient-to-br from-[#0077B5]/10 to-[#E1306C]/10 text-[#833AB4] font-black text-xs">
                    {originalPost.user.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-black text-[#1D2226]">{originalPost.user.name}</span>
                  <span className="text-[12px] font-bold text-[#5E6B7E]">• {new Date(originalPost.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <p className="text-[14px] text-[#1D2226]/80 font-medium leading-relaxed line-clamp-3 italic">
                "{originalPost.content}"
              </p>
            </div>
          </div>

          <div className="flex justify-end items-center gap-3 pt-2">
            <Button 
              variant="ghost" 
              onClick={() => setMode('select')}
              className="rounded-2xl h-12 px-6 font-black text-[#5E6B7E] hover:bg-[#F3F6F8] transition-all"
            >
              Back
            </Button>
            <Button 
              onClick={handleRepostWithComment} 
              disabled={!comment.trim()}
              className="rounded-2xl h-12 px-8 font-black bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white shadow-lg shadow-[#833AB4]/20 hover:scale-105 transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:grayscale"
            >
              Share Post
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="rounded-t-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
          <DrawerHeader className="px-8 pt-8 pb-4 text-left border-b border-[#E8EBEF]/60">
            <DrawerTitle className="text-2xl font-black text-[#1D2226] tracking-tight">
              {mode === 'select' ? 'Repost' : 'Share your thoughts'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-8 pb-10 pt-6">
            {Content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
        <DialogHeader className="px-8 pt-8 pb-4 border-b border-[#E8EBEF]/60">
          <DialogTitle className="text-2xl font-black text-[#1D2226] tracking-tight">
            {mode === 'select' ? 'Repost' : 'Share your thoughts'}
          </DialogTitle>
        </DialogHeader>
        <div className="p-8">
          {Content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
