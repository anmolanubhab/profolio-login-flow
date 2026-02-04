import { 
  User, 
  MessageCircle, 
  Award, 
  FileText, 
  Building2, 
  Bookmark, 
  UsersRound, 
  Settings 
} from "lucide-react"

export interface NavigationItem {
  title: string;
  url: string;
  icon: React.ElementType;
}

export const navigationConfig: NavigationItem[] = [
  { title: "Profile", url: "/profile", icon: User },
  { title: "Connect", url: "/connect", icon: MessageCircle },
  { title: "Certificates", url: "/certificates", icon: Award },
  { title: "Resume", url: "/resume", icon: FileText },
  { title: "Companies", url: "/companies", icon: Building2 },
  { title: "Saved Posts", url: "/saved", icon: Bookmark },
  { title: "Groups", url: "/groups", icon: UsersRound },
  { title: "Settings", url: "/settings", icon: Settings },
];
