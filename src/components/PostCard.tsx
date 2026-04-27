import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Heart, MessageCircle, Share, User, Facebook, Twitter, Copy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PostOptionsMenu } from './PostOptionsMenu';

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
  onDelete?: () => void;
  onHide?: () => void;
}

const PostCard = ({ id, user, content, image, timestamp, likes, onLike, initialIsLiked = false, onDelete, onHide }: PostCardProps) => {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [localLikes, setLocalLikes] = useState(likes);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
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
      
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', authUser.id)
          .single();
        
        if (profile) {
          setCurrentUserProfileId(profile.id);
        }
      }
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
    if (!content) {
      toast({
        title: 'Empty comment',
        description: 'Please enter a comment before posting.',
        variant: 'destructive',
      });
      return;
    }
    
    setSubmittingComment(true);
    
    try {
      // Get the current user's profile to obtain the profile.id (comments.user_id references profiles.id)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      
      if (profileError) {
        console.error('Profile fetch error:', profileError);
        throw new Error(`Profile error: ${profileError.message}`);
      }
      
      if (!profile) {
        console.error('No profile found for user:', currentUser.id);
        throw new Error('Your profile was not found. Please try logging out and back in.');
      }
      
      console.log('Adding comment:', { post_id: id, user_id: profile.id, content: content.substring(0, 50) });
      
      const { data: newCommentData, error: insertError } = await supabase
        .from('comments')
        .insert({
          post_id: id,
          user_id: profile.id,
          content,
        })
        .select(`
          id,
          content,
          created_at,
          user_id
        `)
        .single();
      
      if (insertError) {
        console.error('Comment insert error:', insertError);
        throw new Error(insertError.message);
      }
      
      console.log('Comment added successfully:', newCommentData);
      
      // Clear input and update UI optimistically
      setNewComment('');
      
      // Add new comment to list immediately without full refresh
      if (newCommentData) {
        const newCommentForUI = {
          id: newCommentData.id,
          user_id: newCommentData.user_id,
          content: newCommentData.content,
          created_at: newCommentData.created_at,
          user: {
            name: profile.display_name || currentUser.email?.split('@')[0] || 'You',
            avatar: profile.avatar_url,
          },
        };
        setComments(prev => [...prev, newCommentForUI]);
      } else {
        // Fallback: refresh comments if we didn't get the new comment back
        await fetchComments();
      }
      
      toast({
        title: 'Comment posted',
        description: 'Your comment has been added.',
      });
      
    } catch (err: any) {
      console.error('Error adding comment:', err);
      toast({
        title: 'Could not add comment',
        description: err?.message || 'An unexpected error occurred. Please try again.',
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

  const isOwnPost = !!(currentUserProfileId && user.id === currentUserProfileId);

  return (
    <div className="post-card w-full max-w-full overflow-hidden" id={`post-${id}`}>
      <div className="post-header">
        <div 
          className="flex items-center gap-3 cursor-pointer group flex-1"
          onClick={handleProfileClick}
        >
          <Avatar className="h-12 w-12 ring-1 ring-border group-hover:ring-primary/40 transition-all">
            <AvatarImage src={user.avatar} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {user.name.charAt(0).toUpperCase() || <User className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="post-title group-hover:text-primary transition-colors">
              {user.name}
            </div>
            <div className="post-meta">{formatTimeAgo(timestamp)}</div>
          </div>
        </div>

        <PostOptionsMenu
          postId={id}
          postUserId={user.id || ''}
          postUserName={user.name}
          currentUserProfileId={currentUserProfileId}
          isOwnPost={isOwnPost}
          onDelete={onDelete}
          onHide={onHide}
        />
      </div>

      <div className="post-body">
        <p>{content}</p>
      </div>

      {image && (
        <div className="px-0 mb-3">
          <img 
            src={image} 
            alt="Post content" 
            className="w-full h-auto object-cover"
          />
        </div>
      )}

      <div className="px-4 sm:px-5 pb-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {localLikes > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3 fill-current text-red-500" />
              {localLikes}
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-border mx-4 sm:mx-5" />

      <div className="px-2 sm:px-3 py-1">
        <div className="flex items-center justify-around">
          <button 
            type="button" 
            className={`action-btn ${isLiked ? 'active text-primary' : ''}`} 
            onClick={handleLike}
          >
            <Heart className={`icon ${isLiked ? 'fill-current' : ''}`} />
            <span>Like</span>
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
              disabled={submittingComment}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !submittingComment && newComment.trim().length > 0) {
                  e.preventDefault();
                  addComment();
                }
              }}
            />
            <Button 
              disabled={submittingComment || newComment.trim().length === 0} 
              onClick={addComment}
              className="min-w-[60px]"
            >
              {submittingComment ? (
                <span className="flex items-center gap-1">
                  <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                </span>
              ) : (
                'Post'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default PostCard;