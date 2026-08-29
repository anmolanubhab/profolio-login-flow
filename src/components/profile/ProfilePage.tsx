import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { Lock, ArrowLeft, AlertCircle } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ProfileTabs from "@/components/profile/ProfileTabs";
import { ProfileHeaderCard } from "@/components/profile/ProfileHeaderCard";
import type {
  ConnectionRelationship,
  ProfileContextValue,
  ProfileCounts,
  ProfileRow,
} from "@/components/profile/profileTypes";

type Mode = "self" | "public";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ProfilePageProps {
  mode: Mode;
}

const ProfilePage = ({ mode }: ProfilePageProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userId: routeParam } = useParams<{ userId: string }>();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [viewerProfileId, setViewerProfileId] = useState<string | null>(null);
  const [counts, setCounts] = useState<ProfileCounts>({
    followers: 0,
    following: 0,
    connections: 0,
  });
  const [relationship, setRelationship] = useState<ConnectionRelationship>("none");
  const [isFollowing, setIsFollowing] = useState(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const viewRecordedRef = useRef(false);

  // ---- auth ---------------------------------------------------------------
  useEffect(() => {
    let active = true;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setAuthUser(user);
      setAuthChecked(true);
      if (!user) navigate("/");
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate("/");
  }, [navigate]);

  // ---- load target profile + relationship ------------------------------
  // NOTE: this project tracks the connection graph via `friend_requests`
  // (status accepted = connected); the `connections` table is a parallel
  // system that Notifications.tsx / the rest of the app do not write to, so
  // we key everything off friend_requests to stay consistent.
  const loadRelationshipAndCounts = useCallback(
    async (target: ProfileRow, myProfileId: string | null) => {
      const isOwnProfile = myProfileId != null && myProfileId === target.id;

      // followers / following — followers RLS allows public reads ---------
      const [followersRes, followingRes] = await Promise.all([
        supabase
          .from("followers")
          .select("id", { count: "exact", head: true })
          .eq("following_id", target.id),
        supabase
          .from("followers")
          .select("id", { count: "exact", head: true })
          .eq("follower_id", target.id),
      ]);

      // connections count -------------------------------------------------
      // Owner: count their own accepted friend_requests (RLS lets the
      // participant read those rows). Visitor: ask the visibility-aware
      // RPC, which returns null when they may not see it.
      let connectionsCount: number | null = null;
      if (isOwnProfile) {
        const { count } = await supabase
          .from("friend_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "accepted")
          .or(`sender_id.eq.${target.id},receiver_id.eq.${target.id}`);
        connectionsCount = count ?? 0;
      } else {
        const { data } = await supabase.rpc("get_visible_connections_count", {
          target_profile_id: target.id,
        });
        connectionsCount = typeof data === "number" ? data : null;
      }

      setCounts({
        followers: followersRes.count ?? 0,
        following: followingRes.count ?? 0,
        connections: connectionsCount,
      });

      if (!myProfileId || isOwnProfile) {
        setRelationship(isOwnProfile ? "self" : "none");
        setIsFollowing(false);
        return;
      }

      // relationship via friend_requests (either direction) --------------
      const { data: fr } = await supabase
        .from("friend_requests")
        .select("sender_id, receiver_id, status")
        .or(
          `and(sender_id.eq.${myProfileId},receiver_id.eq.${target.id}),and(sender_id.eq.${target.id},receiver_id.eq.${myProfileId})`
        )
        .maybeSingle();

      if (fr?.status === "accepted") {
        setRelationship("connected");
      } else if (fr?.status === "pending") {
        setRelationship(
          fr.sender_id === myProfileId ? "pending_outgoing" : "pending_incoming"
        );
      } else {
        setRelationship("none");
      }

      const { data: follow } = await supabase
        .from("followers")
        .select("id")
        .eq("follower_id", myProfileId)
        .eq("following_id", target.id)
        .maybeSingle();
      setIsFollowing(Boolean(follow));
    },
    []
  );

  const recordProfileView = useCallback(
    async (targetProfileId: string, myProfileId: string) => {
      if (viewRecordedRef.current) return;
      viewRecordedRef.current = true;
      try {
        // The `on_profile_view` trigger creates the notification; we only
        // upsert the view row here (no manual notification insert).
        await supabase.from("profile_views").upsert(
          {
            viewer_id: myProfileId,
            viewed_profile_id: targetProfileId,
            viewed_at: new Date().toISOString(),
          },
          { onConflict: "viewer_id,viewed_profile_id" }
        );
      } catch (e) {
        // non-fatal
        console.error("recordProfileView failed", e);
      }
    },
    []
  );

  const fetchAll = useCallback(async () => {
    if (!authUser) return;
    setLoading(true);
    setErrorMsg(null);
    setNotFound(false);

    try {
      // my own profile row (also the viewer id) --------------------------
      let myProfile: Pick<ProfileRow, "id"> | null = null;
      {
        const { data } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", authUser.id)
          .maybeSingle();
        myProfile = data;
      }

      // resolve the target ------------------------------------------------
      let target: ProfileRow | null = null;

      if (mode === "self") {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", authUser.id)
          .maybeSingle();
        if (error) throw error;
        target = data;

        if (!target) {
          const { data: created, error: createErr } = await supabase
            .from("profiles")
            .insert({ user_id: authUser.id })
            .select("*")
            .single();
          if (createErr) throw createErr;
          target = created;
        }
        if (!myProfile && target) myProfile = { id: target.id };
      } else {
        const param = routeParam ?? "";
        if (!UUID_RE.test(param)) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        // The param may be either profiles.id (links from search / network)
        // or profiles.user_id (links from post headers). Accept both.
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .or(`id.eq.${param},user_id.eq.${param}`)
          .maybeSingle();
        if (error) throw error;
        target = data;

        if (!target) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        // Viewing yourself via the public route → canonical own page.
        if (target.user_id === authUser.id) {
          navigate("/profile", { replace: true });
          return;
        }
      }

      if (!target) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setProfile(target);
      setViewerProfileId(myProfile?.id ?? null);

      await loadRelationshipAndCounts(target, myProfile?.id ?? null);

      if (mode === "public" && myProfile?.id && myProfile.id !== target.id) {
        void recordProfileView(target.id, myProfile.id);
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load profile";
      setErrorMsg(message);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [
    authUser,
    mode,
    routeParam,
    navigate,
    toast,
    loadRelationshipAndCounts,
    recordProfileView,
  ]);

  useEffect(() => {
    if (authChecked && authUser) void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, authUser, mode, routeParam]);

  const refresh = useCallback(async () => {
    await fetchAll();
  }, [fetchAll]);

  const patchProfile = useCallback((patch: Partial<ProfileRow>) => {
    setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const isOwner = Boolean(
    profile && authUser && profile.user_id === authUser.id
  );

  const isGated = useMemo(() => {
    if (!profile || isOwner) return false;
    if (profile.profile_visibility === "private") return true;
    if (
      profile.profile_visibility === "connections_only" &&
      relationship !== "connected"
    )
      return true;
    return false;
  }, [profile, isOwner, relationship]);

  const ctx: ProfileContextValue | null = useMemo(() => {
    if (!profile) return null;
    return {
      profileId: profile.id,
      targetUserId: profile.user_id,
      profile,
      isOwner,
      viewerProfileId,
      relationship,
      isFollowing,
      counts,
      refresh,
      patchProfile,
    };
  }, [
    profile,
    isOwner,
    viewerProfileId,
    relationship,
    isFollowing,
    counts,
    refresh,
    patchProfile,
  ]);

  // ---- render ----------------------------------------------------------
  if (!authChecked || !authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <Layout user={authUser} onSignOut={handleSignOut}>
      <div className="container mx-auto max-w-4xl">
        {mode === "public" && (
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-3"
            size="sm"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        )}

        {loading && (
          <Card className="mb-6 overflow-hidden border-0 shadow-card">
            <div className="animate-pulse">
              <div className="h-32 sm:h-48 bg-muted" />
              <div className="p-6 space-y-4">
                <div className="-mt-16 h-28 w-28 rounded-full bg-muted border-4 border-card" />
                <div className="h-6 w-1/2 bg-muted rounded" />
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-4 w-1/3 bg-muted rounded" />
              </div>
            </div>
          </Card>
        )}

        {!loading && notFound && (
          <Card className="mb-6 border-0 shadow-card">
            <CardContent className="py-16 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto" />
              <h2 className="text-xl font-semibold">Profile not found</h2>
              <p className="text-muted-foreground text-sm">
                This profile doesn’t exist or is no longer available.
              </p>
              <Button onClick={() => navigate("/dashboard")}>
                Back to dashboard
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !notFound && errorMsg && (
          <Card className="mb-6 border-0 shadow-card">
            <CardContent className="py-16 text-center space-y-3">
              <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
              <h2 className="text-xl font-semibold">Couldn’t load this profile</h2>
              <p className="text-muted-foreground text-sm">{errorMsg}</p>
              <Button onClick={() => void refresh()}>Try again</Button>
            </CardContent>
          </Card>
        )}

        {!loading && !notFound && !errorMsg && ctx && (
          <>
            <ProfileHeaderCard ctx={ctx} gated={isGated} />

            {isGated ? (
              <Card className="border-0 shadow-card">
                <CardContent className="py-16 text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-muted/60 flex items-center justify-center mx-auto">
                    <Lock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold">
                    {profile?.profile_visibility === "private"
                      ? "This profile is private"
                      : "Connections only"}
                  </h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                    {profile?.profile_visibility === "private"
                      ? "The member has chosen to keep their full profile private."
                      : "Connect with this member to see their full profile."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              ctx && (
                <div id="profile-sections" className="scroll-mt-20">
                  <ProfileTabs ctx={ctx} />
                </div>
              )
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default ProfilePage;
