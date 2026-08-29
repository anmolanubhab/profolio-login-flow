import { useState } from 'react';
import { Home, Users, Plus, MessageCircle, Briefcase } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMobileChromeHidden } from '@/hooks/use-mobile-scroll-direction';
import { useMobileNavBadges } from '@/hooks/use-mobile-nav-badges';
import { MobileCreateSheet } from '@/components/MobileCreateSheet';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hidden = useMobileChromeHidden();
  const badges = useMobileNavBadges();
  const [createOpen, setCreateOpen] = useState(false);

  // Home / Network / Create / Messages / Jobs. Alerts + Profile stay out --
  // notifications live in the header bell, the profile menu in the header
  // avatar; everything else is behind the hamburger drawer (MobileNavDrawer).
  const navItems = [
    { id: 'home', icon: Home, label: 'Home', path: '/dashboard' },
    { id: 'network', icon: Users, label: 'Network', path: '/network', badge: badges.network },
    { id: 'messages', icon: MessageCircle, label: 'Messages', path: '/connect', badge: badges.messages },
    { id: 'jobs', icon: Briefcase, label: 'Jobs', path: '/jobs' },
  ] as const;

  const isActive = (path: string) => location.pathname === path;

  const renderItem = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const active = isActive(item.path);
    const badge = 'badge' in item ? item.badge : 0;

    return (
      <Button
        key={item.id}
        variant="ghost"
        size="icon"
        onClick={() => navigate(item.path)}
        aria-label={item.label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex-1 flex flex-col items-center justify-center h-16 gap-1 min-w-[44px]',
          'hover:bg-muted/50 active:bg-muted transition-colors duration-150',
          active && 'text-primary',
        )}
      >
        <span className="relative">
          <Icon
            className={cn(
              'h-5 w-5 transition-colors',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          />
          {badge > 0 && (
            <span
              className="absolute -right-2 -top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
              aria-hidden="true"
            >
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </span>
        <span
          className={cn(
            'text-[10px] font-medium transition-colors',
            active ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {item.label}
        </span>
      </Button>
    );
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border w-full max-w-full transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          // Extra offset so the FAB's overhang above the bar also clears the
          // viewport when hidden -- it must never float there on its own.
          transform: hidden ? 'translateY(calc(100% + 1.5rem))' : 'translateY(0)',
        }}
      >
        <div className="relative mx-auto flex h-16 w-full max-w-md items-stretch px-1 xs:px-2">
          {renderItem(navItems[0])}
          {renderItem(navItems[1])}

          {/* Center column: an inert spacer keeps the 5-slot rhythm; the FAB
              itself is absolutely centered on the row so it lands on the true
              horizontal midpoint regardless of the sibling label widths. */}
          <div className="flex-1" aria-hidden="true" />

          {renderItem(navItems[2])}
          {renderItem(navItems[3])}

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label="Create"
            aria-haspopup="dialog"
            aria-expanded={createOpen}
            style={{ background: 'var(--gradient-create-fab)' }}
            className={cn(
              'absolute left-1/2 top-0 h-[50px] w-[50px] -translate-x-1/2 -translate-y-[36%]',
              'grid place-items-center rounded-full text-white',
              'shadow-md ring-1 ring-black/5',
              'transition duration-200 ease-out will-change-transform',
              'hover:shadow-lg active:scale-95 active:brightness-95',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'motion-reduce:transition-none',
            )}
          >
            <Plus
              className={cn(
                'h-6 w-6 drop-shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none',
                createOpen && 'rotate-45',
              )}
              strokeWidth={2.5}
            />
          </button>
        </div>
      </nav>

      <MobileCreateSheet open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
};

export default BottomNavigation;
