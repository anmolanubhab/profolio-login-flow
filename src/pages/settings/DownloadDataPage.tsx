import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { ChevronLeft, Download, CheckCircle2, Loader2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SELF_PROFILE_COLUMNS } from '@/components/profile/profileTypes';
import { fetchMySettings, fetchMyConsentHistory } from '@/lib/mySettings';

type Phase = 'idle' | 'preparing' | 'ready';

/**
 * "Download your data" — a client-side export of the data this account owns,
 * assembled with plain authenticated SELECTs (existing RLS already scopes each
 * to the caller's own rows). No new tables, columns or policies.
 *
 * Scope is deliberately the subset whose ownership key is unambiguous:
 *   - account (auth.users, via getUser)
 *   - profile row (profiles.user_id = auth uid)
 *   - posts (posts.user_id = auth uid)
 *   - consent_history (get_my_consent_history() — owner-scoped RPC)
 * Comments / connections / applications key off profiles.id in different
 * places and are intentionally left for a follow-up rather than guessed here.
 */
export default function DownloadDataPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
    });
  }, [navigate]);

  const handlePrepare = async () => {
    if (!user || phase === 'preparing') return;
    setPhase('preparing');
    try {
      // `select('*')` on profiles no longer works for the authenticated role —
      // read the safe columns directly and the owner-only columns via the
      // get_my_settings() accessor, then recombine for a complete export.
      const [{ data: profile }, mySettings, { data: posts }, consentHistory] =
        await Promise.all([
          supabase
            .from('profiles')
            .select(SELF_PROFILE_COLUMNS)
            .eq('user_id', user.id)
            .maybeSingle(),
          fetchMySettings(),
          supabase
            .from('posts')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false }),
          fetchMyConsentHistory(1000),
        ]);

      const bundle = {
        export_generated_at: new Date().toISOString(),
        export_format_version: 1,
        account: {
          id: user.id,
          email: user.email ?? null,
          created_at: user.created_at ?? null,
          last_sign_in_at: user.last_sign_in_at ?? null,
          providers: user.app_metadata?.providers ?? [],
        },
        profile: profile ? { ...profile, ...(mySettings ?? {}) } : null,
        posts: posts ?? [],
        consent_history: consentHistory,
      };

      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `profolio-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setPhase('ready');
      toast({ title: 'Your data export has been downloaded' });
    } catch (err) {
      setPhase('idle');
      toast({
        title: 'Couldn’t prepare your export',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="w-full max-w-[720px] mx-auto px-2 sm:px-4">
        <div className="flex items-center gap-2 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate('/settings/privacy')}
            aria-label="Back to Data privacy"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Download your data</h1>
        </div>

        <Card className="bg-card shadow-card border-0">
          <CardHeader>
            <CardTitle className="text-[15px] font-bold">Get a copy of your data</CardTitle>
            <CardDescription className="text-xs">
              Download a JSON file containing your account details, your profile, the
              posts you’ve published and your consent history. The file is generated in
              your browser and never leaves your device except as the download.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
              <li>Account (email, sign-in dates, providers)</li>
              <li>Profile (all fields, including your visibility &amp; privacy settings)</li>
              <li>Your posts</li>
              <li>Consent history (changes to your Advertising data &amp; personalisation choices)</li>
            </ul>

            <Button onClick={handlePrepare} disabled={phase === 'preparing' || !user} className="gap-2">
              {phase === 'preparing' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Preparing…
                </>
              ) : phase === 'ready' ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Download again
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Prepare &amp; download
                </>
              )}
            </Button>

            {phase === 'ready' && (
              <p className="text-xs text-muted-foreground">
                Your download has started. Check your browser’s downloads.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
