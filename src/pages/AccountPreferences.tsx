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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import React from "react";
import { UpdateEmailDrawer } from "@/components/settings/UpdateEmailDrawer";
import { UpdatePhoneDrawer } from "@/components/settings/UpdatePhoneDrawer";
import { UpdatePasswordDrawer } from "@/components/settings/UpdatePasswordDrawer";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [phoneOpen, setPhoneOpen] = React.useState(false);
  const [passwordOpen, setPasswordOpen] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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
      <div
        className="min-h-screen"
        style={{ background: "radial-gradient(circle at top left, #c7d2fe, #e9d5ff, #bfdbfe)" }}
      >
        {/* Hero */}
        <div className="relative w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-500 rounded-b-3xl py-16 px-8 backdrop-blur-xl bg-white/10 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <Button
                  variant="ghost"
                  className="bg-white rounded-full shadow-md hover:bg-indigo-50 hover:scale-105 transition h-9 px-4"
                  onClick={() => navigate('/settings')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2 text-indigo-600" />
                  Back
                </Button>
                <h1 className="text-white text-3xl md:text-5xl font-extrabold tracking-tight mt-4">
                  Account Preferences
                </h1>
                <p className="text-white/80 text-base md:text-xl mt-2">
                  Manage your account settings, language, and privacy preferences.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto py-8 px-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="flex flex-col space-y-6">
              {/* SECTION 1: Account Information */}
              <Card className="rounded-2xl bg-white/70 backdrop-blur-md shadow-lg border-none overflow-hidden">
                <CardHeader className="px-6 py-6 border-none">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-gray-700" />
                    <CardTitle className="text-lg font-bold text-gray-900">Account Information</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <PreferenceRow 
                    label="Email address" 
                    rightValue={user?.email || ""} 
                    onClick={() => setEmailOpen(true)} 
                  />
                  <PreferenceRow 
                    label="Phone number" 
                    rightValue={profile?.phone || "Not provided"} 
                    onClick={() => setPhoneOpen(true)} 
                  />
                  <PreferenceRow 
                    label="Password" 
                    rightValue="••••••••" 
                    onClick={() => setPasswordOpen(true)} 
                  />
                </CardContent>
              </Card>

              {/* SECTION 2: Localization */}
              <Card className="rounded-2xl bg-white/70 backdrop-blur-md shadow-lg border-none overflow-hidden">
                <CardHeader className="px-6 py-6 border-none">
                  <div className="flex items-center gap-2">
                    <Globe className="h-5 w-5 text-gray-700" />
                    <CardTitle className="text-lg font-bold text-gray-900">Display & Localization</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <VisibilitySelector
                    title="Language"
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
                </CardContent>
              </Card>

              {/* SECTION 3: Content Preferences */}
              <Card className="rounded-2xl bg-white/70 backdrop-blur-md shadow-lg border-none overflow-hidden">
                <CardHeader className="px-6 py-6 border-none">
                  <div className="flex items-center gap-2">
                    <MonitorPlay className="h-5 w-5 text-gray-700" />
                    <CardTitle className="text-lg font-bold text-gray-900">Content Preferences</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <PreferenceRow 
                    label="Autoplay videos" 
                    rightValue={autoplay} 
                    onClick={() => handleNotImplemented("Autoplay videos")} 
                  />
                  <PreferenceToggle 
                    label="Sound effects" 
                    subLabel="Play sounds for notifications and actions"
                    checked={soundEffects}
                    onCheckedChange={handleToggleSound}
                    disabled={isUpdating}
                  />
                  <PreferenceRow 
                    label="Feed preferences" 
                    rightValue={feedPreferences} 
                    onClick={() => handleNotImplemented("Feed preferences")} 
                  />
                </CardContent>
              </Card>

              {/* SECTION 4: Notifications */}
              <Card className="rounded-2xl bg-white/70 backdrop-blur-md shadow-lg border-none overflow-hidden">
                <CardHeader className="px-6 py-6 border-none">
                  <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-gray-700" />
                    <CardTitle className="text-lg font-bold text-gray-900">Notifications</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <PreferenceToggle 
                    label="Job alerts" 
                    subLabel="Get notified about new job matches"
                    checked={notificationSettings.job_alerts}
                    onCheckedChange={(val) => handleNotificationChange('job_alerts', val)}
                    disabled={isUpdating}
                  />
                  <PreferenceToggle 
                    label="Profile views" 
                    subLabel="Notify me when someone views my profile"
                    checked={notificationSettings.profile_views}
                    onCheckedChange={(val) => handleNotificationChange('profile_views', val)}
                    disabled={isUpdating}
                  />
                  <PreferenceToggle 
                    label="Messages" 
                    subLabel="Notify me about new messages"
                    checked={notificationSettings.messages}
                    onCheckedChange={(val) => handleNotificationChange('messages', val)}
                    disabled={isUpdating}
                  />
                  <VisibilitySelector
                    title="Email frequency"
                    description="How often you want to receive emails"
                    value={notificationSettings.email_frequency}
                    options={EMAIL_FREQUENCY_OPTIONS}
                    onChange={(val) => handleNotificationChange('email_frequency', val)}
                    disabled={isUpdating}
                  />
                  <PreferenceToggle 
                    label="Push notifications" 
                    subLabel="Receive alerts on your device"
                    checked={pushNotifications}
                    onCheckedChange={handleTogglePush}
                    disabled={isUpdating}
                  />
                </CardContent>
              </Card>

              {/* SECTION 5: Profile Visibility */}
              <Card className="rounded-2xl bg-white/70 backdrop-blur-md shadow-lg border-none overflow-hidden">
                <CardHeader className="px-6 py-6 border-none">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-gray-700" />
                    <CardTitle className="text-lg font-bold text-gray-900">Profile Visibility</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
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
                </CardContent>
              </Card>

              {/* SECTION 6: Account Actions */}
              <Card className="rounded-2xl bg-white/70 backdrop-blur-md shadow-lg border-none overflow-hidden">
                <CardHeader className="px-6 py-6 border-none">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-gray-700" />
                    <CardTitle className="text-lg font-bold text-gray-900">Account Actions</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
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
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
      <UpdateEmailDrawer open={emailOpen} onOpenChange={setEmailOpen} />
      <UpdatePhoneDrawer open={phoneOpen} onOpenChange={setPhoneOpen} currentPhone={profile?.phone} />
      <UpdatePasswordDrawer open={passwordOpen} onOpenChange={setPasswordOpen} />
    </Layout>
  );
};

export default AccountPreferences;
