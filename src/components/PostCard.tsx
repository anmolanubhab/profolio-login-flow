import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Share, User, Facebook, Twitter, Copy, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import { PostOptionsMenu } from './PostOptionsMenu';
import { ReactionBar, ReactionCountSummary, ReactionType, ReactionSummary, REACTION_META, REACTION_ORDER } from './ReactionBar';

export interface PollSummary {
  id: string;
  question: string;
  totalVotes: number;
  userOptionId: string | null;
  options: { id: string; text: string; votes: number }[];
}

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
  postType?: string;
  videoUrl?: string;
  documentUrl?: string;
  documentName?: string;
  carouselUrls?: string[];
  poll?: PollSummary | null;
  onVote?: (optionId: string) => void;
  reactionSummary: ReactionSummary;
  onReact?: (type: ReactionType | null) => void;
  onDelete?: () => void;
  onHide?: () => void;
  // Overrides where clicking the header identity navigates to -- used for
  // posts published as a company, which should open the company page
  // instead of a personal profile.
  profileLink?: string;
}

const PostCard = ({
  id,
  user,
  content,
  image,
  timestamp,
  postType = 'text',
  videoUrl,
  documentUrl,
  documentName,
  carouselUrls,
  poll,
  onVote,
  reactionSummary,
  onReact,
  onDelete,
  onHide,
  profileLink,
}: PostCardProps) => {
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Array<{ id: string; user_id: string; content: string; created_at: string; parent_comment_id: string | null; user?: { name: string | null; avatar?: string | null } }>>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  // Threaded comments: which top-level comment (if any) is currently being
  // replied to, the text of that reply, and which comments' reply lists are
  // expanded. One level of nesting only -- a reply can't itself be replied to.
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
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

  const handleReact = (type: ReactionType | null) => {
    if (!currentUser) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to react to posts.',
        variant: 'destructive',
      });
      navigate('/register');
      return;
    }
    onReact?.(type);
  };

  const handleVote = (optionId: string) => {
    if (!currentUser) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to vote.',
        variant: 'destructive',
      });
      navigate('/register');
      return;
    }
    onVote?.(optionId);
  };

  const handleProfileClick = () => {
    if (profileLink) {
      navigate(profileLink);
    } else if (user.id) {
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
        parent_comment_id: c.parent_comment_id,
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
          parent_comment_id: null,
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

  const addReply = async (parentCommentId: string) => {
    if (!currentUser) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to reply.',
        variant: 'destructive',
      });
      navigate('/register');
      return;
    }

    const content = replyText.trim();
    if (!content) return;

    setSubmittingReply(true);

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('user_id', currentUser.id)
        .maybeSingle();

      if (profileError) throw new Error(`Profile error: ${profileError.message}`);
      if (!profile) throw new Error('Your profile was not found. Please try logging out and back in.');

      const { data: newReplyData, error: insertError } = await supabase
        .from('comments')
        .insert({
          post_id: id,
          user_id: profile.id,
          content,
          parent_comment_id: parentCommentId,
        })
        .select('id, content, created_at, user_id, parent_comment_id')
        .single();

      if (insertError) throw new Error(insertError.message);

      setReplyText('');
      setReplyingTo(null);

      if (newReplyData) {
        setComments(prev => [
          ...prev,
          {
            id: newReplyData.id,
            user_id: newReplyData.user_id,
            content: newReplyData.content,
            created_at: newReplyData.created_at,
            parent_comment_id: newReplyData.parent_comment_id,
            user: {
              name: profile.display_name || currentUser.email?.split('@')[0] || 'You',
              avatar: profile.avatar_url,
            },
          },
        ]);
        // Auto-expand so the person immediately sees their own reply.
        setExpandedReplies(prev => new Set(prev).add(parentCommentId));
      } else {
        await fetchComments();
      }
    } catch (err: any) {
      console.error('Error adding reply:', err);
      toast({
        title: 'Could not post reply',
        description: err?.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingReply(false);
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  // Group the flat fetched list into top-level comments + their replies --
  // comments are only threaded one level deep (enforced server-side too).
  const topLevelComments = comments.filter((c) => !c.parent_comment_id);
  const repliesByParent = new Map<string, typeof comments>();
  comments.forEach((c) => {
    if (c.parent_comment_id) {
      const arr = repliesByParent.get(c.parent_comment_id) || [];
      arr.push(c);
      repliesByParent.set(c.parent_comment_id, arr);
    }
  });

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

      {postType === 'carousel' && carouselUrls && carouselUrls.length > 0 && (
        <div className="px-4 sm:px-5 mb-3">
          <Carousel className="w-full">
            <CarouselContent>
              {carouselUrls.map((url, i) => (
                <CarouselItem key={i}>
                  <img src={url} alt={`Slide ${i + 1}`} className="w-full h-auto max-h-96 object-cover rounded-lg" />
                </CarouselItem>
              ))}
            </CarouselContent>
            {carouselUrls.length > 1 && (
              <>
                <CarouselPrevious className="left-2" />
                <CarouselNext className="right-2" />
              </>
            )}
          </Carousel>
        </div>
      )}

      {postType === 'video' && videoUrl && (
        <div className="px-0 mb-3">
          <video src={videoUrl} controls className="w-full max-h-[32rem] bg-black" />
        </div>
      )}

      {postType === 'document' && documentUrl && (
        <div className="px-4 sm:px-5 mb-3 space-y-2">
          <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
            <FileText className="h-8 w-8 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{documentName || 'Document'}</div>
            </div>
            <a href={documentUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-1.5" />
                Open
              </Button>
            </a>
          </div>
          <iframe src={documentUrl} title={documentName || 'Document preview'} className="w-full h-72 rounded-lg border border-border" />
        </div>
      )}

      {postType === 'poll' && poll && (
        <div className="px-4 sm:px-5 mb-3 space-y-2">
          {poll.options.map((option) => {
            const pct = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
            const isMine = poll.userOptionId === option.id;
            const hasVoted = poll.userOptionId !== null;

            if (!hasVoted) {
              return (
                <button
                  key={option.id}
                  type="button"
                  className="w-full text-left rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:border-primary hover:bg-secondary/50 transition-colors"
                  onClick={() => handleVote(option.id)}
                >
                  {option.text}
                </button>
              );
            }

            return (
              <div key={option.id} className={`relative w-full rounded-lg border px-4 py-2.5 text-sm overflow-hidden ${isMine ? 'border-primary' : 'border-border'}`}>
                <div
                  className={`absolute inset-y-0 left-0 ${isMine ? 'bg-primary/15' : 'bg-secondary'}`}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center justify-between">
                  <span className={`font-medium ${isMine ? 'text-primary' : ''}`}>
                    {option.text}{isMine ? ' ✓' : ''}
                  </span>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            {poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}
          </p>
        </div>
      )}

      <div className="px-4 sm:px-5 pb-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ReactionCountSummary summary={reactionSummary} onClick={() => setBreakdownOpen(true)} />
        </div>
      </div>

      <div className="border-t border-border mx-4 sm:mx-5" />

      <div className="px-2 sm:px-3 py-1">
        <div className="flex items-center justify-around">
          <ReactionBar summary={reactionSummary} onReact={handleReact} />
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
            ) : topLevelComments.length === 0 ? (
              <div className="text-sm text-muted-foreground">No comments yet. Be the first to comment.</div>
            ) : (
              topLevelComments.map((c) => {
                const replies = repliesByParent.get(c.id) || [];
                const isExpanded = expandedReplies.has(c.id);
                return (
                  <div key={c.id} className="space-y-2">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={c.user?.avatar} />
                        <AvatarFallback>{(c.user?.name?.[0] || 'U').toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="text-sm font-medium">{c.user?.name || 'Unknown User'}</div>
                        <div className="text-sm">{c.content}</div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-muted-foreground">{formatTimeAgo(c.created_at)}</span>
                          <button
                            type="button"
                            className="text-xs font-medium text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setReplyingTo(replyingTo === c.id ? null : c.id);
                              setReplyText('');
                            }}
                          >
                            Reply
                          </button>
                          {replies.length > 0 && (
                            <button
                              type="button"
                              className="text-xs font-medium text-primary hover:underline"
                              onClick={() => toggleReplies(c.id)}
                            >
                              {isExpanded ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {replyingTo === c.id && (
                      <div className="flex items-center gap-2 pl-11">
                        <Input
                          placeholder={`Reply to ${c.user?.name || 'this comment'}...`}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          disabled={submittingReply}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey && !submittingReply && replyText.trim().length > 0) {
                              e.preventDefault();
                              addReply(c.id);
                            }
                          }}
                        />
                        <Button
                          size="sm"
                          disabled={submittingReply || replyText.trim().length === 0}
                          onClick={() => addReply(c.id)}
                        >
                          {submittingReply ? (
                            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                          ) : (
                            'Reply'
                          )}
                        </Button>
                      </div>
                    )}

                    {isExpanded && replies.length > 0 && (
                      <div className="pl-11 space-y-3">
                        {replies.map((r) => (
                          <div key={r.id} className="flex items-start gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={r.user?.avatar} />
                              <AvatarFallback>{(r.user?.name?.[0] || 'U').toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="text-sm font-medium">{r.user?.name || 'Unknown User'}</div>
                              <div className="text-sm">{r.content}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{formatTimeAgo(r.created_at)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
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

      <Dialog open={breakdownOpen} onOpenChange={setBreakdownOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reactions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {REACTION_ORDER.filter((t) => (reactionSummary.reactions[t] || 0) > 0).map((type) => (
              <div key={type} className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm">
                  <span className="text-lg">{REACTION_META[type].emoji}</span>
                  {REACTION_META[type].label}
                </span>
                <span className="text-sm font-medium">{reactionSummary.reactions[type]}</span>
              </div>
            ))}
            {reactionSummary.total_reactions === 0 && (
              <p className="text-sm text-muted-foreground">No reactions yet.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default PostCard;