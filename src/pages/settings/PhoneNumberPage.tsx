import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { ChevronLeft, Phone, Loader2, CheckCircle2 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const E164 = /^\+[1-9]\d{6,14}$/;
type Step = 'idle' | 'sending' | 'code' | 'verifying';

/**
 * Add / verify / remove a phone number on the auth account, using Supabase
 * Auth's built-in phone flow:
 *   updateUser({ phone })  -> SMS OTP
 *   verifyOtp({ phone, token, type: 'phone_change' })
 * Requires an SMS provider to be configured in the project's Auth settings;
 * until then "Send code" surfaces Supabase's "SMS provider not configured".
 */
export default function PhoneNumberPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving] = useState(false);

  const load = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate('/');
      return;
    }
    setUser(user);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const sendCode = async () => {
    const value = phone.trim();
    if (!E164.test(value)) {
      toast({
        title: 'Enter a valid number',
        description: 'Use the international format, e.g. +919876543210.',
        variant: 'destructive',
      });
      return;
    }
    setStep('sending');
    const { error } = await supabase.auth.updateUser({ phone: value });
    if (error) {
      setStep('idle');
      toast({ title: 'Couldn’t send the code', description: error.message, variant: 'destructive' });
      return;
    }
    setStep('code');
    toast({ title: 'Code sent', description: `We texted a 6-digit code to ${value}.` });
  };

  const verify = async () => {
    const value = phone.trim();
    setStep('verifying');
    const { error } = await supabase.auth.verifyOtp({
      phone: value,
      token: code.trim(),
      type: 'phone_change',
    });
    if (error) {
      setStep('code');
      toast({ title: 'Couldn’t verify', description: error.message, variant: 'destructive' });
      return;
    }
    setStep('idle');
    setCode('');
    setPhone('');
    await load();
    toast({ title: 'Phone number verified' });
  };

  const removePhone = async () => {
    setConfirmRemove(false);
    setRemoving(true);
    const { error } = await supabase.auth.updateUser({ phone: '' });
    setRemoving(false);
    if (error) {
      toast({ title: 'Couldn’t remove', description: error.message, variant: 'destructive' });
      return;
    }
    await load();
    toast({ title: 'Phone number removed' });
  };

  const currentPhone = user?.phone || null;

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="w-full max-w-[560px] mx-auto px-2 sm:px-4">
        <div className="flex items-center gap-2 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigate('/settings/security')}
            aria-label="Back to Sign in & security"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">Phone number</h1>
        </div>

        {loading ? (
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mt-8" />
        ) : (
          <Card className="bg-card shadow-card border-0">
            <CardHeader>
              <CardTitle className="text-[15px] font-bold flex items-center gap-2">
                <Phone className="h-4 w-4" />
                {currentPhone ? 'Your phone number' : 'Add a phone number'}
              </CardTitle>
              <CardDescription className="text-xs">
                A verified phone number can be used for account recovery and two-step
                verification. Standard message rates may apply.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentPhone ? (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-background/50 px-3 py-2.5">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    {currentPhone}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={removing}
                    onClick={() => setConfirmRemove(true)}
                  >
                    {removing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove'}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      inputMode="tel"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={step === 'sending' || step === 'code' || step === 'verifying'}
                    />
                    <p className="text-xs text-muted-foreground">
                      International format, starting with “+”.
                    </p>
                  </div>

                  {step === 'code' || step === 'verifying' ? (
                    <div className="space-y-2">
                      <Label htmlFor="code">6-digit code</Label>
                      <Input
                        id="code"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                      />
                      <div className="flex gap-2">
                        <Button onClick={verify} disabled={code.length !== 6 || step === 'verifying'} className="gap-2">
                          {step === 'verifying' && <Loader2 className="h-4 w-4 animate-spin" />}
                          Verify
                        </Button>
                        <Button variant="ghost" onClick={sendCode} disabled={step === 'verifying'}>
                          Resend
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={sendCode} disabled={step === 'sending'} className="gap-2">
                      {step === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}
                      Send code
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove your phone number?</AlertDialogTitle>
            <AlertDialogDescription>
              You’ll no longer be able to use it for recovery or two-step verification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                void removePhone();
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
