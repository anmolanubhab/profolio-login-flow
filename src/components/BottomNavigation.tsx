import { Home, Users, Plus, Bell, Briefcase } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface BottomNavigationProps {
  visible?: boolean;
}

const BottomNavigation = ({ visible = true }: BottomNavigationProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnreadCount = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (!error && count) {
        setUnreadCount(count);
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

  const navItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/dashboard' },
    { id: 'network', icon: Users, label: 'Network', path: '/connect' },
    { id: 'create', icon: Plus, label: '', path: '/create-post', isCenter: true },
    { id: 'notifications', icon: Bell, label: 'Notifications', path: '/notifications' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs', path: '/jobs' }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav 
      className={`fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border/40 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="flex items-center justify-between px-2 h-16 max-w-md mx-auto w-full">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          if (item.isCenter) {
            return (
              <div key={item.id} className="flex-1 flex justify-center items-center">
                <Button
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "w-11 h-11 rounded-xl shadow-md shadow-primary/20",
                    "bg-primary hover:bg-primary/90 text-primary-foreground",
                    "flex items-center justify-center transition-transform active:scale-95",
                    "border-0"
                  )}
                  size="icon"
                >
                  <Plus className="h-6 w-6 text-white" strokeWidth={3} />
                </Button>
              </div>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-1 py-1",
                "transition-colors duration-200 bg-transparent border-0 cursor-pointer",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground/80"
              )}
            >
              <div className="relative">
                <Icon 
                  className={cn(
                    "h-[22px] w-[22px] transition-all",
                    active && "fill-current"
                  )} 
                  strokeWidth={active ? 2.5 : 2}
                />
                {item.id === 'notifications' && unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-[1.5px] border-background"></span>
                  </span>
                )}
              </div>
              <span className={cn(
                "text-[10px] leading-none transition-all",
                active ? "font-bold" : "font-medium"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNavigation;