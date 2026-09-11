import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { User } from '@supabase/supabase-js';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Share, User as UserIcon, Facebook, Twitter, Copy, FileText, ExternalLink, X, Repeat2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PostOptionsMenu } from './PostOptionsMenu';
import { SuggestedFollowControl } from './SuggestedFollowControl';
import PostText from './PostText';
import PostRichText from './post/PostRichText';
import { isRichDoc, type RichDoc } from '@/lib/posts/richText';
import RepostButton from './RepostButton';
import type { RepostOriginalPost } from './RepostComposerDialog';
import { usePostReposts } from '@/hooks/use-post-reposts';
import { useAutoplayPreference } from '@/hooks/useAutoplayPreference';
import { useTapTrigger } from '@/hooks/use-tap-trigger';
import { ReactionBar, ReactionCountSummary, ReactionType, ReactionSummary, REACTION_META, REACTION_ORDER } from './ReactionBar';
import CommentSection from './comments/CommentSection';
import { ImageMedia, VideoMedia } from './post/PostMedia';
import { MultiPhotoCarousel } from './post/MultiPhotoCarousel';
import { PhotoLightbox } from './post/PhotoLightbox';
import { normalizePostMedia } from '@/lib/posts/media';
import { loadPostMediaTags, type DraftTag } from '@/lib/posts/mediaTags';

export interface PollSummary {
  id: string;
  question: string;
  totalVotes: number;
  userOptionId: string | null;
  options: { id: string; text: string; votes: number }[];
  /** Poll close time (ISO), or null for a poll that never expires. */
  expiresAt: string | null;
  /** True once `expiresAt` has passed — voting is disabled, results stay. */
  isClosed: boolean;
}

interface PostCardProps {
  id: string;
  user: {
    id?: string;
    name: string;
    avatar?: string;
  };
  content: string;
  /** Tiptap document (Phase 6A). When set, renders formatted text +
   *  @mention / #hashtag links instead of the plain-text `content`. */
  contentRich?: RichDoc | null;
  image?: string;
  timestamp: string;
  postType?: string;
  videoUrl?: string;
  documentUrl?: string;
  documentName?: string;
  carouselUrls?: string[];
  /** Phase 6C `posts.media` jsonb: ordered [{url, alt, w, h}]. When non-empty
   *  it supersedes `image` / `carouselUrls` and carries per-photo alt text. */
  media?: unknown;
  // Present only for feed cards that represent a published Insight article.
  // When set, the card renders an "Insight" preview (badge + publication +
  // headline + cover) linking to the reading page, instead of plain text.
  insight?: {
    insightSlug: string;
    insightTitle: string;
    articleSlug: string;
    articleTitle: string;
    subtitle: string | null;
    coverUrl: string | null;
    readingMinutes: number | null;
  };
  poll?: PollSummary | null;
  onVote?: (optionId: string) => void;
  reactionSummary: ReactionSummary;
  onReact?: (type: ReactionType | null) => void;
  onDelete?: () => void;
  onHide?: () => void;
  // Feed passes this so "Not Interested" / "Hide Post" replace this card
  // inline with an Undo strip (LinkedIn-style) instead of a toast + refetch.
  onInlineDismiss?: (info: { postId: string; label: string; onUndo: () => void | Promise<void> }) => void;
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
  contentRich,
  image,
  timestamp,
  postType = 'text',
  videoUrl,
  documentUrl,
  documentName,
  carouselUrls,
  media,
  insight,
  poll,
  onVote,
  reactionSummary,
  onReact,
  onDelete,
  onHide,
  onInlineDismiss,
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

  // Post body is kept in local state so an author's in-place edit (via
  // PostOptionsMenu -> EditPostDialog) updates the card immediately without a
  // feed refetch / scroll jump. Re-synced whenever the parent passes new props.
  const [bodyContent, setBodyContent] = useState(content);
  const [bodyRich, setBodyRich] = useState<RichDoc | null | undefined>(contentRich);
  const [wasEdited, setWasEdited] = useState(false);
  useEffect(() => {
    setBodyContent(content);
    setBodyRich(contentRich);
    setWasEdited(false);
  }, [content, contentRich]);

  // "View results" peek on a poll the viewer hasn't voted on yet.
  const [pollShowResults, setPollShowResults] = useState(false);

  // Phase 6C: `posts.media` (per-photo alt + order) supersedes image/carousel.
  // Kept in local state so an author's in-place photo edit refreshes the card.
  const [bodyMedia, setBodyMedia] = useState<unknown>(media);
  useEffect(() => { setBodyMedia(media); }, [media]);
  const mediaItems = normalizePostMedia(bodyMedia);
  const hasMedia = mediaItems.length > 0;

