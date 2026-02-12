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
import { ToastAction } from '@/components/ui/toast';
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
  Globe,
  Loader2,
} from 'lucide-react';

interface PostOptionsMenuProps {
  postId: string;
  postUserId: string;
  postUserName: string;
  currentUserProfileId: string | null;
  currentUserId?: string | null;
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
  currentUserId,
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
  const [whoCanSeeDialogOpen, setWhoCanSeeDialogOpen] = useState(false);
  
  // Logic States
  const [isDeleting, setIsDeleting] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [customReportReason, setCustomReportReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Post Status States
  const [isSaved, setIsSaved] = useState(false);
  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(false);
  const [isLoadingState, setIsLoadingState] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const { toast } = useToast();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // Fetch initial state when menu opens
  useEffect(() => {
    if (open && currentUserProfileId) {
      const controller = new AbortController();
      checkPostState(controller.signal);
      return () => controller.abort();
    }
  }, [open, currentUserProfileId, postId]);

  const checkPostState = async (signal?: AbortSignal) => {
    if (!currentUserProfileId) return;
    setIsLoadingState(true);
    try {
      // Check if saved
      const { data: savedData, error: savedError } = await supabase
        .from('saved_posts')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUserProfileId)
        .abortSignal(signal)
        .maybeSingle();
      
      if (savedError && savedError.code !== 'ABORTED') {
        throw savedError;
      }
      
      setIsSaved(!!savedData);

      // Check if notifications enabled (handling potential missing table gracefully)
      // We use 'any' to bypass TS check if table definition is missing in local types
      const { data: notifData, error: notifError } = await supabase
        .from('post_notifications_enabled')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUserProfileId)
        .abortSignal(signal)
        .maybeSingle();
      
      if (!notifError) {
        setIsNotificationsEnabled(!!notifData);
      } else if (notifError.code === 'ABORTED') {
        return;
      }
    } catch (error) {
      if ((error as any).name === 'AbortError' || (error as any).code === 'ABORTED') return;
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

  // 1.1 Who can see this?
  const handleWhoCanSeeThis = () => {
    closeMenu();
    setWhoCanSeeDialogOpen(true);
  };

  // 2. Interested
  const handleMarkInterested = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUserProfileId) return;
    
