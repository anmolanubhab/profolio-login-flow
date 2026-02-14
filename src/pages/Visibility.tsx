import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { VisibilitySelector } from "@/components/settings/VisibilitySelector";
import { PreferenceRow, PreferenceToggle, SectionSeparator, SectionTitle } from "@/components/settings/PreferenceComponents";

interface VisibilityPreferences {
  profile_viewing?: string;
  page_visit_visibility?: boolean;
  connections_visible?: boolean;
  followers_visible?: boolean;
  active_status?: string;
  share_job_changes?: boolean;
  news_notify_connections?: boolean;
  mentioned_by_others?: boolean;
  [key: string]: any;
}

const Visibility = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [local, setLocal] = useState<any | null>(null);
  const timersRef = useRef<Record<string, number>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Fetch user profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-visibility", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error) {
        console.error("Profile fetch error:", error);
        return null;
      }
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile) setLocal(profile);
  }, [profile]);
  
  const prefs = ((local?.preferences ?? profile?.preferences) as VisibilityPreferences) || {};
  const isUpdating = Object.values(saving).some(Boolean);
  
  // Default values
  const profileViewVisibility = local?.profile_view_visibility ?? "public";
  const emailVisibility = local?.email_visibility ?? "only_me";
  const connectionsVisibility = local?.connections_visibility ?? "connections";
  const followingVisibility = local?.following_visibility ?? "anyone";
  const lastnameVisibility = local?.lastname_visibility ?? "connections";
  const discoveryByEmail = local?.discovery_by_email ?? true;
  const discoveryByPhone = local?.discovery_by_phone ?? true;
  const activeStatusVisibility = local?.active_status_visibility ?? "connections";
  const shareJobChanges = local?.notify_job_changes ?? true;
  const newsNotify = local?.notify_news ?? true;
  const mentionedByOthers = local?.allow_mentions ?? true;
  const allowFollowers = local?.allow_followers ?? true;
  const followerVisibility = local?.follower_visibility ?? "everyone";

  const setSavingFor = (key: string, val: boolean) =>
    setSaving(prev => ({ ...prev, [key]: val }));

  const updateColumn = (column: string, value: any) => {
    if (!user?.id) return;
    const prev = local?.[column];
    setLocal((l: any) => ({ ...(l || {}), [column]: value }));
    setSavingFor(column, true);
    const existing = timersRef.current[column];
    if (existing) window.clearTimeout(existing);
    timersRef.current[column] = window.setTimeout(async () => {
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ [column]: value } as any)
          .eq("user_id", user.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["profile-visibility", user?.id] });
        toast({ title: "Visibility settings updated" });
      } catch (e: any) {
        // rollback
        setLocal((l: any) => ({ ...(l || {}), [column]: prev }));
        toast({ title: "Error", description: e.message || "Failed to update setting.", variant: "destructive" });
      } finally {
        setSavingFor(column, false);
      }
    }, 400);
  };

  const handleNotImplemented = (feature: string) => {
    toast({
      title: "Coming Soon",
      description: `${feature} will be available soon.`,
    });
  };

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="bg-background min-h-screen pt-4">
        {/* Title */}
        <div className="px-4 pb-4">
          <h1 className="text-2xl font-semibold text-foreground">
            Visibility
          </h1>
        </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col pb-8">
          {/* SECTION 1: Visibility of your profile & network */}
          <SectionTitle title="Visibility of your profile & network" />
          
          <VisibilitySelector
            title="Profile viewing options"
            description="Choose who can see your profile when they visit"
            value={profileViewVisibility}
            options={[
              { value: "public", label: "Public" },
              { value: "connections", label: "Connections only" },
              { value: "private", label: "Private" },
            ]}
            onChange={(val) => updateColumn("profile_view_visibility", val)}
            disabled={saving["profile_view_visibility"] === true}
          />
          <VisibilitySelector
            title="Who can see or download your email address"
            value={emailVisibility}
            options={[
              { value: "only_me", label: "Only me" },
              { value: "connections", label: "Connections" },
              { value: "public", label: "Public" },
            ]}
            onChange={(val) => updateColumn("email_visibility", val)}
            disabled={saving["email_visibility"] === true}
          />
          <VisibilitySelector
            title="Who can see your connections"
            value={connectionsVisibility}
            options={[
              { value: "only_me", label: "Only me" },
              { value: "connections", label: "Connections" },
              { value: "public", label: "Public" },
            ]}
            onChange={(val) => updateColumn("connections_visibility", val)}
            disabled={saving["connections_visibility"] === true}
          />
          <VisibilitySelector
            title="Who can see members you follow"
            value={followingVisibility}
            options={[
              { value: "only_me", label: "Only me" },
              { value: "connections", label: "Connections" },
              { value: "anyone", label: "Anyone on Profolio" },
            ]}
            onChange={(val) => updateColumn("following_visibility", val)}
            disabled={saving["following_visibility"] === true}
          />
          <VisibilitySelector
            title="Who can see your last name"
            value={lastnameVisibility}
            options={[
              { value: "only_me", label: "Only me" },
              { value: "connections", label: "Connections" },
              { value: "public", label: "Public" },
            ]}
            onChange={(val) => updateColumn("lastname_visibility", val)}
            disabled={saving["lastname_visibility"] === true}
          />
          <PreferenceToggle
            label="Profile discovery using email address"
            checked={!!discoveryByEmail}
            onCheckedChange={(val) => updateColumn("discovery_by_email", val)}
            disabled={saving["discovery_by_email"] === true}
            isSaving={saving["discovery_by_email"]}
          />
          <PreferenceToggle
            label="Profile discovery using phone number"
            checked={!!discoveryByPhone}
            onCheckedChange={(val) => updateColumn("discovery_by_phone", val)}
            disabled={saving["discovery_by_phone"] === true}
            isSaving={saving["discovery_by_phone"]}
          />
          <PreferenceRow label="Blocked members" hasArrow />

          <SectionSeparator />

          {/* SECTION 2: Visibility of your activity */}
          <SectionTitle title="Visibility of your activity" />
          
          <VisibilitySelector
            title="Manage active status"
            description="Control who sees when you're active"
            value={activeStatusVisibility}
            options={[
              { value: "no_one", label: "No one" },
              { value: "connections", label: "Connections" },
              { value: "everyone", label: "Everyone" },
            ]}
            onChange={(val) => updateColumn("active_status_visibility", val)}
            disabled={saving["active_status_visibility"] === true}
          />
          <PreferenceToggle 
            label="Share job changes" 
            subLabel="Notify connections when you start a new job"
            checked={shareJobChanges}
            onCheckedChange={(val) => updateColumn("notify_job_changes", val)}
            disabled={saving["notify_job_changes"] === true}
            isSaving={saving["notify_job_changes"]}
          />
          <PreferenceToggle 
            label="News notify connections" 
            subLabel="Notify connections when you're in the news"
            checked={newsNotify}
            onCheckedChange={(val) => updateColumn("notify_news", val)}
            disabled={saving["notify_news"] === true}
            isSaving={saving["notify_news"]}
          />
          <PreferenceToggle 
            label="Mentions by others" 
            subLabel="Allow others to mention you in posts"
            checked={mentionedByOthers}
            onCheckedChange={(val) => updateColumn("allow_mentions", val)}
            disabled={saving["allow_mentions"] === true}
            isSaving={saving["allow_mentions"]}
          />
          <SectionTitle title="Followers" />
          <PreferenceToggle
            label="Allow followers"
            checked={!!allowFollowers}
            onCheckedChange={(val) => updateColumn("allow_followers", val)}
            disabled={saving["allow_followers"] === true}
            isSaving={saving["allow_followers"]}
          />
          <VisibilitySelector
            title="Follower visibility"
            description="Who can follow you"
            value={followerVisibility}
            options={[
              { value: "everyone", label: "Everyone can follow" },
              { value: "connections", label: "Only connections can follow" },
            ]}
            onChange={(val) => updateColumn("follower_visibility", val)}
            disabled={!allowFollowers || saving["follower_visibility"] === true}
          />
        </div>
      )}
      </div>
    </Layout>
  );
};

export default Visibility;
