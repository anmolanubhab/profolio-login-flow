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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  BookmarkPlus,
  BookmarkCheck,
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
  Check,
} from 'lucide-react';

interface PostOptionsMenuProps {
  postId: string;
  postUserId: string;
  postUserName: string;
  currentUserProfileId: string | null;
  isOwnPost: boolean;
  onDelete?: () => void;
  onHide?: () => void;
  isPromoted?: boolean;
  isCompanyPost?: boolean;
}

export const PostOptionsMenu = ({
  postId,
  postUserId,
  postUserName,
  currentUserProfileId,
  isOwnPost,
  onDelete,
  onHide,
  isPromoted = false,
  isCompanyPost = false,
}: PostOptionsMenuProps) => {
  const [open, setOpen] = useState(false);
  
  // Dialog States
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [whySeeingDialogOpen, setWhySeeingDialogOpen] = useState(false);
  
  // Logic States
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [customReportReason, setCustomReportReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Post Status States
  const [isSaved, setIsSaved] = useState(false);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Fetch initial state when menu opens
  useEffect(() => {
    if (open && currentUserProfileId) {
      checkPostState();
    }
  }, [open, currentUserProfileId, postId]);

  const checkPostState = async () => {
    if (!currentUserProfileId) return;
    setIsLoadingState(true);
    try {
      // Check if saved
      const { data: savedData } = await supabase
        .from('saved_posts')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUserProfileId)
        .maybeSingle();
      
      setIsSaved(!!savedData);

      // Check if notifications enabled (handling potential missing table gracefully)
      // We use 'any' to bypass TS check if table definition is missing in local types
      const { data: notifData, error: notifError } = await supabase
        .from('post_notifications_enabled')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUserProfileId)
        .maybeSingle();
      
      if (!notifError) {
        setIsNotificationsEnabled(!!notifData);
      }
    } catch (error) {
      console.error('Error checking post state:', error);
    } finally {
      setIsLoadingState(false);
    }
  };

  const closeMenu = () => setOpen(false);

  // 1. Why am I seeing this?
  const handleWhySeeingThis = () => {
    closeMenu();
    setWhySeeingDialogOpen(true);
  };

  // 2. Interested
  const handleMarkInterested = async () => {
    if (!currentUserProfileId) return;
    try {
      const { data: prefs, error: fetchError } = await supabase
        .from('user_feed_preferences')
        .select('interested_posts')
        .eq('user_id', currentUserProfileId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      const interestedPosts = (prefs?.interested_posts as string[]) || [];
      if (!interestedPosts.includes(postId)) {
        interestedPosts.push(postId);
        
        const { error: upsertError } = await supabase
          .from('user_feed_preferences')
          .upsert({
            user_id: currentUserProfileId,
            interested_posts: interestedPosts,
          }, { onConflict: 'user_id' });

        if (upsertError) throw upsertError;
      }

      toast({ 
        title: "Thanks for the feedback!", 
        description: "We'll show you more posts like this." 
      });
      closeMenu();
    } catch (err) {
      console.error('Error marking interested:', err);
      toast({ title: 'Failed to update preference', variant: 'destructive' });
    }
  };

  // 3. Not Interested
  const handleMarkNotInterested = async () => {
    if (!currentUserProfileId) return;
    try {
      // Optimistic UI
      onHide?.();
      closeMenu();

      const { data: prefs, error: fetchError } = await supabase
        .from('user_feed_preferences')
        .select('not_interested_posts')
        .eq('user_id', currentUserProfileId)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

      const notInterestedPosts = (prefs?.not_interested_posts as string[]) || [];
      if (!notInterestedPosts.includes(postId)) {
        notInterestedPosts.push(postId);

        const { error: upsertError } = await supabase
          .from('user_feed_preferences')
          .upsert({
            user_id: currentUserProfileId,
            not_interested_posts: notInterestedPosts,
          }, { onConflict: 'user_id' });

        if (upsertError) throw upsertError;
      }

      toast({ title: "Post hidden", description: "We'll show fewer posts like this." });
    } catch (err) {
      console.error('Error marking not interested:', err);
      // Ideally we would undo the hide here, but simpler to just show error
      toast({ title: 'Failed to update preference', variant: 'destructive' });
    }
  };

  // 4. Save Post (Toggle)
  const handleSavePost = async () => {
    if (!currentUserProfileId) return;
    
    // Optimistic Update
    const newSavedState = !isSaved;
    setIsSaved(newSavedState);
    closeMenu();

    try {
      if (newSavedState) {
        // Save
        const { error } = await supabase.from('saved_posts').insert({
          user_id: currentUserProfileId,
          post_id: postId,
        });
        if (error && error.code !== '23505') throw error;
        toast({ title: 'Post saved' });
      } else {
        // Unsave
        const { error } = await supabase
          .from('saved_posts')
          .delete()
          .eq('user_id', currentUserProfileId)
          .eq('post_id', postId);
        if (error) throw error;
        toast({ title: 'Removed from Saved' });
      }
    } catch (err) {
      console.error('Error toggling save post:', err);
      setIsSaved(!newSavedState); // Revert
      toast({ title: 'Failed to update saved status', variant: 'destructive' });
    }
  };

  // 5. Hide Post
  const handleHidePost = async () => {
    if (!currentUserProfileId) return;
    try {
      // Optimistic
      onHide?.();
      closeMenu();

      const { error } = await supabase.from('hidden_posts').insert({
        user_id: currentUserProfileId,
        post_id: postId,
      });
      if (error && error.code !== '23505') throw error;
      
      toast({ title: 'Post hidden' });
    } catch (err) {
      console.error('Error hiding post:', err);
      toast({ title: 'Failed to hide post', variant: 'destructive' });
    }
  };

  // 6. Report Post
  const handleReportSubmit = async () => {
    if (!currentUserProfileId) return;
    
    const finalReason = reportReason === 'other' ? customReportReason : reportReason;
    if (!finalReason.trim()) {
      toast({ title: "Please provide a reason", variant: "destructive" });
      return;
    }

    try {
      setIsSubmitting(true);
      // Use 'any' cast if table missing in types
      const { error } = await supabase.from('post_reports').insert({
        reporter_id: currentUserProfileId,
        post_id: postId,
        reason: finalReason,
      });
      
      if (error) throw error;
      
      toast({ title: 'Report submitted', description: 'Thank you for helping keep our community safe.' });
      setReportDialogOpen(false);
      setReportReason('spam');
      setCustomReportReason('');
    } catch (err) {
      console.error('Error submitting report:', err);
      toast({ title: 'Failed to submit report', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 7. Turn On/Off Notifications
  const handleToggleNotifications = async () => {
    if (!currentUserProfileId) return;
    
    // Optimistic
    const newState = !isNotificationsEnabled;
    setIsNotificationsEnabled(newState);
    closeMenu();

    try {
      if (newState) {
        // Enable
        const { error } = await supabase.from('post_notifications_enabled').insert({
          user_id: currentUserProfileId,
          post_id: postId,
        });
        if (error && error.code !== '23505') throw error;
        toast({ title: 'Notifications turned on for this post' });
      } else {
        // Disable
        const { error } = await supabase
          .from('post_notifications_enabled')
          .delete()
          .eq('user_id', currentUserProfileId)
          .eq('post_id', postId);
        if (error) throw error;
        toast({ title: 'Notifications turned off' });
      }
    } catch (err) {
      console.error('Error toggling notifications:', err);
      setIsNotificationsEnabled(!newState); // Revert
      toast({ title: 'Failed to update notifications', variant: 'destructive' });
    }
  };

  // 8. Copy Link
  const handleCopyLink = async () => {
    const url = `${window.location.origin}/dashboard#post-${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ 
        title: 'Post link copied',
        description: 'Link copied to clipboard',
        icon: <Link2 className="h-4 w-4" /> 
      });
      closeMenu();
    } catch (err) {
      console.error('Copy failed:', err);
      toast({ title: 'Failed to copy link', variant: 'destructive' });
    }
  };

  // 9. Delete Post
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

  // Secondary actions (User management)
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
      if (error && error.code !== '23505') throw error;
      
      toast({ title: `Blocked ${postUserName}` });
      closeMenu();
      onHide?.();
    } catch (err) {
      console.error('Error blocking user:', err);
      toast({ title: 'Failed to block user', variant: 'destructive' });
    }
  };

  const handleManageFeed = () => {
    closeMenu();
    navigate('/dashboard'); // Assuming dashboard has settings, or redirect to specific settings page
    toast({ title: 'Feed settings', description: 'Manage your preferences from your profile settings.' });
  };

  // Shared Menu Items
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
      <div className="h-px bg-border my-1" />
      <MenuItem 
        icon={isSaved ? BookmarkCheck : BookmarkPlus} 
        onClick={handleSavePost}
        className={isSaved ? "text-primary font-medium" : ""}
      >
        {isSaved ? "Saved" : "Save Post"}
      </MenuItem>
      <MenuItem icon={EyeOff} onClick={handleHidePost}>
        Hide Post
      </MenuItem>
      <MenuItem icon={Flag} onClick={() => { closeMenu(); setReportDialogOpen(true); }}>
        Report Post
      </MenuItem>
      <MenuItem icon={isNotificationsEnabled ? BellOff : Bell} onClick={handleToggleNotifications}>
        {isNotificationsEnabled ? "Turn Off Notifications" : "Turn On Notifications"}
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

  return (
    <>
      {/* Trigger Button */}
      {isMobile ? (
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
            <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-xl">
              <SheetHeader className="pb-2 text-left">
                <SheetTitle className="text-base">Post Options</SheetTitle>
              </SheetHeader>
              <div className="space-y-1 pb-4">
                {menuItems}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
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
            {/* Desktop Menu Items */}
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
              {isSaved ? <BookmarkCheck className="h-4 w-4 mr-2 text-primary" /> : <BookmarkPlus className="h-4 w-4 mr-2" />}
              {isSaved ? "Saved" : "Save Post"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleHidePost}>
              <EyeOff className="h-4 w-4 mr-2" />
              Hide Post
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { closeMenu(); setReportDialogOpen(true); }}>
              <Flag className="h-4 w-4 mr-2" />
              Report Post
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleToggleNotifications}>
              {isNotificationsEnabled ? <BellOff className="h-4 w-4 mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
              {isNotificationsEnabled ? "Turn Off Notifications" : "Turn On Notifications"}
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
      )}

      {/* Dialogs */}
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
        customReason={customReportReason}
        setCustomReason={setCustomReportReason}
        onSubmit={handleReportSubmit}
        isSubmitting={isSubmitting}
      />

      <Dialog open={whySeeingDialogOpen} onOpenChange={setWhySeeingDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Why am I seeing this?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 p-2 rounded-full text-blue-600 mt-0.5">
                <Info className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium">
                  {isPromoted 
                    ? "Promoted Content" 
                    : isCompanyPost 
                      ? "From a Company" 
                      : "In your network"}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {isPromoted 
                    ? "This post is promoted to reach a wider audience."
                    : isCompanyPost
                      ? `You are seeing this post from ${postUserName} because you might be interested in their updates.`
                      : `You are seeing this post because you follow ${postUserName} or are connected with them.`}
                </p>
              </div>
            </div>
            <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground">
              Your feed is personalized based on your connections, interests, and activity.
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setWhySeeingDialogOpen(false)}>
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

// Helper component for mobile menu items
const MenuItem = ({ 
  icon: Icon, 
  children, 
  onClick, 
  destructive = false,
  className = ""
}: { 
  icon?: React.ElementType;
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
  className?: string;
}) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left ${
      destructive ? 'text-destructive hover:bg-destructive/10' : ''
    } ${className}`}
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
  customReason,
  setCustomReason,
  onSubmit,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportReason: string;
  setReportReason: (value: string) => void;
  customReason: string;
  setCustomReason: (value: string) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Report Post</DialogTitle>
        <DialogDescription>
          Why are you reporting this post?
        </DialogDescription>
      </DialogHeader>
      <div className="py-4">
        <RadioGroup value={reportReason} onValueChange={setReportReason} className="space-y-3">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="spam" id="r-spam" />
            <Label htmlFor="r-spam">Spam</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="harassment" id="r-harassment" />
            <Label htmlFor="r-harassment">Harassment</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="fake_info" id="r-fake" />
            <Label htmlFor="r-fake">Fake Information</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="inappropriate" id="r-inappropriate" />
            <Label htmlFor="r-inappropriate">Inappropriate Content</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="other" id="r-other" />
            <Label htmlFor="r-other">Other</Label>
          </div>
        </RadioGroup>
        
        {reportReason === 'other' && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-2">
            <Label htmlFor="custom-reason" className="mb-2 block text-sm">Please specify</Label>
            <Textarea
              id="custom-reason"
              placeholder="Tell us more about the issue..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        )}
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
          disabled={isSubmitting || (reportReason === 'other' && !customReason.trim())}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Report'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
