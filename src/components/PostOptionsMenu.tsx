import { useState, useEffect } from 'react';
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
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  BookmarkPlus,
  EyeOff,
  Flag,
  Link2,
  Bell,
  UserX,
  Clock,
  Info,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  MoreHorizontal,
  Megaphone,
} from 'lucide-react';
import { CtaFields } from '@/components/CtaFields';
import { validateCtaUrl, EMPTY_CTA, type CtaConfig } from '@/lib/cta';

interface PostOptionsMenuProps {
  postId: string;
  postUserId: string;
  postUserName: string;
  currentUserProfileId: string | null;
  isOwnPost: boolean;
  onDelete?: () => void;
  onHide?: () => void;
  // Only present for company posts -- drives the "Edit CTA" admin check and
  // the edit dialog. undefined/null for personal posts, which never show
  // CTA controls at all (matches the composer's own "posting as" gating).
  companyId?: string | null;
  cta?: CtaConfig | null;
  onCtaChange?: (cta: CtaConfig | null) => void;
}

export const PostOptionsMenu = ({
  postId,
  postUserId,
  postUserName,
  currentUserProfileId,
  isOwnPost,
  onDelete,
  onHide,
  companyId,
  cta,
  onCtaChange,
}: PostOptionsMenuProps) => {
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canManageCta, setCanManageCta] = useState(false);
  const [ctaDialogOpen, setCtaDialogOpen] = useState(false);
  const [ctaDraft, setCtaDraft] = useState<CtaConfig>(cta ?? EMPTY_CTA);
  const [ctaUrlError, setCtaUrlError] = useState<string | null>(null);
  const [savingCta, setSavingCta] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

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
      setCtaUrlError(check.error);
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

  const handleSavePost = async () => {
    if (!currentUserProfileId) return;
    try {
      const { error } = await supabase.from('saved_posts').insert({
        user_id: currentUserProfileId,
        post_id: postId,
      });
      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Post already saved' });
        } else {
          throw error;
        }
      } else {
        toast({ title: 'Post saved successfully' });
      }
      closeMenu();
    } catch (err) {
      console.error('Error saving post:', err);
      toast({ title: 'Failed to save post', variant: 'destructive' });
    }
  };

  const handleHidePost = async () => {
    if (!currentUserProfileId) return;
    try {
      const { error } = await supabase.from('hidden_posts').insert({
        user_id: currentUserProfileId,
        post_id: postId,
      });
      if (error) throw error;
      toast({ title: 'Post hidden successfully' });
      closeMenu();
      onHide?.();
    } catch (err) {
      console.error('Error hiding post:', err);
      toast({ title: 'Failed to hide post', variant: 'destructive' });
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/dashboard#post-${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied to clipboard' });
      closeMenu();
    } catch (err) {
      console.error('Copy failed:', err);
      toast({ title: 'Failed to copy link', variant: 'destructive' });
    }
  };

  const handleTurnOnNotifications = async () => {
    if (!currentUserProfileId) return;
    try {
      const { error } = await supabase.from('post_notifications_enabled').insert({
        user_id: currentUserProfileId,
        post_id: postId,
      });
      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Notifications already enabled' });
        } else {
          throw error;
        }
      } else {
        toast({ title: 'Notifications enabled for this post' });
      }
      closeMenu();
    } catch (err) {
      console.error('Error enabling notifications:', err);
      toast({ title: 'Failed to enable notifications', variant: 'destructive' });
    }
  };

  const handleSnoozeUser = async () => {
    if (!currentUserProfileId || postUserId === currentUserProfileId) return;
    try {
      const snoozedUntil = new Date();
      snoozedUntil.setDate(snoozedUntil.getDate() + 30);
      
      const { error } = await supabase.from('snoozed_users').upsert({
        user_id: currentUserProfileId,
        snoozed_user_id: postUserId,
        snoozed_until: snoozedUntil.toISOString(),
      }, { onConflict: 'user_id,snoozed_user_id' });
      
      if (error) throw error;
      toast({ title: `Snoozed ${postUserName} for 30 days` });
      closeMenu();
      onHide?.();
    } catch (err) {
      console.error('Error snoozing user:', err);
      toast({ title: 'Failed to snooze user', variant: 'destructive' });
    }
  };

  const handleHideAllFromUser = async () => {
    if (!currentUserProfileId || postUserId === currentUserProfileId) return;
    try {
      const snoozedUntil = new Date();
      snoozedUntil.setFullYear(snoozedUntil.getFullYear() + 100);
      
      const { error } = await supabase.from('snoozed_users').upsert({
        user_id: currentUserProfileId,
        snoozed_user_id: postUserId,
        snoozed_until: snoozedUntil.toISOString(),
      }, { onConflict: 'user_id,snoozed_user_id' });
      
      if (error) throw error;
      toast({ title: `Hiding all posts from ${postUserName}` });
      closeMenu();
      onHide?.();
    } catch (err) {
      console.error('Error hiding user posts:', err);
      toast({ title: 'Failed to hide posts', variant: 'destructive' });
    }
  };

  const handleBlockUser = async () => {
    if (!currentUserProfileId || postUserId === currentUserProfileId) return;
    try {
      const { error } = await supabase.from('blocked_users').insert({
        user_id: currentUserProfileId,
        blocked_user_id: postUserId,
      });
      if (error) {
        if (error.code === '23505') {
          toast({ title: 'User already blocked' });
        } else {
          throw error;
        }
      } else {
        toast({ title: `Blocked ${postUserName}` });
      }
      closeMenu();
      onHide?.();
    } catch (err) {
      console.error('Error blocking user:', err);
      toast({ title: 'Failed to block user', variant: 'destructive' });
    }
  };

  const handleMarkInterested = async () => {
    if (!currentUserProfileId) return;
    try {
      const { data: prefs, error: fetchError } = await supabase
        .from('user_feed_preferences')
        .select('interested_posts')
        .eq('user_id', currentUserProfileId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      const interestedPosts = prefs?.interested_posts || [];
      if (!interestedPosts.includes(postId)) {
        interestedPosts.push(postId);
      }

      const { error: upsertError } = await supabase
        .from('user_feed_preferences')
        .upsert({
          user_id: currentUserProfileId,
          interested_posts: interestedPosts,
        }, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;
      toast({ title: "Marked as interested - You'll see more posts like this" });
      closeMenu();
    } catch (err) {
      console.error('Error marking interested:', err);
      toast({ title: 'Failed to update preference', variant: 'destructive' });
    }
  };

  const handleMarkNotInterested = async () => {
    if (!currentUserProfileId) return;
    try {
      const { data: prefs, error: fetchError } = await supabase
        .from('user_feed_preferences')
        .select('not_interested_posts')
        .eq('user_id', currentUserProfileId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      const notInterestedPosts = prefs?.not_interested_posts || [];
      if (!notInterestedPosts.includes(postId)) {
        notInterestedPosts.push(postId);
      }

      const { error: upsertError } = await supabase
        .from('user_feed_preferences')
        .upsert({
          user_id: currentUserProfileId,
          not_interested_posts: notInterestedPosts,
        }, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;
      toast({ title: "Marked as not interested - You'll see fewer posts like this" });
      closeMenu();
    } catch (err) {
      console.error('Error marking not interested:', err);
      toast({ title: 'Failed to update preference', variant: 'destructive' });
    }
  };

  const handleWhySeeingThis = () => {
    toast({
      title: 'Why am I seeing this post?',
      description: `You follow ${postUserName} or are connected with them.`,
    });
    closeMenu();
  };

  const handleManageFeed = () => {
    closeMenu();
    navigate('/dashboard');
    toast({ title: 'Feed settings', description: 'Manage your preferences from your profile settings.' });
  };

  const handleDeletePost = async () => {
    if (!currentUserProfileId) return;
    try {
      setIsDeleting(true);
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', currentUserProfileId);

      if (error) throw error;

      toast({ title: 'Post deleted successfully' });
      setDeleteDialogOpen(false);
      onDelete?.();
    } catch (err) {
      console.error('Error deleting post:', err);
      toast({ title: 'Failed to delete post', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReportSubmit = async () => {
    if (!currentUserProfileId || !reportReason.trim()) return;
    try {
      setIsSubmitting(true);
      const { error } = await supabase.from('post_reports').insert({
        reporter_id: currentUserProfileId,
        post_id: postId,
        reason: reportReason,
      });
      if (error) throw error;
      toast({ title: 'Report submitted', description: 'Thank you for helping keep our community safe.' });
      setReportDialogOpen(false);
      setReportReason('');
    } catch (err) {
      console.error('Error submitting report:', err);
      toast({ title: 'Failed to submit report', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const menuItems = (
    <>
      <MenuItem icon={Info} onClick={handleWhySeeingThis}>
        Why am I seeing this?
      </MenuItem>
      <MenuItem icon={ThumbsUp} onClick={handleMarkInterested}>
        Interested
      </MenuItem>
      <MenuItem icon={ThumbsDown} onClick={handleMarkNotInterested}>
        Not Interested
      </MenuItem>
      <MenuItem icon={BookmarkPlus} onClick={handleSavePost}>
        Save Post
      </MenuItem>
      <MenuItem icon={EyeOff} onClick={handleHidePost}>
        Hide Post
      </MenuItem>
      <MenuItem icon={Flag} onClick={() => { closeMenu(); setReportDialogOpen(true); }}>
        Report Post
      </MenuItem>
      <MenuItem icon={Bell} onClick={handleTurnOnNotifications}>
        Turn On Notifications
      </MenuItem>
      <MenuItem icon={Link2} onClick={handleCopyLink}>
        Copy Link
      </MenuItem>
      
      {!isOwnPost && (
        <>
          <div className="h-px bg-border my-1" />
          <MenuItem icon={Clock} onClick={handleSnoozeUser}>
            Snooze {postUserName} for 30 days
          </MenuItem>
          <MenuItem icon={EyeOff} onClick={handleHideAllFromUser}>
            Hide all from {postUserName}
          </MenuItem>
          <MenuItem icon={UserX} onClick={handleBlockUser} destructive>
            Block {postUserName}
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

      {isOwnPost && (
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
        <DropdownMenu open={open} onOpenChange={setOpen}>
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
            className="w-64 max-h-[70vh] overflow-y-auto z-50 bg-popover"
            sideOffset={5}
          >
            <DropdownMenuItem onClick={handleWhySeeingThis}>
              <Info className="h-4 w-4 mr-2" />
              Why am I seeing this?
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleMarkInterested}>
              <ThumbsUp className="h-4 w-4 mr-2" />
              Interested
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleMarkNotInterested}>
              <ThumbsDown className="h-4 w-4 mr-2" />
              Not Interested
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSavePost}>
              <BookmarkPlus className="h-4 w-4 mr-2" />
              Save Post
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleHidePost}>
              <EyeOff className="h-4 w-4 mr-2" />
              Hide Post
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { closeMenu(); setReportDialogOpen(true); }}>
              <Flag className="h-4 w-4 mr-2" />
              Report Post
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleTurnOnNotifications}>
              <Bell className="h-4 w-4 mr-2" />
              Turn On Notifications
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyLink}>
              <Link2 className="h-4 w-4 mr-2" />
              Copy Link
            </DropdownMenuItem>
            
            {!isOwnPost && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSnoozeUser}>
                  <Clock className="h-4 w-4 mr-2" />
                  Snooze {postUserName} for 30 days
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleHideAllFromUser}>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Hide all from {postUserName}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleBlockUser}
                  className="text-destructive focus:text-destructive"
                >
                  <UserX className="h-4 w-4 mr-2" />
                  Block {postUserName}
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

            {isOwnPost && (
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
          onOpenChange={setReportDialogOpen}
          reportReason={reportReason}
          setReportReason={setReportReason}
          onSubmit={handleReportSubmit}
          isSubmitting={isSubmitting}
        />

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
        }}
        aria-label="Post options"
      >
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent 
          side="bottom" 
          className="max-h-[60vh] overflow-y-auto rounded-t-xl"
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
        onOpenChange={setReportDialogOpen}
        reportReason={reportReason}
        setReportReason={setReportReason}
        onSubmit={handleReportSubmit}
        isSubmitting={isSubmitting}
      />
    </>
  );
};

// Helper component for mobile menu items
const MenuItem = ({ 
  icon: Icon, 
  children, 
  onClick, 
  destructive = false 
}: { 
  icon?: React.ElementType;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left ${
      destructive ? 'text-destructive hover:bg-destructive/10' : ''
    }`}
  >
    {Icon && <Icon className="h-5 w-5 flex-shrink-0" />}
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
        <AlertDialogTitle>Delete Post</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete this post? This action cannot be undone.
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

// Report dialog
const ReportDialog = ({
  open,
  onOpenChange,
  reportReason,
  setReportReason,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportReason: string;
  setReportReason: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Report Post</DialogTitle>
      </DialogHeader>
      <div className="py-4">
        <Textarea
          placeholder="Please describe why you're reporting this post..."
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          className="min-h-[120px]"
        />
      </div>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!reportReason.trim() || isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Report'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
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
