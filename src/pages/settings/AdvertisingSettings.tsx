import { useNavigate } from 'react-router-dom';
import { ShieldOff, Sparkles, Handshake, Download, DatabaseZap } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';
import { useProfileSettings } from '@/hooks/useProfileSettings';

/**
 * Profolio has no advertising product, so LinkedIn's 16 ad-targeting rows
 * don't apply. This is the honest equivalent: state plainly that there are no
 * ads / no data selling, expose the one real activity-personalisation control,
 * and link to the data controls that genuinely exist.
 */
export function AdvertisingSettings() {
  const navigate = useNavigate();
  const { loading, saving, settings, togglePersonalizedRecommendations } = useProfileSettings();

  return (
    <>
      <Card className="bg-card shadow-card border-0">
        <CardContent className="flex items-start gap-3 p-4 sm:p-5">
          <ShieldOff className="h-5 w-5 shrink-0 text-primary mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Profolio doesn’t run ads</p>
            <p>
              There are no advertisers on Profolio, no ad-targeting profile is built about
              you, and your data is never sold or shared with data brokers or ad networks.
              The only place your activity is used is to personalise what you see in the app.
            </p>
          </div>
        </CardContent>
      </Card>

      <SettingsSection title="Personalisation">
        {loading ? (
          <div className="px-4 py-6 sm:px-5">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="px-4 py-3.5 sm:px-5 flex items-center justify-between gap-4">
            <div className="space-y-0.5 min-w-0">
              <Label htmlFor="personalized_recommendations" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Personalised recommendations
              </Label>
              <p className="text-xs text-muted-foreground">
                Use your activity — reactions, follows and “Interested” posts — to rank your
                “For You” feed. Turn this off to see it strictly newest-first.
              </p>
            </div>
            <Switch
              id="personalized_recommendations"
              checked={settings.personalized_recommendations}
              onCheckedChange={togglePersonalizedRecommendations}
              disabled={saving}
            />
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Related data controls">
        <SettingsRow
          icon={Handshake}
          title="Sharing with recruiters"
          description="Recruiter candidate search, and what they can see"
          status="active"
          onClick={() => navigate('/settings/visibility')}
        />
        <SettingsRow
          icon={Download}
          title="Download your data"
          status="active"
          onClick={() => navigate('/settings/privacy/download-data')}
        />
        <SettingsRow
          icon={DatabaseZap}
          title="Manage or delete your data"
          status="active"
          onClick={() => navigate('/settings/privacy/manage-data')}
        />
      </SettingsSection>
    </>
  );
}
