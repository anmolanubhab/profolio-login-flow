import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, AlertCircle, RefreshCw, ShieldCheck, X, Loader2, FlaskConical } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsAdReviewer } from '@/hooks/useIsAdReviewer';
import {
  currentProfileId,
  listDeliveryTestUsers,
  setDeliveryTestUser,
  type DeliveryTestUser,
} from '@/lib/ads/delivery';

/**
 * Admin-only. The controlled mechanism for Phase I: only profiles listed
 * here ever receive a sponsored ad in the feed.
 */
export default function AdDeliveryTestPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: isReviewer, isLoading: reviewerLoading } = useIsAdReviewer();

  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<DeliveryTestUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    listDeliveryTestUsers()
      .then(setUsers)
      .catch((e) => {
        setUsers([]);
        setError(e instanceof Error ? e.message : 'Failed to load test users.');
      });
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return navigate('/');
      setUser(user);
    });
    currentProfileId().then(setMeId);
  }, [navigate]);

  useEffect(() => {
    if (isReviewer) load();
  }, [isReviewer, load]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const toggle = async (profileId: string, enabled: boolean) => {
    setBusy(profileId);
    try {
      await setDeliveryTestUser(profileId, enabled);
      load();
      toast({ title: enabled ? 'Added to test delivery' : 'Removed from test delivery' });
    } catch (e) {
      toast({
        title: 'Could not update',
        description: e instanceof Error ? e.message : 'Try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(null);
    }
  };

  const meListed = !!meId && (users ?? []).some((u) => u.profile_id === meId);

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-[720px] px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate('/ads')}
            aria-label="Back to Advertising"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <FlaskConical className="h-5 w-5 text-primary" />
            Test delivery
          </h1>
        </div>

        {reviewerLoading && <Skeleton className="h-40 w-full rounded-lg" />}

        {!reviewerLoading && !isReviewer && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <ShieldCheck className="mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Reviewers only</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                You don’t have access to ad delivery controls.
              </p>
              <Button className="mt-5" variant="outline" onClick={() => navigate('/ads')}>
                Back to Advertising
              </Button>
            </CardContent>
          </Card>
        )}

        {isReviewer && (
          <div className="space-y-4">
            <Card className="border-0 bg-muted/40 shadow-none">
              <CardContent className="p-4 text-sm text-muted-foreground">
                Sponsored ads are delivered <span className="font-medium text-foreground">only</span>{' '}
                to the profiles listed here, and only when a campaign is active and its ad is
                approved and turned on. Everyone else sees the normal feed.
              </CardContent>
            </Card>

            <Card className="bg-card shadow-card border-0">
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-[15px] font-bold">Test users</CardTitle>
                {meId && !meListed && (
                  <Button size="sm" disabled={busy === meId} onClick={() => toggle(meId, true)}>
                    Add me
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {users === null && (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full rounded-md" />
                    <Skeleton className="h-12 w-full rounded-md" />
                  </div>
                )}

                {users !== null && error && (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <span className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      {error}
                    </span>
                    <Button size="sm" variant="outline" onClick={load}>
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Retry
                    </Button>
                  </div>
                )}

                {users !== null && !error && users.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    No test users yet — no one receives sponsored ads.
                  </p>
                )}

                {users !== null && !error && users.length > 0 && (
                  <ul className="divide-y divide-border/60">
                    {users.map((u) => (
                      <li key={u.profile_id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{u.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            profile {u.profile_id.slice(0, 8)}… · added{' '}
                            {new Date(u.added_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy === u.profile_id}
                          onClick={() => toggle(u.profile_id, false)}
                        >
                          {busy === u.profile_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <X className="mr-1.5 h-3.5 w-3.5" />
                              Remove
                            </>
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}
