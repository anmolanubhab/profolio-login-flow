import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { PasskeysDrawer } from "@/components/settings/PasskeysDrawer";
import { SessionsDrawer } from "@/components/settings/SessionsDrawer";
import { TwoFactorDrawer } from "@/components/settings/TwoFactorDrawer";
import { EmailAddressesDrawer } from "@/components/settings/EmailAddressesDrawer";
import { PhoneNumbersDrawer } from "@/components/settings/PhoneNumbersDrawer";
import { UpdatePasswordDrawer } from "@/components/settings/UpdatePasswordDrawer";
import { Button } from "@/components/ui/button";

interface PreferenceRowProps {
  label: string;
  rightValue?: string;
  onClick?: () => void;
  hasArrow?: boolean;
  loading?: boolean;
  disabled?: boolean;
}

const PreferenceRow = ({ label, rightValue, onClick, hasArrow = true, loading = false, disabled = false }: PreferenceRowProps) => (
  <button
    onClick={onClick}
    disabled={disabled || loading}
    className="w-full flex items-center justify-between px-4 py-4 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors border-b border-gray-100 last:border-0 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <span className="text-base font-normal text-gray-900 text-left flex-1">{label}</span>
    <div className="flex items-center gap-2">
      {loading ? (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      ) : (
        <>
          {rightValue && (
            <span className="text-sm text-gray-500 font-normal truncate max-w-[150px] sm:max-w-xs">
              {rightValue}
            </span>
          )}
          {hasArrow && <ChevronRight className="h-5 w-5 text-gray-500" strokeWidth={1.5} />}
        </>
      )}
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
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [changingPassword, setChangingPassword] = useState(false);
  const [passkeysOpen, setPasskeysOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const timersRef = useRef<Record<string, number>>({});

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
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

  const setSavingFor = (key: string, val: boolean) =>
    setSaving(prev => ({ ...prev, [key]: val }));

  const updateColumn = (column: string, value: any) => {
    if (!user?.id) return;
    const prev = (profile as any)?.[column];
    setSavingFor(column, true);
    const existing = timersRef.current[column];
    if (existing) window.clearTimeout(existing);
    timersRef.current[column] = window.setTimeout(async () => {
      try {
        const { error } = await supabase.from("profiles").update({ [column]: value } as any).eq("user_id", user.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["profile-security", user?.id] });
        toast({ title: "Security settings updated successfully" });
        if (column === "remember_devices" && value === false) {
          try {
            const signOutAny = (supabase.auth as any).signOut;
            if (typeof signOutAny === "function") await signOutAny({ scope: "others" });
          } catch {}
        }
      } catch (e: any) {
        toast({ title: "Error", description: e.message || "Failed to update", variant: "destructive" });
        try {
          await supabase.from("profiles").update({ [column]: prev } as any).eq("user_id", user.id);
        } catch {}
      } finally {
        setSavingFor(column, false);
      }
    }, 400);
  };

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

  const twoFactorEnabled = (profile as any)?.two_factor_enabled ?? false;
  const twoFactorType = (profile as any)?.two_factor_type ?? null;
  const appLockEnabled = (profile as any)?.app_lock_enabled ?? false;
  const rememberBrowser = (profile as any)?.remember_browser ?? true;

  const handleNotImplemented = (feature: string) => {
    toast({
      title: "Coming Soon",
      description: `${feature} will be available soon.`,
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
                  Sign in & security
                </h1>
              </div>
            </div>
          </div>
        </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="flex flex-col pb-8 max-w-6xl mx-auto px-6">
          {/* SECTION: Account access */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden mb-6">
            <SectionTitle title="Account access" />
            <PreferenceRow 
              label="Email addresses" 
              rightValue={user?.email || "user@email.com"} 
              onClick={() => setEmailOpen(true)}
            />
            <PreferenceRow 
              label="Phone numbers" 
              onClick={() => setPhoneOpen(true)}
            />
            <PreferenceRow 
              label="Change password" 
              onClick={() => setPasswordOpen(true)}
            />
            <PreferenceRow 
              label="Passkeys" 
              onClick={() => setPasskeysOpen(true)}
            />
            <PreferenceRow 
              label="Where you're signed in" 
              onClick={() => setSessionsOpen(true)}
            />
            <PreferenceToggle
              label="Devices that remember your password"
              subLabel="Allow this browser to stay signed in"
              checked={!!rememberBrowser}
              onCheckedChange={(val) => updateColumn("remember_browser", val)}
              disabled={!!saving["remember_browser"]}
            />
          </div>
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg overflow-hidden">
            <SectionTitle title="Security options" />
            <PreferenceToggle
              label="Two-factor authentication"
              subLabel="Add an extra layer of security"
              checked={twoFactorEnabled}
              onCheckedChange={(val) => {
                if (val) setTwoFactorOpen(true);
                else updateColumn("two_factor_enabled", false);
              }}
              disabled={!!saving["two_factor_enabled"]}
            />
            <PreferenceToggle
              label="App lock"
              subLabel="Require authentication to open the app"
              checked={appLockEnabled}
              onCheckedChange={(val) => updateColumn("app_lock_enabled", val)}
              disabled={!!saving["app_lock_enabled"]}
            />
          </div>
        </div>
      )}
      </div>
      <EmailAddressesDrawer open={emailOpen} onOpenChange={setEmailOpen} />
      <PhoneNumbersDrawer open={phoneOpen} onOpenChange={setPhoneOpen} currentPhone={(profile as any)?.phone} />
      <UpdatePasswordDrawer
        open={passwordOpen}
        onOpenChange={setPasswordOpen}
        onSuccess={async () => {
          try {
            const signOutAny = (supabase.auth as any).signOut;
            if (typeof signOutAny === "function") await signOutAny({ scope: "others" });
          } catch {}
        }}
      />
      <PasskeysDrawer open={passkeysOpen} onOpenChange={setPasskeysOpen} />
      <SessionsDrawer open={sessionsOpen} onOpenChange={setSessionsOpen} />
      <TwoFactorDrawer open={twoFactorOpen} onOpenChange={setTwoFactorOpen} />
    </Layout>
  );
};

export default SignInSecurity;
