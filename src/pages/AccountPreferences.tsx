import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  HelpCircle, 
  ChevronRight,
  User,
  Globe,
  MonitorPlay,
  Bell,
  Eye,
  ShieldAlert
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PreferenceRowProps {
  label: string;
  subLabel?: string;
  rightValue?: string;
  onClick?: () => void;
  hasArrow?: boolean;
}

const PreferenceRow = ({ label, subLabel, rightValue, onClick, hasArrow = true }: PreferenceRowProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-4 py-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors"
  >
    <div className="flex flex-col items-start flex-1 mr-4">
      <span className="text-base font-normal text-gray-900 text-left">{label}</span>
      {subLabel && (
        <span className="text-sm text-gray-500 font-normal text-left mt-0.5">{subLabel}</span>
      )}
    </div>
    <div className="flex items-center gap-2">
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
  <div className="w-full flex items-center justify-between px-4 py-4 bg-white">
    <div className="flex flex-col items-start flex-1 mr-4">
      <span className="text-base font-normal text-gray-900 text-left">{label}</span>
      {subLabel && (
        <span className="text-sm text-gray-500 font-normal text-left mt-0.5">{subLabel}</span>
      )}
    </div>
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
  </div>
);

const SectionTitle = ({ title, icon: Icon }: { title: string, icon?: React.ElementType }) => (
  <div className="px-4 py-4 bg-white flex items-center gap-2">
    {Icon && <Icon className="h-5 w-5 text-gray-700" />}
    <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
  </div>
);

const SectionSeparator = () => (
  <div className="h-2 bg-[#F3F2EF] w-full border-t border-b border-gray-200/50" />
);

interface UserPreferences {
  language?: string;
  region?: string;
  timezone?: string;
  autoplay?: string;
  sound_effects?: boolean;
  feed_preferences?: string;
  email_frequency?: string;
  push_notifications?: boolean;
  story_viewing?: string;
  [key: string]: any;
}

const AccountPreferences = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const handleBack = () => {
    navigate(-1);
  };

  const handleNotImplemented = (feature: string) => {
    toast({
      title: "Coming Soon",
      description: `${feature} settings will be available soon.`,
    });
  };

  // Fetch user profile and preferences
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Mutation to update preferences
  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: UserPreferences) => {
      if (!user?.id) return;
      
      // Merge with existing preferences
      const currentPreferences = (profile?.preferences as UserPreferences) || {};
      const updatedPreferences = { ...currentPreferences, ...newPreferences };

      const { error } = await supabase
        .from("profiles")
        .update({ preferences: updatedPreferences })
        .eq("user_id", user.id);

      if (error) throw error;
      return updatedPreferences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
      toast({
        title: "Preferences updated",
        description: "Your changes have been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update preferences.",
        variant: "destructive",
      });
    },
  });

  const preferences = (profile?.preferences as UserPreferences) || {};
  
  // Default values
  const soundEffects = preferences.sound_effects ?? true;
  const pushNotifications = preferences.push_notifications ?? true;
  const autoplay = preferences.autoplay || "On Mobile Data and Wi-Fi";
  const feedPreferences = preferences.feed_preferences || "Curated";
  const emailFrequency = preferences.email_frequency || "Daily Digest";
  const storyViewing = preferences.story_viewing || "Public";
  
  // Profile visibility is stored in a separate column
  const profileVisibility = profile?.profile_visibility || "Your name & headline";

  const handleToggleSound = (checked: boolean) => {
    updatePreferencesMutation.mutate({ sound_effects: checked });
  };

  const handleTogglePush = (checked: boolean) => {
    updatePreferencesMutation.mutate({ push_notifications: checked });
  };

  return (
    <div className="min-h-screen bg-white pb-8">
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
            Account preferences
          </h1>
          <button
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Help"
            onClick={() => handleNotImplemented("Help Center")}
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
        <div className="flex flex-col">
          {/* SECTION 1: Account Information */}
          <SectionTitle title="Account Information" icon={User} />
          <PreferenceRow 
            label="Phone numbers" 
            onClick={() => handleNotImplemented("Phone numbers")} 
          />
          <PreferenceRow 
            label="Email addresses" 
            onClick={() => handleNotImplemented("Email addresses")} 
          />
          <PreferenceRow 
            label="Verifications" 
            onClick={() => handleNotImplemented("Verifications")} 
          />

          <SectionSeparator />

          {/* SECTION 2: Language & Region */}
          <SectionTitle title="Language & Region" icon={Globe} />
          <PreferenceRow 
            label="App language" 
            rightValue={preferences.language || "English"} 
            onClick={() => handleNotImplemented("App language")} 
          />
          <PreferenceRow 
            label="Region / Country" 
            rightValue={preferences.region || "United States"} 
            onClick={() => handleNotImplemented("Region settings")} 
          />
          <PreferenceRow 
            label="Time zone" 
            rightValue={preferences.timezone || "Pacific Time"} 
            subLabel="Auto-detected"
            onClick={() => handleNotImplemented("Time zone")} 
          />

          <SectionSeparator />

          {/* SECTION 3: Content Preferences */}
          <SectionTitle title="Content Preferences" icon={MonitorPlay} />
          <PreferenceRow 
            label="Autoplay videos" 
            rightValue={autoplay} 
            onClick={() => handleNotImplemented("Autoplay settings")} 
          />
          <PreferenceToggle 
            label="Sound effects" 
            subLabel="In-app sounds"
            checked={soundEffects}
            onCheckedChange={handleToggleSound}
            disabled={updatePreferencesMutation.isPending}
          />
          <PreferenceRow 
            label="Feed preferences" 
            rightValue={feedPreferences} 
            subLabel="What you see in your feed"
            onClick={() => handleNotImplemented("Feed preferences")} 
          />

          <SectionSeparator />

          {/* SECTION 4: Email & Notifications */}
          <SectionTitle title="Email & Notifications" icon={Bell} />
          <PreferenceRow 
            label="Email frequency" 
            rightValue={emailFrequency} 
            onClick={() => handleNotImplemented("Email frequency")} 
          />
          <PreferenceToggle 
            label="Push notifications" 
            checked={pushNotifications}
            onCheckedChange={handleTogglePush}
            disabled={updatePreferencesMutation.isPending}
          />

          <SectionSeparator />

          {/* SECTION 5: Profile Visibility */}
          <SectionTitle title="Profile Visibility" icon={Eye} />
          <PreferenceRow 
            label="Profile viewing options" 
            rightValue={profileVisibility} 
            onClick={() => handleNotImplemented("Profile viewing options")} 
          />
          <PreferenceRow 
            label="Story viewing" 
            rightValue={storyViewing} 
            onClick={() => handleNotImplemented("Story viewing")} 
          />

          <SectionSeparator />

          {/* SECTION 6: Account Actions */}
          <SectionTitle title="Account Actions" icon={ShieldAlert} />
          <PreferenceRow 
            label="Hibernate account" 
            subLabel="Temporary deactivate your account"
            onClick={() => handleNotImplemented("Hibernate account")} 
          />
          <PreferenceRow 
            label="Close account" 
            subLabel="Permanently delete your account"
            onClick={() => handleNotImplemented("Close account")} 
          />
        </div>
      )}
    </div>
  );
};

export default AccountPreferences;
