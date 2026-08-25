import { Home, Users, Plus, Bell, User as UserIcon } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // notifications.user_id is a foreign key to profiles.id, not to the
      // auth user id -- querying with the raw auth uid (as this used to)
      // never matches any row, so the badge silently stayed at 0 forever.
      // Resolve the actual profile id first, same as NotificationBell.tsx
      // and the Notifications page already do.
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;
      setAvatarUrl(profile.avatar_url);

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('is_read', false);

      if (!error) {
        setUnreadCount(count || 0);
      }
    };

    fetchUnreadCount();

    // Subscribe to notification changes
    const channel = supabase
      .channel('bottom-nav-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchUnreadCount();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Home / Network / Create / Notifications / Profile -- the five things a
  // mobile user needs one thumb-reach away. Everything else (Jobs,
  // Companies, Groups, Certificates, Resume, Saved Posts) lives behind the
  // hamburger drawer (MobileNavDrawer) reachable from the top mobile header,
  // matching how a professional network keeps its mobile bottom bar to the
  // handful of highest-frequency actions rather than cramming every section in.
  const navItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/dashboard' },
    { id: 'network', icon: Users, label: 'Network', path: '/network' },
    { id: 'add', icon: Plus, label: 'Create', path: '/add-post', isCenter: true },
    { id: 'notifications', icon: Bell, label: 'Alerts', path: '/notifications' },
    { id: 'profile', icon: UserIcon, label: 'Profile', path: '/profile' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border w-full max-w-full"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="relative flex items-center justify-center h-16 px-1 xs:px-2 max-w-md mx-auto w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          if (item.isCenter) {
            return (
              <div key={item.id} className="flex-1 flex justify-center">
                <Button
                  onClick={() => navigate(item.path)}
                  aria-label={item.label}
                  className={cn(
                    "w-14 h-14 rounded-full shadow-lg shadow-primary/25 bg-primary hover:bg-primary/90",
                    "hover:shadow-xl hover:shadow-primary/30 active:scale-95",
                    "transition-all duration-200 ease-out",
                    "border-4 border-background",
                    "-mt-6 relative z-10"
                  )}
                  size="icon"
                >
                  <Icon className="h-6 w-6 text-primary-foreground" />
                </Button>
              </div>
            );
          }

          return (
            <Button
              key={item.id}
              variant="ghost"
              size="icon"
              onClick={() => navigate(item.path)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                "flex-1 flex flex-col items-center justify-center h-16 gap-1 min-w-[44px]",
                "hover:bg-muted/50 active:bg-muted transition-colors duration-150",
                active && "text-primary"
              )}
            >
              <div className="relative">
                {item.id === 'profile' && avatarUrl ? (
                  <Avatar className={cn("h-5 w-5", active && "ring-2 ring-primary ring-offset-1 ring-offset-background rounded-full")}>
                    <AvatarImage src={avatarUrl} />
                    <AvatarFallback><UserIcon className="h-3 w-3" /></AvatarFallback>
                  </Avatar>
                ) : (
                  <Icon className={cn(
                    "h-5 w-5 transition-colors",
                    active ? "text-primary" : "text-muted-foreground"
                  )} />
                )}
                {item.id === 'notifications' && unreadCount > 0 && (
                  <div className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-semibold grid place-items-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;
