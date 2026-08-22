import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { StoryUploadDialog } from '@/components/StoryUploadDialog';
import {
  X,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Volume2,
  VolumeX,
  Send,
  Plus,
  Archive,
  Settings,
  Loader2,
  ImageOff,
} from 'lucide-react';

interface StoryRow {
  id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  created_at: string;
  expires_at: string;
}

interface AuthorGroup {
  userId: string;
  profile: { display_name: string | null; avatar_url: string | null } | null;
  stories: StoryRow[];
  isSelf: boolean;
}

const IMAGE_STORY_DURATION_MS = 5000;
const REACTIONS: { type: string; emoji: string; label: string }[] = [
  { type: 'like', emoji: '👍', label: 'Like' },
  { type: 'love', emoji: '❤️', label: 'Love' },
  { type: 'laugh', emoji: '😂', label: 'Laugh' },
  { type: 'wow', emoji: '😮', label: 'Wow' },
  { type: 'sad', emoji: '😢', label: 'Sad' },
  { type: 'angry', emoji: '😡', label: 'Angry' },
];
const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'hate', label: 'Hate or abusive content' },
  { value: 'misinformation', label: 'False/misleading information' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'scam', label: 'Scam/fraud' },
  { value: 'other', label: 'Other' },
];

function formatTimeAgo(timestamp: string) {
  const diffMin = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
}

