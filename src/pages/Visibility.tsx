import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PreferenceRowProps {
  label: string;
  rightValue?: string;
  onClick?: () => void;
  hasArrow?: boolean;
}

const PreferenceRow = ({ label, rightValue, onClick, hasArrow = true }: PreferenceRowProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-4 py-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 last:border-0"
  >
    <span className="text-base font-normal text-gray-900 text-left flex-1 pr-4">{label}</span>
    <div className="flex items-center gap-2 shrink-0">
      {rightValue && (
        <span className="text-sm text-gray-500 font-normal truncate max-w-[150px] sm:max-w-xs">
          {rightValue}
        </span>
      )}
      {hasArrow && <ChevronRight className="h-5 w-5 text-gray-500" strokeWidth={1.5} />}
    </div>
  </button>
);

interface PreferenceToggleProps {
  label: string;
  subLabel?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}

const PreferenceToggle = ({ label, subLabel, checked, onCheckedChange, disabled }: PreferenceToggleProps) => (
  <div className="w-full flex items-center justify-between px-4 py-4 bg-white border-b border-gray-100">
    <div className="flex flex-col items-start flex-1 mr-4">
      <span className="text-base font-normal text-gray-900 text-left">{label}</span>
      {subLabel && (
        <span className="text-sm text-gray-500 font-normal text-left mt-0.5">{subLabel}</span>
      )}
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

const SectionTitle = ({ title }: { title: string }) => (
  <div className="px-4 py-4 bg-white">
    <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
  </div>
);

const SectionSeparator = () => (
  <div className="h-2 bg-[#F3F2EF] w-full border-t border-b border-gray-200/50" />
);

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
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleBack = () => {
    navigate(-1);
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

  // Update visibility mutation
  const updateVisibilityMutation = useMutation({
    mutationFn: async (updates: { profile_visibility?: string; preferences?: VisibilityPreferences }) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const updateData: any = {};
      
      if (updates.profile_visibility) {
        updateData.profile_visibility = updates.profile_visibility;
      }
      
      if (updates.preferences) {
        const currentPrefs = (profile?.preferences as VisibilityPreferences) || {};
        updateData.preferences = { ...currentPrefs, ...updates.preferences };
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-visibility", user?.id] });
      toast({
        title: "Settings saved",
        description: "Your visibility preferences have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update visibility settings.",
        variant: "destructive",
      });
    },
  });

  const prefs = (profile?.preferences as VisibilityPreferences) || {};
  
  // Default values
  const pageVisitVisibility = prefs.page_visit_visibility ?? true;
  const connectionsVisible = prefs.connections_visible ?? true;
  const shareJobChanges = prefs.share_job_changes ?? true;
  const newsNotify = prefs.news_notify_connections ?? true;
  const mentionedByOthers = prefs.mentioned_by_others ?? true;
  const profileVisibility = profile?.profile_visibility || "public";

  const handleToggle = (key: string, value: boolean) => {
    updateVisibilityMutation.mutate({ preferences: { [key]: value } });
  };

  const handleProfileVisibilityChange = (visibility: string) => {
    updateVisibilityMutation.mutate({ profile_visibility: visibility });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between px-2 h-[52px]">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" strokeWidth={1.5} />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 flex-1 text-left ml-2">
            Visibility
          </h1>
          <button
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="h-6 w-6 text-gray-600 fill-gray-600" strokeWidth={0} />
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col pb-8">
          {/* SECTION 1: Visibility of your profile & network */}
          <SectionTitle title="Visibility of your profile & network" />
          
          <PreferenceRow 
            label="Profile viewing options" 
            rightValue={profileVisibility === "public" ? "Public" : profileVisibility === "connections_only" ? "Connections only" : "Private"} 
            onClick={() => {
              const next = profileVisibility === "public" ? "connections_only" : profileVisibility === "connections_only" ? "private" : "public";
              handleProfileVisibilityChange(next);
            }}
          />
          <PreferenceToggle 
            label="Page visit visibility"
            subLabel="Let others know when you view their profile"
            checked={pageVisitVisibility}
            onCheckedChange={(val) => handleToggle("page_visit_visibility", val)}
            disabled={updateVisibilityMutation.isPending}
          />
          <PreferenceRow label="Edit your public profile" />
          <PreferenceRow label="Who can see or download your email address" />
          <PreferenceToggle 
            label="Who can see your connections"
            checked={connectionsVisible}
            onCheckedChange={(val) => handleToggle("connections_visible", val)}
            disabled={updateVisibilityMutation.isPending}
          />
          <PreferenceRow 
            label="Who can see members you follow" 
            rightValue="Anyone on Profolio" 
          />
          <PreferenceRow label="Who can see your last name" />
          <PreferenceRow label="Profile discovery and visibility off Profolio" />
          <PreferenceRow 
            label="Profile discovery using email address" 
            rightValue="Anyone" 
          />
          <PreferenceRow 
            label="Profile discovery using phone number" 
            rightValue="Everyone" 
          />
          <PreferenceRow label="Blocked members" />

          <SectionSeparator />

          {/* SECTION 2: Visibility of your activity */}
          <SectionTitle title="Visibility of your activity" />
          
          <PreferenceRow 
            label="Manage active status" 
            rightValue="Your connections" 
          />
          <PreferenceToggle 
            label="Share job changes, education changes"
            subLabel="From your profile"
            checked={shareJobChanges}
            onCheckedChange={(val) => handleToggle("share_job_changes", val)}
            disabled={updateVisibilityMutation.isPending}
          />
          <PreferenceToggle 
            label="Notify connections when you're in the news"
            checked={newsNotify}
            onCheckedChange={(val) => handleToggle("news_notify_connections", val)}
            disabled={updateVisibilityMutation.isPending}
          />
          <PreferenceToggle 
            label="Mentioned by others"
            checked={mentionedByOthers}
            onCheckedChange={(val) => handleToggle("mentioned_by_others", val)}
            disabled={updateVisibilityMutation.isPending}
          />
          <PreferenceRow label="Followers" />
        </div>
      )}
    </div>
  );
};

export default Visibility;