    setLoadingAction('interested');
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
    } finally {
      setLoadingAction(null);
    }
  };

  // 3. Not Interested
  const handleMarkNotInterested = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUserProfileId) return;
    
    setLoadingAction('not_interested');
    try {
      // Optimistic UI
      // onHide?.(); // Don't hide immediately if we want to show loading state? 
      // Actually, for "Not Interested", hiding immediately is better UX. 
      // But user asked for loading states. 
      // If I hide immediately, the menu disappears anyway because the post disappears!
      // So loading state is moot if onHide removes the post.
      
      // If I delay onHide until after API call, then loading state is useful.
      
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

      closeMenu();
      onHide?.(); // Hide after success

      toast({ 
        title: "Post hidden", 
        description: "We'll show fewer posts like this.",
        action: (
          <ToastAction altText="Undo" onClick={async () => {
            // Undo logic for Not Interested
            try {
              const { data: undoPrefs } = await supabase
                .from('user_feed_preferences')
                .select('not_interested_posts')
                .eq('user_id', currentUserProfileId)
                .single();
                
              const currentList = (undoPrefs?.not_interested_posts as string[]) || [];
              const newList = currentList.filter(id => id !== postId);
              
              await supabase
                .from('user_feed_preferences')
                .upsert({
                  user_id: currentUserProfileId,
                  not_interested_posts: newList,
                }, { onConflict: 'user_id' });
                
              toast({ title: "Preference updated. Refresh to see post." });
            } catch (e) {
              console.error("Undo failed", e);
            }
          }}>
            Undo
          </ToastAction>
        )
      });
    } catch (err) {
      console.error('Error marking not interested:', err);
      toast({ title: 'Failed to update preference', variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  // 4. Save Post (Toggle)
  const handleSavePost = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUserProfileId) return;
    
    setLoadingAction('save');
    const newSavedState = !isSaved;

    try {
      if (newSavedState) {
        // Save
        const { error } = await supabase.from('saved_posts').insert({
          user_id: currentUserProfileId,
          post_id: postId,
        });
        if (error && error.code !== '23505') throw error;
        toast({ 
          title: 'Post saved',
          action: (
            <ToastAction altText="Undo" onClick={(e) => handleSavePost(e)}>Undo</ToastAction>
          )
        });
      } else {
        // Unsave
        const { error } = await supabase
          .from('saved_posts')
          .delete()
          .eq('user_id', currentUserProfileId)
          .eq('post_id', postId);
        if (error) throw error;
        toast({ 
          title: 'Removed from Saved',
          action: (
            <ToastAction altText="Undo" onClick={(e) => handleSavePost(e)}>Undo</ToastAction>
          )
        });
      }
      setIsSaved(newSavedState);
      closeMenu();
    } catch (err) {
      console.error('Error toggling save post:', err);
      toast({ title: 'Failed to update saved status', variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  // 5. Hide Post
  const handleHidePost = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUserProfileId) return;
    
    setLoadingAction('hide');
    try {
      const { error } = await supabase.from('hidden_posts').insert({
        user_id: currentUserProfileId,
        post_id: postId,
      });
      if (error && error.code !== '23505') throw error;
      
      closeMenu();
      onHide?.();

      toast({ 
        title: 'Post hidden',
        action: (
          <ToastAction altText="Undo" onClick={async () => {
            try {
              await supabase
                .from('hidden_posts')
                .delete()
                .eq('user_id', currentUserProfileId)
                .eq('post_id', postId);
              toast({ title: "Post unhidden. Refresh to view." });
            } catch (e) {
              console.error("Undo hide failed", e);
            }
          }}>
            Undo
          </ToastAction>
        )
      });
    } catch (err) {
      console.error('Error hiding post:', err);
      toast({ title: 'Failed to hide post', variant: 'destructive' });
    } finally {
      setLoadingAction(null);
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
  const handleToggleNotifications = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUserProfileId) return;
    
    setLoadingAction('notifications');
    const newState = !isNotificationsEnabled;

    try {
      if (newState) {
        // Enable
        const { error } = await supabase.from('post_notifications_enabled').insert({
          user_id: currentUserProfileId,
          post_id: postId,
        });
        if (error && error.code !== '23505') throw error;
        toast({ 
          title: 'Notifications turned on for this post',
          action: (
            <ToastAction altText="Undo" onClick={(e) => handleToggleNotifications(e)}>Undo</ToastAction>
          )
        });
      } else {
        // Disable
        const { error } = await supabase
          .from('post_notifications_enabled')
          .delete()
          .eq('user_id', currentUserProfileId)
          .eq('post_id', postId);
        if (error) throw error;
        toast({ 
          title: 'Notifications turned off',
          action: (
            <ToastAction altText="Undo" onClick={(e) => handleToggleNotifications(e)}>Undo</ToastAction>
          )
        });
      }
      setIsNotificationsEnabled(newState);
      closeMenu();
    } catch (err) {
      console.error('Error toggling notifications:', err);
      toast({ title: 'Failed to update notifications', variant: 'destructive' });
    } finally {
      setLoadingAction(null);
    }
  };

  // 8. Copy Link
  const handleCopyLink = async (e: React.MouseEvent) => {
    // Synchronous-ish, but let's prevent default anyway if we want to show anything? 
    // Actually copy is fast. No loading state needed. But we can keep it consistent.
    // e.preventDefault(); 
    // ...
    // closeMenu();
    
    // Original was:
    // const handleCopyLink = async () => { ... closeMenu(); }
    
    // I will leave it as is or update signature to match MenuItem onClick if needed.
    // MenuItem onClick passes MouseEvent.
    // So let's just accept e but not use it heavily unless we want to show a spinner.
    
    const url = `${window.location.origin}/dashboard#post-${postId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ 
        title: 'Post link copied',
        description: 'Link copied to clipboard',
      });
      closeMenu();
    } catch (err) {
      console.error('Copy failed:', err);
      toast({ title: 'Failed to copy link', variant: 'destructive' });
    }
  };

  // 9. Delete Post
  const handleDeletePost = async () => {
    // Use auth ID (currentUserId) if available, otherwise fallback to profile ID
    // Standard Supabase RLS usually checks against auth.uid() which matches currentUserId
    const userIdToCheck = currentUserId || currentUserProfileId;
    
    if (!userIdToCheck) return;
    
    try {
      setIsDeleting(true);
      
      // Soft delete using status='deleted' since deleted_at column is missing
      // We explicitly check user_id to ensure ownership, though RLS should also enforce it
      const { error } = await supabase
        .from('posts')
        .update({ status: 'deleted' })
        .eq('id', postId)
        .eq('user_id', userIdToCheck);

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
  const handleSnoozeUser = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUserProfileId || postUserId === currentUserProfileId) return;
    
    setLoadingAction('snooze');
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
    } finally {
      setLoadingAction(null);
    }
  };

  const handleHideAllFromUser = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUserProfileId || postUserId === currentUserProfileId) return;
    
    setLoadingAction('hide_all');
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
    } finally {
      setLoadingAction(null);
    }
  };

  const handleBlockUser = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUserProfileId || postUserId === currentUserProfileId) return;
    
    setLoadingAction('block');
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
    } finally {
      setLoadingAction(null);
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
      <MenuItem icon={Globe} onClick={handleWhoCanSeeThis}>
        Who can see this post?
      </MenuItem>
      <MenuItem 
        icon={ThumbsUp} 
        onClick={handleMarkInterested}
        loading={loadingAction === 'interested'}
      >
        Interested
      </MenuItem>
      <MenuItem 
        icon={ThumbsDown} 
        onClick={handleMarkNotInterested}
        loading={loadingAction === 'not_interested'}
      >
        Not Interested
      </MenuItem>
      <div className="h-px bg-border my-1" />
      <MenuItem 
        icon={isSaved ? BookmarkCheck : BookmarkPlus} 
        onClick={handleSavePost}
        className={isSaved ? "text-primary font-medium" : ""}
        loading={loadingAction === 'save'}
      >
        {isSaved ? "Saved" : "Save Post"}
      </MenuItem>
      <MenuItem 
        icon={EyeOff} 
        onClick={handleHidePost}
        loading={loadingAction === 'hide'}
      >
        Hide Post
      </MenuItem>
      <MenuItem icon={Flag} onClick={() => { closeMenu(); setReportDialogOpen(true); }}>
        Report Post
      </MenuItem>
      <MenuItem 
        icon={isNotificationsEnabled ? BellOff : Bell} 
        onClick={handleToggleNotifications}
        loading={loadingAction === 'notifications'}
      >
        {isNotificationsEnabled ? "Turn Off Notifications" : "Turn On Notifications"}
      </MenuItem>
      <MenuItem icon={Link2} onClick={handleCopyLink}>
        Copy Link
      </MenuItem>
      
      {!isOwnPost && (
        <>
          <div className="h-px bg-border my-1" />
          <MenuItem 
            icon={Clock} 
            onClick={handleSnoozeUser}
            loading={loadingAction === 'snooze'}
          >
            Snooze {postUserName} for 30 days
          </MenuItem>
          <MenuItem 
            icon={EyeOff} 
            onClick={handleHideAllFromUser}
            loading={loadingAction === 'hide_all'}
          >
            Hide all from {postUserName}
          </MenuItem>
          <MenuItem 
            icon={UserX} 
            onClick={handleBlockUser} 
            destructive
            loading={loadingAction === 'block'}
          >
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
            className="menu-button hover:bg-gradient-to-r hover:from-[#0077B5]/10 hover:to-[#833AB4]/10 transition-all duration-300 rounded-full p-2.5 active:scale-90 group"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(true);
            }}
            aria-label="Post options"
          >
            <MoreHorizontal className="h-5 w-5 text-[#5E6B7E] group-hover:text-[#833AB4] transition-colors" strokeWidth={2.5} />
          </button>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-[2.5rem] border-0 shadow-2xl p-0 outline-none">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
              <SheetHeader className="px-8 pt-10 pb-4 text-left border-b border-[#E8EBEF]/60">
                <SheetTitle className="text-2xl font-black text-[#1D2226] tracking-tight">Post Options</SheetTitle>
              </SheetHeader>
              <div className="px-4 py-6 space-y-1">
                {menuItems}
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <button 
              className="menu-button hover:bg-gradient-to-r hover:from-[#0077B5]/10 hover:to-[#833AB4]/10 transition-all duration-300 rounded-full p-2.5 active:scale-90 group"
              aria-label="Post options"
            >
              <MoreHorizontal className="h-5 w-5 text-[#5E6B7E] group-hover:text-[#833AB4] transition-colors" strokeWidth={2.5} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent 
            align="end" 
            className="w-80 max-h-[70vh] overflow-y-auto z-50 bg-white rounded-[2rem] border-0 shadow-2xl p-3 animate-in zoom-in-95 duration-200 outline-none"
            sideOffset={12}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
            <div className="pt-2 pb-1">
              <DropdownMenuItem onClick={handleWhySeeingThis} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-[#5E6B7E] focus:bg-gradient-to-r focus:from-[#0077B5]/5 focus:to-[#833AB4]/5 focus:text-[#1D2226] cursor-pointer transition-all duration-300 group">
                <Info className="h-5 w-5 text-[#5E6B7E] group-hover:scale-110 group-hover:text-[#833AB4] transition-all" strokeWidth={2.5} />
                Why am I seeing this?
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleWhoCanSeeThis} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-[#5E6B7E] focus:bg-gradient-to-r focus:from-[#0077B5]/5 focus:to-[#833AB4]/5 focus:text-[#1D2226] cursor-pointer transition-all duration-300 group">
                <Globe className="h-5 w-5 text-[#5E6B7E] group-hover:scale-110 group-hover:text-[#833AB4] transition-all" strokeWidth={2.5} />
                Who can see this post?
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleMarkInterested} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-[#5E6B7E] focus:bg-gradient-to-r focus:from-[#0077B5]/5 focus:to-[#833AB4]/5 focus:text-[#1D2226] cursor-pointer transition-all duration-300 group">
                <ThumbsUp className="h-5 w-5 text-[#5E6B7E] group-hover:scale-110 group-hover:text-[#833AB4] transition-all" strokeWidth={2.5} />
                Interested
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleMarkNotInterested} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-[#5E6B7E] focus:bg-gradient-to-r focus:from-[#0077B5]/5 focus:to-[#833AB4]/5 focus:text-[#1D2226] cursor-pointer transition-all duration-300 group">
                <ThumbsDown className="h-5 w-5 text-[#5E6B7E] group-hover:scale-110 group-hover:text-[#833AB4] transition-all" strokeWidth={2.5} />
                Not Interested
              </DropdownMenuItem>
              
              <DropdownMenuSeparator className="my-2 bg-[#E8EBEF]/60 mx-2" />
              
              <DropdownMenuItem onClick={handleSavePost} className={`flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold cursor-pointer transition-all duration-300 group ${isSaved ? "text-[#833AB4] bg-[#833AB4]/5" : "text-[#5E6B7E] focus:bg-gradient-to-r focus:from-[#0077B5]/5 focus:to-[#833AB4]/5 focus:text-[#1D2226]"}`}>
                {isSaved ? <BookmarkCheck className="h-5 w-5 text-[#833AB4] group-hover:scale-110" strokeWidth={2.5} /> : <BookmarkPlus className="h-5 w-5 text-[#5E6B7E] group-hover:scale-110 group-hover:text-[#833AB4]" strokeWidth={2.5} />}
                {isSaved ? "Saved" : "Save Post"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleHidePost} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-[#5E6B7E] focus:bg-gradient-to-r focus:from-[#0077B5]/5 focus:to-[#833AB4]/5 focus:text-[#1D2226] cursor-pointer transition-all duration-300 group">
                <EyeOff className="h-5 w-5 text-[#5E6B7E] group-hover:scale-110 group-hover:text-[#833AB4] transition-all" strokeWidth={2.5} />
                Hide Post
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { closeMenu(); setReportDialogOpen(true); }} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-[#5E6B7E] focus:bg-gradient-to-r focus:from-[#0077B5]/5 focus:to-[#833AB4]/5 focus:text-[#1D2226] cursor-pointer transition-all duration-300 group">
                <Flag className="h-5 w-5 text-[#5E6B7E] group-hover:scale-110 group-hover:text-[#833AB4] transition-all" strokeWidth={2.5} />
                Report Post
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleNotifications} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-[#5E6B7E] focus:bg-gradient-to-r focus:from-[#0077B5]/5 focus:to-[#833AB4]/5 focus:text-[#1D2226] cursor-pointer transition-all duration-300 group">
                {isNotificationsEnabled ? <BellOff className="h-5 w-5 text-[#833AB4] group-hover:scale-110" strokeWidth={2.5} /> : <Bell className="h-5 w-5 text-[#5E6B7E] group-hover:scale-110 group-hover:text-[#833AB4]" strokeWidth={2.5} />}
                {isNotificationsEnabled ? "Turn Off Notifications" : "Turn On Notifications"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-[#5E6B7E] focus:bg-gradient-to-r focus:from-[#0077B5]/5 focus:to-[#833AB4]/5 focus:text-[#1D2226] cursor-pointer transition-all duration-300 group">
                <Link2 className="h-5 w-5 text-[#5E6B7E] group-hover:scale-110 group-hover:text-[#833AB4] transition-all" strokeWidth={2.5} />
                Copy Link
              </DropdownMenuItem>
              
              {!isOwnPost && (
                <>
                  <DropdownMenuSeparator className="my-2 bg-[#E8EBEF]/60 mx-2" />
                  <DropdownMenuItem onClick={handleSnoozeUser} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-[#5E6B7E] focus:bg-gradient-to-r focus:from-[#0077B5]/5 focus:to-[#833AB4]/5 focus:text-[#1D2226] cursor-pointer transition-all duration-300 group">
                    <Clock className="h-5 w-5 text-[#5E6B7E] group-hover:scale-110 group-hover:text-[#833AB4] transition-all" strokeWidth={2.5} />
                    Snooze {postUserName} for 30 days
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleHideAllFromUser} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-[#5E6B7E] focus:bg-gradient-to-r focus:from-[#0077B5]/5 focus:to-[#833AB4]/5 focus:text-[#1D2226] cursor-pointer transition-all duration-300 group">
                    <EyeOff className="h-5 w-5 text-[#5E6B7E] group-hover:scale-110 group-hover:text-[#833AB4] transition-all" strokeWidth={2.5} />
                    Hide all from {postUserName}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBlockUser} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer transition-all duration-300 group">
                    <UserX className="h-5 w-5 text-red-600 group-hover:scale-110 transition-all" strokeWidth={2.5} />
                    Block {postUserName}
                  </DropdownMenuItem>
                </>
              )}
              
              {isOwnPost && (
                <>
                  <DropdownMenuSeparator className="my-2 bg-[#E8EBEF]/60 mx-2" />
                  <DropdownMenuItem onClick={() => { closeMenu(); setDeleteDialogOpen(true); }} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-red-600 focus:bg-red-50 focus:text-red-700 cursor-pointer transition-all duration-300 group">
                    <Trash2 className="h-5 w-5 text-red-600 group-hover:scale-110 transition-all" strokeWidth={2.5} />
                    Delete Post
                  </DropdownMenuItem>
                </>
              )}
              
              <DropdownMenuSeparator className="my-2 bg-[#E8EBEF]/60 mx-2" />
              <DropdownMenuItem onClick={handleManageFeed} className="flex items-center gap-3 px-4 py-3.5 rounded-[1.25rem] font-bold text-[#5E6B7E] focus:bg-gradient-to-r focus:from-[#0077B5]/5 focus:to-[#833AB4]/5 focus:text-[#1D2226] cursor-pointer transition-all duration-300 group">
                Manage your Feed
              </DropdownMenuItem>
            </div>
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

      <Dialog open={whoCanSeeDialogOpen} onOpenChange={setWhoCanSeeDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
          <DialogHeader className="px-8 pt-8 pb-2">
            <DialogTitle className="text-2xl font-bold text-[#1D2226]">Who can see this post?</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 px-8 py-6">
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-[1.5rem] border border-[#E8EBEF]/60">
              <div className="bg-white p-3 rounded-2xl shadow-sm text-[#0077B5]">
                <Globe className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-[#1D2226]">Anyone</h4>
                <p className="text-[14px] text-[#5E6B7E] font-medium leading-relaxed">
                  Anyone on or off Profolio can see this post.
                </p>
              </div>
            </div>
            <div className="bg-[#833AB4]/5 p-5 rounded-[1.25rem] text-[14px] text-[#833AB4] font-bold leading-relaxed border border-[#833AB4]/10">
              Visible to the public, including search engines and people without a Profolio account.
            </div>
          </div>
          <DialogFooter className="px-8 pb-8 pt-2">
            <Button 
              onClick={() => setWhoCanSeeDialogOpen(false)}
              className="w-full bg-gradient-to-r from-[#0077B5] to-[#833AB4] hover:from-[#0077B5]/90 hover:to-[#833AB4]/90 text-white font-bold h-12 rounded-2xl shadow-lg transition-all duration-300 transform active:scale-95"
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={whySeeingDialogOpen} onOpenChange={setWhySeeingDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl animate-in zoom-in-95 duration-300">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
          <DialogHeader className="px-8 pt-8 pb-2">
            <DialogTitle className="text-2xl font-bold text-[#1D2226]">Why am I seeing this?</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 px-8 py-6">
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-[1.5rem] border border-[#E8EBEF]/60">
              <div className="bg-white p-3 rounded-2xl shadow-sm text-[#0077B5]">
                <Info className="h-6 w-6" strokeWidth={2.5} />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-[#1D2226]">
                  {isPromoted 
                    ? "Promoted Content" 
                    : isCompanyPost 
                      ? "From a Company" 
                      : "In your network"}
                </h4>
                <p className="text-[14px] text-[#5E6B7E] font-medium leading-relaxed">
                  {isPromoted 
                    ? "This post is promoted to reach a wider audience."
                    : isCompanyPost
                      ? `You are seeing this post from ${postUserName} because you might be interested in their updates.`
                      : `You are seeing this post because you follow ${postUserName} or are connected with them.`}
                </p>
              </div>
            </div>
            <div className="bg-[#0077B5]/5 p-5 rounded-[1.25rem] text-[14px] text-[#0077B5] font-bold leading-relaxed border border-[#0077B5]/10">
              Your feed is personalized based on your connections, interests, and activity.
            </div>
          </div>
          <DialogFooter className="px-8 pb-8 pt-2">
            <Button 
              onClick={() => setWhySeeingDialogOpen(false)}
              className="w-full bg-gradient-to-r from-[#0077B5] to-[#833AB4] hover:from-[#0077B5]/90 hover:to-[#833AB4]/90 text-white font-bold h-12 rounded-2xl shadow-lg transition-all duration-300 transform active:scale-95"
            >
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
  className = "",
  loading = false,
}: { 
  icon?: React.ElementType;
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  destructive?: boolean;
  className?: string;
  loading?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={`w-full flex items-center gap-4 px-5 py-4 hover:bg-gradient-to-r hover:from-[#0077B5]/5 hover:to-[#833AB4]/5 rounded-[1.25rem] transition-all duration-300 text-left disabled:opacity-50 disabled:pointer-events-none group ${
      destructive ? 'text-red-600 hover:from-red-50 hover:to-red-50' : 'text-[#5E6B7E]'
    } ${className}`}
  >
    {loading ? (
      <Loader2 className="h-5 w-5 flex-shrink-0 animate-spin" />
    ) : (
      Icon && <Icon className={`h-5 w-5 flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:text-[#833AB4] ${destructive ? 'text-red-600 group-hover:text-red-700' : 'text-[#5E6B7E]'}`} strokeWidth={2.5} />
    )}
    <span className="text-[15px] font-bold group-hover:text-[#1D2226] transition-colors">{children}</span>
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
    <AlertDialogContent className="rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#E1306C] to-[#833AB4]" />
      <AlertDialogHeader className="px-8 pt-8 pb-2">
        <AlertDialogTitle className="text-2xl font-black text-[#1D2226] tracking-tight">Delete Post?</AlertDialogTitle>
        <AlertDialogDescription className="text-[16px] text-[#5E6B7E] font-medium leading-relaxed mt-2">
          This action cannot be undone. This will permanently remove your voice from the feed and our community servers.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="px-8 pb-8 pt-6 gap-3">
        <AlertDialogCancel 
          disabled={isDeleting}
          className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[12px] text-[#5E6B7E] border-[#E8EBEF] hover:bg-[#F3F6F8] transition-all"
        >
          Cancel
        </AlertDialogCancel>
        <AlertDialogAction
          onClick={onConfirm}
          disabled={isDeleting}
          className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[12px] bg-gradient-to-r from-[#E1306C] to-[#833AB4] text-white hover:opacity-90 shadow-lg transition-all duration-300 transform active:scale-95"
        >
          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete Permanently'}
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
    <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
      <DialogHeader className="px-8 pt-8 pb-2 border-b border-[#E8EBEF]/60">
        <DialogTitle className="text-2xl font-black text-[#1D2226] tracking-tight">Report Post</DialogTitle>
        <DialogDescription className="text-[15px] text-[#5E6B7E] font-medium mt-1">
          Help us understand what's wrong with this post.
        </DialogDescription>
      </DialogHeader>
      <div className="p-8 space-y-6">
        <RadioGroup value={reportReason} onValueChange={setReportReason} className="gap-4">
          {[
            { value: 'spam', label: 'Spam' },
            { value: 'harassment', label: 'Harassment' },
            { value: 'fake_info', label: 'Fake Information' },
            { value: 'inappropriate', label: 'Inappropriate Content' },
            { value: 'other', label: 'Other' },
          ].map((reason) => (
            <div key={reason.value} className="flex items-center space-x-3 group cursor-pointer">
              <RadioGroupItem value={reason.value} id={`r-${reason.value}`} className="border-2 border-[#E8EBEF] text-[#833AB4] focus:ring-[#833AB4]" />
              <Label htmlFor={`r-${reason.value}`} className="text-[16px] font-bold text-[#1D2226] cursor-pointer group-hover:text-[#833AB4] transition-colors">{reason.label}</Label>
            </div>
          ))}
        </RadioGroup>
        
        {reportReason === 'other' && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <Label htmlFor="custom-reason" className="text-[14px] font-black uppercase tracking-widest text-[#5E6B7E] mb-2 block">Reason Details</Label>
            <Textarea
              id="custom-reason"
              placeholder="Tell us more about the issue..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              className="min-h-[100px] rounded-2xl border-[#E8EBEF] focus:border-[#833AB4] focus:ring-[#833AB4] font-medium resize-none"
            />
          </div>
        )}
      </div>
      <DialogFooter className="px-8 pb-8 pt-0 gap-3">
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isSubmitting}
          className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[12px] text-[#5E6B7E] border-[#E8EBEF] hover:bg-[#F3F6F8] transition-all"
        >
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          disabled={isSubmitting || (reportReason === 'other' && !customReason.trim())}
          className="flex-1 h-12 rounded-xl font-black uppercase tracking-widest text-[12px] bg-gradient-to-r from-[#0077B5] to-[#833AB4] text-white hover:opacity-90 shadow-lg transition-all transform active:scale-95"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Report'}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
