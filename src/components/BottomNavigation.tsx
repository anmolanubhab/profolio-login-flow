import { useState } from 'react';
import { Home, Users, Plus, MessageCircle, Briefcase } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useMobileChromeHidden } from '@/hooks/use-mobile-scroll-direction';
import { useMobileNavBadges } from '@/hooks/use-mobile-nav-badges';
import { useFullscreenOverlayActive } from '@/hooks/useFullscreenOverlay';
import { MobileCreateSheet } from '@/components/MobileCreateSheet';

const BottomNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const hidden = useMobileChromeHidden();
  // A full-screen takeover (e.g. the Story composer) owns the whole viewport;
  // the bottom bar must not sit on top of its footer controls.
  const overlayActive = useFullscreenOverlayActive();
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

  if (overlayActive) return null;

  return (
    <>
      <nav
        className="fixed inset-x-0 z-50 w-full max-w-full border-t border-border bg-background transition-transform duration-300 ease-out will-change-transform motion-reduce:transition-none"
        style={{
          // Edge-to-edge: the ONLY opaque layer is this h-16 bar, and it floats
          // *above* the system inset. The strip behind the Android gesture
          // handle / 3-button bar is left uncovered, so the feed + page
          // background show through there (LinkedIn-style) -- we never paint
          // `bg-background` into `env(safe-area-inset-bottom)`.
          bottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          // Hide: clear the bar's own height + the inset it was floating above
          // + the FAB's overhang, so nothing (not even the "+") is left behind.
          transform: hidden
            ? 'translateY(calc(100% + env(safe-area-inset-bottom) + 1.5rem))'
            : 'translateY(0)',
        }}
      >
        <div className="mx-auto flex h-16 w-full max-w-md items-stretch px-1 xs:px-2">
          {renderItem(navItems[0])}
          {renderItem(navItems[1])}

          {/* Create: an in-row slot (no longer a raised FAB) -- a compact
              gradient circle, ~40% smaller than the old 50px button, sitting
              on the same baseline as Home / Network / Messages / Jobs. The
              whole slot (circle + "Create" label) is one tap target, matching
              the other four items. */}
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label="Create"
            aria-haspopup="dialog"
            aria-expanded={createOpen}
            className={cn(
              'group flex flex-1 flex-col items-center justify-center gap-1 h-16 min-w-[44px]',
              'transition-colors duration-150 active:bg-muted',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            <span
              style={{ background: 'var(--gradient-create-fab)' }}
              className={cn(
                'grid h-[30px] w-[30px] place-items-center rounded-full text-white',
                'shadow-sm ring-1 ring-black/5',
                'transition duration-200 ease-out will-change-transform',
                'group-hover:shadow-md group-active:scale-95 group-active:brightness-95',
                'motion-reduce:transition-none',
              )}
            >
              <Plus
                className={cn(
                  'h-4 w-4 drop-shadow-sm transition-transform duration-200 ease-out motion-reduce:transition-none',
                  createOpen && 'rotate-45',
                )}
                strokeWidth={2.5}
              />
            </span>
            <span className="text-[10px] font-medium text-muted-foreground">Create</span>
          </button>

          {renderItem(navItems[2])}
          {renderItem(navItems[3])}
        </div>
      </nav>

      <MobileCreateSheet open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
};

export default BottomNavigation;
