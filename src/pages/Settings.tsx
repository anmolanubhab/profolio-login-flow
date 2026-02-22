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
  Briefcase,
  Sparkles
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
  const robotFallbacks = ["/robo.png", "/robot.png", "/ai-bot.png", "https://cdn-icons-png.flaticon.com/512/4712/4712108.png"];
  const [robotIdx, setRobotIdx] = useState(0);

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
    { icon: User, label: "Account preferences", description: "Manage email, phone number, & more", iconBg: "from-blue-400 to-indigo-600", onClick: () => navigate("/settings/account") },
    { icon: Briefcase, label: "Job preferences", description: "Set desired job roles and locations", iconBg: "from-violet-400 to-purple-600", onClick: () => navigate("/jobs/preferences") },
    { icon: Lock, label: "Sign in & security", description: "Set two-factor authentication and passwords", iconBg: "from-sky-400 to-blue-600", onClick: () => navigate("/settings/security") },
    { icon: Eye, label: "Visibility", description: "Control how others see your profile & activity", iconBg: "from-teal-400 to-emerald-600", onClick: () => navigate("/settings/visibility") },
    { icon: Shield, label: "Data privacy", description: "Manage your data visibility and sharing settings", iconBg: "from-indigo-400 to-fuchsia-600", onClick: () => navigate("/settings/privacy") },
    { icon: FileText, label: "Advertising data", description: "Manage how your data is used for ads", iconBg: "from-orange-400 to-rose-500", onClick: () => navigate("/settings/advertising-data") },
    { icon: Bell, label: "Notifications", description: "Choose what alerts you receive", iconBg: "from-amber-400 to-orange-500", onClick: () => navigate("/settings/notifications") },
  ];

  // Secondary links
  const secondaryLinks: { label: string; path: string; icon: React.ElementType; iconBg: string }[] = [
    { label: "Help Center", path: "/resources/help", icon: HelpCircle, iconBg: "from-sky-400 to-blue-600" },
    { label: "Professional Community Policies", path: "/resources/community-policies", icon: Shield, iconBg: "from-indigo-400 to-fuchsia-600" },
    { label: "Privacy Policy", path: "/resources/privacy", icon: Shield, iconBg: "from-emerald-400 to-teal-600" },
    { label: "Accessibility", path: "/resources/accessibility", icon: Eye, iconBg: "from-violet-400 to-purple-600" },
    { label: "Recommendation Transparency", path: "/resources/recommendation-transparency", icon: Eye, iconBg: "from-amber-400 to-orange-500" },
    { label: "User Agreement", path: "/resources/user-agreement", icon: FileText, iconBg: "from-blue-400 to-indigo-600" },
    { label: "End User License Agreement", path: "/resources/eula", icon: FileText, iconBg: "from-rose-400 to-pink-600" },
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
              className="group rounded-full h-10 px-0 relative p-[1px] overflow-hidden border-none transition-transform hover:scale-105 hover:shadow-lg"
              onClick={() => navigate('/profile')}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-100 group-hover:brightness-110" />
              <span className="relative z-10 rounded-full bg-white text-gray-900 px-4 py-2">
                View profile
              </span>
            </Button>
          </div>

          {/* Main Settings List */}
          <div className="mt-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mainSettings.map((item) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="group flex items-center justify-between p-6 bg-white/70 backdrop-blur-md rounded-2xl shadow-md hover:shadow-2xl transition-transform hover:-translate-y-0.5 text-left"
                >
                  <div className="flex items-start gap-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ring-1 ring-white/40 shadow-md bg-gradient-to-br ${(item as any).iconBg} transition-transform duration-200 group-hover:scale-105 group-hover:ring-2`}>
                      <item.icon className="w-6 h-6 text-white transition-colors" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">{item.label}</h3>
                      <p className="text-sm text-gray-500 mt-1">{(item as any).description}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
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
            <div className="flex items-center justify-between mb-3 px-2">
              <h3 className="text-lg font-extrabold bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-blue-500 bg-clip-text text-transparent tracking-wider">Resources</h3>
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-md"
                style={{ background: 'linear-gradient(135deg, #6A11CB 0%, #2575FC 50%, #E1306C 100%)' }}>
                <Sparkles className="h-3 w-3" />
                Quick access
              </span>
            </div>
            <div className="h-1 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 mx-2 mb-4"></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {secondaryLinks.map(({ label, path, icon: Icon, iconBg }) => (
                <button
                  key={label}
                  onClick={() => navigate(path)}
                  className="group relative overflow-hidden flex items-center justify-between p-5 rounded-2xl bg-white/80 backdrop-blur-md shadow-lg ring-1 ring-white/50 hover:ring-indigo-200 transition-transform hover:-translate-y-0.5 text-left"
                >
                  <div className="pointer-events-none absolute -top-6 -left-10 right-0 h-24 bg-gradient-to-r from-indigo-100 via-purple-100 to-blue-100 opacity-0 group-hover:opacity-60 blur-xl"></div>
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${iconBg} ring-1 ring-white/40 shadow-md flex items-center justify-center transition-transform group-hover:scale-105 group-hover:ring-2`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-[#1D2226] group-hover:bg-gradient-to-r group-hover:from-indigo-500 group-hover:via-fuchsia-500 group-hover:to-blue-500 group-hover:bg-clip-text group-hover:text-transparent">
                      {label}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 transition-all group-hover:translate-x-1" />
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
