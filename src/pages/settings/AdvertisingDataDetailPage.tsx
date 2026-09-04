import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import {
  AlertCircle,
  ArrowUpRight,
  ChevronLeft,
  Info,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  ADVERTISING_DATA_TOPIC_MAP,
  isAdvertisingDataTopicId,
} from '@/config/advertisingDataConfig';
import { useAdvertisingDataSettings } from '@/hooks/useAdvertisingDataSettings';
import { summariseAdvertisingData } from '@/lib/advertisingDataSummary';

/**
 * One screen per Advertising data row. Driven entirely by
 * advertisingDataConfig + useAdvertisingDataSettings so every row has a real
 * title, real back navigation, direct-URL load, and (where applicable) a real
 * persisted control. Nothing here fakes a value or a save.
 */
export default function AdvertisingDataDetailPage() {
  const { topic: topicId } = useParams<{ topic?: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);

  const topic = useMemo(
    () => (isAdvertisingDataTopicId(topicId) ? ADVERTISING_DATA_TOPIC_MAP[topicId] : null),
    [topicId],
  );

  const { loading, error, saving, prefs, data, reload, setDataUsePref, setPersonalizedRecommendations } =
    useAdvertisingDataSettings();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        navigate('/', { replace: true });
        return;
      }
      setUser(user);
    });
  }, [navigate]);

  useEffect(() => {
    // Unknown slug -> back to the list rather than a broken screen.
    if (topicId && !isAdvertisingDataTopicId(topicId)) {
      navigate('/settings/advertising', { replace: true });
    }
  }, [topicId, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const back = () => navigate('/settings/advertising');

  return (
    <Layout user={user} onSignOut={handleSignOut} fullWidth>
      <div className="mx-auto w-full max-w-[720px] px-2 sm:px-4">
        <div className="flex items-center gap-2 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={back}
            aria-label="Back to Advertising data"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h1 className="truncate text-lg font-semibold text-foreground">
            {topic ? topic.title : 'Advertising data'}
          </h1>
        </div>

        {!topic ? null : loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ) : error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <span className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </span>
              <Button variant="outline" size="sm" onClick={reload}>
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4 pb-8">
            {/* What this row is about */}
            <Card className="bg-card shadow-card border-0">
              <CardContent className="flex items-start gap-3 p-4 sm:p-5">
                <topic.icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-sm text-muted-foreground">{topic.detailBody}</p>
              </CardContent>
            </Card>

            {/* linked: live data summary + manage deep-link */}
            {topic.kind === 'linked' && topic.dataKey && (
              <Card className="bg-card shadow-card border-0">
                <CardContent className="flex flex-col gap-3 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">This data on your profile</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">
                      {summariseAdvertisingData(topic.dataKey, data)}
                    </p>
                  </div>
                  {topic.manageRoute && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => navigate(topic.manageRoute!)}
                    >
                      {topic.manageLabel ?? 'Manage'}
                      <ArrowUpRight className="ml-1.5 h-4 w-4" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* The actual control */}
            {topic.kind === 'linked' && topic.prefKey && (
              <ControlRow
                id={`data-use-${topic.prefKey}`}
                label={`Use my ${topic.title.toLowerCase()} to personalise Profolio`}
                hint="Applies to the people, companies, jobs and posts Profolio suggests to you. Never used for third‑party advertising."
                checked={prefs[topic.prefKey]}
                disabled={saving === topic.prefKey}
                onCheckedChange={(v) => setDataUsePref(topic.prefKey!, v)}
              />
            )}

            {topic.kind === 'personalisation' && (
              <ControlRow
                id="personalized-recommendations"
                label="Use my activity to personalise my “For You” feed"
                hint="Turn off to see the “For You” feed strictly newest‑first."
                checked={prefs.personalized_recommendations}
                disabled={saving === 'personalized_recommendations'}
                onCheckedChange={setPersonalizedRecommendations}
              />
            )}

            {topic.kind === 'future' && topic.prefKey && (
              <Card className="bg-card shadow-card border-0">
                <CardContent className="p-0 divide-y divide-border/60">
                  <div className="flex items-center justify-between gap-4 px-4 py-3.5 opacity-60 sm:px-5">
                    <div className="min-w-0 space-y-0.5">
                      <Label className="text-sm">{topic.title}</Label>
                      <p className="text-xs text-muted-foreground">
                        {topic.futureNote ?? 'Not available yet. Kept off.'}
                      </p>
                    </div>
                    <Switch checked={prefs[topic.prefKey]} disabled aria-label={topic.title} />
                  </div>
                </CardContent>
              </Card>
            )}

            {topic.kind === 'not-collected' && (
              <Card className="border-dashed bg-muted/30 shadow-none">
                <CardContent className="flex items-start gap-3 p-4 sm:p-5">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Nothing is stored and there is no setting to change here.
                  </p>
                </CardContent>
              </Card>
            )}

            <p className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              Only you can see and change this. It is never shared with advertisers or partners.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

function ControlRow({
  id,
  label,
  hint,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <Card className="bg-card shadow-card border-0">
      <CardContent className="flex items-center justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor={id} className="text-sm">
            {label}
          </Label>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
      </CardContent>
    </Card>
  );
}
