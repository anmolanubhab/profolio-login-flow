import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Share, User, Facebook, Twitter, Copy, FileText, ExternalLink, X, Repeat2 } from 'lucide-react';
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
import { SuggestedFollowControl } from './SuggestedFollowControl';
import PostText from './PostText';
import RepostButton from './RepostButton';
import type { RepostOriginalPost } from './RepostComposerDialog';
import { usePostReposts } from '@/hooks/use-post-reposts';
import { useAutoplayPreference } from '@/hooks/useAutoplayPreference';
import { ReactionBar, ReactionCountSummary, ReactionType, ReactionSummary, REACTION_META, REACTION_ORDER } from './ReactionBar';
import CommentSection from './comments/CommentSection';

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
  cta?: { label: string; url: string; openNewTab: boolean } | null;
  // Only set for posts published as a company -- drives the "Edit CTA"
  // admin check in PostOptionsMenu. Absent/undefined for personal posts.
  companyId?: string | null;
  // "Suggested" treatment (LinkedIn-style): the author isn't followed yet --
  // shows a Follow/Following control and a top-right X to dismiss just this
  // card. Computed once per feed fetch by the caller (Feed.tsx), not
  // re-derived here, so it stays fixed for the card's lifetime in this
  // session even after the user follows the author from this same card.
  isSuggested?: boolean;
  isFollowingAuthor?: boolean;
  onDismissSuggested?: () => void;
  // Repost — seeds from the feed query so the button renders correct state
  // with no extra round-trip.
  repostCount?: number;
  hasReposted?: boolean;
  myRepostCommentary?: string | null;
  // Seeds the Comment button's count from the feed query (comments(count)) so
  // it renders immediately without opening the thread. The section itself
  // re-reads the authoritative count from the DB when opened.
  commentCount?: number;
  // Set when this card represents "<someone> reposted this" in the feed.
  repostContext?: RepostContext;
  onRepostChange?: () => void;
}

