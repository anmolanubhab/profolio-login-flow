import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { ChevronLeft, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

function fmt(d?: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

/** Read-only account standing — no controls, mirrors LinkedIn's "Account status". */
export default function AccountStatusPage() {
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

  const emailConfirmed = Boolean(
    (user as unknown as { email_confirmed_at?: string })?.email_confirmed_at,
  );
  const providers: string[] =
    (user?.app_metadata?.providers as string[] | undefined) ??
    (user?.app_metadata?.provider ? [user.app_metadata.provider as string] : []);

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="w-full max-w-[720px] mx-auto px-2 sm:px-4">
        <div className="flex items-center gap-2 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate('/settings/account')}
            aria-label="Back to Account preferences"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Account status</h1>
        </div>

        {loading ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mt-8" />
        ) : (
          <div className="space-y-4">
            <Card className="bg-card shadow-card border-0">
              <CardHeader className="pb-3">
                <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-success" />
                  In good standing
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Your account is active and not restricted. Profolio has no open
                actions against it.
              </CardContent>
            </Card>

            <Card className="bg-card shadow-card border-0 overflow-hidden">
              <CardContent className="p-0 divide-y divide-border/60">
                <Row label="Email address" value={user?.email ?? '—'} />
                <Row
                  label="Email verified"
                  right={
                    emailConfirmed ? (
                      <Badge variant="secondary" className="gap-1 text-[11px]">
                        <CheckCircle2 className="h-3 w-3" /> Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 text-[11px] text-muted-foreground">
                        <AlertCircle className="h-3 w-3" /> Not verified
                      </Badge>
                    )
                  }
                />
                <Row
                  label="Sign-in method"
                  value={providers.length ? providers.join(', ') : 'email'}
                />
                <Row label="Member since" value={fmt(user?.created_at)} />
                <Row label="Last sign-in" value={fmt(user?.last_sign_in_at)} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
}

function Row({
  label,
  value,
  right,
}: {
  label: string;
  value?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {right ?? <span className="text-sm text-muted-foreground break-all">{value}</span>}
    </div>
  );
}
