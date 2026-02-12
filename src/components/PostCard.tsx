import { useState, useEffect, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { User, Facebook, Twitter, Copy, MessageCircle, MessageSquare, Loader2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { RepostDialog } from './feed/RepostDialog';
import SharedPost from './feed/SharedPost';
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
  // Repost props
  postType?: string;
  originalPost?: any;
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
  companyLogo,
  postType,
  originalPost
}: PostCardProps) => {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [localLikes, setLocalLikes] = useState(likes);
  const { user: currentUser, profile: currentUserProfile } = useAuth();
  const currentUserProfileId = currentUserProfile?.id || null;
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<Array<{ id: string; user_id: string; content: string; created_at: string; user?: { name: string | null; avatar?: string | null } }>>([]);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showRepostDialog, setShowRepostDialog] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    setCommentCount(initialCommentCount);
  }, [initialCommentCount]);

  useEffect(() => {
    const controller = new AbortController();
    
    // Fetch initial comment count
    fetchCommentCount(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    setIsLiked(initialIsLiked);
  }, [initialIsLiked]);

  useEffect(() => {
    setLocalLikes(likes);
  }, [likes]);

  const fetchCommentCount = async (signal?: AbortSignal) => {
    try {
      const query = supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', id);
      
      if (signal) {
        query.abortSignal(signal);
      }

      const { count, error } = await query;
      
      if (!error && count !== null && (!signal || !signal.aborted)) {
        setCommentCount(count);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error fetching comment count:', error);
      }
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
    setShowRepostDialog(true);
  };

  const handleCreateRepost = async (comment?: string) => {
    try {
      if (!currentUser) {
        toast({ title: 'Sign in required', description: 'Please sign in to repost.', variant: 'destructive' });
        navigate('/register');
        return;
      }

      // If this post is already a repost, we want to repost the ORIGINAL post
      // This prevents nested reposts (A reposts B, B reposts C -> A reposts C)
      const targetPostId = postType === 'repost' && originalPost ? originalPost.id : id;

      const { error } = await supabase.from('posts').insert({
        content: comment || '',
        user_id: currentUser.id,
        post_type: 'repost',
        original_post_id: targetPostId,
        posted_as: 'user', // Default to user for now
      });

      if (error) throw error;

      toast({ title: 'Success', description: 'Post reposted successfully' });
      // Ideally trigger a feed refresh here
    } catch (error: any) {
      console.error('Error reposting:', error);
      toast({ title: 'Error', description: error.message || 'Failed to repost', variant: 'destructive' });
    }
  };

  const handleShareClick = () => {
    if (isMobile && navigator.share) {
      handleShare();
    }
  };

  const isOwnPost = !!(currentUserProfileId && user.id === currentUserProfileId);

  return (
    <article 
      className="bg-white overflow-hidden
        rounded-[2rem] sm:rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 group/card" 
      id={`post-${id}`}
    >
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-0 group-hover/card:opacity-100 transition-opacity duration-500" />
      
      {/* Post Header */}
      <PostHeader
        postId={id}
        user={user}
        timestamp={timestamp}
        isPromoted={isPromoted}
        currentUserProfileId={currentUserProfileId}
        currentUserId={currentUser?.id}
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

      {/* Shared Post (if this is a repost) */}
      {postType === 'repost' && originalPost && (
        <div className="px-6 mb-4">
          <SharedPost post={originalPost} />
        </div>
      )}

      {/* Post Media */}
      {image && (
        <div className="mx-6 mb-4 rounded-[2rem] overflow-hidden shadow-lg border border-gray-100 group/media transition-transform duration-500">
          <PostMedia src={image} mediaType={mediaType} />
        </div>
      )}

      {/* Engagement Stats */}
      <EngagementStats
        likes={localLikes}
        comments={commentCount}
        onCommentsClick={openComments}
      />

      {/* Action Buttons */}
      <div className="border-t border-[#E8EBEF]/60">
        <div className="flex items-center px-2 py-1 gap-1">
          <button
            onClick={handleLike}
            className={`flex-1 flex items-center justify-center gap-2 py-3.5 min-h-[52px] rounded-[1.5rem] text-[14px] font-bold transition-all duration-300 transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#833AB4]/30 ${
              isLiked 
                ? 'bg-gradient-to-r from-[#0077B5]/10 to-[#E1306C]/10 text-[#833AB4]' 
                : 'text-[#5E6B7E] hover:bg-gray-50 hover:text-[#1D2226]'
            }`}
          >
            <svg className={`w-5 h-5 transition-all duration-300 ${isLiked ? 'fill-[#833AB4] text-[#833AB4] scale-110' : 'group-hover:scale-110'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
            <span className="hidden sm:inline">Like</span>
          </button>
          
          <button
            onClick={openComments}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 min-h-[52px] rounded-[1.5rem] text-[14px] font-bold transition-all duration-300 transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#833AB4]/30 text-[#5E6B7E] hover:bg-gray-50 hover:text-[#1D2226]"
          >
            <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
            <span className="hidden sm:inline">Comment</span>
          </button>
          
          <button
            onClick={handleRepost}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 min-h-[52px] rounded-[1.5rem] text-[14px] font-bold transition-all duration-300 transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#833AB4]/30 text-[#5E6B7E] hover:bg-gray-50 hover:text-[#1D2226]"
          >
            <svg className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
              <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
            <span className="hidden sm:inline">Repost</span>
          </button>
          
          {isMobile && navigator.share ? (
            <button 
              onClick={handleShareClick}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 min-h-[52px] rounded-[1.5rem] text-[14px] font-bold transition-all duration-300 transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#833AB4]/30 text-[#5E6B7E] hover:bg-gray-50 hover:text-[#1D2226]"
            >
              <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" strokeWidth={2.5} />
              <span className="hidden sm:inline">Send</span>
            </button>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex-1 flex items-center justify-center gap-2 py-3.5 min-h-[52px] rounded-[1.5rem] text-[14px] font-bold transition-all duration-300 transform active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#833AB4]/30 text-[#5E6B7E] hover:bg-gray-50 hover:text-[#1D2226]">
                  <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" strokeWidth={2.5} />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-2 rounded-[1.5rem] shadow-2xl border-[#E8EBEF]/60 animate-in fade-in zoom-in-95 duration-200">
                <DropdownMenuItem onClick={shareOnWhatsApp} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer font-bold text-[#5E6B7E] hover:text-[#1D2226] transition-colors">
                  <div className="p-2 rounded-lg bg-green-50 text-green-600">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  <span>Share on WhatsApp</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareOnFacebook} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer font-bold text-[#5E6B7E] hover:text-[#1D2226] transition-colors">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    <Facebook className="h-5 w-5" />
                  </div>
                  <span>Share on Facebook</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareOnTwitter} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer font-bold text-[#5E6B7E] hover:text-[#1D2226] transition-colors">
                  <div className="p-2 rounded-lg bg-sky-50 text-sky-600">
                    <Twitter className="h-5 w-5" />
                  </div>
                  <span>Share on Twitter</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={copyLink} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer font-bold text-[#5E6B7E] hover:text-[#1D2226] transition-colors">
                  <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                    <Copy className="h-5 w-5" />
                  </div>
                  <span>Copy Link</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      
      {/* Comments Dialog */}
      <Dialog open={commentsOpen} onOpenChange={setCommentsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col rounded-[2rem] sm:rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden animate-in zoom-in-95 duration-300">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
          
          <div className="px-8 pt-8 pb-4 border-b border-[#E8EBEF]/60">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-[#1D2226] tracking-tight flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#0077B5]/10 to-[#E1306C]/10 text-[#833AB4]">
                    <MessageCircle className="h-6 w-6" />
                  </div>
                  <span>Discussion</span>
                </div>
                <span className="text-[13px] font-black px-4 py-1.5 rounded-full bg-[#F3F6F8] text-[#5E6B7E] uppercase tracking-wider">
                  {commentCount} {commentCount === 1 ? 'Voice' : 'Voices'}
                </span>
              </DialogTitle>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 scrollbar-hide bg-white">
            {loadingComments ? (
              <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-start gap-4 animate-pulse">
                    <div className="h-12 w-12 rounded-[1rem] bg-[#F3F6F8]" />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 w-32 bg-[#F3F6F8] rounded-full" />
                      <div className="h-16 w-full bg-[#F3F6F8]/50 rounded-[1.5rem]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-3xl rounded-full" />
                  <div className="relative h-24 w-24 bg-white rounded-[2.5rem] shadow-xl flex items-center justify-center text-[#833AB4] border border-[#E8EBEF]/50">
                    <MessageSquare className="h-10 w-10" />
                  </div>
                </div>
                <div className="max-w-[280px] space-y-2">
                  <h3 className="text-xl font-black text-[#1D2226]">No voices yet</h3>
                  <p className="text-[#5E6B7E] font-medium leading-relaxed">Be the first to share your perspective and start the conversation!</p>
                </div>
              </div>
            ) : (
              comments.map((c, index) => (
                <div key={c.id} className="flex items-start gap-4 group/comment animate-in fade-in slide-in-from-bottom-2" style={{ animationDelay: `${index * 50}ms` }}>
                  <Avatar className="h-12 w-12 rounded-[1rem] ring-4 ring-white shadow-sm flex-shrink-0 group-hover/comment:scale-105 transition-all duration-300">
                    <AvatarImage src={c.user?.avatar || undefined} referrerPolicy="no-referrer" className="object-cover" />
                    <AvatarFallback className="bg-gradient-to-br from-[#0077B5]/10 to-[#E1306C]/10 text-[#833AB4] font-black text-lg">
                      {(c.user?.name?.[0] || 'U').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="bg-[#F3F6F8]/60 group-hover/comment:bg-[#F3F6F8] transition-all duration-300 rounded-[1.5rem] px-6 py-4 border border-[#E8EBEF]/50 shadow-sm group-hover/comment:shadow-md">
                      <div className="flex justify-between items-center mb-1.5">
                        <p className="text-[15px] font-black text-[#1D2226] hover:text-[#0077B5] transition-colors cursor-pointer">{c.user?.name || 'Unknown User'}</p>
                        <p className="text-[11px] font-bold text-[#5E6B7E] uppercase tracking-widest opacity-80">{formatTimeAgo(c.created_at)}</p>
                      </div>
                      <p className="text-[15px] text-[#1D2226]/90 leading-relaxed break-words font-medium">{c.content}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-8 bg-white border-t border-[#E8EBEF]/60">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative group">
                <Input
                  placeholder="Add to the discussion..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  disabled={submittingComment}
                  className="w-full h-14 pl-6 pr-14 rounded-2xl bg-[#F3F6F8] border-transparent focus:bg-white focus:ring-4 focus:ring-[#833AB4]/5 focus:border-[#833AB4]/20 transition-all font-bold text-[16px] text-[#1D2226] placeholder:text-[#5E6B7E]/60 placeholder:font-bold"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !submittingComment && newComment.trim().length > 0) {
                      e.preventDefault();
                      addComment();
                    }
                  }}
                />
                <div className="absolute right-2 top-2">
                  <Button 
                    disabled={submittingComment || newComment.trim().length === 0} 
                    onClick={addComment}
                    className="h-10 w-10 rounded-xl bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white p-0 shadow-lg shadow-[#833AB4]/20 hover:shadow-[#833AB4]/40 hover:scale-105 transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:grayscale"
                  >
                    {submittingComment ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Send className="h-5 w-5 ml-0.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Repost Dialog */}
      <RepostDialog
        open={showRepostDialog}
        onOpenChange={setShowRepostDialog}
        onRepost={handleCreateRepost}
        originalPost={{
          user: {
            name: postType === 'repost' && originalPost ? (originalPost.posted_as === 'company' ? originalPost.company_name : originalPost.profiles?.display_name) : user.name,
            avatar: postType === 'repost' && originalPost ? (originalPost.posted_as === 'company' ? originalPost.company_logo : originalPost.profiles?.avatar_url) : user.avatar,
          },
          content: postType === 'repost' && originalPost ? originalPost.content : content,
          created_at: postType === 'repost' && originalPost ? originalPost.created_at : timestamp,
        }}
      />
    </article>
  );
};

export default memo(PostCard);
