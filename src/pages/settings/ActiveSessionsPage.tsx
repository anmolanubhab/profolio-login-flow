import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, Monitor, CheckCircle2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getCurrentDeviceLabel } from '@/lib/userAgent';

type LoadState = 'loading' | 'ready' | 'error';

export default function ActiveSessionsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [othersSignedOut, setOthersSignedOut] = useState(false);

  const loadCurrentSession = async () => {
    setLoadState('loading');
    try {
      const [{ data: userData, error: userError }, { data: sessionData, error: sessionError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      if (userError || sessionError || !userData.user || !sessionData.session) {
        if (!userData?.user) {
          navigate('/');
          return;
        }
        setLoadState('error');
        return;
      }

      setUser(userData.user);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  };

  useEffect(() => {
    loadCurrentSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBack = () => navigate('/settings/security');

  const handleSignOutOthers = async () => {
    if (signingOutOthers) return;
    setSigningOutOthers(true);
    try {
      // scope: 'others' revokes every refresh token for this user except
      // the one backing the current session -- the current session is
      // deliberately left untouched by this call.
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) {
        toast({
          title: 'Error',
          description: "Couldn't sign out of other sessions. Please try again.",
          variant: 'destructive',
        });
        return;
      }
      setOthersSignedOut(true);
      toast({ title: 'Done', description: "You've been signed out of all other sessions." });
    } catch {
      toast({
        title: 'Error',
        description: "Couldn't sign out of other sessions. Please try again.",
        variant: 'destructive',
      });
    } finally {
      setSigningOutOthers(false);
    }
  };

  const lastSignInLabel = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <Layout user={user} fullWidth>
      <div className="w-full max-w-[520px] mx-auto">
        <div className="flex items-center gap-2 px-2 py-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack} aria-label="Back to Security settings">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold text-foreground">Active sessions</h1>
        </div>

        {loadState === 'loading' && (
          <Card className="bg-card shadow-card border-0">
            <CardContent className="py-10 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </CardContent>
          </Card>
        )}

        {loadState === 'error' && (
          <Card className="bg-card shadow-card border-0">
            <CardContent className="py-8 flex flex-col items-center text-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">
                We couldn't load your session information right now.
              </p>
              <Button variant="outline" onClick={loadCurrentSession}>
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {loadState === 'ready' && (
          <>
            <Card className="bg-card shadow-card border-0">
              <CardHeader className="px-5 pt-4 pb-2">
                <CardTitle className="text-[15px] font-bold">Current session</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Monitor className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{getCurrentDeviceLabel()}</p>
                      <Badge variant="secondary" className="text-[10px] font-normal">This device</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {user?.email}
                    </p>
                    {lastSignInLabel && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last signed in {lastSignInLabel}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-success font-medium shrink-0">Active now</span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-card border-0 mt-4">
              <CardHeader className="px-5 pt-4 pb-2">
                <CardTitle className="text-[15px] font-bold">Other sessions</CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Profolio's authentication provider doesn't expose a list of individual devices or
                  browsers signed in to your account, so we can't show them here. You can still sign
                  out everywhere else at once -- this device stays signed in.
                </p>

                {othersSignedOut ? (
                  <div className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" />
                    Signed out of all other sessions.
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full sm:w-auto"
                    onClick={handleSignOutOthers}
                    disabled={signingOutOthers}
                  >
                    {signingOutOthers ? 'Signing out…' : 'Sign out of all other sessions'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
