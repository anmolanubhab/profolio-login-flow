import { 
  User, 
  MessageCircle, 
  Award, 
  FileText, 
  Building2, 
  Bookmark, 
  UsersRound, 
  Settings,
  Home,
  Users,
  Briefcase,
  Bell,
  Plus
} from "lucide-react"

export interface NavigationItem {
  title: string;
  url: string;
  icon: React.ElementType;
  variant?: 'default' | 'rainbow'; // For the Post button
}

// The core navigation items that should be visible on both Mobile and Desktop
export const mainNavItems: NavigationItem[] = [
  { title: "Home", url: "/", icon: Home },
  { title: "Connections", url: "/network", icon: Users },
  { title: "Post", url: "/add-post", icon: Plus, variant: 'rainbow' },
  { title: "Jobs", url: "/jobs", icon: Briefcase },
  { title: "Notifications", url: "/notifications", icon: Bell },
];

// Additional navigation items for the Sidebar/Menu
export const secondaryNavItems: NavigationItem[] = [
  { title: "Connect", url: "/connect", icon: MessageCircle },
  { title: "Profile", url: "/profile", icon: User },
  { title: "Certificates", url: "/certificates", icon: Award },
  { title: "Resume", url: "/resume", icon: FileText },
  { title: "Companies", url: "/companies", icon: Building2 },
  { title: "Saved Posts", url: "/saved", icon: Bookmark },
  { title: "Groups", url: "/groups", icon: UsersRound },
  { title: "Settings", url: "/settings", icon: Settings },
];

// Combined list for components that need everything (like a full sidebar)
export const navigationConfig: NavigationItem[] = [
  ...mainNavItems,
  ...secondaryNavItems
];
