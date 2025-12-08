import { Home, Users, Plus, Bell, Briefcase } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/dashboard' },
    { id: 'network', icon: Users, label: 'Network', path: '/connect' },
    { id: 'add', icon: Plus, label: 'Add Post', path: '/add-post', isCenter: true },
    { id: 'notifications', icon: Bell, label: 'Notifications', path: '/notifications' },
    { id: 'jobs', icon: Briefcase, label: 'Jobs', path: '/jobs' }
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-t border-border w-full max-w-full">
      <div className="relative flex items-center justify-center h-16 px-2 sm:px-4 max-w-md mx-auto w-full">
        {navItems.map((item, index) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          if (item.isCenter) {
            return (
              <div key={item.id} className="flex-1 flex justify-center">
                <Button
                  onClick={() => navigate(item.path)}
                  className={cn(
                    "w-14 h-14 rounded-full shadow-lg shadow-primary/25",
                    "bg-gradient-to-br from-primary to-primary/80",
                    "hover:shadow-xl hover:shadow-primary/30 hover:scale-105",
                    "transition-all duration-300 ease-out",
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
              className={cn(
                "flex-1 flex flex-col items-center justify-center h-16 gap-1",
                "hover:bg-muted/50 transition-all duration-200",
                active && "text-primary bg-primary/5"
              )}
            >
              <div className="relative">
                <Icon className={cn(
                  "h-5 w-5 transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )} />
                {item.id === 'notifications' && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-destructive rounded-full" />
                )}
              </div>
              <span className={cn(
                "text-xs font-medium transition-colors",
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