import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ChevronLeft,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  KeyRound,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ViewState =
  | 'loading'
  | 'off'
  | 'enroll-qr'
  | 'show-codes'
  | 'on'
  | 'recovery-mode'
  | 'error';

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
}

export default function TwoStepVerificationPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState<ViewState>('loading');
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [codesConfirmed, setCodesConfirmed] = useState(false);
  const [codesStatus, setCodesStatus] = useState<{ remaining: number; total: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerateArmed, setRegenerateArmed] = useState(false);
  const [disableArmed, setDisableArmed] = useState(false);

  const loadStatus = useCallback(async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      navigate('/');
      return;
    }
    setUser(currentUser);

    const [{ data: factorsData, error: factorsError }, { data: aalData }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);

    if (factorsError || !factorsData) {
      setView('error');
      return;
    }

    const hasVerifiedFactor = factorsData.totp.some((f) => f.status === 'verified');
    const isAal2 = aalData?.currentLevel === 'aal2';

    console.info('[MFA diagnostic] loadStatus', {
      allFactors: factorsData.all.map((f) => ({ id: f.id, type: f.factor_type, status: f.status })),
      hasVerifiedFactor,
      currentLevel: aalData?.currentLevel,
      nextLevel: aalData?.nextLevel,
    });

    if (!hasVerifiedFactor) {
      setView('off');
      return;
    }

    if (isAal2) {
      const { data: status } = await supabase.rpc('get_mfa_recovery_codes_status');
      const row = Array.isArray(status) ? status[0] : status;
      if (row) setCodesStatus({ remaining: row.remaining ?? 0, total: row.total_generated ?? 0 });
      setView('on');
      return;
    }

    // Verified factor exists but this session isn't aal2 -- reached Settings
    // via recovery access (backup code), not a real MFA challenge.
    setView('recovery-mode');
  }, [navigate]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleBack = () => navigate('/settings/security');

  const startEnrollment = async () => {
    setBusy(true);
    setVerifyError(null);
    try {
      // Clean up any abandoned unverified factor from a prior attempt before
      // starting fresh, so enrollment always begins from a clean slate.
      const { data: existing } = await supabase.auth.mfa.listFactors();
      if (existing) {
        const unverified = existing.all.find((f) => f.factor_type === 'totp' && f.status === 'unverified');
        if (unverified) {
          console.info('[MFA diagnostic] startEnrollment cleanup unenrolling', { factorId: unverified.id, status: unverified.status });
          await supabase.auth.mfa.unenroll({ factorId: unverified.id });
        }
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Profolio',
      });

      if (error || !data) {
        toast({ title: 'Error', description: error?.message ?? 'Could not start enrollment.', variant: 'destructive' });
        return;
      }

      setEnrollData({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setVerifyCode('');
      setView('enroll-qr');
    } finally {
      setBusy(false);
    }
  };

  const cancelEnrollment = async () => {
    if (enrollData) {
      console.info('[MFA diagnostic] cancelEnrollment unenrolling', { factorId: enrollData.factorId });
      await supabase.auth.mfa.unenroll({ factorId: enrollData.factorId });
    }
    setEnrollData(null);
    setVerifyCode('');
    setVerifyError(null);
    loadStatus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollData || verifying) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollData.factorId,
        code: verifyCode.trim(),
      });

      if (error) {
        setVerifyError('Invalid code. Check your authenticator app and try again.');
        return;
      }

      // Diagnostic: confirm, from Supabase's own response, exactly what
      // state the session and factor are in immediately after a successful
      // verify -- no secrets, only status/level values.
      const [{ data: postVerifyFactors }, { data: postVerifyAal }] = await Promise.all([
        supabase.auth.mfa.listFactors(),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      console.info('[MFA diagnostic] immediately after verify', {
        factorId: enrollData.factorId,
        verifiedTotpFactors: postVerifyFactors?.totp.map((f) => ({ id: f.id, status: f.status })),
        currentLevel: postVerifyAal?.currentLevel,
        nextLevel: postVerifyAal?.nextLevel,
      });

      const { data: codes, error: codesError } = await supabase.rpc('generate_mfa_recovery_codes');
      if (codesError || !codes) {
        toast({
          title: 'Two-step verification is on',
          description: "Your recovery codes couldn't be generated. You can generate them from this page.",
          variant: 'destructive',
        });
        // Verification already succeeded server-side (this factor is now
        // verified) -- clear the enrollment reference so it can never be
        // mistaken for an in-progress attempt on this page again.
        setEnrollData(null);
        setView('on');
        return;
      }

      setRecoveryCodes(codes as string[]);
      setCodesConfirmed(false);
      setEnrollData(null);
      setView('show-codes');
    } finally {
      setVerifying(false);
    }
  };

  const handleRegenerateCodes = async () => {
    setBusy(true);
    try {
      const { data: codes, error } = await supabase.rpc('generate_mfa_recovery_codes');
      if (error || !codes) {
        toast({ title: 'Error', description: 'Could not generate new codes.', variant: 'destructive' });
        return;
      }
      setRecoveryCodes(codes as string[]);
      setCodesConfirmed(false);
      setRegenerateArmed(false);
      setView('show-codes');
    } finally {
      setBusy(false);
    }
  };

  const handleFinishShowCodes = () => {
    setRecoveryCodes([]);
    loadStatus();
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      const factor = factorsData?.totp.find((f) => f.status === 'verified');
      if (!factor) {
        toast({ title: 'Error', description: 'No active authenticator found.', variant: 'destructive' });
        return;
      }

      console.info('[MFA diagnostic] handleDisable unenrolling', { factorId: factor.id, status: factor.status });
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) {
        toast({
          title: "Couldn't turn off two-step verification",
          description: error.message.toLowerCase().includes('aal2')
            ? 'Please complete a fresh authenticator check first, then try again.'
            : error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({ title: 'Two-step verification turned off' });
      setDisableArmed(false);
      loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const copySecret = async (secret: string) => {
    await navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const copyAllCodes = async () => {
    await navigator.clipboard.writeText(recoveryCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Layout user={user} fullWidth>
      <div className="w-full max-w-[560px] mx-auto">
        <div className="flex items-center gap-2 px-2 py-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack} aria-label="Back to Security settings">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold text-foreground">Two-step verification</h1>
        </div>

        {view === 'loading' && (
          <Card className="bg-card shadow-card border-0">
            <CardContent className="py-10 flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </CardContent>
          </Card>
        )}

        {view === 'error' && (
          <Card className="bg-card shadow-card border-0">
            <CardContent className="py-8 flex flex-col items-center text-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">Couldn't load your two-step verification status.</p>
              <Button variant="outline" onClick={loadStatus}>Try again</Button>
            </CardContent>
          </Card>
        )}

        {view === 'off' && (
          <Card className="bg-card shadow-card border-0">
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <ShieldOff className="h-4 w-4 text-muted-foreground" /> Currently off
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Add an extra layer of security to your account. Once turned on, you'll need a
                code from an authenticator app (like Google Authenticator or Authy) every time
                you sign in.
              </p>
              <Button onClick={startEnrollment} disabled={busy} className="w-full sm:w-auto">
                {busy ? 'Starting…' : 'Turn on two-step verification'}
              </Button>
            </CardContent>
          </Card>
        )}

        {view === 'enroll-qr' && enrollData && (
          <Card className="bg-card shadow-card border-0">
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="text-[15px] font-bold">Scan the QR code</CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Scan this with your authenticator app, or enter the code manually.
              </p>
              <div className="flex justify-center bg-white rounded-lg p-4 border">
                <img
                  src={enrollData.qrCode.startsWith('data:') ? enrollData.qrCode : `data:image/svg+xml;utf-8,${encodeURIComponent(enrollData.qrCode)}`}
                  alt="Authenticator QR code"
                  className="h-44 w-44"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Manual entry code</Label>
                <div className="flex items-center gap-2">
                  <Input value={enrollData.secret} readOnly className="font-mono text-xs" />
                  <Button type="button" variant="outline" size="icon" onClick={() => copySecret(enrollData.secret)}>
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <form onSubmit={handleVerify} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="verify-code">Enter the 6-digit code to confirm</Label>
                  <Input
                    id="verify-code"
                    inputMode="numeric"
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                  />
                  {verifyError && <p className="text-xs text-destructive">{verifyError}</p>}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={verifying || verifyCode.length !== 6} className="flex-1">
                    {verifying ? 'Verifying…' : 'Verify and turn on'}
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelEnrollment} disabled={verifying}>
                    Cancel
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Verifying will sign you out of any other sessions currently signed in.
                </p>
              </form>
            </CardContent>
          </Card>
        )}

        {view === 'show-codes' && (
          <Card className="bg-card shadow-card border-0">
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" /> Save your backup codes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Each code can be used once to get back into your account if you lose access to
                your authenticator app. Store them somewhere safe -- they won't be shown again.
              </p>
              <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-4 font-mono text-sm">
                {recoveryCodes.map((c) => (
                  <div key={c}>{c}</div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={copyAllCodes}>
                {copied ? <Check className="h-4 w-4 mr-1.5" /> : <Copy className="h-4 w-4 mr-1.5" />}
                Copy all codes
              </Button>

              <div className="flex items-start gap-2 pt-2">
                <Checkbox
                  id="confirm-codes"
                  checked={codesConfirmed}
                  onCheckedChange={(v) => setCodesConfirmed(v === true)}
                />
                <Label htmlFor="confirm-codes" className="text-sm font-normal leading-snug">
                  I've saved these backup codes somewhere safe.
                </Label>
              </div>

              <Button onClick={handleFinishShowCodes} disabled={!codesConfirmed} className="w-full">
                Done
              </Button>
            </CardContent>
          </Card>
        )}

        {view === 'on' && (
          <Card className="bg-card shadow-card border-0">
            <CardHeader className="px-5 pt-4 pb-2">
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-success" /> Currently on
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-5">
              <p className="text-sm text-muted-foreground">
                You'll be asked for a verification code from your authenticator app each time you sign in.
              </p>

              <div className="rounded-lg border p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">Backup codes</p>
                <p className="text-xs text-muted-foreground">
                  {codesStatus ? `${codesStatus.remaining} of ${codesStatus.total} unused` : 'Status unavailable'}
                </p>
                {regenerateArmed ? (
                  <div className="flex items-center gap-2 pt-1">
                    <Button size="sm" variant="destructive" onClick={handleRegenerateCodes} disabled={busy}>
                      {busy ? 'Generating…' : 'Confirm regenerate'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRegenerateArmed(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setRegenerateArmed(true)}>
                    Regenerate codes
                  </Button>
                )}
                <p className="text-xs text-muted-foreground pt-1">
                  Regenerating invalidates all existing backup codes, used or not.
                </p>
              </div>

              <div className="rounded-lg border border-destructive/30 p-4 space-y-2">
                <p className="text-sm font-medium text-foreground">Turn off</p>
                {disableArmed ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="destructive" onClick={handleDisable} disabled={busy}>
                      {busy ? 'Turning off…' : 'Confirm turn off'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDisableArmed(false)}>Cancel</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setDisableArmed(true)}>
                    Turn off two-step verification
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {view === 'recovery-mode' && (
          <div className="space-y-4">
            <Card className="bg-destructive/5 border-destructive/30">
              <CardContent className="py-4 flex items-start gap-3">
                <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">You're in recovery mode</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You signed in with a backup code, not your authenticator app. Set up a new
                    authenticator now to fully restore two-step verification -- until you do,
                    protection on this account is reduced.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card shadow-card border-0">
              <CardContent className="px-5 py-5">
                <Button onClick={startEnrollment} disabled={busy} className="w-full sm:w-auto">
                  {busy ? 'Starting…' : 'Set up a new authenticator'}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {view === 'enroll-qr' && !enrollData && null}
      </div>
    </Layout>
  );
}
