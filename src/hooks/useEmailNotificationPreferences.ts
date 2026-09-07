import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

/**
 * Phase 5 email-alert preferences. Deliberately a SEPARATE system from
 * useNotificationPreferences (which reads/writes the JSONB
 * profiles.preferences.notifications blob via the patchMyPreferences RPC).
 *
 * These are plain boolean columns directly on `profiles`
 * (email_notifications_enabled, job_alert_emails, application_emails,
 * message_emails, network_emails, marketing_emails), following the same
 * `.from('profiles').update({...}).eq('user_id', ...)` pattern already used
 * by JobPreferencesDialog/EditProfileDialog for other plain profile columns.
 *
 * job_alert_emails in particular is intentionally NEVER inferred from
 * open_to_work/actively_looking or from the in-app "Jobs" notification
 * category above -- it is its own explicit opt-in, defaulting to false.
 */
export interface EmailNotificationPreferences {
  email_notifications_enabled: boolean;
  job_alert_emails: boolean;
  application_emails: boolean;
  message_emails: boolean;
  network_emails: boolean;
  marketing_emails: boolean;
}

export type EmailPreferenceKey = keyof EmailNotificationPreferences;

const DEFAULTS: EmailNotificationPreferences = {
  email_notifications_enabled: false,
  job_alert_emails: false,
  application_emails: false,
  message_emails: false,
  network_emails: false,
  marketing_emails: false,
};

export function useEmailNotificationPreferences() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<EmailNotificationPreferences>(DEFAULTS);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'email_notifications_enabled, job_alert_emails, application_emails, message_emails, network_emails, marketing_emails',
        )
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setUserId(user.id);
      if (!error && data) {
        setPrefs({
          email_notifications_enabled: data.email_notifications_enabled ?? DEFAULTS.email_notifications_enabled,
          job_alert_emails: data.job_alert_emails ?? DEFAULTS.job_alert_emails,
          application_emails: data.application_emails ?? DEFAULTS.application_emails,
          message_emails: data.message_emails ?? DEFAULTS.message_emails,
          network_emails: data.network_emails ?? DEFAULTS.network_emails,
          marketing_emails: data.marketing_emails ?? DEFAULTS.marketing_emails,
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setCategory = useCallback(
    async (key: EmailPreferenceKey, enabled: boolean) => {
      if (!userId) return;
      const previous = prefsRef.current;
      const optimistic = { ...previous, [key]: enabled };
      setPrefs(optimistic);
      setSaving(true);
      try {
        const { error } = await supabase.from('profiles').update({ [key]: enabled }).eq('user_id', userId);
        if (error) throw error;
        toast({
          title: enabled ? 'Email alerts on' : 'Email alerts off',
          description: `You’ll ${enabled ? 'now' : 'no longer'} get emails for “${key.replace(/_/g, ' ')}”.`,
        });
      } catch (err) {
        setPrefs(previous);
        toast({
          title: 'Couldn’t save',
          description: err instanceof Error ? err.message : 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setSaving(false);
      }
    },
    [userId, toast],
  );

  return { loading, saving, prefs, setCategory };
}
