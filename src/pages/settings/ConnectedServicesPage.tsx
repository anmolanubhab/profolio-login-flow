import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { ChevronLeft, Mail, Chrome, Linkedin, KeyRound } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

const PROVIDER_META: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: 'Email & password', icon: Mail },
  google: { label: 'Google', icon: Chrome },
  linkedin: { label: 'LinkedIn', icon: Linkedin },
  linkedin_oidc: { label: 'LinkedIn', icon: Linkedin },
};

/**
 * Read-only view of the sign-in methods linked to this Supabase auth user.
 * Nothing to change here — adding/removing a provider is done at sign-in —
 * so this mirrors LinkedIn's "Connected services" as an informational page.
 */
export default function ConnectedServicesPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
      setLoading(false);
    });
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const identities = user?.identities ?? [];
  const providers = identities.length
    ? identities.map((i) => i.provider)
    : ((user?.app_metadata?.providers as string[] | undefined) ??
      (user?.app_metadata?.provider ? [user.app_metadata.provider as string] : ['email']));

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
          <h1 className="text-lg font-semibold text-foreground">Connected services</h1>
        </div>

        {loading ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mt-8" />
        ) : (
          <Card className="bg-card shadow-card border-0 overflow-hidden">
            <CardHeader>
              <CardTitle className="text-[15px] font-bold">Sign-in methods</CardTitle>
              <CardDescription className="text-xs">
                These are the ways you can sign in to this account. Add another by signing
                in with it; there are no third-party apps connected to Profolio.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-border/60">
              {providers.map((p) => {
                const meta = PROVIDER_META[p] ?? { label: p, icon: KeyRound };
                const Icon = meta.icon;
                return (
                  <div
                    key={p}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">
                        {meta.label}
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-[10px] font-normal">
                      Connected
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
