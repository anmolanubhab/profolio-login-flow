import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { supabase } from '@/integrations/supabase/client';
import {
  BookmarkPlus,
  Bookmark,
  EyeOff,
  Flag,
  Link2,
  Bell,
  BellOff,
  UserX,
  Clock,
  Info,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  MoreHorizontal,
  Megaphone,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { CtaFields } from '@/components/CtaFields';
import { validateCtaUrl, EMPTY_CTA, type CtaConfig } from '@/lib/cta';
import { useIsPostSaved, useToggleSavePost } from '@/hooks/useSavedPosts';

interface PostOptionsMenuProps {
  postId: string;
  postUserId: string;
  postUserName: string;
  currentUserProfileId: string | null;
  isOwnPost: boolean;
  onDelete?: () => void;
  onHide?: () => void;
  // Feed surfaces pass this to get the LinkedIn-style inline treatment: the
  // PostCard is replaced in place by a "you'll see fewer like this" strip with
  // Undo, instead of a toast + full feed refetch. When absent (PostDetail,
  // CompanyProfile, SavedPosts, …) the menu keeps the toast + onHide behavior.
  onInlineDismiss?: (info: { postId: string; label: string; onUndo: () => void | Promise<void> }) => void;
  // Only present for company posts -- drives the "Edit CTA" admin check and
  // the edit dialog. undefined/null for personal posts, which never show
  // CTA controls at all (matches the composer's own "posting as" gating).
  companyId?: string | null;
  cta?: CtaConfig | null;
  onCtaChange?: (cta: CtaConfig | null) => void;
}

// LinkedIn-parallel reporting categories. Every `value` is inside the DB
// check constraint post_reports_reason_check (see migration
// 20260831130000_expand_post_reports_reason_categories) -- the 5 reused legacy
// values plus 9 additions. `inappropriate`/`other` stay valid in the DB for
// old rows but are not offered here (matches LinkedIn, which has no "other").
const REPORT_REASONS: { value: string; label: string; description: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying', description: 'Targeted attacks, intimidation, or unwanted contact.' },
  { value: 'scam', label: 'Fraud or scam', description: 'Deceptive schemes, phishing, impersonation, or fake offers.' },
  { value: 'spam', label: 'Spam', description: 'Irrelevant, repetitive, or misleading promotional content.' },
  { value: 'misinformation', label: 'Misinformation', description: 'False or misleading claims that could deceive or cause harm.' },
  { value: 'hate', label: 'Hateful speech', description: 'Attacks or slurs against a person or group based on identity.' },
  { value: 'threats_or_violence', label: 'Threats or violence', description: 'Threats of harm, incitement, or glorification of violence.' },
  { value: 'self_harm', label: 'Self-harm', description: 'Content that promotes or depicts suicide or self-injury.' },
  { value: 'graphic_content', label: 'Graphic content', description: 'Excessively violent, gory, or disturbing imagery.' },
  { value: 'dangerous_orgs', label: 'Dangerous or extremist organizations', description: 'Promotes terrorism, extremism, or organized crime.' },
  { value: 'sexual_content', label: 'Sexual content', description: 'Nudity, pornography, or sexually explicit material.' },
  { value: 'fake_account', label: 'Fake account', description: 'The author appears to be impersonating someone or is not a real person.' },
  { value: 'child_exploitation', label: 'Child exploitation', description: 'Content that sexualizes or endangers minors.' },
  { value: 'restricted_goods', label: 'Restricted goods and services', description: 'Sale of weapons, drugs, or other regulated goods.' },
  { value: 'nonconsensual_imagery', label: 'Nonconsensual intimate imagery', description: 'Intimate images shared without the subject’s consent.' },
];

type ReportStep = 'reason' | 'review' | 'done';

// A snoozed_until further out than this counts as "Hide all from" (an
// effectively-indefinite mute) rather than the 30-day "Snooze" -- both
// actions write to the same snoozed_users/snoozed_companies row, so the
// distinction is read back from how far out the timestamp is.
const HIDE_ALL_THRESHOLD_MS = 365 * 24 * 60 * 60 * 1000;

interface MenuState {
  loaded: boolean;
  notifOn: boolean;
  isInterested: boolean;
  isNotInterested: boolean;
  isSnoozed: boolean;
  isHiddenAll: boolean;
  isBlocked: boolean;
}

const EMPTY_STATE: MenuState = {
  loaded: false,
  notifOn: false,
  isInterested: false,
  isNotInterested: false,
  isSnoozed: false,
  isHiddenAll: false,
  isBlocked: false,
};

export const PostOptionsMenu = ({
  postId,
  postUserId,
  postUserName,
  currentUserProfileId,
  isOwnPost,
  onDelete,
  onHide,
  onInlineDismiss,
  companyId,
  cta,
  onCtaChange,
}: PostOptionsMenuProps) => {
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportStep, setReportStep] = useState<ReportStep>('reason');
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [alreadyReported, setAlreadyReported] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const [canManageCta, setCanManageCta] = useState(false);
  const [ctaDialogOpen, setCtaDialogOpen] = useState(false);
  const [ctaDraft, setCtaDraft] = useState<CtaConfig>(cta ?? EMPTY_CTA);
  const [ctaUrlError, setCtaUrlError] = useState<string | null>(null);
  const [savingCta, setSavingCta] = useState(false);
  const [whyDialogOpen, setWhyDialogOpen] = useState(false);
  const [whyReason, setWhyReason] = useState<string>('Loading…');
  const [state, setState] = useState<MenuState>(EMPTY_STATE);
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Saved state comes from the shared, batched React Query cache (see
  // useSavedPosts) -- one query per user, not one per card -- so every
  // surface showing this post reflects a save/unsave immediately.
  const { isSaved } = useIsPostSaved(postId);
  const { toggleSave, isToggling: saveToggling } = useToggleSavePost();

  // Company posts identify their "author" in the UI via companyId, not a
  // profiles.id -- isOwnPost (computed by the caller from profiles.id) is
  // therefore always false for a company post even when the current user
  // authored/administers it. A company admin can manage (incl. delete) any
  // post published as their company; treat that the same as "own post" for
  // menu purposes so Delete Post appears and Snooze/Hide/Block (targeting
  // your own company) don't.
  const isSelfAuthored = isOwnPost || (!!companyId && canManageCta);
  const canDeletePost = isSelfAuthored;

  useEffect(() => {
    // Only the company's own admin/owner can add or change a CTA -- other
    // viewers (including the post's own author, if they're not an admin of
    // the posting company) can only view and click it. Mirrors the same
    // is_company_admin check already used for "Manage Team" elsewhere.
    if (!companyId) return;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.rpc('is_company_admin', { _user_id: user.id, _company_id: companyId });
      setCanManageCta(!!data);
    };
    check();
  }, [companyId]);

  const setBusy = (key: string, value: boolean) =>
    setPending((prev) => ({ ...prev, [key]: value }));

  // Loads every toggle-able state this menu displays in one pass, so labels
  // read "Unsave Post" / "Turn Off Notifications" / etc. correctly as soon
  // as the menu opens, and survive a refresh.
  const loadMenuState = useCallback(async () => {
    if (!currentUserProfileId) {
      setState({ ...EMPTY_STATE, loaded: true });
      return;
    }
    try {
      const targetIsCompany = !!companyId && !isSelfAuthored;
      const [
        notifRes,
        prefsRes,
        snoozeRes,
        blockRes,
      ] = await Promise.all([
        supabase.from('post_notifications_enabled').select('id').eq('user_id', currentUserProfileId).eq('post_id', postId).maybeSingle(),
        supabase.from('user_feed_preferences').select('interested_posts, not_interested_posts').eq('user_id', currentUserProfileId).maybeSingle(),
        !isSelfAuthored
          ? targetIsCompany
            ? supabase.from('snoozed_companies').select('snoozed_until').eq('user_id', currentUserProfileId).eq('snoozed_company_id', companyId!).maybeSingle()
            : supabase.from('snoozed_users').select('snoozed_until').eq('user_id', currentUserProfileId).eq('snoozed_user_id', postUserId).maybeSingle()
          : Promise.resolve({ data: null }),
        !isSelfAuthored
          ? targetIsCompany
            ? supabase.from('blocked_companies').select('id').eq('user_id', currentUserProfileId).eq('blocked_company_id', companyId!).maybeSingle()
            : supabase.from('blocked_users').select('id').eq('user_id', currentUserProfileId).eq('blocked_user_id', postUserId).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const snoozedUntil = (snoozeRes as { data: { snoozed_until: string } | null }).data?.snoozed_until;
      const snoozeActive = snoozedUntil ? new Date(snoozedUntil).getTime() > Date.now() : false;
      const isHiddenAll = snoozeActive && new Date(snoozedUntil!).getTime() - Date.now() > HIDE_ALL_THRESHOLD_MS;

      setState({
        loaded: true,
        notifOn: !!notifRes.data,
        isInterested: (prefsRes.data?.interested_posts || []).includes(postId),
        isNotInterested: (prefsRes.data?.not_interested_posts || []).includes(postId),
        isSnoozed: snoozeActive && !isHiddenAll,
        isHiddenAll,
        isBlocked: !!blockRes.data,
      });

      const reported = await supabase
        .from('post_reports')
        .select('id')
        .eq('reporter_id', currentUserProfileId)
        .eq('post_id', postId)
        .maybeSingle();
      setAlreadyReported(!!reported.data);
    } catch (err) {
      console.error('Error loading post menu state:', err);
      setState((prev) => ({ ...prev, loaded: true }));
    }
  }, [currentUserProfileId, postId, postUserId, companyId, isSelfAuthored]);

  useEffect(() => {
    loadMenuState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserProfileId, postId, isSelfAuthored]);

  const closeMenu = () => setOpen(false);

  const openCtaDialog = () => {
    closeMenu();
    setCtaDraft(cta ?? EMPTY_CTA);
    setCtaUrlError(null);
    setCtaDialogOpen(true);
  };

  const handleSaveCta = async () => {
    if (!ctaDraft.cta_label) {
      toast({ title: 'Choose a button label', variant: 'destructive' });
      return;
    }
    const check = validateCtaUrl(ctaDraft.cta_url || '');
    if (!check.valid) {
      setCtaUrlError((check as { error: string }).error);
      return;
    }
    setSavingCta(true);
    try {
      const next: CtaConfig = { cta_enabled: true, cta_label: ctaDraft.cta_label, cta_url: check.normalized, cta_open_new_tab: ctaDraft.cta_open_new_tab };
      const { error } = await supabase.from('posts').update(next).eq('id', postId);
      if (error) throw error;
      onCtaChange?.(next);
      toast({ title: 'Call-to-action saved' });
      setCtaDialogOpen(false);
    } catch (err) {
      console.error('Error saving CTA:', err);
      toast({ title: 'Failed to save call-to-action', variant: 'destructive' });
    } finally {
      setSavingCta(false);
    }
  };

  const handleRemoveCta = async () => {
    setSavingCta(true);
    try {
      const { error } = await supabase.from('posts').update(EMPTY_CTA).eq('id', postId);
      if (error) throw error;
      onCtaChange?.(null);
      toast({ title: 'Call-to-action removed' });
      setCtaDialogOpen(false);
    } catch (err) {
      console.error('Error removing CTA:', err);
      toast({ title: 'Failed to remove call-to-action', variant: 'destructive' });
    } finally {
      setSavingCta(false);
    }
  };

  const handleToggleSave = async () => {
    if (!currentUserProfileId || saveToggling) return;
    // Optimistic flip, rollback-on-error and the toast all live in
    // useToggleSavePost so every post surface stays in sync from one place.
    closeMenu();
    try {
      await toggleSave(postId, isSaved);
    } catch (err) {
      console.error('Error toggling save:', err);
      // toast already surfaced by the mutation's onError
    }
  };

  const handleHidePost = async () => {
    if (!currentUserProfileId || pending.hide) return;
    setBusy('hide', true);
    try {
      const { error } = await supabase.from('hidden_posts').insert({
        user_id: currentUserProfileId,
        post_id: postId,
      });
      if (error && error.code !== '23505') throw error;
      closeMenu();

      const undoHide = async () => {
        await supabase.from('hidden_posts').delete()
          .eq('user_id', currentUserProfileId).eq('post_id', postId);
      };

      if (onInlineDismiss) {
        onInlineDismiss({
          postId,
          label: "Post hidden. You won't see this in your feed.",
          onUndo: undoHide,
        });
      } else {
        onHide?.();
        toast({
          title: 'Post hidden',
          description: "You won't see this post in your feed.",
          action: (
            <ToastAction
              altText="Undo"
              onClick={async () => { await undoHide(); onHide?.(); }}
            >
              Undo
            </ToastAction>
          ),
        });
      }
    } catch (err) {
      console.error('Error hiding post:', err);
      toast({ title: 'Failed to hide post', variant: 'destructive' });
    } finally {
      setBusy('hide', false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/post/${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied to clipboard' });
      closeMenu();
    } catch (err) {
      console.error('Copy failed:', err);
      toast({ title: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const handleToggleNotifications = async () => {
    if (!currentUserProfileId || pending.notif) return;
    setBusy('notif', true);
    const wasOn = state.notifOn;
    try {
      if (wasOn) {
        const { error } = await supabase.from('post_notifications_enabled').delete()
          .eq('user_id', currentUserProfileId).eq('post_id', postId);
        if (error) throw error;
        setState((prev) => ({ ...prev, notifOn: false }));
        toast({ title: 'Notifications turned off for this post' });
      } else {
        const { error } = await supabase.from('post_notifications_enabled').insert({
          user_id: currentUserProfileId,
          post_id: postId,
        });
        if (error && error.code !== '23505') throw error;
        setState((prev) => ({ ...prev, notifOn: true }));
        toast({ title: 'Notifications enabled for this post' });
      }
      closeMenu();
    } catch (err) {
      console.error('Error toggling notifications:', err);
      toast({ title: 'Failed to update notifications', variant: 'destructive' });
    } finally {
      setBusy('notif', false);
    }
  };

  const targetIsCompany = !!companyId && !isSelfAuthored;

  const handleSnoozeTarget = async () => {
    if (!currentUserProfileId || isSelfAuthored || pending.snooze) return;
    setBusy('snooze', true);
    try {
      const snoozedUntil = new Date();
      snoozedUntil.setDate(snoozedUntil.getDate() + 30);

      const table = targetIsCompany ? 'snoozed_companies' : 'snoozed_users';
      const conflictCol = targetIsCompany ? 'snoozed_company_id' : 'snoozed_user_id';
      const payload = targetIsCompany
        ? { user_id: currentUserProfileId, snoozed_company_id: companyId, snoozed_until: snoozedUntil.toISOString() }
        : { user_id: currentUserProfileId, snoozed_user_id: postUserId, snoozed_until: snoozedUntil.toISOString() };

      const { error } = await supabase.from(table).upsert(payload, { onConflict: `user_id,${conflictCol}` });
      if (error) throw error;

      setState((prev) => ({ ...prev, isSnoozed: true, isHiddenAll: false }));
      closeMenu();
      onHide?.();
      toast({
        title: `Snoozed ${postUserName} for 30 days`,
        description: "You'll stop seeing their posts until then.",
        action: (
          <ToastAction altText="Undo" onClick={() => undoTarget(table)}>
            Undo
          </ToastAction>
        ),
      });
    } catch (err) {
      console.error('Error snoozing:', err);
      toast({ title: 'Failed to snooze', variant: 'destructive' });
    } finally {
      setBusy('snooze', false);
    }
  };

  const handleHideAllFromTarget = async () => {
    if (!currentUserProfileId || isSelfAuthored || pending.hideAll) return;
    setBusy('hideAll', true);
    try {
      const snoozedUntil = new Date();
      snoozedUntil.setFullYear(snoozedUntil.getFullYear() + 100);

      const table = targetIsCompany ? 'snoozed_companies' : 'snoozed_users';
      const conflictCol = targetIsCompany ? 'snoozed_company_id' : 'snoozed_user_id';
      const payload = targetIsCompany
        ? { user_id: currentUserProfileId, snoozed_company_id: companyId, snoozed_until: snoozedUntil.toISOString() }
        : { user_id: currentUserProfileId, snoozed_user_id: postUserId, snoozed_until: snoozedUntil.toISOString() };

      const { error } = await supabase.from(table).upsert(payload, { onConflict: `user_id,${conflictCol}` });
      if (error) throw error;

      setState((prev) => ({ ...prev, isHiddenAll: true, isSnoozed: false }));
      closeMenu();
      onHide?.();
      toast({
        title: `Hiding all posts from ${postUserName}`,
        action: (
          <ToastAction altText="Undo" onClick={() => undoTarget(table)}>
            Undo
          </ToastAction>
        ),
      });
    } catch (err) {
      console.error('Error hiding all from target:', err);
      toast({ title: 'Failed to hide posts', variant: 'destructive' });
    } finally {
      setBusy('hideAll', false);
    }
  };

  const undoTarget = async (table: 'snoozed_users' | 'snoozed_companies') => {
    if (!currentUserProfileId) return;
    if (table === 'snoozed_companies') {
      await supabase.from('snoozed_companies').delete()
        .eq('user_id', currentUserProfileId).eq('snoozed_company_id', companyId!);
    } else {
      await supabase.from('snoozed_users').delete()
        .eq('user_id', currentUserProfileId).eq('snoozed_user_id', postUserId);
    }
    setState((prev) => ({ ...prev, isSnoozed: false, isHiddenAll: false }));
    onHide?.();
  };

  // Block entry point from the menu. Blocking is destructive and one-sided,
  // so it NEVER fires straight from the menu row -- it opens a confirmation
  // dialog first (see BlockConfirmDialog). Unblock is safe and immediate.
  const handleBlockClick = () => {
    if (!currentUserProfileId || isSelfAuthored || pending.block) return;
    if (state.isBlocked) {
      performUnblock();
    } else {
      closeMenu();
      setBlockConfirmOpen(true);
    }
  };

  const performUnblock = async () => {
    if (!currentUserProfileId || pending.block) return;
    setBusy('block', true);
    try {
      if (targetIsCompany) {
        await supabase.from('blocked_companies').delete()
          .eq('user_id', currentUserProfileId).eq('blocked_company_id', companyId!);
      } else {
        await supabase.from('blocked_users').delete()
          .eq('user_id', currentUserProfileId).eq('blocked_user_id', postUserId);
      }
      setState((prev) => ({ ...prev, isBlocked: false }));
      toast({ title: `Unblocked ${postUserName}` });
    } catch (err) {
      console.error('Error unblocking:', err);
      toast({ title: 'Failed to unblock', variant: 'destructive' });
    } finally {
      setBusy('block', false);
    }
  };

  const performBlock = async () => {
    if (!currentUserProfileId || pending.block) return;
    setBusy('block', true);
    try {
      const table = targetIsCompany ? 'blocked_companies' : 'blocked_users';
      const payload = targetIsCompany
        ? { user_id: currentUserProfileId, blocked_company_id: companyId }
        : { user_id: currentUserProfileId, blocked_user_id: postUserId };
      const { error } = await supabase.from(table).insert(payload);
      if (error && error.code !== '23505') throw error;
      setState((prev) => ({ ...prev, isBlocked: true }));
      setBlockConfirmOpen(false);
      onHide?.();
      toast({ title: `Blocked ${postUserName}`, description: 'Manage blocked accounts in Feed preferences.' });
    } catch (err) {
      console.error('Error blocking:', err);
      toast({ title: 'Failed to block', variant: 'destructive' });
    } finally {
      setBusy('block', false);
    }
  };

  const handleToggleInterested = async () => {
    if (!currentUserProfileId || pending.interested) return;
    setBusy('interested', true);
    try {
      const { data: prefs, error: fetchError } = await supabase
        .from('user_feed_preferences')
        .select('interested_posts, not_interested_posts')
        .eq('user_id', currentUserProfileId)
        .maybeSingle();
      if (fetchError) throw fetchError;

      const interested = new Set(prefs?.interested_posts || []);
      const notInterested = new Set(prefs?.not_interested_posts || []);
      const turningOn = !interested.has(postId);
      if (turningOn) {
        interested.add(postId);
        notInterested.delete(postId);
      } else {
        interested.delete(postId);
      }

      const { error: upsertError } = await supabase.from('user_feed_preferences').upsert({
        user_id: currentUserProfileId,
        interested_posts: Array.from(interested),
        not_interested_posts: Array.from(notInterested),
      }, { onConflict: 'user_id' });
      if (upsertError) throw upsertError;

      setState((prev) => ({ ...prev, isInterested: turningOn, isNotInterested: false }));
      toast({ title: turningOn ? "Marked as interested — you'll see more posts like this" : 'Removed from Interested' });
      closeMenu();
    } catch (err) {
      console.error('Error marking interested:', err);
      toast({ title: 'Failed to update preference', variant: 'destructive' });
    } finally {
      setBusy('interested', false);
    }
  };

  const handleToggleNotInterested = async () => {
    if (!currentUserProfileId || pending.notInterested) return;
    setBusy('notInterested', true);
    try {
      const { data: prefs, error: fetchError } = await supabase
        .from('user_feed_preferences')
        .select('interested_posts, not_interested_posts')
        .eq('user_id', currentUserProfileId)
        .maybeSingle();
      if (fetchError) throw fetchError;

      const interested = new Set(prefs?.interested_posts || []);
      const notInterested = new Set(prefs?.not_interested_posts || []);
      const turningOn = !notInterested.has(postId);
      if (turningOn) {
        notInterested.add(postId);
        interested.delete(postId);
      } else {
        notInterested.delete(postId);
      }

      const { error: upsertError } = await supabase.from('user_feed_preferences').upsert({
        user_id: currentUserProfileId,
        interested_posts: Array.from(interested),
        not_interested_posts: Array.from(notInterested),
      }, { onConflict: 'user_id' });
      if (upsertError) throw upsertError;

      setState((prev) => ({ ...prev, isNotInterested: turningOn, isInterested: false }));

      if (turningOn) {
        closeMenu();

        const undoNotInterested = async () => {
          const { data: p } = await supabase
            .from('user_feed_preferences')
            .select('not_interested_posts')
            .eq('user_id', currentUserProfileId)
            .maybeSingle();
          const next = (p?.not_interested_posts || []).filter((id: string) => id !== postId);
          await supabase.from('user_feed_preferences')
            .update({ not_interested_posts: next })
            .eq('user_id', currentUserProfileId);
          setState((prev) => ({ ...prev, isNotInterested: false }));
        };

        if (onInlineDismiss) {
          onInlineDismiss({
            postId,
            label: "You'll see fewer posts like this.",
            onUndo: undoNotInterested,
          });
        } else {
          onHide?.();
          toast({
            title: "Marked as not interested — you'll see fewer posts like this",
            description: 'Removed from your feed.',
            action: (
              <ToastAction
                altText="Undo"
                onClick={async () => { await undoNotInterested(); onHide?.(); }}
              >
                Undo
              </ToastAction>
            ),
          });
        }
      } else {
        closeMenu();
      }
    } catch (err) {
      console.error('Error marking not interested:', err);
      toast({ title: 'Failed to update preference', variant: 'destructive' });
    } finally {
      setBusy('notInterested', false);
    }
  };

  const handleWhySeeingThis = async () => {
    closeMenu();
    setWhyDialogOpen(true);
    setWhyReason('Loading…');
    try {
      if (!currentUserProfileId) {
        setWhyReason(`This post appears in your feed because it's public content from your network.`);
        return;
      }
      if (companyId) {
        const { data } = await supabase
          .from('company_followers')
          .select('id')
          .eq('user_id', currentUserProfileId)
          .eq('company_id', companyId)
          .maybeSingle();
        if (data) {
          setWhyReason(`Because you follow ${postUserName}.`);
          return;
        }
        setWhyReason(`This post from ${postUserName} matches your interests or is popular in your network.`);
        return;
      }

      if (postUserId === currentUserProfileId) {
        setWhyReason('This is your own post.');
        return;
      }

      const { data: followData } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', currentUserProfileId)
        .eq('following_id', postUserId)
        .maybeSingle();
      if (followData) {
        setWhyReason(`Because you follow ${postUserName}.`);
        return;
      }

      const { data: connData } = await supabase
        .from('connections')
        .select('id')
        .eq('status', 'accepted')
        .or(`and(user_id.eq.${currentUserProfileId},connection_id.eq.${postUserId}),and(user_id.eq.${postUserId},connection_id.eq.${currentUserProfileId})`)
        .maybeSingle();
      if (connData) {
        setWhyReason(`Because you are connected with ${postUserName}.`);
        return;
      }

      if (state.isInterested) {
        setWhyReason(`Because you marked a similar post as "Interested".`);
        return;
      }

      setWhyReason(`This post is popular in your network or matches topics you engage with.`);
    } catch (err) {
      console.error('Error computing why-seeing-this reason:', err);
      setWhyReason('This post is showing based on your network and activity on Profolio.');
    }
  };

  const handleManageFeed = () => {
    closeMenu();
    navigate('/feed/preferences');
  };

  const openReportDialog = () => {
    closeMenu();
    setReportStep('reason');
    setReportReason('');
    setReportDescription('');
    // Defer the dialog mount by a tick: opening a Radix Dialog in the same
    // event that closes the dropdown occasionally races the dropdown's
    // focus-restore pointerdown and the dialog immediately re-closes.
    setTimeout(() => setReportDialogOpen(true), 0);
  };

  const handleDeletePost = async () => {
    if (!currentUserProfileId || !canDeletePost) return;
    try {
      setIsDeleting(true);
      // Ownership/authorization is enforced by RLS (auth.uid() = user_id, or
      // is_company_admin() for company posts) -- no need to (and no correct
      // way to) re-check it client-side against a mismatched id column here.
      const { error, count } = await supabase
        .from('posts')
        .delete({ count: 'exact' })
        .eq('id', postId);

      if (error) throw error;
      if (!count) {
        throw new Error('You are not authorized to delete this post.');
      }

      toast({ title: 'Post deleted successfully' });
      setDeleteDialogOpen(false);
      onDelete?.();
    } catch (err) {
      console.error('Error deleting post:', err);
      toast({ title: 'Failed to delete post', description: err instanceof Error ? err.message : undefined, variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReportSubmit = async () => {
    if (!currentUserProfileId || isSubmitting || !reportReason) return;
    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('post_reports').insert({
        reporter_id: currentUserProfileId,
        post_id: postId,
        reason: reportReason,
        description: reportDescription.trim() || null,
      });
      if (error) {
        if (error.code === '23505') {
          setAlreadyReported(true);
          toast({ title: "You've already reported this post" });
          setReportDialogOpen(false);
          return;
        }
        throw error;
      }
      setAlreadyReported(true);
      setReportStep('done');
    } catch (err) {
      console.error('Error submitting report:', err);
      toast({ title: 'Failed to submit report', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const busy = (key: string) => !!pending[key];

  const menuItems = (
    <>
      <MenuItem icon={Info} onClick={handleWhySeeingThis}>
        Why am I seeing this?
      </MenuItem>
      <MenuItem icon={ThumbsUp} onClick={handleToggleInterested} loading={busy('interested')} active={state.isInterested}>
        {state.isInterested ? 'Marked as Interested' : 'Interested'}
      </MenuItem>
      <MenuItem icon={ThumbsDown} onClick={handleToggleNotInterested} loading={busy('notInterested')} active={state.isNotInterested}>
        {state.isNotInterested ? 'Marked as Not Interested' : 'Not Interested'}
      </MenuItem>
      <MenuItem icon={isSaved ? Bookmark : BookmarkPlus} onClick={handleToggleSave} loading={saveToggling}>
        {isSaved ? 'Unsave Post' : 'Save Post'}
      </MenuItem>
      <MenuItem icon={EyeOff} onClick={handleHidePost} loading={busy('hide')}>
        Hide Post
      </MenuItem>
      <MenuItem icon={Flag} onClick={openReportDialog}>
        {alreadyReported ? 'Reported' : 'Report Post'}
      </MenuItem>
      <MenuItem icon={state.notifOn ? BellOff : Bell} onClick={handleToggleNotifications} loading={busy('notif')}>
        {state.notifOn ? 'Turn Off Notifications' : 'Turn On Notifications'}
      </MenuItem>
      <MenuItem icon={Link2} onClick={handleCopyLink}>
        Copy Link
      </MenuItem>

      {!isSelfAuthored && (
        <>
          <div className="h-px bg-border my-1" />
          <MenuItem icon={Clock} onClick={handleSnoozeTarget} loading={busy('snooze')} active={state.isSnoozed}>
            {state.isSnoozed ? `Snoozed` : `Snooze ${postUserName} for 30 days`}
          </MenuItem>
          <MenuItem icon={EyeOff} onClick={handleHideAllFromTarget} loading={busy('hideAll')} active={state.isHiddenAll}>
            {state.isHiddenAll ? `Hiding all from ${postUserName}` : `Hide all from ${postUserName}`}
          </MenuItem>
          <MenuItem icon={UserX} onClick={handleBlockClick} loading={busy('block')} destructive>
            {state.isBlocked ? `Unblock ${postUserName}` : `Block ${postUserName}`}
          </MenuItem>
        </>
      )}

      {canManageCta && (
        <>
          <div className="h-px bg-border my-1" />
          <MenuItem icon={Megaphone} onClick={openCtaDialog}>
            {cta?.cta_enabled ? 'Edit call-to-action' : 'Add call-to-action'}
          </MenuItem>
        </>
      )}

      {canDeletePost && (
        <>
          <div className="h-px bg-border my-1" />
          <MenuItem icon={Trash2} onClick={() => { closeMenu(); setDeleteDialogOpen(true); }} destructive>
            Delete Post
          </MenuItem>
        </>
      )}

      <div className="h-px bg-border my-1" />
      <MenuItem onClick={handleManageFeed}>
        Manage your Feed
      </MenuItem>
    </>
  );

  // Desktop: Use dropdown menu
  if (!isMobile) {
    return (
      <>
        <DropdownMenu open={open} onOpenChange={(next) => { setOpen(next); if (next) loadMenuState(); }}>
          <DropdownMenuTrigger asChild>
            <button
              className="menu-button hover:bg-secondary transition-colors rounded-full p-2"
              aria-label="Post options"
            >
              <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-72 max-h-[70vh] overflow-y-auto z-50 bg-popover"
            sideOffset={5}
          >
            <DropdownMenuItem onClick={handleWhySeeingThis}>
              <Info className="h-4 w-4 mr-2" />
              Why am I seeing this?
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleInterested} disabled={busy('interested')} className={state.isInterested ? 'bg-secondary/60' : ''}>
              {busy('interested') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ThumbsUp className="h-4 w-4 mr-2" />}
              {state.isInterested ? 'Marked as Interested' : 'Interested'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleNotInterested} disabled={busy('notInterested')} className={state.isNotInterested ? 'bg-secondary/60' : ''}>
              {busy('notInterested') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ThumbsDown className="h-4 w-4 mr-2" />}
              {state.isNotInterested ? 'Marked as Not Interested' : 'Not Interested'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleToggleSave} disabled={saveToggling}>
              {saveToggling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : (isSaved ? <Bookmark className="h-4 w-4 mr-2" /> : <BookmarkPlus className="h-4 w-4 mr-2" />)}
              {isSaved ? 'Unsave Post' : 'Save Post'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleHidePost} disabled={busy('hide')}>
              {busy('hide') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <EyeOff className="h-4 w-4 mr-2" />}
              Hide Post
            </DropdownMenuItem>
            <DropdownMenuItem onClick={openReportDialog}>
              <Flag className="h-4 w-4 mr-2" />
              {alreadyReported ? 'Reported' : 'Report Post'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleNotifications} disabled={busy('notif')}>
              {busy('notif') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : (state.notifOn ? <BellOff className="h-4 w-4 mr-2" /> : <Bell className="h-4 w-4 mr-2" />)}
              {state.notifOn ? 'Turn Off Notifications' : 'Turn On Notifications'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyLink}>
              <Link2 className="h-4 w-4 mr-2" />
              Copy Link
            </DropdownMenuItem>

            {!isSelfAuthored && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSnoozeTarget} disabled={busy('snooze')}>
                  {busy('snooze') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Clock className="h-4 w-4 mr-2" />}
                  {state.isSnoozed ? 'Snoozed' : `Snooze ${postUserName} for 30 days`}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleHideAllFromTarget} disabled={busy('hideAll')}>
                  {busy('hideAll') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <EyeOff className="h-4 w-4 mr-2" />}
                  {state.isHiddenAll ? `Hiding all from ${postUserName}` : `Hide all from ${postUserName}`}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleBlockClick}
                  disabled={busy('block')}
                  className="text-destructive focus:text-destructive"
                >
                  {busy('block') ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <UserX className="h-4 w-4 mr-2" />}
                  {state.isBlocked ? `Unblock ${postUserName}` : `Block ${postUserName}`}
                </DropdownMenuItem>
              </>
            )}

            {canManageCta && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={openCtaDialog}>
                  <Megaphone className="h-4 w-4 mr-2" />
                  {cta?.cta_enabled ? 'Edit call-to-action' : 'Add call-to-action'}
                </DropdownMenuItem>
              </>
            )}

            {canDeletePost && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => { closeMenu(); setDeleteDialogOpen(true); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Post
                </DropdownMenuItem>
              </>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleManageFeed}>
              Manage your Feed
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DeleteConfirmDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeletePost}
          isDeleting={isDeleting}
        />

        <ReportDialog
          open={reportDialogOpen}
          onOpenChange={(o) => { setReportDialogOpen(o); if (!o) setReportStep('reason'); }}
          step={reportStep}
          setStep={setReportStep}
          reason={reportReason}
          setReason={setReportReason}
          description={reportDescription}
          setDescription={setReportDescription}
          onSubmit={handleReportSubmit}
          isSubmitting={isSubmitting}
        />

        <BlockConfirmDialog
          open={blockConfirmOpen}
          onOpenChange={setBlockConfirmOpen}
          name={postUserName}
          isCompany={targetIsCompany}
          onConfirm={performBlock}
          isBlocking={busy('block')}
        />

        <WhyDialog open={whyDialogOpen} onOpenChange={setWhyDialogOpen} reason={whyReason} />

        <CtaEditDialog
          open={ctaDialogOpen}
          onOpenChange={setCtaDialogOpen}
          draft={ctaDraft}
          setDraft={setCtaDraft}
          urlError={ctaUrlError}
          setUrlError={setCtaUrlError}
          hasExisting={!!cta?.cta_enabled}
          saving={savingCta}
          onSave={handleSaveCta}
          onRemove={handleRemoveCta}
        />
      </>
    );
  }

  // Mobile: Use bottom sheet
  return (
    <>
      <button
        className="menu-button hover:bg-secondary transition-colors rounded-full p-2"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
          loadMenuState();
        }}
        aria-label="Post options"
      >
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[75vh] overflow-y-auto rounded-t-xl"
        >
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">Post Options</SheetTitle>
          </SheetHeader>
          <div className="space-y-1 pb-4">
            {menuItems}
          </div>
        </SheetContent>
      </Sheet>

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeletePost}
        isDeleting={isDeleting}
      />

      <ReportDialog
        open={reportDialogOpen}
        onOpenChange={(o) => { setReportDialogOpen(o); if (!o) setReportStep('reason'); }}
        step={reportStep}
        setStep={setReportStep}
        reason={reportReason}
        setReason={setReportReason}
        description={reportDescription}
        setDescription={setReportDescription}
        onSubmit={handleReportSubmit}
        isSubmitting={isSubmitting}
      />

      <BlockConfirmDialog
        open={blockConfirmOpen}
        onOpenChange={setBlockConfirmOpen}
        name={postUserName}
        isCompany={targetIsCompany}
        onConfirm={performBlock}
        isBlocking={busy('block')}
      />

      <WhyDialog open={whyDialogOpen} onOpenChange={setWhyDialogOpen} reason={whyReason} />
    </>
  );
};

// Helper component for mobile menu items
const MenuItem = ({
  icon: Icon,
  children,
  onClick,
  destructive = false,
  loading = false,
  active = false,
}: {
  icon?: React.ElementType;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  loading?: boolean;
  active?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left disabled:opacity-60 ${
      destructive ? 'text-destructive hover:bg-destructive/10' : active ? 'bg-secondary/60' : ''
    }`}
  >
    {loading ? <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" /> : Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
    <span className="text-sm">{children}</span>
  </button>
);

// Delete confirmation dialog
const DeleteConfirmDialog = ({
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this post?</AlertDialogTitle>
        <AlertDialogDescription>
          This action cannot be undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          disabled={isDeleting}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

// "Why am I seeing this?" explanation dialog
const WhyDialog = ({
  open,
  onOpenChange,
  reason,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason: string;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Why am I seeing this post?</DialogTitle>
      </DialogHeader>
      <DialogDescription className="text-foreground">{reason}</DialogDescription>
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)}>Done</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

// Report dialog -- LinkedIn-style multi-step flow:
//   reason  -> pick one category chip, "Next"
//   review  -> confirm the selected reason (+ optional details), "Back" / "Submit"
//   done    -> success acknowledgement, "Done"
// Writes a single row to post_reports (reason constrained to the 7 DB values).
const ReportDialog = ({
  open,
  onOpenChange,
  step,
  setStep,
  reason,
  setReason,
  description,
  setDescription,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: ReportStep;
  setStep: (s: ReportStep) => void;
  reason: string;
  setReason: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) => {
  const selected = REPORT_REASONS.find((r) => r.value === reason);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {step === 'reason' && (
          <>
            <DialogHeader>
              <DialogTitle>Report this post</DialogTitle>
              <DialogDescription>Select your reporting reason.</DialogDescription>
            </DialogHeader>
            <div className="flex max-h-[52vh] flex-wrap gap-2 overflow-y-auto py-2">
              {REPORT_REASONS.map((r) => {
                const active = r.value === reason;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    aria-pressed={active}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:bg-secondary'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            <DialogFooter>
              <Button onClick={() => setStep('review')} disabled={!reason}>
                Next
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'review' && (
          <>
            <DialogHeader>
              <DialogTitle>Report this post</DialogTitle>
              <DialogDescription>You've selected the following reason.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <p className="text-sm font-semibold">{selected?.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{selected?.description}</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="report-description">Add details (optional)</Label>
                <Textarea
                  id="report-description"
                  placeholder="Add any extra context that will help our team review this..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </div>
            <DialogFooter className="sm:justify-between">
              <Button variant="outline" onClick={() => setStep('reason')} disabled={isSubmitting}>
                Back
              </Button>
              <Button onClick={onSubmit} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting…' : 'Submit report'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle className="sr-only">Report submitted</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <p className="text-base font-semibold">Thanks for letting us know</p>
              <p className="text-sm text-muted-foreground">
                Our team will review this post against our Community Policies. You won't be
                notified of the outcome, but reports like yours help keep Profolio safe.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Block confirmation -- block is destructive and one-sided, so the menu row
// only ever opens this; it never blocks directly.
const BlockConfirmDialog = ({
  open,
  onOpenChange,
  name,
  isCompany,
  onConfirm,
  isBlocking,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  isCompany: boolean;
  onConfirm: () => void;
  isBlocking: boolean;
}) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Block {name}?</AlertDialogTitle>
        <AlertDialogDescription>
          {isCompany ? (
            <>You'll no longer see posts or updates from {name}, and its content will be
            removed from your feed. {name} won't be notified. You can unblock it anytime
            from Feed preferences.</>
          ) : (
            <>{name} won't be able to see your posts or find your profile, and you won't see
            theirs. Any connection or follow between you will be removed. {name} won't be
            notified. You can unblock them anytime from Feed preferences.</>
          )}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={isBlocking}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          onClick={(e) => { e.preventDefault(); onConfirm(); }}
          disabled={isBlocking}
          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        >
          {isBlocking ? 'Blocking…' : 'Block'}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

const CtaEditDialog = ({
  open,
  onOpenChange,
  draft,
  setDraft,
  urlError,
  setUrlError,
  hasExisting,
  saving,
  onSave,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: CtaConfig;
  setDraft: (updater: (prev: CtaConfig) => CtaConfig) => void;
  urlError: string | null;
  setUrlError: (error: string | null) => void;
  hasExisting: boolean;
  saving: boolean;
  onSave: () => void;
  onRemove: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Call-to-action</DialogTitle>
      </DialogHeader>
      <div className="py-2">
        <CtaFields
          label={draft.cta_label || ''}
          url={draft.cta_url || ''}
          openNewTab={draft.cta_open_new_tab}
          urlError={urlError}
          onLabelChange={(v) => setDraft((prev) => ({ ...prev, cta_label: v }))}
          onUrlChange={(v) => { setDraft((prev) => ({ ...prev, cta_url: v })); setUrlError(null); }}
          onOpenNewTabChange={(v) => setDraft((prev) => ({ ...prev, cta_open_new_tab: v }))}
        />
      </div>
      <DialogFooter className="sm:justify-between">
        {hasExisting ? (
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={onRemove} disabled={saving}>
            Remove CTA
          </Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save CTA'}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
