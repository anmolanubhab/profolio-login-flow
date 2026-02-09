import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  HelpCircle, 
  User,
  Globe,
  MonitorPlay,
  Bell,
  Eye,
  ShieldAlert
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PreferenceRow, PreferenceToggle, SectionTitle, SectionSeparator } from "@/components/settings/PreferenceComponents";
import { VisibilitySelector } from "@/components/settings/VisibilitySelector";
import { Layout } from "@/components/Layout";

interface VisibilitySettings {
  profile: 'everyone' | 'connections' | 'recruiters' | 'only_me';
  job_activity: 'recruiters' | 'connections' | 'only_me';
  email: 'connections' | 'recruiters' | 'only_me';
}

interface LocalizationSettings {
  language: string;
  region: string;
}

interface NotificationSettings {
  job_alerts: boolean;
  profile_views: boolean;
  messages: boolean;
  email_frequency: 'instant' | 'daily' | 'weekly' | 'never';
}

interface UserPreferences {
  localization?: LocalizationSettings;
  timezone?: string;
  autoplay?: string;
  sound_effects?: boolean;
  feed_preferences?: string;
  email_frequency?: string;
  push_notifications?: boolean;
  story_viewing?: string;
  profile_visibility?: VisibilitySettings;
  notifications?: NotificationSettings;
  [key: string]: any;
}

const PROFILE_VISIBILITY_OPTIONS = [
  { value: 'everyone', label: 'Everyone', description: 'Your profile is visible to all members and non-members' },
  { value: 'connections', label: 'Connections only', description: 'Your profile is visible only to your connections' },
  { value: 'recruiters', label: 'Recruiters only', description: 'Your profile is visible only to recruiters' },
  { value: 'only_me', label: 'Only me', description: 'No one can see your profile' },
];

const JOB_ACTIVITY_OPTIONS = [
  { value: 'recruiters', label: 'Recruiters only', description: 'Share your job activity with recruiters only' },
  { value: 'connections', label: 'Connections only', description: 'Share your job activity with connections only' },
  { value: 'only_me', label: 'Only me', description: 'Do not share your job activity' },
];

