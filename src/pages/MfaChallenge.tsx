import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';

type Mode = 'totp' | 'backup';
type CheckState = 'checking' | 'ready';

export default function MfaChallenge() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const [checkState, setCheckState] = useState<CheckState>('checking');
  const [mode, setMode] = useState<Mode>('totp');
  const [code, setCode] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destination = (location.state as { from?: string } | null)?.from || '/dashboard';

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/', { replace: true });
        return;
      }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData && aalData.currentLevel === 'aal2') {
        navigate(destination, { replace: true });
        return;
      }
      if (aalData && aalData.currentLevel === aalData.nextLevel) {
        // MFA not actually required for this session -- nothing to challenge.
        navigate(destination, { replace: true });
        return;
      }

      const { data: hasGrant } = await supabase.rpc('has_active_mfa_recovery_grant');
      if (hasGrant) {
        navigate(destination, { replace: true });
        return;
      }

      setCheckState('ready');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const rateLimitKey = `mfa-challenge-totp`;
    if (rateLimiter.isRateLimited(rateLimitKey, RATE_LIMITS.POST_CREATE)) {
      const resetTime = Math.ceil(rateLimiter.getTimeUntilReset(rateLimitKey) / 1000);
      toast({ title: 'Too many attempts', description: `Please wait ${resetTime} seconds.`, variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      if (factorsError || !factorsData) {
        setError("Couldn't load your authenticator. Please try again.");
        return;
      }
      const factor = factorsData.totp.find((f) => f.status === 'verified');
      if (!factor) {
        setError('No verified authenticator found on this account.');
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code: code.trim(),
      });

      if (verifyError) {
        setError('Invalid or expired code. Please try again.');
        setCode('');
        return;
      }

      navigate(destination, { replace: true });
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    const rateLimitKey = `mfa-challenge-backup`;
    if (rateLimiter.isRateLimited(rateLimitKey, RATE_LIMITS.POST_CREATE)) {
      const resetTime = Math.ceil(rateLimiter.getTimeUntilReset(rateLimitKey) / 1000);
      toast({ title: 'Too many attempts', description: `Please wait ${resetTime} seconds.`, variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    try {
      const { data: ok, error: rpcError } = await supabase.rpc('consume_mfa_recovery_code', {
        code: backupCode.trim(),
      });

      if (rpcError || !ok) {
        setError('That backup code is invalid or has already been used.');
        setBackupCode('');
        return;
      }

      toast({ title: 'Recovery access granted', description: 'Set up a new authenticator soon to fully restore two-step verification.' });
      navigate(destination, { replace: true });
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/', { replace: true });
  };

  if (checkState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <Card className="bg-card shadow-card border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-xl">Two-step verification</CardTitle>
            <CardDescription>
              {mode === 'totp'
                ? 'Enter the 6-digit code from your authenticator app.'
                : 'Enter one of your unused backup codes.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === 'totp' ? (
              <form onSubmit={handleTotpSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="totp-code">Authentication code</Label>
                  <Input
                    id="totp-code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    autoFocus
                  />
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={submitting || code.length !== 6}>
                  {submitting ? 'Verifying…' : 'Verify'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleBackupSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="backup-code">Backup code</Label>
                  <Input
                    id="backup-code"
                    autoComplete="off"
                    value={backupCode}
                    onChange={(e) => setBackupCode(e.target.value)}
                    placeholder="XXXXX-XXXXX"
                    icon={<KeyRound className="h-4 w-4" />}
                    autoFocus
                  />
                  {error && <p className="text-xs text-destructive">{error}</p>}
                </div>
                <Button type="submit" className="w-full" disabled={submitting || !backupCode.trim()}>
                  {submitting ? 'Verifying…' : 'Use backup code'}
                </Button>
              </form>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                onClick={() => {
                  setError(null);
                  setMode((m) => (m === 'totp' ? 'backup' : 'totp'));
                }}
              >
                {mode === 'totp' ? "Can't access your authenticator? Use a backup code" : 'Use your authenticator app instead'}
              </button>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
