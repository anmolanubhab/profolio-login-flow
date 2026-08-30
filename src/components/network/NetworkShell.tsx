import { ReactNode } from 'react';
import { Rss, UserPlus, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { NETWORK_TABS, type NetworkTab } from '@/lib/network';
import type { NetworkCounts } from '@/hooks/network/useNetworkCounts';
import { useFollowCounts } from '@/hooks/network/useFollowCounts';

const TAB_LABELS: Record<NetworkTab, string> = {
  grow: 'Grow',
  invitations: 'Invitations',
  connections: 'Connections',
  following: 'Following & followers',
};

interface NetworkShellProps {
  tab: NetworkTab;
  onTabChange: (tab: NetworkTab) => void;
  counts: NetworkCounts;
  children: ReactNode;
}

export function NetworkShell({ tab, onTabChange, counts, children }: NetworkShellProps) {
  const { counts: followCounts } = useFollowCounts();

  const badgeFor = (t: NetworkTab): number | null => {
    if (t === 'invitations') return counts.pending_received || null;
    if (t === 'connections') return counts.connections_count || null;
    if (t === 'following') return followCounts.followers_count || null;
    return null;
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-6 sm:px-4">
      <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6">
        {/* Left rail (desktop) */}
        <aside className="hidden lg:block">
          <Card className="sticky top-20 border-0 bg-gradient-card shadow-card">
            <CardContent className="p-2">
              <p className="px-3 py-2 text-sm font-semibold text-foreground">
                Manage my network
              </p>
              <nav className="flex flex-col">
                <RailItem
                  icon={<Users className="h-4 w-4" />}
                  label="Connections"
                  count={counts.connections_count}
                  active={tab === 'connections'}
                  onClick={() => onTabChange('connections')}
                />
                <RailItem
                  icon={<UserPlus className="h-4 w-4" />}
                  label="Invitations"
                  count={counts.pending_received}
                  active={tab === 'invitations'}
                  onClick={() => onTabChange('invitations')}
                />
                <RailItem
                  icon={<Rss className="h-4 w-4" />}
                  label="Following & followers"
                  count={followCounts.followers_count}
                  active={tab === 'following'}
                  onClick={() => onTabChange('following')}
                />
              </nav>
            </CardContent>
          </Card>
        </aside>

        <div className="min-w-0">
          <h1 className="mb-4 text-2xl font-bold text-foreground sm:text-3xl">
            My Network
          </h1>

          {/* Tab nav (horizontally scrollable on mobile) */}
          <div
            role="tablist"
            aria-label="Network sections"
            className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1"
          >
            {NETWORK_TABS.map((t) => {
              const badge = badgeFor(t);
              return (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => onTabChange(t)}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    tab === t
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {TAB_LABELS[t]}
                  {badge ? (
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-xs font-semibold',
                        tab === t
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted-foreground/15 text-muted-foreground',
                      )}
                    >
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

interface RailItemProps {
  icon: ReactNode;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

function RailItem({ icon, label, count, active, onClick }: RailItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        active
          ? 'bg-background font-medium text-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
      )}
    >
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <span className="tabular-nums">{count}</span>
    </button>
  );
}