const EMAIL_VISIBILITY_OPTIONS = [
  { value: 'connections', label: 'Connections only', description: 'Only connections can see your email' },
  { value: 'recruiters', label: 'Recruiters only', description: 'Only recruiters can see your email' },
  { value: 'only_me', label: 'Only me', description: 'No one can see your email' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
];

const REGION_OPTIONS = [
  { value: 'IN', label: 'India' },
  { value: 'US', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'ROW', label: 'Other' },
];

const EMAIL_FREQUENCY_OPTIONS = [
  { value: 'instant', label: 'Instant', description: 'Receive emails immediately' },
  { value: 'daily', label: 'Daily digest', description: 'Get a summary once a day' },
  { value: 'weekly', label: 'Weekly digest', description: 'Get a summary once a week' },
  { value: 'never', label: 'Never', description: 'Turn off email notifications' },
];

const AccountPreferences = () => {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

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
      try {
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
      } catch (error) {
        console.error("Profile fetch error:", error);
        return null;
      }
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
      const errorMessage = error.message === 'Failed to fetch' 
        ? 'Network error: Unable to connect to server. Please check your internet connection.' 
        : (error.message || "Failed to update preferences.");

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const preferences = (profile?.preferences as UserPreferences) || {};
  const isUpdating = updatePreferencesMutation.isPending;
  
  // Default values
  const soundEffects = preferences.sound_effects ?? true;
  const pushNotifications = preferences.push_notifications ?? true;
  const autoplay = preferences.autoplay || "On Mobile Data and Wi-Fi";
  const feedPreferences = preferences.feed_preferences || "Curated";
  const storyViewing = preferences.story_viewing || "Public";
  
  // Visibility Settings with defaults
  const visibilitySettings: VisibilitySettings = preferences.profile_visibility || {
    profile: 'everyone',
    job_activity: 'recruiters',
    email: 'connections'
  };

  // Localization Settings with defaults
  const localizationSettings: LocalizationSettings = preferences.localization || {
    language: 'en',
    region: 'IN'
  };

  // Notification Settings with defaults
  const notificationSettings: NotificationSettings = preferences.notifications || {
    job_alerts: true,
    profile_views: true,
    messages: true,
    email_frequency: 'daily'
  };

  const handleToggleSound = (checked: boolean) => {
    updatePreferencesMutation.mutate({ sound_effects: checked });
  };

  const handleTogglePush = (checked: boolean) => {
    updatePreferencesMutation.mutate({ push_notifications: checked });
  };

  const handleNotificationChange = (key: keyof NotificationSettings, value: any) => {
    const newNotifications = { ...notificationSettings, [key]: value };
    updatePreferencesMutation.mutate({
      notifications: newNotifications
    });
  };

  const handleVisibilityChange = (key: keyof VisibilitySettings, value: string) => {
    const newVisibility = { ...visibilitySettings, [key]: value };
    updatePreferencesMutation.mutate({
      profile_visibility: newVisibility
    });
  };

  const handleLocalizationChange = (key: keyof LocalizationSettings, value: string) => {
    const newLocalization = { ...localizationSettings, [key]: value };
    updatePreferencesMutation.mutate({
      localization: newLocalization
    });
  };

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="bg-background min-h-screen">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-muted/50 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <h1 className="text-2xl font-semibold text-foreground">
            Account preferences
          </h1>
          <div className="flex-1" />
          <button
            className="p-2 -mr-2 hover:bg-muted/50 rounded-full transition-colors"
            aria-label="Help"
            onClick={() => handleNotImplemented("Help Center")}
          >
            <HelpCircle className="h-6 w-6 text-foreground fill-foreground" />
          </button>
        </div>

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
          <VisibilitySelector
            title="App language"
            description="Select your preferred language"
            value={localizationSettings.language}
            options={LANGUAGE_OPTIONS}
            onChange={(val) => handleLocalizationChange('language', val)}
            disabled={isUpdating}
          />
          <VisibilitySelector
            title="Region / Country"
            description="Select your region"
            value={localizationSettings.region}
            options={REGION_OPTIONS}
            onChange={(val) => handleLocalizationChange('region', val)}
            disabled={isUpdating}
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
            disabled={isUpdating}
          />
          <PreferenceRow 
            label="Feed preferences" 
            rightValue={feedPreferences} 
            subLabel="What you see in your feed"
            onClick={() => handleNotImplemented("Feed preferences")} 
          />

          <SectionSeparator />

          {/* SECTION 4: Notifications */}
          <SectionTitle title="Notifications" icon={Bell} />
          <VisibilitySelector
            title="Email frequency"
            description="How often you receive emails"
            value={notificationSettings.email_frequency}
            options={EMAIL_FREQUENCY_OPTIONS}
            onChange={(val) => handleNotificationChange('email_frequency', val)}
            disabled={isUpdating}
          />
          <PreferenceToggle
            label="Job alerts"
            subLabel="Get notified about new jobs"
            checked={notificationSettings.job_alerts}
            onCheckedChange={(checked) => handleNotificationChange('job_alerts', checked)}
            disabled={isUpdating}
          />
          <PreferenceToggle
            label="Profile views"
            subLabel="See who viewed your profile"
            checked={notificationSettings.profile_views}
            onCheckedChange={(checked) => handleNotificationChange('profile_views', checked)}
            disabled={isUpdating}
          />
          <PreferenceToggle
            label="Messages"
            subLabel="Direct messages and recruiter outreach"
            checked={notificationSettings.messages}
            onCheckedChange={(checked) => handleNotificationChange('messages', checked)}
            disabled={isUpdating}
          />
          <PreferenceToggle 
            label="Push notifications" 
            checked={pushNotifications}
            onCheckedChange={handleTogglePush}
            disabled={isUpdating}
          />

          <SectionSeparator />

          {/* SECTION 5: Profile Visibility */}
          <SectionTitle title="Profile Visibility" icon={Eye} />
          
          <VisibilitySelector
            title="Profile visibility"
            description="Control who can see your profile"
            value={visibilitySettings.profile}
            options={PROFILE_VISIBILITY_OPTIONS}
            onChange={(val) => handleVisibilityChange('profile', val)}
            disabled={isUpdating}
          />

          <VisibilitySelector
            title="Job activity"
            description="Manage who sees your job activity"
            value={visibilitySettings.job_activity}
            options={JOB_ACTIVITY_OPTIONS}
            onChange={(val) => handleVisibilityChange('job_activity', val)}
            disabled={isUpdating}
          />

          <VisibilitySelector
            title="Email visibility"
            description="Choose who can see your email address"
            value={visibilitySettings.email}
            options={EMAIL_VISIBILITY_OPTIONS}
            onChange={(val) => handleVisibilityChange('email', val)}
            disabled={isUpdating}
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
    </Layout>
  );
};

export default AccountPreferences;
