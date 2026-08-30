import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  X, ChevronLeft, ChevronRight, MoreHorizontal, Volume2, VolumeX, Send,
  Plus, Archive, Settings, Loader2, ImageOff, Pause, Play, Globe, Users, Lock,
  Smile, Sticker as StickerIcon, Link2, Flag, EyeOff, UserMinus, Trash2, Bug,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { StoryComposer } from '@/components/stories/StoryComposer';
import { StorySettingsDialog } from '@/components/stories/StorySettingsDialog';
import { EmojiPicker } from '@/components/stories/EmojiPicker';
import { StoryCanvas, type StoryRenderModel } from '@/lib/stories/render';
import { STICKERS } from '@/lib/stickers';
import {
  IMAGE_STORY_DURATION_MS, STORY_REACTIONS, STORY_REPORT_REASONS,
} from '@/lib/stories/constants';
import type { StoryAuthorGroup, StoryRecord } from '@/lib/stories/types';
import {
  deleteStory as apiDeleteStory, fetchActiveStoryGroups, fetchArchivedStories, fetchAuthorProfile,
  fetchMyViewsAndReactions, fetchSeenBy, fetchStoryById, fetchStorySettings,
  muteAuthor, recordStoryView, reportStory, saveStoryToArchive, sendStoryReply,
  setStoryReaction, unfollowAuthor, type SeenByViewer,
} from '@/lib/stories/api';

