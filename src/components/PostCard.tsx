import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Heart, MessageCircle, Share, MoreHorizontal, User, Facebook, Twitter, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PostCardProps {
  id: string;
  user: {
    id?: string;
    name: string;
    avatar?: string;
  };
  content: string;
  image?: string;
  timestamp: string;
  likes: number;
  initialIsLiked?: boolean;
  onLike?: (isLiked: boolean) => void;
}

const PostCard = ({ id, user, content, image, timestamp, likes, onLike, initialIsLiked = false }: PostCardProps) => {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [localLikes, setLocalLikes] = useState(likes);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Array<{ id: string; user_id: string; content: string; created_at: string; user?: { name: string | null; avatar?: string | null } }>>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      setCurrentUser(authUser);
    };
    checkUser();
  }, []);

  useEffect(() => {
    setIsLiked(initialIsLiked);
  }, [initialIsLiked]);

  useEffect(() => {
    setLocalLikes(likes);
  }, [likes]);

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const postTime = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - postTime.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const handleLike = () => {
    if (!currentUser) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to like posts.',
        variant: 'destructive',
      });
      navigate('/register');
      return;
    }
    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLocalLikes((prev) => (nextLiked ? prev + 1 : Math.max(0, prev - 1)));
    onLike?.(nextLiked);
  };

  const handleProfileClick = () => {
    if (user.id) {
      navigate(`/profile/${user.id}`);
    }
  };

  const fetchComments = async () => {
    try {
      setLoadingComments(true);
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', id)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      const userIds = Array.from(new Set((commentsData || []).map((c: any) => c.user_id)));
      let profilesMap = new Map<string, { name: string | null; avatar?: string | null }>();
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds);

        (profilesData || []).forEach((p: any) => {
          profilesMap.set(p.id, { name: p.display_name, avatar: p.avatar_url });
        });
      }

      const enriched = (commentsData || []).map((c: any) => ({
        id: c.id,
        user_id: c.user_id,
        content: c.content,
        created_at: c.created_at,
        user: profilesMap.get(c.user_id) || { name: 'Unknown User', avatar: undefined },
      }));

      setComments(enriched);
    } catch (err) {
      console.error('Error loading comments:', err);
      toast({
        title: 'Error',
        description: 'Could not load comments.',
        variant: 'destructive',
      });
    } finally {
      setLoadingComments(false);
    }
  };

  const openComments = async () => {
    setCommentsOpen(true);
    await fetchComments();
  };

  const addComment = async () => {
    if (!currentUser) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to comment.',
        variant: 'destructive',
      });
      navigate('/register');
      return;
    }
    const content = newComment.trim();
    if (!content) return;
    try {
      setSubmittingComment(true);
      // Get the current user's profile to obtain the profile.id (comments.user_id references profiles.id)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser.id)
        .single();
      if (profileError || !profile) throw profileError || new Error('Profile not found');
      const { error } = await supabase.from('comments').insert({
        post_id: id,
        user_id: profile.id,
        content,
      });
      if (error) throw error;
      setNewComment('');
      // Refresh comments
      await fetchComments();
    } catch (err) {
      console.error('Error adding comment:', err);
      toast({
        title: 'Error',
        description: 'Could not add comment.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/dashboard#post-${id}`;
    const title = `${user.name} on Profolio`;
    const text = content;

    // On mobile, use navigator.share() if supported
    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
      } catch (err) {
        console.error('Share failed:', err);
        toast({
          title: 'Error',
          description: 'Could not share the post.',
          variant: 'destructive',
        });
      }
      return;
    }

    // On desktop or if navigator.share() is not supported, show dropdown menu
    // The dropdown menu will be handled in the JSX below
  };

  const shareOnWhatsApp = () => {
    const url = `${window.location.origin}/dashboard#post-${id}`;
    const text = encodeURIComponent(`${user.name} on Profolio: ${content}\n\n${url}`);
    const whatsappUrl = `https://wa.me/?text=${text}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(`${window.location.origin}/dashboard#post-${id}`);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    window.open(facebookUrl, '_blank');
  };

  const shareOnTwitter = () => {
    const url = encodeURIComponent(`${window.location.origin}/dashboard#post-${id}`);
    const text = encodeURIComponent(`${user.name} on Profolio: ${content}`);
    const twitterUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
    window.open(twitterUrl, '_blank');
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/dashboard#post-${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: 'Link copied',
        description: 'Post link copied to clipboard.',
      });
    } catch (err) {
      console.error('Copy failed:', err);
      toast({
        title: 'Error',
        description: 'Could not copy the link.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="post-card" id={`post-${id}`}>
      <div className="post-header">
        <div 
          className="flex items-center gap-4 cursor-pointer group"
          onClick={handleProfileClick}
        >
          <div className="relative">
            <Avatar className="h-12 w-12 ring-2 ring-primary/10 group-hover:ring-primary/30 transition-all duration-300 group-hover:scale-105">
              <AvatarImage src={user.avatar} className="object-cover" />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                {user.name.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="flex-1">
            <div className="post-title group-hover:text-primary transition-colors duration-200">
              {user.name}
            </div>
            <div className="post-meta mt-0.5">{formatTimeAgo(timestamp)}</div>
          </div>

          <button className="menu-button">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="post-body">
        <p>{content}</p>
      </div>

      {image && (
        <div className="px-4 sm:px-5">
          <div className="rounded-xl overflow-hidden border border-border/50 mb-4">
            <img 
              src={image} 
              alt="Post content" 
              className="w-full h-auto object-cover hover:scale-105 transition-transform duration-500"
            />
          </div>
        </div>
      )}

      <div className="post-divider" />

      <div className="post-actions">
        <button type="button" className={`action-btn ${isLiked ? 'text-red-500 bg-red-50' : ''}`} onClick={handleLike}>
          <Heart className={`icon ${isLiked ? 'fill-current' : ''}`} />
          <span>Like</span>
          <span>({localLikes})</span>
        </button>
        <button type="button" className="action-btn" onClick={openComments}>
          <MessageCircle className="icon" />
          <span>Comment</span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="action-btn">
              <Share className="icon" />
              <span>Share</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={shareOnWhatsApp} className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              <span>Share on WhatsApp</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={shareOnFacebook} className="flex items-center gap-2">
              <Facebook className="h-4 w-4" />
              <span>Share on Facebook</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={shareOnTwitter} className="flex items-center gap-2">
              <Twitter className="h-4 w-4" />
              <span>Share on Twitter</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyLink} className="flex items-center gap-2">
              <Copy className="h-4 w-4" />
              <span>Copy Link</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Comments</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
            {loadingComments ? (
              <div className="text-sm text-muted-foreground">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-sm text-muted-foreground">No comments yet. Be the first to comment.</div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={c.user?.avatar} />
                    <AvatarFallback>{(c.user?.name?.[0] || 'U').toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{c.user?.name || 'Unknown User'}</div>
                    <div className="text-sm">{c.content}</div>
                    <div className="text-xs text-muted-foreground">{formatTimeAgo(c.created_at)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Input
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  addComment();
                }
              }}
            />
            <Button disabled={submittingComment || newComment.trim().length === 0} onClick={addComment}>
              Post
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PostCard;