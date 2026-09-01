import { useNavigate } from 'react-router-dom';
import {
  Download,
  DatabaseZap,
  History,
  Sparkles,
  SlidersHorizontal,
  ClipboardList,
  Handshake,
  Plug,
  CalendarClock,
  Share2,
} from 'lucide-react';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsRow } from '@/components/settings/SettingsRow';

export function DataPrivacySettings() {
  const navigate = useNavigate();

  return (
    <>
      <SettingsSection title="How the application uses your data">
        <SettingsRow
          icon={Download}
          title="Download your data"
          description="Get a copy of your account, profile and posts as a file"
          status="active"
          onClick={() => navigate('/settings/privacy/download-data')}
        />
        <SettingsRow
          icon={DatabaseZap}
          title="Manage your data"
          description="Your connected sign-in methods, and bulk-delete your posts or comments"
          status="active"
          onClick={() => navigate('/settings/privacy/manage-data')}
        />
        <SettingsRow
          icon={History}
          title="Search history"
          description="Profolio doesn’t keep a history of your searches"
          status="unavailable"
        />
        <SettingsRow
          icon={Sparkles}
          title="Personalization data"
          description="Profolio doesn’t build a personalization profile from your activity"
          status="unavailable"
        />
      </SettingsSection>

      <SettingsSection title="Job seeking privacy">
        <SettingsRow
          icon={SlidersHorizontal}
          title="Job seeking preferences"
          description="Roles, locations, salary and job types used for your recommendations"
          status="active"
          onClick={() => navigate('/jobs')}
        />
        <SettingsRow
          icon={ClipboardList}
          title="Stored applicant information"
          description="Review or withdraw the job applications you’ve submitted"
          status="active"
          onClick={() => navigate('/dashboard?tab=applications')}
        />
        <SettingsRow
          icon={Handshake}
          title="Sharing profile with recruiters"
          description="Recruiter candidate search, and what they can see (profile, résumé, links)"
          status="active"
          onClick={() => navigate('/settings/visibility')}
        />
      </SettingsSection>

      <SettingsSection title="Other privacy controls">
        <SettingsRow
          icon={Plug}
          title="Connected services"
          description="Sign-in methods linked to your account"
          status="active"
          onClick={() => navigate('/settings/privacy/connected-services')}
        />
        <SettingsRow
          icon={CalendarClock}
          title="Calendar & contact sync"
          description="Profolio has no calendar or contacts integration"
          status="unavailable"
        />
        <SettingsRow
          icon={Share2}
          title="Data sharing preferences"
          description="Profolio doesn’t share your data with third parties"
          status="unavailable"
        />
      </SettingsSection>
    </>
  );
}