function timeAgo(ts: string) {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const PrivacyIcon = ({ p }: { p: string }) =>
  p === 'friends' ? <Users className="h-3 w-3" /> : p === 'custom' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />;

function toModel(s: StoryRecord): StoryRenderModel {
  return {
    kind: s.kind,
    background: s.background,
    caption: s.caption,
    fontStyle: s.font_style,
    mediaUrl: s.media_url,
    mediaType: s.media_type,
    thumbnailUrl: s.thumbnail_url,
    overlays: s.overlays,
    music: s.music,
    mediaTransform: null,
  };
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
  const [authors, setAuthors] = useState<StoryAuthorGroup[]>([]);
  const [standalone, setStandalone] = useState<StoryAuthorGroup | null>(null); // archived/expired direct open
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [myReactions, setMyReactions] = useState<Map<string, string>>(new Map());

  const [ai, setAi] = useState(0);
  const [si, setSi] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);

  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [seenByOpen, setSeenByOpen] = useState(false);
  const [seenBy, setSeenBy] = useState<SeenByViewer[]>([]);
  const [archived, setArchivedList] = useState<StoryRecord[]>([]);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Any modal / menu / composer open => hold playback (FB behaviour) and
  // stop the single-story auto-advance from closing the viewer underneath it.
  const blockingUi =
    menuOpen || reportOpen || deleteOpen || seenByOpen || showArchive ||
    showSettings || showComposer || stickerOpen;

  const videoRef = useRef<HTMLVideoElement>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>();
  const startRef = useRef(0);
  const elapsedRef = useRef(0);
  const viewedRef = useRef<Set<string>>(new Set());
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const holdRef = useRef<ReturnType<typeof setTimeout>>();

  const cameFromApp = useRef(location.key !== 'default');
  const close = useCallback(() => {
    if (cameFromApp.current) navigate(-1);
    else navigate('/dashboard');
  }, [navigate]);

  // ---- initial load ----
  const init = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setStandalone(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/'); return; }
    setAuthUserId(user.id);

    let groups: StoryAuthorGroup[] = [];
    try {
      groups = await fetchActiveStoryGroups(user.id);
    } catch {
      setNotFound(true); setLoading(false); return;
    }

    const inActive = storyId && groups.some((g) => g.stories.some((s) => s.id === storyId));

    if (storyId && !inActive) {
      // maybe an archived/expired story the owner opened directly
      const s = await fetchStoryById(storyId);
      if (s) {
        const prof = await fetchAuthorProfile(s.user_id);
        setStandalone({ userId: s.user_id, profile: prof, stories: [s], isSelf: s.user_id === user.id });
        setAuthors([]);
        setAi(0); setSi(0);
        setLoading(false);
        return;
      }
    }

    if (groups.length === 0) { setNotFound(true); setLoading(false); return; }

    const allIds = groups.flatMap((g) => g.stories.map((s) => s.id));
    const { seen, reactions } = await fetchMyViewsAndReactions(allIds, user.id);
    setSeenIds(seen);
    setMyReactions(reactions);
    seen.forEach((id) => viewedRef.current.add(id));
    setAuthors(groups);

    let a = 0, s = 0;
    if (storyId) {
      outer: for (let x = 0; x < groups.length; x++) {
        for (let y = 0; y < groups[x].stories.length; y++) {
          if (groups[x].stories[y].id === storyId) { a = x; s = y; break outer; }
        }
      }
    }
    setAi(a); setSi(s);
    setLoading(false);
  }, [navigate, storyId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { init(); }, []);

  const activeGroups = standalone ? [standalone] : authors;
  const currentAuthor = activeGroups[ai];
  const currentStory = currentAuthor?.stories[si];
  const isOwn = !!currentStory && currentStory.user_id === authUserId;

  // ---- navigation ----
  const goNext = useCallback(() => {
    const grp = activeGroups[ai];
    if (!grp) return;
    if (si < grp.stories.length - 1) setSi(si + 1);
    else if (ai < activeGroups.length - 1) { setAi(ai + 1); setSi(0); }
    else close();
  }, [activeGroups, ai, si, close]);

  const goPrev = useCallback(() => {
    if (si > 0) setSi(si - 1);
    else if (ai > 0) { const p = activeGroups[ai - 1]; setAi(ai - 1); setSi(p.stories.length - 1); }
  }, [activeGroups, ai, si]);

  const jumpToAuthor = (idx: number) => {
    const grp = activeGroups[idx];
    if (!grp) return;
    const firstUnseen = grp.stories.findIndex((s) => !seenIds.has(s.id));
    setAi(idx);
    setSi(firstUnseen >= 0 ? firstUnseen : 0);
  };

  // ---- URL sync ----
  useEffect(() => {
    if (currentStory && currentStory.id !== storyId) {
      navigate(`/story/${currentStory.id}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id]);

  // ---- per-story setup: view tracking + reset ----
  useEffect(() => {
    if (!currentStory || !authUserId) return;
    setMediaLoading(currentStory.kind === 'media');
    setMediaError(false);
    setProgress(0);
    elapsedRef.current = 0;

    if (!isOwn && !viewedRef.current.has(currentStory.id)) {
      viewedRef.current.add(currentStory.id);
      recordStoryView(currentStory.id, authUserId)
        .then(() => setSeenIds((p) => new Set(p).add(currentStory.id)))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id, authUserId]);

  // ---- music playback ----
  useEffect(() => {
    musicRef.current?.pause();
    musicRef.current = null;
    if (!currentStory?.music) return;
    const m = currentStory.music;
    const a = new Audio(m.audioUrl);
    a.loop = false;
    a.volume = muted ? 0 : 0.9;
    a.currentTime = m.clipStart;
    a.ontimeupdate = () => {
      if (a.currentTime >= m.clipEnd) a.currentTime = m.clipStart;
    };
    musicRef.current = a;
    if (!paused) a.play().catch(() => {});
    return () => { a.pause(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id]);

  useEffect(() => {
    const a = musicRef.current;
    if (!a) return;
    a.volume = muted ? 0 : 0.9;
    if (paused || blockingUi) a.pause();
    else a.play().catch(() => {});
  }, [muted, paused, blockingUi]);

  // ---- image auto-advance ----
  useEffect(() => {
    if (!currentStory || paused || blockingUi || mediaError) return;
    if (currentStory.kind === 'media' && currentStory.media_type === 'video') return;
    if (currentStory.kind === 'media' && mediaLoading) return;

    startRef.current = performance.now() - elapsedRef.current;
    const tick = (now: number) => {
      const el = now - startRef.current;
      elapsedRef.current = el;
      const pct = Math.min(100, (el / IMAGE_STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) { elapsedRef.current = 0; goNext(); return; }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id, paused, blockingUi, mediaLoading, mediaError]);

  // ---- video trim playback ----
  useEffect(() => {
    const v = videoRef.current;
    if (!v || currentStory?.media_type !== 'video') return;
    const trim = currentStory.trim;
    const onLoaded = () => {
      setMediaLoading(false);
      if (trim) v.currentTime = trim.start;
      if (!paused) v.play().catch(() => {});
    };
    const onTime = () => {
      const end = trim?.end ?? v.duration;
      const start = trim?.start ?? 0;
      if (v.duration) setProgress(((v.currentTime - start) / (end - start)) * 100);
      if (v.currentTime >= end) goNext();
    };
    v.addEventListener('loadeddata', onLoaded);
    v.addEventListener('timeupdate', onTime);
    return () => {
      v.removeEventListener('loadeddata', onLoaded);
      v.removeEventListener('timeupdate', onTime);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id, paused, goNext]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || currentStory?.media_type !== 'video') return;
    v.muted = muted;
    if (paused || blockingUi) v.pause();
    else v.play().catch(() => {});
  }, [muted, paused, blockingUi, currentStory?.media_type]);

  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // ---- keyboard ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') {
        if (e.key === 'Escape') (document.activeElement as HTMLElement).blur();
        return;
      }
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') close();
      else if (e.key === ' ') { e.preventDefault(); setPaused((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, close]);

  // ---- touch ----
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    holdRef.current = setTimeout(() => setPaused(true), 220);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (holdRef.current) clearTimeout(holdRef.current);
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const held = Date.now() - start.t > 220;
    if (paused) {
      setPaused(false);
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    }
    if (Math.abs(dy) > 80 && Math.abs(dy) > Math.abs(dx)) { close(); return; }
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) { if (dx < 0) goNext(); else goPrev(); return; }
    if (!held && Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relX = (start.x - rect.left) / rect.width;
      if (relX < 0.35) goPrev();
      else if (relX > 0.65) goNext();
      else setPaused((p) => !p);
    }
  };
  const onMediaClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    if (relX < 0.3) goPrev();
    else if (relX > 0.7) goNext();
    else setPaused((p) => !p);
  };

  // ---- actions ----
  const react = async (type: string) => {
    if (!authUserId || !currentStory || isOwn) return;
    const existing = myReactions.get(currentStory.id);
    try {
      if (existing === type) {
        await setStoryReaction(currentStory.id, authUserId, null);
        setMyReactions((p) => { const n = new Map(p); n.delete(currentStory.id); return n; });
      } else {
        await setStoryReaction(currentStory.id, authUserId, type);
        setMyReactions((p) => new Map(p).set(currentStory.id, type));
      }
    } catch { toast({ title: 'Could not react', variant: 'destructive' }); }
  };

  const sendReply = async (sticker?: { id: string; label: string }) => {
    if (!authUserId || !currentStory || isOwn || sendingReply) return;
    if (!sticker && !replyText.trim()) return;
    setSendingReply(true);
    try {
      await sendStoryReply({
        senderId: authUserId, authorId: currentStory.user_id, storyId: currentStory.id,
        text: replyText.trim(), sticker: sticker ?? null,
      });
      setReplyText('');
      setStickerOpen(false);
      toast({ title: 'Reply sent' });
    } catch {
      toast({ title: 'Could not send reply', variant: 'destructive' });
    } finally { setSendingReply(false); }
  };

  const removeStory = async () => {
    if (!currentStory) return;
    try {
      await apiDeleteStory(currentStory);
      toast({ title: 'Story deleted' });
      setDeleteOpen(false);
      if (standalone) { close(); return; }
      const nextAuthors = authors
        .map((a) => ({ ...a, stories: a.stories.filter((s) => s.id !== currentStory.id) }))
        .filter((a) => a.stories.length > 0);
      setAuthors(nextAuthors);
      if (nextAuthors.length === 0) { close(); return; }
      setAi((x) => Math.min(x, nextAuthors.length - 1));
      setSi(0);
    } catch { toast({ title: 'Could not delete story', variant: 'destructive' }); }
  };

  const toggleArchive = async () => {
    if (!currentStory) return;
    const next = !currentStory.is_archived;
    try {
      await saveStoryToArchive(currentStory.id, next);
      const patch = (a: StoryAuthorGroup[]) =>
        a.map((g) => ({ ...g, stories: g.stories.map((s) => s.id === currentStory.id ? { ...s, is_archived: next } : s) }));
      setAuthors(patch);
      if (standalone) setStandalone((g) => g ? { ...g, stories: g.stories.map((s) => ({ ...s, is_archived: next })) } : g);
      toast({ title: next ? 'Saved to archive' : 'Removed from archive' });
    } catch { toast({ title: 'Could not update archive', variant: 'destructive' }); }
  };

  const submitReport = async () => {
    if (!authUserId || !currentStory) return;
    setSubmittingReport(true);
    try {
      await reportStory(currentStory.id, authUserId, reportReason, reportDescription.trim() || null);
      toast({ title: 'Report submitted', description: 'Thanks for helping keep Profolio safe.' });
      setReportOpen(false); setReportReason('spam'); setReportDescription('');
    } catch { toast({ title: 'Could not submit report', variant: 'destructive' }); }
    finally { setSubmittingReport(false); }
  };

  const doMute = async () => {
    if (!authUserId || !currentAuthor || currentAuthor.isSelf) return;
    try {
      await muteAuthor(authUserId, currentAuthor.userId);
      toast({ title: `Muted ${currentAuthor.profile?.display_name || 'this user'}'s stories` });
      const rest = authors.filter((a) => a.userId !== currentAuthor.userId);
      setAuthors(rest);
      if (rest.length === 0) close();
      else { setAi(0); setSi(0); }
    } catch { toast({ title: 'Could not mute', variant: 'destructive' }); }
  };

  const doUnfollow = async () => {
    if (!authUserId || !currentAuthor) return;
    try {
      await unfollowAuthor(authUserId, currentAuthor.userId);
      toast({ title: `Unfollowed ${currentAuthor.profile?.display_name || 'user'}` });
    } catch { toast({ title: 'Could not unfollow', variant: 'destructive' }); }
  };

  const copyLink = async () => {
    if (!currentStory) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/story/${currentStory.id}`);
      toast({ title: 'Link copied' });
    } catch { toast({ title: 'Could not copy link', variant: 'destructive' }); }
  };

  const openSeenBy = async () => {
    if (!currentStory) return;
    setSeenByOpen(true);
    try { setSeenBy(await fetchSeenBy(currentStory.id)); } catch { /* ignore */ }
  };

  const openArchive = async () => {
    setShowArchive(true);
    if (!authUserId) return;
    try {
      setArchivedList(await fetchArchivedStories(authUserId));
    } catch { /* ignore */ }
  };

  // preload next
  const nextMedia = useMemo(() => {
    const grp = activeGroups[ai];
    if (!grp) return null;
    return grp.stories[si + 1] ?? activeGroups[ai + 1]?.stories[0] ?? null;
  }, [activeGroups, ai, si]);

  // ---- render ----
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
        <Button variant="secondary" onClick={close}>Back</Button>
      </div>
    );
  }

  const authorName = currentAuthor.isSelf ? 'Your story' : currentAuthor.profile?.display_name || 'User';
  const expired = new Date(currentStory.expires_at).getTime() < Date.now();

  return (
    <div className="fixed inset-0 z-50 bg-black text-white flex overflow-hidden"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Desktop sidebar */}
      {!standalone && (
        <div className="hidden lg:flex w-80 shrink-0 flex-col bg-neutral-950 border-r border-white/10 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-primary flex items-center justify-center font-bold text-sm">P</div>
              <span className="font-semibold">Profolio</span>
            </div>
            <button aria-label="Close story" onClick={close} className="p-2 rounded-full hover:bg-white/10">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-4 py-2"><h2 className="text-xl font-bold">Stories</h2></div>
          <div className="px-4 flex flex-col gap-1 pb-3 border-b border-white/10">
            <button onClick={openArchive} className="flex items-center gap-2 py-2 text-sm text-white/70 hover:text-white">
              <Archive className="h-4 w-4" /> Archive
            </button>
            <button onClick={() => setShowSettings(true)} className="flex items-center gap-2 py-2 text-sm text-white/70 hover:text-white">
              <Settings className="h-4 w-4" /> Settings
            </button>
          </div>
          <div className="px-4 py-3 border-b border-white/10">
            {authors[0]?.isSelf ? (
              <button className={`w-full flex items-center gap-3 rounded-lg p-2 ${ai === 0 ? 'bg-white/10' : 'hover:bg-white/5'}`}
                onClick={() => jumpToAuthor(0)}>
                <Avatar className="h-11 w-11 ring-2 ring-primary">
                  <AvatarImage src={authors[0].profile?.avatar_url || undefined} />
                  <AvatarFallback>{authors[0].profile?.display_name?.charAt(0) || 'Y'}</AvatarFallback>
                </Avatar>
                <div className="text-left min-w-0">
                  <p className="text-sm font-medium truncate">Your story</p>
                  <p className="text-xs text-white/50">{timeAgo(authors[0].stories[authors[0].stories.length - 1].created_at)}</p>
                </div>
              </button>
            ) : (
              <button className="w-full flex items-center gap-3 rounded-lg p-2 hover:bg-white/5" onClick={() => setShowComposer(true)}>
                <div className="h-11 w-11 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center">
                  <Plus className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium">Create a story</p>
              </button>
            )}
          </div>
          <div className="px-4 py-2 text-xs font-semibold text-white/50 uppercase tracking-wide">All stories</div>
          <div className="flex-1 px-2 pb-4">
            {authors.filter((a) => !a.isSelf).map((author) => {
              const idx = authors.indexOf(author);
              const allSeen = author.stories.every((s) => seenIds.has(s.id));
              return (
                <button key={author.userId} onClick={() => jumpToAuthor(idx)}
                  className={`w-full flex items-center gap-3 rounded-lg p-2 text-left ${idx === ai ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                  <Avatar className={`h-11 w-11 ring-2 ${allSeen ? 'ring-white/20' : 'ring-primary'}`}>
                    <AvatarImage src={author.profile?.avatar_url || undefined} />
                    <AvatarFallback>{author.profile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{author.profile?.display_name || 'User'}</p>
                    <p className="text-xs text-white/50">
                      {author.stories.filter((s) => !seenIds.has(s.id)).length || 0} new · {timeAgo(author.stories[author.stories.length - 1].created_at)}
                    </p>
                  </div>
                  {!allSeen && <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label="New" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main viewer */}
      <div className="relative flex-1 flex items-center justify-center bg-black min-w-0">
        <button aria-label="Close story" onClick={close}
          className="lg:hidden absolute top-3 left-3 z-30 p-2 rounded-full bg-black/40 hover:bg-black/60">
          <X className="h-5 w-5" />
        </button>

        <div className="relative w-full h-full max-w-[480px] mx-auto flex flex-col">
          {/* progress */}
          <div className="absolute top-2 inset-x-2 z-20 flex gap-1">
            {currentAuthor.stories.map((s, idx) => (
              <div key={s.id} className="h-[3px] flex-1 rounded-full bg-white/30 overflow-hidden">
                <div className="h-full bg-white"
                  style={{ width: idx < si ? '100%' : idx === si ? `${progress}%` : '0%' }} />
              </div>
            ))}
          </div>

          {/* header */}
          <div className="absolute top-6 inset-x-2 z-20 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Avatar className="h-9 w-9 ring-1 ring-white/40">
                <AvatarImage src={currentAuthor.profile?.avatar_url || undefined} />
                <AvatarFallback>{currentAuthor.profile?.display_name?.charAt(0) || 'U'}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate flex items-center gap-1">
                  {authorName} <PrivacyIcon p={currentStory.privacy} />
                  {currentStory.ai_label && <span className="rounded bg-white/20 px-1 text-[9px] font-bold">AI</span>}
                </p>
                <p className="text-xs text-white/60">
                  {timeAgo(currentStory.created_at)}{expired ? ' · expired' : ''}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {(currentStory.media_type === 'video' || currentStory.music) && (
                <button aria-label={muted ? 'Unmute' : 'Mute'} className="p-2 rounded-full hover:bg-white/10"
                  onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}>
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              )}
              <button aria-label={paused ? 'Play' : 'Pause'} className="p-2 rounded-full hover:bg-white/10"
                onClick={(e) => { e.stopPropagation(); setPaused((p) => !p); }}>
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
              <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button aria-label="Story options" className="p-2 rounded-full hover:bg-white/10" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {isOwn ? (
                    <>
                      <DropdownMenuItem onClick={openSeenBy}><Users className="mr-2 h-4 w-4" /> Seen by</DropdownMenuItem>
                      <DropdownMenuItem onClick={toggleArchive}>
                        <Archive className="mr-2 h-4 w-4" />
                        {currentStory.is_archived ? 'Remove from archive' : 'Save to archive'}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={copyLink}><Link2 className="mr-2 h-4 w-4" /> Copy link</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={openArchive} className="lg:hidden">
                        <Archive className="mr-2 h-4 w-4" /> Story archive
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowSettings(true)} className="lg:hidden">
                        <Settings className="mr-2 h-4 w-4" /> Story settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="lg:hidden" />
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete story
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <>
                      <DropdownMenuItem onClick={copyLink}><Link2 className="mr-2 h-4 w-4" /> Copy link to share this story</DropdownMenuItem>
                      <DropdownMenuItem onClick={doMute}><EyeOff className="mr-2 h-4 w-4" /> Mute {currentAuthor.profile?.display_name || 'user'}</DropdownMenuItem>
                      <DropdownMenuItem onClick={doUnfollow}><UserMinus className="mr-2 h-4 w-4" /> Unfollow {currentAuthor.profile?.display_name || 'user'}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setReportOpen(true)}><Flag className="mr-2 h-4 w-4" /> Report story</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toast({ title: 'Thanks', description: "We've noted that something isn't working." })}>
                        <Bug className="mr-2 h-4 w-4" /> Something isn't working
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <button aria-label="Close story" onClick={close} className="hidden lg:block p-2 rounded-full hover:bg-white/10">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* media / canvas */}
          <div className="flex-1 flex items-center justify-center relative select-none"
            onClick={!isMobile ? onMediaClick : undefined}
            onTouchStart={isMobile ? onTouchStart : undefined}
            onTouchEnd={isMobile ? onTouchEnd : undefined}>
            {mediaLoading && !mediaError && currentStory.kind === 'media' && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <Loader2 className="h-8 w-8 animate-spin text-white/70" />
              </div>
            )}
            {mediaError ? (
              <div className="flex flex-col items-center gap-2 text-white/60">
                <ImageOff className="h-10 w-10" />
                <p className="text-sm">This media couldn't be loaded.</p>
              </div>
            ) : currentStory.kind === 'media' && currentStory.media_type === 'video' ? (
              <div className="relative h-full w-full flex items-center justify-center">
                <video key={currentStory.id} ref={videoRef} src={currentStory.media_url ?? undefined}
                  poster={currentStory.thumbnail_url ?? undefined}
                  autoPlay muted={muted} playsInline className="max-h-full max-w-full object-contain"
                  onError={() => { setMediaLoading(false); setMediaError(true); }} />
                <OverlayLayer story={currentStory} />
              </div>
            ) : (
              <div className="relative h-full w-full max-h-[92vh] aspect-[9/16] mx-auto">
                <StoryCanvas
                  model={toModel(currentStory)}
                  className="h-full w-full"
                  muted={muted}
                />
                {currentStory.kind === 'media' && (
                  <img src={currentStory.media_url ?? undefined} alt="" className="hidden"
                    onLoad={() => setMediaLoading(false)}
                    onError={() => { setMediaLoading(false); setMediaError(true); }} />
                )}
              </div>
            )}

            {nextMedia?.kind === 'media' && nextMedia.media_type === 'image' && (
              <img src={nextMedia.media_url ?? undefined} alt="" className="hidden" />
            )}
          </div>

          {/* desktop arrows */}
          {!standalone && (
            <>
              <button aria-label="Previous story" onClick={(e) => { e.stopPropagation(); goPrev(); }}
                className="hidden lg:flex absolute -left-16 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center">
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button aria-label="Next story" onClick={(e) => { e.stopPropagation(); goNext(); }}
                className="hidden lg:flex absolute -right-16 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 items-center justify-center">
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* bottom bar */}
          <div className="relative z-20 px-3 pb-3 pt-2">
            {isOwn ? (
              <button onClick={openSeenBy} className="mx-auto block text-sm text-white/70 hover:text-white">
                Seen by — tap to view
              </button>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <EmojiPicker onPick={(em) => setReplyText((t) => t + em)} side="top" align="start">
                    <button aria-label="Emoji" className="p-2 rounded-full hover:bg-white/10"><Smile className="h-4 w-4" /></button>
                  </EmojiPicker>
                  <button aria-label="Stickers" onClick={() => setStickerOpen((v) => !v)} className="p-2 rounded-full hover:bg-white/10">
                    <StickerIcon className="h-4 w-4" />
                  </button>
                  <input type="text" value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !sendingReply) sendReply(); }}
                    placeholder="Send message…"
                    className="flex-1 rounded-full bg-white/10 border border-white/20 px-4 py-2.5 text-sm placeholder:text-white/50 focus:outline-none focus:border-white/40" />
                  <button aria-label="Send reply" disabled={!replyText.trim() || sendingReply} onClick={() => sendReply()}
                    className="p-2.5 rounded-full bg-primary disabled:opacity-40 disabled:cursor-not-allowed">
                    <Send className="h-4 w-4" />
                  </button>
                </div>
                {stickerOpen && (
                  <div className="mb-2 grid grid-cols-8 gap-2 rounded-lg bg-white/10 p-2">
                    {STICKERS.map((s) => (
                      <button key={s.id} onClick={() => sendReply({ id: s.id, label: s.label })}
                        className="rounded-md p-1 hover:bg-white/10">
                        <img src={s.src} alt={s.label} className="h-7 w-7" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-center gap-3">
                  {STORY_REACTIONS.map((r) => (
                    <button key={r.type} aria-label={r.label} onClick={() => react(r.type)}
                      className={`text-xl p-1.5 rounded-full transition-transform hover:scale-125 ${myReactions.get(currentStory.id) === r.type ? 'bg-white/20 scale-110' : ''}`}>
                      {r.emoji}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Composer */}
      {showComposer && authUserId && (
        <ComposerLauncher userId={authUserId} onClose={() => setShowComposer(false)} onPublished={() => { setShowComposer(false); init(); }} />
      )}

      {authUserId && (
        <StorySettingsDialog open={showSettings} onOpenChange={setShowSettings} userId={authUserId} onChanged={init} />
      )}

      {/* Archive */}
      <Dialog open={showArchive} onOpenChange={setShowArchive}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Story archive</DialogTitle>
            <DialogDescription>Only you can see your archived stories.</DialogDescription>
          </DialogHeader>
          {archived.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No archived stories yet. Turn on “Save to archive” in Settings.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {archived.map((s) => (
                <button key={s.id} onClick={() => { setShowArchive(false); navigate(`/story/${s.id}`); init(); }}
                  className="relative aspect-[9/16] overflow-hidden rounded-lg bg-neutral-800">
                  {s.kind === 'text'
                    ? <div className="absolute inset-0" style={{ background: s.background?.css ?? '#1e293b' }} />
                    : <img src={s.thumbnail_url ?? s.media_url ?? undefined} alt="" className="absolute inset-0 h-full w-full object-cover" />}
                  <span className="absolute bottom-1 left-1 text-[10px] text-white drop-shadow">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Seen by */}
      <Dialog open={seenByOpen} onOpenChange={setSeenByOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Seen by {seenBy.length}</DialogTitle></DialogHeader>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {seenBy.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No views yet.</p>}
            {seenBy.map((v) => (
              <div key={v.viewerId} className="flex items-center gap-3 rounded-md p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={v.avatarUrl ?? undefined} />
                  <AvatarFallback>{v.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="flex-1 text-sm">{v.name}</span>
                {v.reaction && <span>{STORY_REACTIONS.find((r) => r.type === v.reaction)?.emoji}</span>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this story?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeStory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report story</DialogTitle>
            <DialogDescription>Tell us what's wrong with this story.</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <RadioGroup value={reportReason} onValueChange={setReportReason} className="space-y-2">
              {STORY_REPORT_REASONS.map((r) => (
                <div key={r.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={r.value} id={`sr-${r.value}`} />
                  <Label htmlFor={`sr-${r.value}`} className="font-normal cursor-pointer">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
            <Textarea placeholder="Add any extra context (optional)…" value={reportDescription}
              onChange={(e) => setReportDescription(e.target.value)} className="min-h-[80px]" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)} disabled={submittingReport}>Cancel</Button>
            <Button onClick={submitReport} disabled={submittingReport}>
              {submittingReport ? 'Submitting…' : 'Submit report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// small wrapper so the composer can be launched from inside the viewer with
// the current user's profile details.
function ComposerLauncher({ userId, onClose, onPublished }: { userId: string; onClose: () => void; onPublished: (id: string) => void }) {
  const [me, setMe] = useState<{ name: string; avatar: string | null; privacy: 'public' | 'friends' | 'custom' } | null>(null);
  useEffect(() => {
    (async () => {
      const [{ data }, settings] = await Promise.all([
        supabase.from('profiles').select('display_name, avatar_url').eq('user_id', userId).maybeSingle(),
        fetchStorySettings(userId),
      ]);
      setMe({ name: data?.display_name ?? 'You', avatar: data?.avatar_url ?? null, privacy: settings.defaultPrivacy });
    })();
  }, [userId]);
  if (!me) return null;
  return (
    <StoryComposer userId={userId} authorName={me.name} authorAvatar={me.avatar}
      defaultPrivacy={me.privacy} onClose={onClose} onPublished={onPublished} />
  );
}

// Renders overlays + music sticker on top of a raw <video> (the non-canvas path).
function OverlayLayer({ story }: { story: StoryRecord }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <StoryCanvas
        model={{ ...toModel(story), kind: 'text', background: null, caption: null, mediaUrl: null }}
        className="absolute inset-0 bg-transparent"
      />
    </div>
  );
}

export default StoryPage;
