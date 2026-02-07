import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
    <span className="text-base font-normal text-gray-900 text-left flex-1">{label}</span>
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

const SectionDivider = () => (
  <div className="h-2 bg-[#F3F2EF] w-full border-t border-b border-gray-200/50" />
);

interface SecurityPreferences {
  two_factor_enabled?: boolean;
  app_lock_enabled?: boolean;
  [key: string]: any;
}

const SignInSecurity = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [changingPassword, setChangingPassword] = useState(false);

  const handleBack = () => {
    navigate(-1);
  };

  // Fetch profile for security preferences
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-security", user?.id],
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

  // Update security preferences
  const updateSecurityMutation = useMutation({
    mutationFn: async (newPrefs: SecurityPreferences) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const currentPrefs = (profile?.preferences as SecurityPreferences) || {};
      const updatedPrefs = { ...currentPrefs, ...newPrefs };

      const { error } = await supabase
        .from("profiles")
        .update({ preferences: updatedPrefs })
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-security", user?.id] });
      toast({
        title: "Settings saved",
        description: "Your security settings have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update security settings.",
        variant: "destructive",
      });
    },
  });

  const handleChangePassword = async () => {
    if (!user?.email) {
      toast({
        title: "Error",
        description: "Email not found. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Password reset email sent",
        description: "Check your email for a link to reset your password.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send password reset email.",
        variant: "destructive",
      });
    } finally {
      setChangingPassword(false);
    }
  };

  const prefs = (profile?.preferences as SecurityPreferences) || {};
  const twoFactorEnabled = prefs.two_factor_enabled ?? false;
  const appLockEnabled = prefs.app_lock_enabled ?? false;

  const handleNotImplemented = (feature: string) => {
    toast({
      title: "Coming Soon",
      description: `${feature} will be available soon.`,
    });
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
            Sign in & security
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
          {/* SECTION: Account access */}
          <SectionTitle title="Account access" />
          
          <PreferenceRow 
            label="Email addresses" 
            rightValue={user?.email || "user@email.com"} 
            onClick={() => handleNotImplemented("Email management")}
          />
          <PreferenceRow 
            label="Phone numbers" 
            onClick={() => handleNotImplemented("Phone numbers")}
          />
          <PreferenceRow 
            label="Change password" 
            onClick={handleChangePassword}
            hasArrow={!changingPassword}
          />
          <PreferenceRow 
            label="Passkeys" 
            onClick={() => handleNotImplemented("Passkeys")}
          />
          <PreferenceRow 
            label="Where you're signed in" 
            onClick={() => handleNotImplemented("Active sessions")}
          />
          <PreferenceRow 
            label="Devices that remember your password" 
            onClick={() => handleNotImplemented("Remembered devices")}
          />
          <PreferenceToggle
            label="Two-factor authentication"
            subLabel="Add an extra layer of security"
            checked={twoFactorEnabled}
            onCheckedChange={(val) => {
              if (val) {
                handleNotImplemented("Two-factor authentication setup");
              } else {
                updateSecurityMutation.mutate({ two_factor_enabled: false });
              }
            }}
            disabled={updateSecurityMutation.isPending}
          />
          <PreferenceToggle
            label="App lock"
            subLabel="Require authentication to open the app"
            checked={appLockEnabled}
            onCheckedChange={(val) => updateSecurityMutation.mutate({ app_lock_enabled: val })}
            disabled={updateSecurityMutation.isPending}
          />
        </div>
      )}
    </div>
  );
};

export default SignInSecurity;
