import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
} from 'lucide-react';

interface PostOptionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postUserId: string;
  postUserName: string;
  currentUserProfileId: string | null;
  isOwnPost: boolean;
  onDelete?: () => void;
}

export const PostOptionsSheet = ({
  open,
  onOpenChange,
  postId,
  postUserId,
  postUserName,
  currentUserProfileId,
  isOwnPost,
  onDelete,
}: PostOptionsSheetProps) => {
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSavePost = async () => {
    if (!currentUserProfileId) return;
    try {
      const { error } = await supabase.from('saved_posts').insert({
        user_id: currentUserProfileId,
        post_id: postId,
      });
      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Post already saved', variant: 'default' });
        } else {
          throw error;
        }
      } else {
        toast({ title: 'Post saved successfully' });
      }
      onOpenChange(false);
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
      onOpenChange(false);
      window.location.reload();
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
      onOpenChange(false);
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
          toast({ title: 'Notifications already enabled', variant: 'default' });
        } else {
          throw error;
        }
      } else {
        toast({ title: 'Notifications enabled for this post' });
      }
      onOpenChange(false);
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
      onOpenChange(false);
      window.location.reload();
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
      onOpenChange(false);
      window.location.reload();
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
          toast({ title: 'User already blocked', variant: 'default' });
        } else {
          throw error;
        }
      } else {
        toast({ title: `Blocked ${postUserName}` });
      }
      onOpenChange(false);
      window.location.reload();
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
      toast({ title: 'Marked as interested - You\'ll see more posts like this' });
      onOpenChange(false);
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
      toast({ title: 'Marked as not interested - You\'ll see fewer posts like this' });
      onOpenChange(false);
    } catch (err) {
      console.error('Error marking not interested:', err);
      toast({ title: 'Failed to update preference', variant: 'destructive' });
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
      onOpenChange(false);
    } catch (err) {
      console.error('Error submitting report:', err);
      toast({ title: 'Failed to submit report', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhySeeingThis = () => {
    toast({
      title: 'Why am I seeing this post?',
      description: `You follow ${postUserName} or are connected with them.`,
    });
    onOpenChange(false);
  };

  const handleManageFeed = () => {
    onOpenChange(false);
    navigate('/dashboard'); // Could be a dedicated settings page in the future
    toast({ title: 'Feed settings', description: 'Manage your preferences from your profile settings.' });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Post Options</SheetTitle>
          </SheetHeader>
          <div className="space-y-2 mt-6">
            <button
              onClick={handleWhySeeingThis}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left"
            >
              <Info className="h-5 w-5 text-muted-foreground" />
              <span>Why am I seeing this post?</span>
            </button>

            <button
              onClick={handleMarkInterested}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left"
            >
              <ThumbsUp className="h-5 w-5 text-muted-foreground" />
              <span>Interested</span>
            </button>

            <button
              onClick={handleMarkNotInterested}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left"
            >
              <ThumbsDown className="h-5 w-5 text-muted-foreground" />
              <span>Not Interested</span>
            </button>

            <button
              onClick={handleSavePost}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left"
            >
              <BookmarkPlus className="h-5 w-5 text-muted-foreground" />
              <span>Save Post</span>
            </button>

            <button
              onClick={handleHidePost}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left"
            >
              <EyeOff className="h-5 w-5 text-muted-foreground" />
              <span>Hide Post</span>
            </button>

            <button
              onClick={() => setReportDialogOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left"
            >
              <Flag className="h-5 w-5 text-muted-foreground" />
              <span>Report Post</span>
            </button>

            <button
              onClick={handleTurnOnNotifications}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left"
            >
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span>Turn On Notifications for this Post</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left"
            >
              <Link2 className="h-5 w-5 text-muted-foreground" />
              <span>Copy Link</span>
            </button>

            {!isOwnPost && (
              <>
                <button
                  onClick={handleSnoozeUser}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left"
                >
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span>Snooze {postUserName} for 30 days</span>
                </button>

                <button
                  onClick={handleHideAllFromUser}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left"
                >
                  <EyeOff className="h-5 w-5 text-muted-foreground" />
                  <span>Hide all from {postUserName}</span>
                </button>

                <button
                  onClick={handleBlockUser}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-destructive/10 text-destructive rounded-lg transition-colors text-left"
                >
                  <UserX className="h-5 w-5" />
                  <span>Block {postUserName}</span>
                </button>
              </>
            )}

            {isOwnPost && onDelete && (
              <button
                onClick={() => {
                  onOpenChange(false);
                  onDelete();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-destructive/10 text-destructive rounded-lg transition-colors text-left"
              >
                <Trash2 className="h-5 w-5" />
                <span>Delete Post</span>
              </button>
            )}

            <button
              onClick={handleManageFeed}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted rounded-lg transition-colors text-left border-t mt-2 pt-4"
            >
              <span className="font-medium">Manage your Feed</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
        <DialogContent>
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
              onClick={() => setReportDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReportSubmit}
              disabled={!reportReason.trim() || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
