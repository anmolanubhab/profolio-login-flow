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
  LogOut
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

  const handleSignOut = async () => {
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
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  const displayName = profile?.display_name || profile?.full_name || user?.email?.split("@")[0] || "User";
  const avatarUrl = profile?.avatar_url;

  // Main settings options
  const mainSettings = [
    { icon: User, label: "Account preferences", onClick: () => navigate("/settings/account") },
    { icon: Lock, label: "Sign in & security", onClick: () => navigate("/settings/security") },
    { icon: Eye, label: "Visibility", onClick: () => navigate("/settings/visibility") },
    { icon: Shield, label: "Data privacy", onClick: () => navigate("/settings/privacy") },
    { icon: FileText, label: "Advertising data", onClick: () => navigate("/settings/advertising-data") },
    { icon: Bell, label: "Notifications", onClick: () => navigate("/notifications") },
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-muted/50 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <button
            className="p-2 -mr-2 hover:bg-muted/50 rounded-full transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="h-6 w-6 text-foreground fill-foreground" />
          </button>
        </div>
      </header>

      {/* Profile Section */}
      <div className="flex items-center gap-3 px-4 py-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={avatarUrl || undefined} alt={displayName} />
          <AvatarFallback className="bg-primary text-primary-foreground text-lg">
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      </div>

      {/* Main Settings List */}
      <div className="bg-background">
        {mainSettings.map((item, index) => (
          <SettingsItem
            key={item.label}
            icon={item.icon}
            label={item.label}
            onClick={item.onClick}
          />
        ))}
      </div>

      {/* Divider */}
      <Separator className="my-2" />

      {/* Secondary Links */}
      <div className="bg-background">
        {secondaryLinks.map((link) => (
          <LinkItem key={link} label={link} onClick={() => {}} />
        ))}
      </div>

      {/* Sign Out */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-muted/50 transition-colors">
            Sign Out
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to sign out of your account?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>Sign Out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* App Version */}
      <div className="px-4 py-6">
        <p className="text-xs text-muted-foreground">VERSION: {APP_VERSION}</p>
      </div>
    </div>
  );
};

export default Settings;
