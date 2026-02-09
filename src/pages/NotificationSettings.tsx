import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PreferenceToggle, SectionTitle, VisibilitySelector } from "@/components/settings/PreferenceComponents";
import { Layout } from "@/components/Layout";

interface NotificationSettings {
  job_alerts: boolean;
  profile_views: boolean;
  messages: boolean;
  email_frequency: 'instant' | 'daily' | 'weekly' | 'never';
}

interface UserPreferences {
  notifications?: NotificationSettings;
  [key: string]: any;
}

const EMAIL_FREQUENCY_OPTIONS = [
  { value: 'instant', label: 'Instant', description: 'Receive emails immediately' },
  { value: 'daily', label: 'Daily digest', description: 'Get a summary once a day' },
  { value: 'weekly', label: 'Weekly digest', description: 'Get a summary once a week' },
  { value: 'never', label: 'Never', description: 'Turn off email notifications' },
];

const NotificationSettings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();

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

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPreferences: UserPreferences) => {
      if (!user?.id) return;
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
      queryClient.invalidateQueries({ queryKey: ["profile-notifications", user?.id] });
      toast({ title: "Preferences updated", description: "Your changes have been saved." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update preferences.", variant: "destructive" });
    },
  });

  const preferences = (profile?.preferences as UserPreferences) || {};
  const notificationSettings: NotificationSettings = preferences.notifications || {
    job_alerts: true,
    profile_views: true,
    messages: true,
    email_frequency: 'daily'
  };

  const handleNotificationChange = (key: keyof NotificationSettings, value: any) => {
    const newNotifications = { ...notificationSettings, [key]: value };
    updatePreferencesMutation.mutate({ notifications: newNotifications });
  };

  const isUpdating = updatePreferencesMutation.isPending;

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="bg-white min-h-screen">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4 border-b border-gray-200">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6 text-gray-600" strokeWidth={1.5} />
          </button>
          <h1 className="text-[17px] font-semibold text-gray-900 flex-1 text-left ml-2">
            Notifications
          </h1>
          <button
            className="p-2 -mr-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Help"
            onClick={() => handleNotImplemented("Help Center")}
          >
            <HelpCircle className="h-6 w-6 text-gray-600 fill-gray-600" strokeWidth={0} />
          </button>
        </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col">
          <SectionTitle title="Notifications" icon={Bell} />
          <PreferenceToggle
            label="Job Alerts"
            subLabel="Get notified about new jobs matching your preferences"
            checked={notificationSettings.job_alerts}
            onCheckedChange={(val) => handleNotificationChange('job_alerts', val)}
            disabled={isUpdating}
          />
          <PreferenceToggle
            label="Profile Views"
            subLabel="See when someone views your profile"
            checked={notificationSettings.profile_views}
            onCheckedChange={(val) => handleNotificationChange('profile_views', val)}
            disabled={isUpdating}
          />
          <PreferenceToggle
            label="Messages"
            subLabel="Get notified when you receive a new message"
            checked={notificationSettings.messages}
            onCheckedChange={(val) => handleNotificationChange('messages', val)}
            disabled={isUpdating}
          />
          
          <VisibilitySelector
            title="Email Frequency"
            description="How often do you want to receive emails?"
            value={notificationSettings.email_frequency}
            options={EMAIL_FREQUENCY_OPTIONS}
            onChange={(val) => handleNotificationChange('email_frequency', val)}
            disabled={isUpdating}
          />
        </div>
      )}
      </div>
    </Layout>
  );
};

export default NotificationSettings;
