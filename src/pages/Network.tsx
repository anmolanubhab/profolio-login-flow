import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Layout } from '@/components/Layout';
import { NetworkShell } from '@/components/network/NetworkShell';
import { GrowPanel } from '@/components/network/GrowPanel';
import { InvitationsPanel } from '@/components/network/InvitationsPanel';
import { ConnectionsPanel } from '@/components/network/ConnectionsPanel';
import { useNetworkCounts } from '@/hooks/network/useNetworkCounts';
import { isNetworkTab, type NetworkPerson, type NetworkTab } from '@/lib/network';

type InvitationsSub = 'received' | 'sent';

const Network = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { counts } = useNetworkCounts();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/', { replace: true });
        return;
      }
      setUser(user);
      setAuthChecked(true);
    });
  }, [navigate]);

  const tab: NetworkTab = isNetworkTab(searchParams.get('tab'))
    ? (searchParams.get('tab') as NetworkTab)
    : 'grow';
  const sub: InvitationsSub = searchParams.get('sub') === 'sent' ? 'sent' : 'received';
  const query = searchParams.get('q') ?? '';

  const setTab = useCallback(
    (next: NetworkTab) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'grow') p.delete('tab');
        else p.set('tab', next);
        p.delete('q');
        p.delete('sub');
        return p;
      });
    },
    [setSearchParams],
  );

  const setSub = useCallback(
    (next: InvitationsSub) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'received') p.delete('sub');
        else p.set('sub', next);
        return p;
      });
    },
    [setSearchParams],
  );

  const setQuery = useCallback(
    (value: string) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (value) p.set('q', value);
          else p.delete('q');
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const openProfile = useCallback(
    (person: NetworkPerson) => navigate(`/profile/${person.id}`),
    [navigate],
  );

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    navigate('/');
  }, [navigate]);

  if (!authChecked) {
    return (
      <Layout user={user} onSignOut={handleSignOut} fullWidth>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <NetworkShell tab={tab} onTabChange={setTab} counts={counts}>
        {tab === 'grow' && (
          <GrowPanel query={query} onQueryChange={setQuery} onOpenProfile={openProfile} />
        )}
        {tab === 'invitations' && (
          <InvitationsPanel sub={sub} onSubChange={setSub} onOpenProfile={openProfile} />
        )}
        {tab === 'connections' && (
          <ConnectionsPanel
            query={query}
            onQueryChange={setQuery}
            onOpenProfile={openProfile}
          />
        )}
      </NetworkShell>
    </Layout>
  );
};

export default Network;
