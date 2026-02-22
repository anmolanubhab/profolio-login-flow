import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PreferenceToggle, SectionTitle } from "@/components/settings/PreferenceComponents";
import { VisibilitySelector } from "@/components/settings/VisibilitySelector";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";

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
      <div
        className="min-h-screen"
        style={{ background: "radial-gradient(1000px 300px at 0% 0%, #e9d5ff 0%, #fce7f3 40%, #dbeafe 80%)" }}
      >
        {/* Hero */}
        <div className="relative w-full bg-gradient-to-r from-indigo-300 via-pink-200 to-blue-200 rounded-b-3xl py-16 px-8 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <Button
                  variant="ghost"
                  className="bg-white rounded-full shadow-md hover:bg-gray-100 hover:scale-105 transition h-9 px-4"
                  onClick={() => navigate('/settings')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2 text-indigo-600" />
                  Back
                </Button>
                <h1 className="text-[#1D2226] text-3xl md:text-5xl font-extrabold tracking-tight mt-4">
                  Notifications
                </h1>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -top-20 -right-32 w-[400px] h-[400px] bg-white/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-16 w-[300px] h-[300px] bg-white/20 rounded-full blur-3xl" />
          </div>
        </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col max-w-6xl mx-auto px-6">
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden">
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
        </div>
      )}
      </div>
    </Layout>
  );
};

export default NotificationSettings;
