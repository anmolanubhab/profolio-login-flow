import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { User, Facebook, Twitter, Copy, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import PostHeader from './feed/PostHeader';
import PostContent from './feed/PostContent';
import PostMedia from './feed/PostMedia';
import PostActions from './feed/PostActions';
import EngagementStats from './feed/EngagementStats';

interface PostCardProps {
  id: string;
  user: {
    id?: string;
    name: string;
    avatar?: string;
    subtitle?: string;
  };
  content: string;
  image?: string;
  mediaType?: 'image' | 'video';
  timestamp: string;
  likes: number;
  comments?: number;
  initialIsLiked?: boolean;
  isPromoted?: boolean;
  onLike?: (isLiked: boolean) => void;
  onDelete?: () => void;
  onHide?: () => void;
  // Company post props
  postedAs?: 'user' | 'company';
  companyId?: string | null;
  companyName?: string | null;
  companyLogo?: string | null;
}

const PostCard = ({ 
  id, 
  user, 
  content, 
  image, 
  mediaType = 'image', 
  timestamp, 
  likes, 
  comments: initialCommentCount = 0,
  onLike, 
  initialIsLiked = false, 
  isPromoted = false,
  onDelete, 
  onHide,
  postedAs = 'user',
  companyId,
  companyName,
  companyLogo
}: PostCardProps) => {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [localLikes, setLocalLikes] = useState(likes);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Array<{ id: string; user_id: string; content: string; created_at: string; user?: { name: string | null; avatar?: string | null } }>>([]);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
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
    
    // Fetch initial comment count
    fetchCommentCount();
  }, []);

  useEffect(() => {
    setIsLiked(initialIsLiked);
  }, [initialIsLiked]);

  useEffect(() => {
    setLocalLikes(likes);
  }, [likes]);

  const fetchCommentCount = async () => {
    try {
      const { count, error } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', id);
      
      if (!error && count !== null) {
        setCommentCount(count);
      }
    } catch (error) {
      console.error('Error fetching comment count:', error);
    }
  };

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
      setCommentCount(enriched.length);
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
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      
      if (profileError) {
        throw new Error(`Profile error: ${profileError.message}`);
      }
      
      if (!profile) {
        throw new Error('Your profile was not found. Please try logging out and back in.');
      }
      
      const { data: newCommentData, error: insertError } = await supabase
        .from('comments')
        .insert({
          post_id: id,
          user_id: profile.id,
          content,
        })
        .select(`id, content, created_at, user_id`)
        .single();
      
      if (insertError) {
        throw new Error(insertError.message);
      }
      
      setNewComment('');
      
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
        setCommentCount(prev => prev + 1);
      } else {
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

    if (isMobile && navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        console.error('Share failed:', err);
      }
      return;
    }
  };

  const shareOnWhatsApp = () => {
    const url = `${window.location.origin}/dashboard#post-${id}`;
    const text = encodeURIComponent(`${user.name} on Profolio: ${content}\n\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(`${window.location.origin}/dashboard#post-${id}`);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank');
  };

  const shareOnTwitter = () => {
    const url = encodeURIComponent(`${window.location.origin}/dashboard#post-${id}`);
    const text = encodeURIComponent(`${user.name} on Profolio: ${content}`);
    window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/dashboard#post-${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'Post link copied to clipboard.' });
    } catch (err) {
      toast({ title: 'Error', description: 'Could not copy the link.', variant: 'destructive' });
    }
  };

  const handleRepost = () => {
    toast({ title: 'Coming soon', description: 'Repost feature will be available soon!' });
  };

  const handleShareClick = () => {
    if (isMobile && navigator.share) {
      handleShare();
    }
  };

  const isOwnPost = !!(currentUserProfileId && user.id === currentUserProfileId);

  return (
    <article 
      className="bg-card rounded-xl border border-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.08)] hover:shadow-[0_4px_12px_rgba(0,0,0,0.1)] transition-shadow duration-300 overflow-hidden" 
      id={`post-${id}`}
    >
      {/* Post Header */}
      <PostHeader
        postId={id}
        user={user}
        timestamp={timestamp}
        isPromoted={isPromoted}
        currentUserProfileId={currentUserProfileId}
        isOwnPost={isOwnPost}
        onDelete={onDelete}
        onHide={onHide}
        postedAs={postedAs}
        companyId={companyId}
        companyName={companyName}
        companyLogo={companyLogo}
      />

      {/* Post Content */}
      <PostContent content={content} />

      {/* Post Media */}
      {image && (
        <PostMedia src={image} mediaType={mediaType} />
      )}

      {/* Engagement Stats */}
      <EngagementStats
        likes={localLikes}
        comments={commentCount}
        onCommentsClick={openComments}
      />

      {/* Action Buttons */}
      <div className="border-t border-border/60">
        {isMobile && navigator.share ? (
          <PostActions
            isLiked={isLiked}
            onLike={handleLike}
            onComment={openComments}
            onRepost={handleRepost}
            onShare={handleShareClick}
          />
        ) : (
          <div className="flex items-center px-1 py-1">
            <button
              onClick={handleLike}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-secondary active:scale-95 ${
                isLiked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <svg className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
              <span className="hidden sm:inline">Like</span>
            </button>
            
            <button
              onClick={openComments}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-secondary active:scale-95 text-muted-foreground hover:text-foreground"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="hidden sm:inline">Comment</span>
            </button>
            
            <button
              onClick={handleRepost}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-secondary active:scale-95 text-muted-foreground hover:text-foreground"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <span className="hidden sm:inline">Repost</span>
            </button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all duration-200 hover:bg-secondary active:scale-95 text-muted-foreground hover:text-foreground">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  <span className="hidden sm:inline">Send</span>
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
        )}
      </div>
      
      {/* Post separator divider */}
      <div className="h-2 bg-muted/50 -mx-4 sm:hidden" />

      {/* Comments Dialog */}
      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Comments</DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-2">
            {loadingComments ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-3 animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 bg-muted rounded" />
                      <div className="h-4 w-full bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">No comments yet</p>
                <p className="text-muted-foreground text-xs mt-1">Be the first to share your thoughts!</p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex items-start gap-3 group">
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={c.user?.avatar || undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {(c.user?.name?.[0] || 'U').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="bg-secondary rounded-xl px-3 py-2">
                      <p className="text-sm font-medium text-foreground">{c.user?.name || 'Unknown User'}</p>
                      <p className="text-sm text-foreground/90 break-words">{c.content}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 ml-1">{formatTimeAgo(c.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="flex items-center gap-2 pt-3 border-t border-border">
            <Input
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              disabled={submittingComment}
              className="flex-1"
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
              size="sm"
              className="px-4"
            >
              {submittingComment ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                'Post'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
};

export default PostCard;
