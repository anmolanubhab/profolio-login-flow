import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { ChevronLeft, AlertCircle, Loader2, RefreshCw, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdAccountStatusBadge } from '@/components/ads/AdAccountStatusBadge';
import { AdAccountCampaignsCard } from '@/components/ads/AdAccountCampaignsCard';
import { AdAccountAudiencesCard } from '@/components/ads/AdAccountAudiencesCard';
import {
  AD_ACCOUNT_TIMEZONES,
  getAdAccount,
  setAdAccountStatus,
  updateAdAccountSettings,
  type AdAccount,
} from '@/lib/ads/api';

function fmtDateTime(d: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function AdAccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<AdAccount | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // basic-settings form
  const [name, setName] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [saving, setSaving] = useState(false);

  // status change
  const [statusDialog, setStatusDialog] = useState<null | 'close' | 'reopen'>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setState('loading');
    setErrorMsg(null);
    try {
      const acct = await getAdAccount(id);
      if (!acct) {
        setState('notfound');
        return;
      }
      setAccount(acct);
      setName(acct.name);
      setTimezone(acct.timezone);
      setState('ready');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load this ad account.');
      setState('error');
    }
  }, [id]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
      load();
    });
  }, [navigate, load]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const dirty = !!account && (name.trim() !== account.name || timezone !== account.timezone);
  const nameValid = name.trim().length >= 2 && name.trim().length <= 80;

  const handleSave = async () => {
    if (!account || !dirty || !nameValid) return;
    setSaving(true);
    try {
      const patch: { name?: string; timezone?: string } = {};
      if (name.trim() !== account.name) patch.name = name.trim();
      if (timezone !== account.timezone) patch.timezone = timezone;
      const updated = await updateAdAccountSettings(account.id, patch);
      setAccount(updated);
      setName(updated.name);
      setTimezone(updated.timezone);
      toast({ title: 'Settings saved' });
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Could not save changes.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async () => {
    if (!account || !statusDialog) return;
    setStatusSaving(true);
    try {
      const next = statusDialog === 'close' ? 'closed' : 'active';
      const updated = await setAdAccountStatus(account.id, next);
      setAccount(updated);
      toast({
        title: next === 'closed' ? 'Ad account closed' : 'Ad account reopened',
      });
      setStatusDialog(null);
    } catch (e) {
      toast({
        title: 'Update failed',
        description: e instanceof Error ? e.message : 'Could not change the account status.',
        variant: 'destructive',
      });
    } finally {
      setStatusSaving(false);
    }
  };

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-[720px] px-3 py-4 sm:px-4 sm:py-6">
        {/* Back / title */}
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
          <h1 className="truncate text-lg font-semibold text-foreground">
            {state === 'ready' && account ? account.name : 'Ad account'}
          </h1>
          {state === 'ready' && account && <AdAccountStatusBadge status={account.status} />}
        </div>

        {state === 'loading' && (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        )}

        {state === 'notfound' && (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <AlertCircle className="mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Ad account not found</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                It may have been removed, or you don’t have access to it.
              </p>
              <Button className="mt-5" variant="outline" onClick={() => navigate('/ads')}>
                Back to Advertising
              </Button>
            </CardContent>
          </Card>
        )}

        {state === 'error' && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {state === 'ready' && account && (
          <div className="space-y-4">
            {/* Overview */}
            <Card className="bg-card shadow-card border-0 overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px] font-bold">Account details</CardTitle>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/60">
                <DetailRow label="Status" right={<AdAccountStatusBadge status={account.status} />} />
                <DetailRow
                  label="Currency"
                  right={
                    <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Lock className="h-3.5 w-3.5" />
                      {account.currency}
                    </span>
                  }
                />
                <DetailRow label="Reporting time zone" value={account.timezone.replace(/_/g, ' ')} />
                <DetailRow label="Created" value={fmtDateTime(account.created_at)} />
                <DetailRow
                  label="Ads Agreement"
                  value={
                    account.agreement_accepted_at
                      ? `Accepted ${fmtDateTime(account.agreement_accepted_at)}`
                      : 'Not accepted'
                  }
                />
              </CardContent>
            </Card>

            {/* Campaigns */}
            <AdAccountCampaignsCard
              adAccountId={account.id}
              currency={account.currency}
              disabled={account.status === 'closed'}
            />

            {/* Audiences */}
            <AdAccountAudiencesCard
              adAccountId={account.id}
              disabled={account.status === 'closed'}
            />

            {/* Basic settings */}
            <Card className="bg-card shadow-card border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px] font-bold">Basic settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="acct-name">Account name</Label>
                  <Input
                    id="acct-name"
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                    disabled={account.status === 'closed'}
                    aria-invalid={name.length > 0 && !nameValid}
                  />
                  {name.length > 0 && !nameValid && (
                    <p className="text-xs text-destructive">Use 2–80 characters.</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="acct-tz">Reporting time zone</Label>
                  <Select
                    value={timezone}
                    onValueChange={setTimezone}
                    disabled={account.status === 'closed'}
                  >
                    <SelectTrigger id="acct-tz">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {/* keep the stored value selectable even if it's not in the preset list */}
                      {(AD_ACCOUNT_TIMEZONES.includes(timezone)
                        ? AD_ACCOUNT_TIMEZONES
                        : [timezone, ...AD_ACCOUNT_TIMEZONES]
                      ).map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Currency</Label>
                  <div className="flex items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    {account.currency} — can’t be changed after creation
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={handleSave} disabled={!dirty || !nameValid || saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save changes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Status controls */}
            <Card className="bg-card shadow-card border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-[15px] font-bold">Account status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                {account.status === 'suspended' ? (
                  <p>
                    This account is suspended by Profolio. Contact support to resolve it — it can’t be
                    reactivated from here.
                  </p>
                ) : account.status === 'closed' ? (
                  <>
                    <p>This ad account is closed. Reopen it to make changes or run campaigns again.</p>
                    <Button variant="outline" onClick={() => setStatusDialog('reopen')}>
                      Reopen ad account
                    </Button>
                  </>
                ) : (
                  <>
                    <p>
                      Closing stops the account from being used for new campaigns. You can reopen it
                      later — nothing is deleted.
                    </p>
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setStatusDialog('close')}
                    >
                      Close ad account
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <AlertDialog open={statusDialog !== null} onOpenChange={(o) => !o && setStatusDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusDialog === 'close' ? 'Close this ad account?' : 'Reopen this ad account?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusDialog === 'close'
                ? 'It will be marked closed and can’t be used for new campaigns until you reopen it. Nothing is deleted.'
                : 'The account will become active again and editable.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={statusSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleStatusChange();
              }}
              disabled={statusSaving}
            >
              {statusSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {statusDialog === 'close' ? 'Close account' : 'Reopen account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

function DetailRow({
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
