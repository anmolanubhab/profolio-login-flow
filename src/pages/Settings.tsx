import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, 
  HelpCircle, 
  User, 
  Lock, 
  Eye, 
  Shield, 
  FileText, 
  Bell,
  LogOut,
  Loader2,
  Briefcase
} from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Layout } from "@/components/Layout";

const APP_VERSION = "1.0.0001";

interface SettingsItemProps {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}

const SettingsItem = ({ icon: Icon, label, onClick }: SettingsItemProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-4 px-4 py-4 hover:bg-muted/50 transition-colors text-left"
  >
    <Icon className="h-6 w-6 text-muted-foreground" />
    <span className="text-base font-medium text-foreground">{label}</span>
  </button>
);

interface LinkItemProps {
  label: string;
  onClick?: () => void;
}

const LinkItem = ({ label, onClick }: LinkItemProps) => (
  <button
    onClick={onClick}
    className="w-full text-left px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
  >
    {label}
  </button>
);

const Settings = () => {
  const { user, signOut, profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    
    setIsSigningOut(true);
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to sign out",
        variant: "destructive",
      });
      setIsSigningOut(false);
    }
  };



  const displayName = profile?.display_name || profile?.full_name || user?.email?.split("@")[0] || "User";
  const avatarUrl = profile?.avatar_url;

  // Main settings options
  const mainSettings = [
    { icon: User, label: "Account preferences", description: "Manage email, phone number, & more", onClick: () => navigate("/settings/account") },
    { icon: Briefcase, label: "Job preferences", description: "Set desired job roles and locations", onClick: () => navigate("/jobs/preferences") },
    { icon: Lock, label: "Sign in & security", description: "Set two-factor authentication and passwords", onClick: () => navigate("/settings/security") },
    { icon: Eye, label: "Visibility", description: "Control how others see your profile & activity", onClick: () => navigate("/settings/visibility") },
    { icon: Shield, label: "Data privacy", description: "Manage your data visibility and sharing settings", onClick: () => navigate("/settings/privacy") },
    { icon: FileText, label: "Advertising data", description: "Manage how your data is used for ads", onClick: () => navigate("/settings/advertising-data") },
    { icon: Bell, label: "Notifications", description: "Choose what alerts you receive", onClick: () => navigate("/settings/notifications") },
  ];

  // Secondary links
  const secondaryLinks: { label: string; path: string }[] = [
    { label: "Help Center", path: "/resources/help" },
    { label: "Professional Community Policies", path: "/resources/community-policies" },
    { label: "Privacy Policy", path: "/resources/privacy" },
    { label: "Accessibility", path: "/resources/accessibility" },
    { label: "Recommendation Transparency", path: "/resources/recommendation-transparency" },
    { label: "User Agreement", path: "/resources/user-agreement" },
    { label: "End User License Agreement", path: "/resources/eula" },
  ];

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
                <h1 className="text-white text-4xl md:text-6xl font-extrabold tracking-tighter">Settings</h1>
                <p className="text-white/80 text-base md:text-xl mt-2">Manage your account preferences and security settings.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6">
          {/* Profile Card */}
          <div className="bg-white/70 backdrop-blur-md rounded-2xl shadow-lg p-6 mt-8 flex items-center gap-4">
            <Avatar className="h-16 w-16 ring-2 ring-white/70 shadow-sm">
              <AvatarImage src={avatarUrl || undefined} alt={displayName} referrerPolicy="no-referrer" />
              <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 text-xl font-bold">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
              <p className="text-sm text-gray-500">Professional Account</p>
            </div>
            <Button 
              variant="outline" 
              className="rounded-full h-10 px-4"
              onClick={() => navigate('/profile')}
            >
              View profile
            </Button>
          </div>

          {/* Main Settings List */}
          <div className="mt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mainSettings.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="flex items-center justify-between p-6 bg-white/70 backdrop-blur-md rounded-2xl shadow-md hover:shadow-lg transition text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-white/60 flex items-center justify-center ring-1 ring-white/50">
                      <item.icon className="w-6 h-6 text-indigo-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{item.label}</h3>
                      <p className="text-sm text-gray-500 mt-1">{(item as any).description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="py-6">
            <Separator className="bg-white/60" />
          </div>

          {/* Secondary Links */}
          <div className="pb-12">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">Resources</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {secondaryLinks.map(({ label, path }) => (
                <button
                  key={label}
                  onClick={() => navigate(path)}
                  className="flex items-center justify-between p-5 rounded-2xl bg-white/70 backdrop-blur-md shadow-lg hover:shadow-2xl transition group text-left"
                >
                  <span className="text-sm font-medium text-[#1D2226]">{label}</span>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          {/* Sign Out */}
          <div className="pb-12">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full md:w-auto px-8 rounded-full font-semibold relative p-[1px] overflow-hidden group border-none h-12">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
                  <div className="flex items-center justify-center w-full h-full bg-white rounded-full relative z-10 px-8 text-gray-900 group-hover:bg-gray-50 transition-colors">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </div>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-2xl font-bold text-gray-900">Sign out</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-500">
                    Are you sure you want to sign out of your account?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3">
                  <AlertDialogCancel className="rounded-full border-gray-200 font-semibold h-11 px-6">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleSignOut} 
                    disabled={isSigningOut}
                    className="rounded-full font-semibold h-11 px-8 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] border-none text-white hover:opacity-90"
                  >
                    {isSigningOut && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign Out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            {/* App Version */}
            <div className="mt-8 text-center md:text-left">
              <p className="text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em]">Version {APP_VERSION}</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;