const StoryPage = () => {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authors, setAuthors] = useState<AuthorGroup[]>([]);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [myReactions, setMyReactions] = useState<Map<string, string>>(new Map());
  const [activeAuthorIndex, setActiveAuthorIndex] = useState(0);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [ownViewCount, setOwnViewCount] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number>();
  const frameStartRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const viewedThisSessionRef = useRef<Set<string>>(new Set());
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Captured once at mount -- location.key changes on every one of our own
  // internal `navigate(..., { replace: true })` calls as the viewer steps
  // through stories, so re-reading it live would make a direct-URL/refresh
  // session look like it "came from the app" after just a couple of
  // auto-advances, sending Close/finish to navigate(-1) into empty history
  // instead of back to the feed.
  const cameFromAppRef = useRef(location.key !== 'default');
  const closeViewer = useCallback(() => {
    if (cameFromAppRef.current) navigate(-1);
    else navigate('/dashboard');
  }, [navigate]);

  // ---- Initial fetch -----------------------------------------------------
  const init = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/');
      return;
    }
    setAuthUserId(user.id);

    const { data: mutedRows } = await supabase
      .from('muted_story_authors')
      .select('muted_user_id')
      .eq('user_id', user.id);
    const mutedSet = new Set((mutedRows || []).map((m) => m.muted_user_id));

    const { data: storiesData, error } = await supabase
      .from('stories')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (error || !storiesData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const visible = storiesData.filter((s) => s.user_id === user.id || !mutedSet.has(s.user_id));

    const userIds = [...new Set(visible.map((s) => s.user_id))];
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);
    const profileMap = new Map((profilesData || []).map((p) => [p.user_id, p]));

    const groupsMap = new Map<string, AuthorGroup>();
    visible.forEach((s) => {
      if (!groupsMap.has(s.user_id)) {
        groupsMap.set(s.user_id, {
          userId: s.user_id,
          profile: profileMap.get(s.user_id) || null,
          stories: [],
          isSelf: s.user_id === user.id,
        });
      }
      groupsMap.get(s.user_id)!.stories.push(s as StoryRow);
    });

    const groups = [...groupsMap.values()].sort((a, b) => {
      if (a.isSelf) return -1;
      if (b.isSelf) return 1;
      const aMax = Math.max(...a.stories.map((s) => new Date(s.created_at).getTime()));
      const bMax = Math.max(...b.stories.map((s) => new Date(s.created_at).getTime()));
      return bMax - aMax;
    });

    if (groups.length === 0) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const allIds = visible.map((s) => s.id);
    const [{ data: viewsData }, { data: reactData }] = await Promise.all([
      supabase.from('story_views').select('story_id').eq('viewer_id', user.id).in('story_id', allIds),
      supabase.from('story_reactions').select('story_id, reaction_type').eq('user_id', user.id).in('story_id', allIds),
    ]);
    setSeenIds(new Set((viewsData || []).map((v) => v.story_id!)));
    setMyReactions(new Map((reactData || []).map((r) => [r.story_id, r.reaction_type])));
    (viewsData || []).forEach((v) => viewedThisSessionRef.current.add(v.story_id!));

    setAuthors(groups);

    let ai = 0;
    let si = 0;
    if (storyId) {
      outer: for (let a = 0; a < groups.length; a++) {
        for (let s = 0; s < groups[a].stories.length; s++) {
          if (groups[a].stories[s].id === storyId) {
            ai = a;
            si = s;
            break outer;
          }
        }
      }
    }
    setActiveAuthorIndex(ai);
    setActiveStoryIndex(si);
    setLoading(false);
  }, [navigate, storyId]);

  useEffect(() => {
    init();
    // Only re-run on mount -- navigating between stories updates the URL via
    // replace without re-fetching the whole story set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentAuthor = authors[activeAuthorIndex];
  const currentStory = currentAuthor?.stories[activeStoryIndex];
  const isOwnStory = !!currentStory && currentStory.user_id === authUserId;

  // ---- Navigation ---------------------------------------------------------
  // Plain functions (not useCallback) -- they close over the current
  // render's authors/activeAuthorIndex/activeStoryIndex directly, which
  // keeps the "next story within this author, else first story of the next
  // author, else close" logic a single straightforward read instead of
  // threading state through nested setState updaters.
  const goNext = () => {
    const author = authors[activeAuthorIndex];
    if (!author) return;
    if (activeStoryIndex < author.stories.length - 1) {
      setActiveStoryIndex(activeStoryIndex + 1);
    } else if (activeAuthorIndex < authors.length - 1) {
      setActiveAuthorIndex(activeAuthorIndex + 1);
      setActiveStoryIndex(0);
    } else {
      closeViewer();
    }
  };

  const goPrev = () => {
    if (activeStoryIndex > 0) {
      setActiveStoryIndex(activeStoryIndex - 1);
    } else if (activeAuthorIndex > 0) {
      const prevAuthor = authors[activeAuthorIndex - 1];
      setActiveAuthorIndex(activeAuthorIndex - 1);
      setActiveStoryIndex(prevAuthor.stories.length - 1);
    }
  };

  const jumpToAuthor = (authorIndex: number) => {
    const author = authors[authorIndex];
    if (!author) return;
    const firstUnseen = author.stories.findIndex((s) => !seenIds.has(s.id));
    setActiveAuthorIndex(authorIndex);
    setActiveStoryIndex(firstUnseen >= 0 ? firstUnseen : 0);
  };

  // ---- URL sync -------------------------------------------------------
  useEffect(() => {
    if (currentStory) {
      navigate(`/story/${currentStory.id}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id]);

  // ---- View tracking ----------------------------------------------------
  useEffect(() => {
    if (!currentStory || !authUserId) return;
    setMediaLoading(true);
    setMediaError(false);
    setProgress(0);
    elapsedRef.current = 0;

    if (isOwnStory) {
      supabase
        .from('story_views')
        .select('*', { count: 'exact', head: true })
        .eq('story_id', currentStory.id)
        .then(({ count }) => setOwnViewCount(count ?? 0));
      return;
    }
    setOwnViewCount(null);

    if (viewedThisSessionRef.current.has(currentStory.id)) return;
    viewedThisSessionRef.current.add(currentStory.id);
    supabase.from('story_views').insert({ story_id: currentStory.id, viewer_id: authUserId }).then(({ error }) => {
      if (!error) setSeenIds((prev) => new Set(prev).add(currentStory.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id, authUserId]);

  // ---- Auto-advance timer ------------------------------------------------
  useEffect(() => {
    if (!currentStory || paused || mediaLoading || mediaError) return;
    if (currentStory.media_type === 'video') return; // driven by <video> events instead

    frameStartRef.current = performance.now() - elapsedRef.current;
    const tick = (now: number) => {
      const elapsed = now - frameStartRef.current;
      elapsedRef.current = elapsed;
      const pct = Math.min(100, (elapsed / IMAGE_STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) {
        elapsedRef.current = 0;
        goNext();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id, paused, mediaLoading, mediaError]);

  // Pause when the tab loses focus; resume when it regains it.
  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || currentStory?.media_type !== 'video') return;
    if (paused) video.pause();
    else video.play().catch(() => {});
  }, [paused, currentStory?.media_type]);

  // ---- Keyboard -----------------------------------------------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') {
        if (e.key === 'Escape') (document.activeElement as HTMLElement).blur();
        return;
      }
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') closeViewer();
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, closeViewer]);

  // ---- Touch (mobile) -----------------------------------------------------
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    holdTimerRef.current = setTimeout(() => setPaused(true), 220);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const heldLong = Date.now() - start.t > 220;

    if (paused) {
      setPaused(false);
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // was just a hold-release, don't also navigate
    }

    if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx)) {
      closeViewer();
      return;
    }
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNext();
      else goPrev();
      return;
    }
    if (!heldLong && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relX = (start.x - rect.left) / rect.width;
      if (relX < 0.35) goPrev();
      else if (relX > 0.65) goNext();
      else setPaused((p) => !p);
    }
  };

  // ---- Desktop click zones -------------------------------------------------
  const onMediaClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    if (relX < 0.3) goPrev();
    else if (relX > 0.7) goNext();
    else setPaused((p) => !p);
  };

  // ---- Reactions ------------------------------------------------------------
  const handleReact = async (type: string) => {
    if (!authUserId || !currentStory || isOwnStory) return;
    const existing = myReactions.get(currentStory.id);
    try {
      if (existing === type) {
        await supabase.from('story_reactions').delete().eq('story_id', currentStory.id).eq('user_id', authUserId);
        setMyReactions((prev) => {
          const next = new Map(prev);
          next.delete(currentStory.id);
          return next;
        });
      } else {
        const { error } = await supabase.from('story_reactions').upsert(
          { story_id: currentStory.id, user_id: authUserId, reaction_type: type },
          { onConflict: 'story_id,user_id' }
        );
        if (error) throw error;
        setMyReactions((prev) => new Map(prev).set(currentStory.id, type));
      }
    } catch (err) {
      console.error('Error reacting to story:', err);
      toast({ title: 'Could not react', variant: 'destructive' });
    }
  };

  // ---- Reply ------------------------------------------------------------
  const handleSendReply = async () => {
    if (!authUserId || !currentStory || isOwnStory || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const { data: existingConvo } = await supabase
        .from('conversations')
        .select('id')
        .or(
          `and(participant_1.eq.${authUserId},participant_2.eq.${currentStory.user_id}),and(participant_1.eq.${currentStory.user_id},participant_2.eq.${authUserId})`
        )
        .maybeSingle();

      let conversationId = existingConvo?.id;
      if (!conversationId) {
        const { data: newConvo, error: convoError } = await supabase
          .from('conversations')
          .insert({ participant_1: authUserId, participant_2: currentStory.user_id })
          .select('id')
          .single();
        if (convoError) throw convoError;
        conversationId = newConvo.id;
      }

      const { error: msgError } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: authUserId,
        content: replyText.trim(),
        story_id: currentStory.id,
      });
      if (msgError) throw msgError;

      setReplyText('');
      toast({ title: 'Reply sent' });
    } catch (err) {
      console.error('Error sending story reply:', err);
      toast({ title: 'Could not send reply', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setSendingReply(false);
    }
  };

  // ---- Options menu actions ------------------------------------------------
  const handleDeleteStory = async () => {
    if (!currentStory) return;
    try {
      const { error } = await supabase.from('stories').delete().eq('id', currentStory.id);
      if (error) throw error;
      toast({ title: 'Story deleted' });
      setDeleteOpen(false);
      setAuthors((prev) => {
        const next = prev.map((a) => ({ ...a, stories: a.stories.filter((s) => s.id !== currentStory.id) }));
        return next.filter((a) => a.stories.length > 0);
      });
      if ((authors[activeAuthorIndex]?.stories.length ?? 0) <= 1) {
        if (authors.length <= 1) closeViewer();
      }
    } catch (err) {
      console.error('Error deleting story:', err);
      toast({ title: 'Could not delete story', variant: 'destructive' });
    }
  };

  const handleReportSubmit = async () => {
    if (!authUserId || !currentStory) return;
    setSubmittingReport(true);
    try {
      const { error } = await supabase.from('story_reports').insert({
        reporter_id: authUserId,
        story_id: currentStory.id,
        reason: reportReason,
        description: reportDescription.trim() || null,
      });
      if (error && error.code !== '23505') throw error;
      toast({ title: 'Report submitted', description: 'Thank you for helping keep our community safe.' });
      setReportOpen(false);
      setReportReason('spam');
      setReportDescription('');
    } catch (err) {
      console.error('Error reporting story:', err);
      toast({ title: 'Could not submit report', variant: 'destructive' });
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleMuteAuthor = async () => {
    if (!authUserId || !currentAuthor || currentAuthor.isSelf) return;
    try {
      const { error } = await supabase.from('muted_story_authors').insert({
        user_id: authUserId,
        muted_user_id: currentAuthor.userId,
      });
      if (error && error.code !== '23505') throw error;
      toast({ title: `Muted ${currentAuthor.profile?.display_name || 'this user'}'s stories` });
      setAuthors((prev) => prev.filter((a) => a.userId !== currentAuthor.userId));
      if (authors.length <= 1) closeViewer();
      else if (activeAuthorIndex >= authors.length - 1) setActiveAuthorIndex(0);
      setActiveStoryIndex(0);
    } catch (err) {
      console.error('Error muting story author:', err);
      toast({ title: 'Could not mute', variant: 'destructive' });
    }
  };

  const handleCopyLink = async () => {
    if (!currentStory) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/story/${currentStory.id}`);
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: 'Could not copy link', variant: 'destructive' });
    }
  };

  // ---- Preload next story's media -------------------------------------------
  const nextPreloadUrl = useMemo(() => {
    if (!currentAuthor || !currentStory) return null;
    const withinAuthor = currentAuthor.stories[activeStoryIndex + 1];
    if (withinAuthor) return withinAuthor;
    const nextAuthor = authors[activeAuthorIndex + 1];
    return nextAuthor?.stories[0] || null;
  }, [authors, activeAuthorIndex, activeStoryIndex, currentAuthor, currentStory]);

  // ---- Render states --------------------------------------------------------
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-white animate-spin" />
      </div>
    );
  }

  if (notFound || !currentAuthor || !currentStory) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center gap-4 px-6 text-center">
        <ImageOff className="h-12 w-12 text-white/50" />
        <div>
          <p className="text-white text-lg font-semibold">Story unavailable</p>
          <p className="text-white/60 text-sm mt-1">This story may have expired or been removed.</p>
        </div>
        <Button variant="secondary" onClick={closeViewer}>Back</Button>
      </div>
    );
  }

  const authorName = currentAuthor.isSelf ? 'Your Story' : currentAuthor.profile?.display_name || 'User';

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex w-80 shrink-0 flex-col bg-neutral-950 border-r border-white/10 overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center font-bold text-sm">P</div>
            <span className="font-semibold">Profolio</span>
          </div>
          <button aria-label="Close story" onClick={closeViewer} className="p-2 rounded-full hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-2">
          <h2 className="text-xl font-bold">Stories</h2>
        </div>

        <div className="px-4 flex flex-col gap-1 pb-3 border-b border-white/10">
          <button
            className="flex items-center gap-2 py-2 text-sm text-white/70 hover:text-white"
            onClick={() => toast({ title: 'Coming soon', description: 'Story archive is not available yet.' })}
          >
            <Archive className="h-4 w-4" /> Archive
          </button>
          <button
            className="flex items-center gap-2 py-2 text-sm text-white/70 hover:text-white"
            onClick={() => toast({ title: 'Coming soon', description: 'Story settings are not available yet.' })}
          >
            <Settings className="h-4 w-4" /> Settings
          </button>
        </div>

        {/* Your story */}
        <div className="px-4 py-3 border-b border-white/10">
          {authors[0]?.isSelf ? (
            <button
              className={`w-full flex items-center gap-3 rounded-lg p-2 ${activeAuthorIndex === 0 ? 'bg-white/10' : 'hover:bg-white/5'}`}
              onClick={() => jumpToAuthor(0)}
            >
              <Avatar className="h-11 w-11 ring-2 ring-primary">
                <AvatarImage src={authors[0].profile?.avatar_url || undefined} />
                <AvatarFallback>{authors[0].profile?.display_name?.charAt(0) || 'Y'}</AvatarFallback>
              </Avatar>
              <div className="text-left min-w-0">
                <p className="text-sm font-medium truncate">Your story</p>
                <p className="text-xs text-white/50">{formatTimeAgo(authors[0].stories[authors[0].stories.length - 1].created_at)} ago</p>
              </div>
            </button>
          ) : (
            <button className="w-full flex items-center gap-3 rounded-lg p-2 hover:bg-white/5" onClick={() => setShowUpload(true)}>
              <div className="h-11 w-11 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center">
                <Plus className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">Create a story</p>
            </button>
          )}
        </div>

        {/* All stories */}
        <div className="px-4 py-2 text-xs font-semibold text-white/50 uppercase tracking-wide">All stories</div>
        <div className="flex-1 px-2 pb-4">
          {authors.filter((a) => !a.isSelf).map((author) => {
            const authorIndex = authors.indexOf(author);
            const allSeen = author.stories.every((s) => seenIds.has(s.id));
            const isActive = authorIndex === activeAuthorIndex;
            return (
              <button
                key={author.userId}
                onClick={() => jumpToAuthor(authorIndex)}
                className={`w-full flex items-center gap-3 rounded-lg p-2 text-left ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
              >
                <Avatar className={`h-11 w-11 ring-2 ${allSeen ? 'ring-white/20' : 'ring-primary'}`}>
                  <AvatarImage src={author.profile?.avatar_url || undefined} />
                  <AvatarFallback>{author.profile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{author.profile?.display_name || 'User'}</p>
                  <p className="text-xs text-white/50">{formatTimeAgo(author.stories[author.stories.length - 1].created_at)} ago</p>
                </div>
                {!allSeen && <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label="New" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main viewer */}
      <div className="relative flex-1 flex items-center justify-center bg-black min-w-0">
        {/* Mobile top bar (X only, sidebar hidden) */}
        <button
          aria-label="Close story"
          onClick={closeViewer}
          className="lg:hidden absolute top-3 left-3 z-30 p-2 rounded-full bg-black/40 hover:bg-black/60"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative w-full h-full max-w-[480px] mx-auto flex flex-col">
          {/* Progress bars */}
          <div className="absolute top-2 inset-x-2 z-20 flex gap-1">
            {currentAuthor.stories.map((s, idx) => (
              <div key={s.id} className="h-[3px] flex-1 rounded-full bg-white/30 overflow-hidden">
                <div
                  className="h-full bg-white"
                  style={{
                    width: idx < activeStoryIndex ? '100%' : idx === activeStoryIndex ? `${progress}%` : '0%',
                    transition: s.media_type === 'video' ? 'width 0.1s linear' : undefined,
                  }}
                />
              </div>
            ))}
          </div>

          {/* Header */}
          <div className="absolute top-6 inset-x-2 z-20 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-9 w-9 ring-1 ring-white/40">
                <AvatarImage src={currentAuthor.profile?.avatar_url || undefined} />
                <AvatarFallback>{currentAuthor.profile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{authorName}</p>
                <p className="text-xs text-white/60">{formatTimeAgo(currentStory.created_at)} ago</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {currentStory.media_type === 'video' && (
                <button
                  aria-label={muted ? 'Unmute' : 'Mute'}
                  className="p-2 rounded-full hover:bg-white/10"
                  onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
                >
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Story options" className="p-2 rounded-full hover:bg-white/10" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isOwnStory ? (
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                      Delete Story
                    </DropdownMenuItem>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={() => setReportOpen(true)}>Report Story</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleMuteAuthor}>Mute Story</DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCopyLink}>Copy link</DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <button aria-label="Close story" onClick={closeViewer} className="hidden lg:block p-2 rounded-full hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Media */}
          <div
            className="flex-1 flex items-center justify-center relative select-none"
            onClick={!isMobile ? onMediaClick : undefined}
            onTouchStart={isMobile ? onTouchStart : undefined}
            onTouchEnd={isMobile ? onTouchEnd : undefined}
          >
            {mediaLoading && !mediaError && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <Loader2 className="h-8 w-8 animate-spin text-white/70" />
              </div>
            )}
            {mediaError ? (
              <div className="flex flex-col items-center gap-2 text-white/60">
                <ImageOff className="h-10 w-10" />
                <p className="text-sm">This media couldn't be loaded.</p>
              </div>
            ) : currentStory.media_type === 'video' ? (
              <video
                key={currentStory.id}
                ref={videoRef}
                src={currentStory.media_url}
                autoPlay
                muted={muted}
                playsInline
                className="max-h-full max-w-full object-contain"
                onLoadedData={() => setMediaLoading(false)}
                onError={() => { setMediaLoading(false); setMediaError(true); }}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration) setProgress((v.currentTime / v.duration) * 100);
                }}
                onEnded={goNext}
              />
            ) : (
              <img
                key={currentStory.id}
                src={currentStory.media_url}
                alt="Story"
                className="max-h-full max-w-full object-contain"
                onLoad={() => setMediaLoading(false)}
                onError={() => { setMediaLoading(false); setMediaError(true); }}
              />
            )}

            {/* Hidden preload for the next story's media */}
            {nextPreloadUrl && nextPreloadUrl.media_type === 'image' && (
              <img src={nextPreloadUrl.media_url} alt="" className="hidden" />
            )}
            {nextPreloadUrl && nextPreloadUrl.media_type === 'video' && (
              <video src={nextPreloadUrl.media_url} preload="auto" className="hidden" />
            )}
          </div>

          {/* Desktop nav arrows (outside media) */}
          <button
            aria-label="Previous story"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="hidden lg:flex absolute -left-16 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            aria-label="Next story"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="hidden lg:flex absolute -right-16 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center"
          >
            <ChevronRight className="h-6 w-6" />
          </button>

          {/* Bottom bar */}
          <div className="relative z-20 px-3 pb-3 pt-2">
            {isOwnStory ? (
              <p className="text-center text-sm text-white/60">
                {ownViewCount === null ? 'Loading views…' : `${ownViewCount} ${ownViewCount === 1 ? 'view' : 'views'}`}
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onFocus={() => setPaused(true)}
                    onBlur={() => setPaused(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !sendingReply) handleSendReply(); }}
                    placeholder="Send message..."
                    className="flex-1 rounded-full bg-white/10 border border-white/20 px-4 py-2.5 text-sm placeholder:text-white/50 focus:outline-none focus:border-white/40"
                  />
                  <button
                    aria-label="Send reply"
                    disabled={!replyText.trim() || sendingReply}
                    onClick={handleSendReply}
                    className="p-2.5 rounded-full bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center justify-center gap-3">
                  {REACTIONS.map((r) => (
                    <button
                      key={r.type}
                      aria-label={r.label}
                      onClick={() => handleReact(r.type)}
                      className={`text-xl p-1.5 rounded-full transition-transform hover:scale-125 ${myReactions.get(currentStory.id) === r.type ? 'bg-white/20 scale-110' : ''}`}
                    >
                      {r.emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <StoryUploadDialog open={showUpload} onOpenChange={setShowUpload} onUploaded={init} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this story?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report Story</DialogTitle>
            <DialogDescription>Tell us what's wrong with this story.</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <RadioGroup value={reportReason} onValueChange={setReportReason} className="space-y-2">
              {REPORT_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={`story-report-${r.value}`} />
                  <Label htmlFor={`story-report-${r.value}`} className="font-normal cursor-pointer">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
            <Textarea
              placeholder="Add any extra context (optional)..."
              value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)} disabled={submittingReport}>Cancel</Button>
            <Button onClick={handleReportSubmit} disabled={submittingReport}>
              {submittingReport ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StoryPage;
