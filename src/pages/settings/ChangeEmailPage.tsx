import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Lock, Mail, Eye, EyeOff, MailCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';
import { sanitizeInput } from '@/lib/input-sanitizer';

function getReauthErrorMessage(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Current password is incorrect.';
  }
  return message;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ChangeEmailPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{ current?: string; email?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
      setCheckingAuth(false);
    };
    init();
  }, [navigate]);

  const handleBack = () => navigate('/settings/security');

  const validate = () => {
    const errors: typeof fieldErrors = {};
    if (!currentPassword) errors.current = 'Enter your current password.';

    const sanitizedEmail = sanitizeInput(newEmail.toLowerCase());
    if (!sanitizedEmail) {
      errors.email = 'Enter a new email address.';
    } else if (!EMAIL_PATTERN.test(sanitizedEmail)) {
      errors.email = 'Please enter a valid email address.';
    } else if (sanitizedEmail === user?.email) {
      errors.email = 'That’s already your current email address.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || success || !user?.email) return;

    if (!validate()) return;

    const rateLimitKey = `change-email-${user.id}`;
    if (rateLimiter.isRateLimited(rateLimitKey, RATE_LIMITS.PROFILE_UPDATE)) {
      const resetTime = Math.ceil(rateLimiter.getTimeUntilReset(rateLimitKey) / 1000);
      toast({
        title: 'Too Many Attempts',
        description: `Please wait ${resetTime} seconds before trying again.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Re-verify identity with the current password first -- same pattern
      // as Change Password. Email is used for login/recovery, so changing
      // it deserves the same re-auth gate, not just an already-open session.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (reauthError) {
        setFieldErrors({ current: getReauthErrorMessage(reauthError.message) });
        setSubmitting(false);
        return;
      }

      // This does NOT change auth.users.email immediately -- Supabase holds
      // the new address pending confirmation (auth.users.email_change) and
      // only finalizes it once the confirmation link is clicked. profiles.email
      // is reconciled separately (useProfileSettings.ts) the next time a
      // session loads with the auth email already updated, so it can never
      // pick up this unconfirmed address prematurely.
      const { error: updateError } = await supabase.auth.updateUser({
        email: sanitizeInput(newEmail.toLowerCase()),
      });

      if (updateError) {
        toast({ title: 'Error', description: updateError.message, variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setCurrentPassword('');
      toast({ title: 'Confirmation sent', description: 'Check your inbox to confirm the change.' });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  if (checkingAuth) {
    return (
      <Layout user={user} fullWidth>
        <div className="min-h-[50vh] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} fullWidth>
      <div className="w-full max-w-[520px] mx-auto">
        <div className="flex items-center gap-2 px-2 py-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleBack} aria-label="Back to Security settings">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-base font-semibold text-foreground">Email address</h1>
        </div>

        <Card className="bg-card shadow-card border-0">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-[15px] font-bold">
              {success ? 'Confirmation sent' : 'Change your email'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {success ? (
              <div className="flex flex-col items-center text-center gap-3 py-6">
                <MailCheck className="h-10 w-10 text-success" />
                <p className="text-sm text-muted-foreground">
                  We've sent a confirmation link to your new email address. Your account keeps using{' '}
                  <strong>{user?.email}</strong> to sign in until you confirm the change.
                </p>
                <Button onClick={handleBack} className="w-full sm:w-auto mt-2">
                  Back to Security settings
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label>Current email</Label>
                  <div className="relative">
                    <Input value={user?.email ?? ''} icon={<Mail className="h-4 w-4" />} disabled readOnly />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Current password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        if (fieldErrors.current) setFieldErrors((prev) => ({ ...prev, current: undefined }));
                      }}
                      icon={<Lock className="h-4 w-4" />}
                      autoComplete="current-password"
                      aria-invalid={!!fieldErrors.current}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.current && <p className="text-xs text-destructive">{fieldErrors.current}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-email">New email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => {
                      setNewEmail(e.target.value);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    icon={<Mail className="h-4 w-4" />}
                    autoComplete="email"
                    aria-invalid={!!fieldErrors.email}
                  />
                  {fieldErrors.email ? (
                    <p className="text-xs text-destructive">{fieldErrors.email}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      We'll send a confirmation link to this address before the change takes effect.
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? 'Sending…' : 'Send confirmation'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
