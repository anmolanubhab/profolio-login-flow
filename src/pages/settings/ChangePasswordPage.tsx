import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';
import { sanitizeInput } from '@/lib/input-sanitizer';
import { PASSWORD_MIN_LENGTH, getPasswordStrength } from '@/lib/password';

function getReauthErrorMessage(message: string): string {
  if (message.includes('Invalid login credentials')) {
    return 'Current password is incorrect.';
  }
  return message;
}

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordStrength = getPasswordStrength(newPassword);

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
    if (!newPassword) {
      errors.next = 'Enter a new password.';
    } else if (newPassword.length < PASSWORD_MIN_LENGTH) {
      errors.next = `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
    }
    if (!confirmPassword) {
      errors.confirm = 'Confirm your new password.';
    } else if (newPassword && confirmPassword !== newPassword) {
      errors.confirm = 'Passwords do not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || success || !user?.email) return;

    if (!validate()) return;

    const rateLimitKey = `change-password-${user.id}`;
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
      // Re-verify identity with the current password before changing it --
      // supabase.auth.updateUser() alone would happily change the password
      // for anyone with the current (already-open) session, current
      // password or not. signInWithPassword is the same supported call
      // Login.tsx already uses; this just confirms the caller still knows
      // the current password without a custom auth system.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (reauthError) {
        setFieldErrors({ current: getReauthErrorMessage(reauthError.message) });
        setSubmitting(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: sanitizeInput(newPassword),
      });

      if (updateError) {
        toast({ title: 'Error', description: updateError.message, variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({ title: 'Password updated', description: 'Your password has been changed successfully.' });
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
          <h1 className="text-base font-semibold text-foreground">Change password</h1>
        </div>

        <Card className="bg-card shadow-card border-0">
          <CardHeader className="px-5 pt-4 pb-2">
            <CardTitle className="text-[15px] font-bold">
              {success ? 'Password changed' : 'Update your password'}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {success ? (
              <div className="flex flex-col items-center text-center gap-3 py-6">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <p className="text-sm text-muted-foreground">
                  Your password has been updated. You'll stay signed in on this device.
                </p>
                <Button onClick={handleBack} className="w-full sm:w-auto mt-2">
                  Back to Security settings
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Current password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrent ? 'text' : 'password'}
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
                      onClick={() => setShowCurrent((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showCurrent ? 'Hide current password' : 'Show current password'}
                    >
                      {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.current && <p className="text-xs text-destructive">{fieldErrors.current}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (fieldErrors.next) setFieldErrors((prev) => ({ ...prev, next: undefined }));
                      }}
                      icon={<Lock className="h-4 w-4" />}
                      autoComplete="new-password"
                      aria-invalid={!!fieldErrors.next}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showNew ? 'Hide new password' : 'Show new password'}
                    >
                      {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Password strength</span>
                        <span
                          className={
                            passwordStrength.strength === 100
                              ? 'text-success font-medium'
                              : passwordStrength.strength >= 75
                              ? 'text-primary font-medium'
                              : passwordStrength.strength >= 50
                              ? 'text-warning font-medium'
                              : 'text-destructive font-medium'
                          }
                        >
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${passwordStrength.color} transition-all duration-300`}
                          style={{ width: `${passwordStrength.strength}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {fieldErrors.next ? (
                    <p className="text-xs text-destructive">{fieldErrors.next}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">At least {PASSWORD_MIN_LENGTH} characters.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (fieldErrors.confirm) setFieldErrors((prev) => ({ ...prev, confirm: undefined }));
                      }}
                      icon={<Lock className="h-4 w-4" />}
                      autoComplete="new-password"
                      aria-invalid={!!fieldErrors.confirm}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                    >
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.confirm && <p className="text-xs text-destructive">{fieldErrors.confirm}</p>}
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                  {submitting ? 'Updating…' : 'Update password'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
