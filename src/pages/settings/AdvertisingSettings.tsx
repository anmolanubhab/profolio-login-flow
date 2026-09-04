import { useNavigate } from 'react-router-dom';
import { AlertCircle, RefreshCw, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import {
  ADVERTISING_DATA_SECTIONS,
  ADVERTISING_DATA_TOPICS,
  type AdvertisingDataTopic,
} from '@/config/advertisingDataConfig';
import {
  useAdvertisingDataSettings,
  type AdvertisingDataPrefs,
} from '@/hooks/useAdvertisingDataSettings';
import {
  summariseAdvertisingData,
  type AdvertisingDataSnapshot,
} from '@/lib/advertisingDataSummary';

/**
 * Settings -> Advertising data. LinkedIn's page is the interaction reference:
 * three grouped sections, a right-side current value, a chevron, and the whole
 * row navigates to a detail screen. Every value shown is the user's real
 * stored state (or their real data), loaded from Supabase — nothing hard-coded.
 */
export function AdvertisingSettings() {
  const navigate = useNavigate();
  const { loading, error, prefs, data, reload } = useAdvertisingDataSettings();

  return (
    <>
      <Card className="bg-card shadow-card border-0">
        <CardContent className="flex items-start gap-3 p-4 sm:p-5">
          <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Profolio doesn’t show you third‑party ads</p>
            <p>
              No ad‑targeting profile is built about you and your data is never sold or shared with
              advertisers, data brokers or partners. These controls govern how your Profolio data
              personalises what you see — and pre‑set your choices for any future advertising
              features so they start off private.
            </p>
          </div>
        </CardContent>
      </Card>

      {error && !loading && (
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
      )}

      {ADVERTISING_DATA_SECTIONS.map((section) => (
        <SettingsSection key={section.id} title={section.title}>
          {ADVERTISING_DATA_TOPICS.filter((t) => t.section === section.id).map((topic) => (
            <SettingsRow
              key={topic.id}
              icon={topic.icon}
              title={topic.title}
              description={rowDescription(topic, data)}
              value={loading ? '…' : rowValue(topic, prefs)}
              status="active"
              onClick={() => navigate(`/settings/advertising/${topic.id}`)}
            />
          ))}
        </SettingsSection>
      ))}
    </>
  );
}

function rowValue(topic: AdvertisingDataTopic, prefs: AdvertisingDataPrefs): string {
  switch (topic.kind) {
    case 'linked':
      return topic.prefKey && prefs[topic.prefKey] ? 'On' : 'Off';
    case 'personalisation':
      return prefs.personalized_recommendations ? 'On' : 'Off';
    case 'future':
      return topic.prefKey && prefs[topic.prefKey] ? 'On' : 'Off';
    case 'not-collected':
      return 'Not collected';
  }
}

function rowDescription(topic: AdvertisingDataTopic, data: AdvertisingDataSnapshot): string {
  if (topic.kind !== 'linked' || !topic.dataKey) return topic.listBlurb;
  return summariseAdvertisingData(topic.dataKey, data);
}
