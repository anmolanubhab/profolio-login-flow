import { Home, Users, Plus, MessageCircle, Briefcase } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMobileChromeHidden } from '@/hooks/use-mobile-scroll-direction';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hidden = useMobileChromeHidden();

  // Home / Network / Create / Messages / Jobs -- the five things a mobile user
  // needs one thumb-reach away. Alerts and Profile moved out: notifications
  // stay reachable from the bell in the top header, and the profile menu from
  // the avatar next to it. Everything else (Companies, Groups, Certificates,
  // Resume, Saved Posts) lives behind the hamburger drawer (MobileNavDrawer).
  const navItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/dashboard' },
    { id: 'network', icon: Users, label: 'Network', path: '/network' },
    { id: 'add', icon: Plus, label: 'Create', path: '/add-post', isCenter: true },
    { id: 'messages', icon: MessageCircle, label: 'Messages', path: '/connect' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs', path: '/jobs' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border w-full max-w-full transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        transform: hidden ? 'translateY(100%)' : 'translateY(0)',
      }}
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
              <Icon className={cn(
                "h-5 w-5 transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )} />
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
