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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { rateLimiter, RATE_LIMITS } from "@/lib/rate-limiter";
import { profileDisplayName, type ProfileContextValue } from "@/components/profile/profileTypes";

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

  const connect = async () => {
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
        description: `Wait ${secs}s before sending another request.`,
        variant: "destructive",
      });
      return;
    }
    setBusy("connect");
    try {
      const { error } = await supabase.from("friend_requests").insert({
        sender_id: viewerProfileId!,
        receiver_id: profileId,
        status: "pending",
      });
      if (error) throw error;
      await supabase.from("notifications").insert({
        user_id: profileId,
        type: "friend_request",
        payload: { sender_id: viewerProfileId },
      });
      toast({ title: "Request sent" });
      await refresh();
    } catch (err) {
      toast({
        title: "Couldn’t send request",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  const withdraw = async () => {
    if (!guardViewer()) return;
    setBusy("withdraw");
    try {
      const { error } = await supabase
        .from("friend_requests")
        .delete()
        .eq("sender_id", viewerProfileId!)
        .eq("receiver_id", profileId)
        .eq("status", "pending");
      if (error) throw error;
      toast({ title: "Request withdrawn" });
      await refresh();
    } catch (err) {
      toast({
        title: "Couldn’t withdraw",
        description: err instanceof Error ? err.message : "Please try again",
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

      // Match Notifications.tsx: accepting a connection is just a status
      // change on friend_requests. We do NOT write to the parallel
      // `connections` table (unused by the app, and its INSERT trigger
      // would emit a wrong-typed notification).
      const { error: updErr } = await supabase
        .from("friend_requests")
        .update({ status: accept ? "accepted" : "rejected" })
        .eq("id", req.id);
      if (updErr) throw updErr;

      toast({ title: accept ? "Connected" : "Request ignored" });
      await refresh();
    } catch (err) {
      toast({
        title: "Something went wrong",
        description: err instanceof Error ? err.message : "Please try again",
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
        <Button onClick={connect} disabled={busy !== null} className="gap-2">
          {busy === "connect" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Connect
        </Button>
      )}

      {relationship === "pending_outgoing" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" disabled={busy !== null} className="gap-2">
              <Clock className="h-4 w-4" />
              Pending
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={withdraw}>
              <X className="h-4 w-4 mr-2" />
              Withdraw request
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
    </div>
  );
};

export default ProfileActions;
