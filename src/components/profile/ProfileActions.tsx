import { useState } from "react";
import {
  UserPlus,
  UserCheck,
  Clock,
  Check,
  X,
  Loader2,
  Rss,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { rateLimiter, RATE_LIMITS } from "@/lib/rate-limiter";
import { profileDisplayName, type ProfileContextValue } from "@/components/profile/profileTypes";
import { ConnectNoteDialog } from "@/components/network/ConnectNoteDialog";
import {
  connectionErrorMessage,
  respondToConnectionRequest,
  sendConnectionRequest,
  withdrawConnectionRequest,
} from "@/lib/network/connectionApi";

interface ProfileActionsProps {
  ctx: ProfileContextValue;
}

export const ProfileActions = ({ ctx }: ProfileActionsProps) => {
  const { toast } = useToast();
  const {
    profile,
    profileId,
    viewerProfileId,
    relationship,
    isFollowing,
    refresh,
  } = ctx;
  const [busy, setBusy] = useState<null | string>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const name = profileDisplayName(profile);

  const guardViewer = () => {
    if (!viewerProfileId) {
      toast({
        title: "Sign in required",
        description: "You need a profile to do that.",
        variant: "destructive",
      });
      return false;
    }
    return true;
  };

  const startConnect = () => {
    if (!guardViewer()) return;
    if (
      rateLimiter.isRateLimited(
        `friend_request_${viewerProfileId}`,
        RATE_LIMITS.MESSAGE_SEND
      )
    ) {
      const secs = Math.ceil(
        rateLimiter.getTimeUntilReset(`friend_request_${viewerProfileId}`) / 1000
      );
      toast({
        title: "Slow down",
        description: `Wait ${secs}s before sending another invitation.`,
        variant: "destructive",
      });
      return;
    }
    setNoteOpen(true);
  };

  const sendConnect = async (note: string | null) => {
    setNoteOpen(false);
    setBusy("connect");
    try {
      const result = await sendConnectionRequest(profileId, note);
      toast({
        title: result === "connected" ? "Connected" : "Invitation sent",
        description:
          result === "connected"
            ? `You are now connected with ${name}.`
            : `Invitation sent to ${name}.`,
      });
      await refresh();
    } catch (err) {
      toast({
        title: "Couldn’t send invitation",
        description: connectionErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async () => {
    if (!guardViewer()) return;
    setWithdrawOpen(false);
    setBusy("withdraw");
    try {
      const { data: req } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("sender_id", viewerProfileId!)
        .eq("receiver_id", profileId)
        .eq("status", "pending")
        .maybeSingle();
      if (req) await withdrawConnectionRequest(req.id);
      toast({ title: "Invitation withdrawn" });
      await refresh();
    } catch (err) {
      toast({
        title: "Couldn’t withdraw",
        description: connectionErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const respond = async (accept: boolean) => {
    if (!guardViewer()) return;
    setBusy(accept ? "accept" : "ignore");
    try {
      const { data: req, error: findErr } = await supabase
        .from("friend_requests")
        .select("id")
        .eq("sender_id", profileId)
        .eq("receiver_id", viewerProfileId!)
        .eq("status", "pending")
        .maybeSingle();
      if (findErr) throw findErr;
      if (!req) {
        await refresh();
        return;
      }
      await respondToConnectionRequest(req.id, accept);
      toast({ title: accept ? "Connected" : "Invitation ignored" });
      await refresh();
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: connectionErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const toggleFollow = async () => {
    if (!guardViewer()) return;
    setBusy("follow");
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from("followers")
          .delete()
          .eq("follower_id", viewerProfileId!)
          .eq("following_id", profileId);
        if (error) throw error;
        toast({ title: `Unfollowed ${name}` });
      } else {
        const { error } = await supabase.from("followers").insert({
          follower_id: viewerProfileId!,
          following_id: profileId,
        });
        if (error) throw error;
        await supabase.from("notifications").insert({
          user_id: profileId,
          type: "new_follower",
          payload: { follower_id: viewerProfileId },
        });
        toast({ title: `Following ${name}` });
      }
      await refresh();
    } catch (err) {
      toast({
        title: "Couldn’t update follow",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {relationship === "none" && (
        <Button onClick={startConnect} disabled={busy !== null} className="gap-2">
          {busy === "connect" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Connect
        </Button>
      )}

      {relationship === "pending_outgoing" && (
        <Button
          variant="outline"
          disabled={busy !== null}
          className="gap-2"
          onClick={() => setWithdrawOpen(true)}
        >
          <Clock className="h-4 w-4" />
          Pending
        </Button>
      )}

      {relationship === "pending_incoming" && (
        <>
          <Button
            onClick={() => respond(true)}
            disabled={busy !== null}
            className="gap-2"
          >
            {busy === "accept" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Accept
          </Button>
          <Button
            variant="outline"
            onClick={() => respond(false)}
            disabled={busy !== null}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Ignore
          </Button>
        </>
      )}

      {relationship === "connected" && (
        <Button variant="outline" disabled className="gap-2">
          <UserCheck className="h-4 w-4" />
          Connected
        </Button>
      )}

      <Button
        variant={isFollowing ? "secondary" : "outline"}
        onClick={toggleFollow}
        disabled={busy !== null}
        className="gap-2"
      >
        {busy === "follow" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Rss className="h-4 w-4" />
        )}
        {isFollowing ? "Following" : "Follow"}
      </Button>

      <ConnectNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        personName={name}
        onSend={sendConnect}
        sending={busy === "connect"}
      />

      <AlertDialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw invitation to {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won't be notified. You can send a new invitation later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={withdraw}>Withdraw</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProfileActions;
