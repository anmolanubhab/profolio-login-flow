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
    { icon: User, label: "Account preferences", onClick: () => navigate("/settings/account") },
    { icon: Briefcase, label: "Job preferences", onClick: () => navigate("/jobs/preferences") },
    { icon: Lock, label: "Sign in & security", onClick: () => navigate("/settings/security") },
    { icon: Eye, label: "Visibility", onClick: () => navigate("/settings/visibility") },
    { icon: Shield, label: "Data privacy", onClick: () => navigate("/settings/privacy") },
    { icon: FileText, label: "Advertising data", onClick: () => navigate("/settings/advertising-data") },
    { icon: Bell, label: "Notifications", onClick: () => navigate("/settings/notifications") },
  ];

  // Secondary links
  const secondaryLinks = [
    "Help Center",
    "Professional Community Policies",
    "Privacy Policy",
    "Accessibility",
    "Recommendation Transparency",
    "User Agreement",
    "End User License Agreement",
  ];

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="min-h-screen bg-white">
        {/* Universal Page Hero Section */}
        <div className="relative w-full overflow-hidden border-b border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-5 animate-gradient-shift" />
          <div className="max-w-4xl mx-auto py-20 px-4 sm:px-6 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="text-center md:text-left">
                <h1 className="text-4xl md:text-6xl font-extrabold text-[#1D2226] mb-4 tracking-tighter">
                  Settings
                </h1>
                <p className="text-[#5E6B7E] text-lg md:text-2xl font-medium max-w-2xl mx-auto md:mx-0 leading-relaxed">
                  Manage your account preferences and security settings.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto">
          {/* Profile Section */}
          <div className="flex items-center gap-3 px-4 sm:px-6 py-8">
            <Avatar className="h-16 w-16 border-2 border-white shadow-sm">
              <AvatarImage src={avatarUrl || undefined} alt={displayName} referrerPolicy="no-referrer" />
              <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 text-xl font-bold">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{displayName}</h2>
              <p className="text-sm text-gray-500">Professional Account</p>
            </div>
          </div>

          {/* Main Settings List */}
          <div className="px-0 sm:px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-6">
              {mainSettings.map((item, index) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className="flex items-center gap-4 p-4 rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white hover:border-transparent hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group text-left"
                >
                  <div className="h-12 w-12 rounded-xl bg-gray-50 flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-[#0077B5]/10 group-hover:to-[#E1306C]/10 transition-colors">
                    <item.icon className="h-6 w-6 text-gray-600 group-hover:text-[#833AB4] transition-colors" />
                  </div>
                  <span className="text-base font-semibold text-gray-900">{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="px-4 sm:px-6 py-4">
            <Separator className="bg-gray-100" />
          </div>

          {/* Secondary Links */}
          <div className="px-4 sm:px-6 pb-8">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4 px-2">Resources</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {secondaryLinks.map((link) => (
                <button
                  key={link}
                  onClick={() => {}}
                  className="text-left px-4 py-3 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all"
                >
                  {link}
                </button>
              ))}
            </div>
          </div>

          {/* Sign Out */}
          <div className="px-4 sm:px-6 pb-12">
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