export interface RepostContext {
  reposterName: string;
  reposterAvatar?: string;
  reposterProfileId?: string;
  commentary?: string | null;
  repostedAt: string;
  isMine?: boolean;
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
  cta,
  companyId,
  isSuggested,
  isFollowingAuthor,
  onDismissSuggested,
  repostCount: initialRepostCount = 0,
  hasReposted: initialHasReposted = false,
  myRepostCommentary = null,
  commentCount: initialCommentCount = 0,
  repostContext,
  onRepostChange,
}: PostCardProps) => {
  const [ctaState, setCtaState] = useState(cta ?? null);
  useEffect(() => { setCtaState(cta ?? null); }, [cta]);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  // Comments: an inline (non-modal) section that toggles open under the
  // action bar. The full thread state lives in useComments (via
  // CommentSection); the card only tracks open/closed and a display count.
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  useEffect(() => { setCommentCount(initialCommentCount); }, [initialCommentCount]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const autoplayEnabled = useAutoplayPreference();
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    repostCount,
    hasReposted,
    myCommentary: myRepostText,
    busy: repostBusy,
    repost,
    removeRepost,
  } = usePostReposts(id, {
    count: initialRepostCount,
    hasReposted: initialHasReposted,
    myCommentary: myRepostCommentary,
  });

  const handleRepost = async (commentary?: string | null) => {
    const ok = await repost(commentary);
    if (ok) onRepostChange?.();
    return ok;
  };

  const handleRemoveRepost = async () => {
    const ok = await removeRepost();
    if (ok) onRepostChange?.();
    return ok;
  };

  const repostOriginalPost: RepostOriginalPost = {
    id,
    author: { name: user.name, avatar: user.avatar },
    content,
    image,
    postType,
    videoUrl,
    documentName,
    carouselUrls,
    createdAt: timestamp,
  };

  // Scroll-triggered autoplay: only wired up when the viewer has the
  // Autoplay videos setting on, and only for this post's own <video> (not
  // story videos or compose-time previews, which live in other components
  // entirely and are untouched by this setting). Muted is required for
  // browsers to allow autoplay without a user gesture.
  //
  // Deliberate hysteresis on play vs. pause: play as soon as the video is
  // >=50% visible, but only pause once it's fully (0%) out of view. Using
  // the same 50% threshold for both directions causes real flapping --
  // confirmed while testing -- any minor layout shift from async content
  // loading elsewhere on the page (an avatar, a suggested-post image) nudges
  // the ratio a few percent and re-fires the observer, so a video sitting
  // right at the boundary rapidly play/pause loops instead of just playing.
  // Requiring full exit before pausing is the standard fix feed UIs use.
  useEffect(() => {
    if (!autoplayEnabled || postType !== 'video' || !videoRef.current) return;
    const videoEl = videoRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.5) {
          videoEl.play().catch(() => {});
        } else if (entry.intersectionRatio === 0) {
          videoEl.pause();
        }
      },
      { threshold: [0, 0.5] }
    );
    observer.observe(videoEl);
    return () => observer.disconnect();
  }, [autoplayEnabled, postType]);

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

  const handleShare = async () => {
    const url = `${window.location.origin}/post/${id}`;
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
    const url = `${window.location.origin}/post/${id}`;
    const text = encodeURIComponent(`${user.name} on Profolio: ${content}\n\n${url}`);
    const whatsappUrl = `https://wa.me/?text=${text}`;
    window.open(whatsappUrl, '_blank');
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(`${window.location.origin}/post/${id}`);
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    window.open(facebookUrl, '_blank');
  };

  const shareOnTwitter = () => {
    const url = encodeURIComponent(`${window.location.origin}/post/${id}`);
    const text = encodeURIComponent(`${user.name} on Profolio: ${content}`);
    const twitterUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
    window.open(twitterUrl, '_blank');
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/post/${id}`;
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

  const optionsMenu = (
    <PostOptionsMenu
      postId={id}
      postUserId={user.id || ''}
      postUserName={user.name}
      currentUserProfileId={currentUserProfileId}
      isOwnPost={isOwnPost}
      onDelete={onDelete}
      onHide={onHide}
      companyId={companyId}
      cta={{
        cta_enabled: !!ctaState,
        cta_label: ctaState?.label ?? null,
        cta_url: ctaState?.url ?? null,
        cta_open_new_tab: ctaState?.openNewTab ?? true,
      }}
      onCtaChange={(next) =>
        setCtaState(next ? { label: next.cta_label!, url: next.cta_url!, openNewTab: next.cta_open_new_tab } : null)
      }
    />
  );

  return (
    // overflow-clip (not -hidden): still clips media bleed / rounded corners,
    // but is NOT a scroll container, so a focus event inside the inline comment
    // section can't shift the card sideways and strand its content.
    <div className="post-card w-full max-w-full overflow-clip" id={`post-${id}`}>
      {repostContext && (
        <div className="flex items-center gap-2 px-4 sm:px-5 pt-3 text-[13px] text-muted-foreground">
          <Repeat2 className="h-4 w-4 shrink-0" />
          <span className="truncate">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (repostContext.reposterProfileId) navigate(`/profile/${repostContext.reposterProfileId}`);
              }}
              className="font-semibold text-foreground hover:text-primary hover:underline"
            >
              {repostContext.isMine ? 'You' : repostContext.reposterName}
            </button>{' '}
            reposted this · {formatTimeAgo(repostContext.repostedAt)}
          </span>
        </div>
      )}

      {repostContext?.commentary ? (
        <div className="post-body pb-2">
          <PostText content={repostContext.commentary} />
        </div>
      ) : null}

      {isSuggested && (
        <div className="flex items-center justify-between px-4 sm:px-5 pt-3">
          <span className="text-[13px] font-medium text-muted-foreground">Suggested</span>
          <div className="flex items-center gap-1 shrink-0">
            {optionsMenu}
            <button
              type="button"
              className="menu-button hover:bg-secondary transition-colors rounded-full p-2"
              aria-label="Dismiss suggested post"
              onClick={(e) => { e.stopPropagation(); onDismissSuggested?.(); }}
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

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

        <div className="flex items-center gap-1 shrink-0">
          {isSuggested && !isOwnPost && user.id ? (
            <SuggestedFollowControl
              targetId={companyId || user.id}
              targetName={user.name}
              isCompany={!!companyId}
              currentUserProfileId={currentUserProfileId}
              initialFollowing={!!isFollowingAuthor}
            />
          ) : (
            optionsMenu
          )}
        </div>
      </div>

      <div className="post-body">
        <PostText content={content} />
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
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            muted={autoplayEnabled}
            playsInline={autoplayEnabled}
            className="w-full max-h-[32rem] bg-black"
          />
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

      {ctaState && <PostCta {...ctaState} />}

      <div className="px-4 sm:px-5 pb-2">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <ReactionCountSummary summary={reactionSummary} onClick={() => setBreakdownOpen(true)} />
          {repostCount > 0 && (
            <span>{repostCount} {repostCount === 1 ? 'repost' : 'reposts'}</span>
          )}
        </div>
      </div>

      <div className="border-t border-border mx-4 sm:mx-5" />

      <div className="px-2 sm:px-3 py-1">
        <div className="flex items-center justify-around">
          <ReactionBar summary={reactionSummary} onReact={handleReact} />
          <button
            type="button"
            className={`action-btn ${commentsOpen ? 'active' : ''}`}
            onClick={() => setCommentsOpen((o) => !o)}
            aria-expanded={commentsOpen}
            aria-controls={`comments-${id}`}
          >
            <MessageCircle className="icon" />
            <span>Comment{commentCount > 0 ? ` ${commentCount}` : ''}</span>
          </button>
          <RepostButton
            post={repostOriginalPost}
            repostCount={repostCount}
            hasReposted={hasReposted}
            myCommentary={myRepostText}
            busy={repostBusy}
            onRepost={handleRepost}
            onRemoveRepost={handleRemoveRepost}
          />
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

      {commentsOpen && (
        <div id={`comments-${id}`} className="border-t border-border">
          <CommentSection
            postId={id}
            seedCount={commentCount}
            onCountChange={setCommentCount}
          />
        </div>
      )}

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

// The company-post CTA, rendered as a compact link-preview strip (domain +
// button) rather than a floating button -- matches how the destination
// itself is always a real, validated http(s) URL (the DB check constraint
// `posts_cta_consistency` guarantees this even if a row got here some other
// way), so a plain <a> with a real href is used, never
// dangerouslySetInnerHTML or a raw string interpolated into markup.
function PostCta({ label, url, openNewTab }: { label: string; url: string; openNewTab: boolean }) {
  let hostname = url;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // Malformed CTA URLs shouldn't exist (validated at write time), but if
    // one somehow slipped through, fall back to showing the raw string
    // rather than crashing the whole post card.
  }

  return (
    <div className="mx-4 sm:mx-5 mb-3 rounded-lg border border-border bg-secondary/40 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <span className="text-xs text-muted-foreground truncate min-w-0">{hostname}</span>
      <a
        href={url}
        target={openNewTab ? '_blank' : undefined}
        rel={openNewTab ? 'noopener noreferrer' : undefined}
        className="inline-flex items-center justify-center shrink-0 rounded-full bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {label}
      </a>
    </div>
  );
}

export default PostCard;