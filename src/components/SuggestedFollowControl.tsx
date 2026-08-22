import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Check, Loader2, Plus } from 'lucide-react';
import { useFollowState, setFollowState } from '@/lib/followStore';

interface SuggestedFollowControlProps {
  // profiles.id for a personal author, companies.id for a company author --
  // never an auth uid, and never mixed across the two (the caller picks
  // which table this targets via `isCompany`).
  targetId: string;
  targetName: string;
  isCompany: boolean;
  currentUserProfileId: string | null;
  initialFollowing: boolean;
}

// Follow/Following control shown on a "Suggested" post card's header. Reuses
// the same followers/company_followers tables and insert/delete pattern
// already used on PublicProfile.tsx and CompanyProfile.tsx -- no new follow
// system, just a compact variant with a LinkedIn-style unfollow confirm.
export function SuggestedFollowControl({
  targetId,
  targetName,
  isCompany,
  currentUserProfileId,
  initialFollowing,
}: SuggestedFollowControlProps) {
  // Author/company-level state shared across every post card for this same
  // target -- following from one post instantly flips every other rendered
  // post by the same author/company, including ones mounted later via
  // infinite scroll, without a full feed refetch. See src/lib/followStore.ts.
  const following = useFollowState(targetId, isCompany, initialFollowing);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();

  const table = isCompany ? 'company_followers' : 'followers';

  const handleFollow = async () => {
    if (!currentUserProfileId || loading) return;
    setLoading(true);
    try {
      const payload = isCompany
        ? { company_id: targetId, user_id: currentUserProfileId }
        : { follower_id: currentUserProfileId, following_id: targetId };
      const { error } = await supabase.from(table).insert(payload);
      if (error && error.code !== '23505') throw error;

      if (!isCompany) {
        // Matches PublicProfile.tsx's follow flow -- notifications RLS only
        // allows client-side inserts for type 'new_follower' when the
        // payload's follower_id is the caller's own profile id.
        await supabase.from('notifications').insert({
          user_id: targetId,
          type: 'new_follower',
          payload: { follower_id: currentUserProfileId },
        });
      }

      setFollowState(targetId, isCompany, true);
      toast({ title: `Following ${targetName}` });
    } catch (err) {
      console.error('Error following:', err);
      // Deliberately do NOT flip the shared state -- stay on "+ Follow" so
      // the UI never claims a follow that didn't persist.
      toast({ title: 'Could not follow', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!currentUserProfileId || loading) return;
    setLoading(true);
    try {
      const query = isCompany
        ? supabase.from('company_followers').delete().eq('company_id', targetId).eq('user_id', currentUserProfileId)
        : supabase.from('followers').delete().eq('follower_id', currentUserProfileId).eq('following_id', targetId);
      const { error } = await query;
      if (error) throw error;

      setFollowState(targetId, isCompany, false);
      setConfirmOpen(false);
      toast({ title: `Unfollowed ${targetName}` });
    } catch (err) {
      console.error('Error unfollowing:', err);
      // Keep the dialog open and the shared state at "following" -- the
      // relationship still exists server-side, so every card must keep
      // saying so.
      toast({ title: 'Could not unfollow', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (!currentUserProfileId) return null;

  return (
    <>
      {following ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 rounded-full text-xs px-3 shrink-0 gap-1 text-muted-foreground"
          disabled={loading}
          onClick={(e) => { e.stopPropagation(); setConfirmOpen(true); }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Following
        </Button>
      ) : (
        <Button
          size="sm"
          className="h-7 rounded-full text-xs px-3 shrink-0 gap-1"
          disabled={loading}
          onClick={(e) => { e.stopPropagation(); handleFollow(); }}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Follow
        </Button>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Unfollow {targetName}</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Stop seeing activity from {targetName} on your feed. They won't be notified that you've unfollowed.
          </DialogDescription>
          <DialogFooter className="sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleUnfollow} disabled={loading}>
              {loading ? 'Unfollowing...' : 'Unfollow'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default SuggestedFollowControl;