  // Phase 6C: photo tags (people attached to a specific image), grouped by the
  // stable media id. Read-only here; markers toggle on/off over the image.
  const [photoTags, setPhotoTags] = useState<Record<string, DraftTag[]>>({});
  const [showPhotoTags, setShowPhotoTags] = useState(false);
  // Full-screen viewer for the truly-legacy single `image_url` path (posts.media
  // and legacy carousel_urls get their own viewer inside <MultiPhotoCarousel>).
  const [legacyLightboxOpen, setLegacyLightboxOpen] = useState(false);
  useEffect(() => {
    let alive = true;
    if (hasMedia) {
      loadPostMediaTags(id).then((t) => { if (alive) setPhotoTags(t); });
    } else {
      setPhotoTags({});
    }
    return () => { alive = false; };
  }, [id, hasMedia, bodyMedia]);
  const totalPhotoTags = Object.values(photoTags).reduce((n, arr) => n + arr.length, 0);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentUserProfileId, setCurrentUserProfileId] = useState<string | null>(null);
  // Comments: an inline (non-modal) section that toggles open under the
  // action bar. The full thread state lives in useComments (via
  // CommentSection); the card only tracks open/closed and a display count.
  const [commentsOpen, setCommentsOpen] = useState(false);
  // Share menu is controlled so the tap-gesture guard (below) can open it from
  // an intentional tap only -- Radix's trigger would otherwise open it on
  // `pointerdown`, firing "Share" during a vertical scroll that starts on the
  // button.
  const [shareOpen, setShareOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  useEffect(() => { setCommentCount(initialCommentCount); }, [initialCommentCount]);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Touch/pen: open the Share menu on an intentional tap, never on
  // `pointerdown`. Desktop mouse keeps Radix's normal open-on-mousedown path.
  const shareTapHandlers = useTapTrigger(() => setShareOpen((o) => !o));
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
    const text = bodyContent;

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
    const text = encodeURIComponent(`${user.name} on Profolio: ${bodyContent}\n\n${url}`);
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
    const text = encodeURIComponent(`${user.name} on Profolio: ${bodyContent}`);
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
      onInlineDismiss={onInlineDismiss}
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
      onEdited={(newContent, newRich, newMedia) => {
        setBodyContent(newContent);
        setBodyRich(newRich);
        if (newMedia !== undefined) setBodyMedia(newMedia);
        setWasEdited(true);
      }}
    />
  );

  return (
    // Layout (overflow, and the mobile full-bleed breakout) is driven entirely
    // by `.post-card` in index.css. Do NOT add `w-full` / `max-w-full` here --
    // those Tailwind utilities load in a later layer and would override the
    // mobile `width: 100vw` that makes the whole card edge-to-edge.
    <div className="post-card" id={`post-${id}`}>
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
              {user.name.charAt(0).toUpperCase() || <UserIcon className="h-5 w-5" />}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="post-title group-hover:text-primary transition-colors">
              {user.name}
            </div>
            <div className="post-meta">
              {formatTimeAgo(timestamp)}{wasEdited ? ' · Edited' : ''}
            </div>
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

      {insight ? (
        <div className="px-4 pb-3 sm:px-5">
          <button
            type="button"
            onClick={() => navigate(`/insights/${insight.insightSlug}/${insight.articleSlug}`)}
            className="group block w-full overflow-hidden rounded-xl border border-border text-left transition-colors hover:bg-secondary/40"
          >
            {insight.coverUrl && (
              <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                <img
                  src={insight.coverUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </div>
            )}
            <div className="p-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                <FileText className="h-3.5 w-3.5" />
                Insight · {insight.insightTitle}
              </span>
              <div className="mt-1.5 text-[17px] font-bold leading-snug tracking-tight group-hover:text-primary">
                {insight.articleTitle}
              </div>
              {insight.subtitle && (
                <p className="mt-1 line-clamp-2 text-[13px] leading-normal text-muted-foreground">
                  {insight.subtitle}
                </p>
              )}
              {insight.readingMinutes ? (
                <p className="mt-1.5 text-xs text-muted-foreground">{insight.readingMinutes} min read</p>
              ) : null}
            </div>
          </button>
        </div>
      ) : (
        <>
          {(bodyContent || isRichDoc(bodyRich)) && (
            <div className="post-body">
              {isRichDoc(bodyRich) ? (
                <PostRichText doc={bodyRich} />
              ) : (
                <PostText content={bodyContent} />
              )}
            </div>
          )}

          {/* Photos render in one block below (sibling of video / document) so
              new posts.media (1-10), legacy carousel_urls and the
              truly-legacy single image_url all route through one path. */}
        </>
      )}

      {/* Phase 6C posts.media -> carousel (also handles a single photo:
          tap-to-zoom + photo tags, no arrows/indicator). */}
      {hasMedia && (
        <MultiPhotoCarousel
          photos={mediaItems.map((m) => ({ url: m.url, alt: m.alt, id: m.id, w: m.w, h: m.h }))}
          photoTags={photoTags}
          showPhotoTags={showPhotoTags}
          onToggleTags={() => setShowPhotoTags((s) => !s)}
          totalPhotoTags={totalPhotoTags}
        />
      )}
      {/* Legacy multi-image posts (carousel_urls, pre-Phase-6C). */}
      {!hasMedia && !!carouselUrls && carouselUrls.length > 0 && (
        <MultiPhotoCarousel
          photos={carouselUrls.map((url, i) => ({ url, alt: `Photo ${i + 1}`, id: '' }))}
        />
      )}
      {/* Legacy single image (pre-Phase-6C). Unchanged renderer; tap opens the
          shared full-screen viewer. */}
      {!hasMedia && (!carouselUrls || carouselUrls.length === 0) && image && (
        <ImageMedia src={image} alt="Post image" onClick={() => setLegacyLightboxOpen(true)} />
      )}
      {legacyLightboxOpen && image && (
        <PhotoLightbox
          photos={[{ url: image, alt: 'Post image' }]}
          index={0}
          onClose={() => setLegacyLightboxOpen(false)}
        />
      )}

      {postType === 'video' && videoUrl && (
        <VideoMedia
          ref={videoRef}
          src={videoUrl}
          muted={autoplayEnabled}
          playsInline={autoplayEnabled}
        />
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

      {postType === 'poll' && poll && (() => {
        const hasVoted = poll.userOptionId !== null;
        // Show the results (bars) once the viewer has voted, the poll has
        // closed, or they chose to peek. Otherwise show votable options.
        const showBars = hasVoted || poll.isClosed || pollShowResults;
        const canVote = !hasVoted && !poll.isClosed;
        const timeLabel = poll.isClosed
          ? 'Poll ended'
          : poll.expiresAt
            ? `${pollTimeLeft(poll.expiresAt)} left`
            : null;

        return (
          <div className="px-4 sm:px-5 mb-3">
            <div
              role={canVote && !showBars ? 'radiogroup' : 'group'}
              aria-label={`Poll: ${poll.question}`}
              className="space-y-2"
            >
              {poll.options.map((option) => {
                const pct = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0;
                const isMine = poll.userOptionId === option.id;

                if (!showBars) {
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={false}
                      className="w-full break-words text-left rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-primary hover:border-primary hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                      onClick={() => handleVote(option.id)}
                    >
                      {option.text}
                    </button>
                  );
                }

                return (
                  <div
                    key={option.id}
                    aria-label={`${option.text}: ${pct}%${isMine ? ', your vote' : ''}`}
                    className={`relative w-full overflow-hidden rounded-lg border px-4 py-2.5 text-sm ${isMine ? 'border-primary' : 'border-border'}`}
                  >
                    <div
                      className={`absolute inset-y-0 left-0 ${isMine ? 'bg-primary/15' : 'bg-secondary'}`}
                      style={{ width: `${pct}%` }}
                      aria-hidden
                    />
                    <div className="relative flex items-center justify-between gap-2">
                      <span className={`min-w-0 break-words font-medium ${isMine ? 'text-primary' : ''}`}>
                        {option.text}{isMine ? ' ✓' : ''}
                      </span>
                      <span className="shrink-0 text-muted-foreground">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{poll.totalVotes} {poll.totalVotes === 1 ? 'vote' : 'votes'}</span>
              {timeLabel && (
                <>
                  <span aria-hidden>·</span>
                  <span>{timeLabel}</span>
                </>
              )}
              {canVote && (
                <>
                  <span aria-hidden>·</span>
                  <button
                    type="button"
                    className="rounded-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setPollShowResults((s) => !s)}
                  >
                    {pollShowResults ? 'Hide results' : 'View results'}
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {ctaState && <PostCta {...ctaState} />}

      <div className="px-4 sm:px-5 pb-1.5">
        <div className="flex items-center justify-between gap-2 text-xs sm:text-[13px] text-muted-foreground">
          <ReactionCountSummary summary={reactionSummary} onClick={() => setBreakdownOpen(true)} />
          {(commentCount > 0 || repostCount > 0) && (
            <span className="shrink-0">
              {[
                commentCount > 0 && `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`,
                repostCount > 0 && `${repostCount} ${repostCount === 1 ? 'repost' : 'reposts'}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </div>
      </div>

      {/* Full-width hairline between the counts row and the action bar --
          matches LinkedIn (their .social-action-bar border-top spans the
          card edge-to-edge); inset only on desktop where the card is padded. */}
      <div className="border-t border-border sm:mx-5" />

      <div className="px-0.5 sm:px-2 py-0.5">
        <div className="post-actions-row">
          <ReactionBar summary={reactionSummary} onReact={handleReact} />
          <button
            type="button"
            className={`action-btn ${commentsOpen ? 'active' : ''}`}
            onClick={() => setCommentsOpen((o) => !o)}
            aria-expanded={commentsOpen}
            aria-controls={`comments-${id}`}
          >
            <MessageCircle className="icon" />
            <span>Comment</span>
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
          <DropdownMenu open={shareOpen} onOpenChange={setShareOpen}>
            {/* Tap handlers on the Trigger, not the inner <button> -- Radix's
                Slot merge keeps parent handlers but drops child-only ones. */}
            <DropdownMenuTrigger asChild {...shareTapHandlers}>
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

// Coarse "time remaining" label for an open poll: "3d" / "5h" / "12m".
// Closed polls are handled by the caller (shows "Poll ended" instead).
function pollTimeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '<1m';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

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