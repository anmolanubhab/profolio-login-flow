
import { supabase } from "@/integrations/supabase/client";
import { Job } from "@/hooks/useJobFeed";

export interface JobPreferences {
  roles?: string[];
  locations?: string[];
  job_type?: string[];
  experience_level?: string[];
}

export interface NotificationPreferences {
  job_alerts?: boolean;
  email_frequency?: 'instant' | 'daily' | 'weekly' | 'never';
}

export interface AlertLog {
  id: string;
  user_id: string;
  job_id: string;
  sent_at: string;
  channel: 'email' | 'in_app';
}

export const checkAndGenerateJobAlerts = async (userId: string) => {
  console.log("Checking job alerts for user:", userId);

  // 1. Fetch User Profile & Preferences
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('preferences')
    .eq('user_id', userId)
    .single();

  if (profileError || !profile?.preferences) {
    console.log("No preferences found or error fetching profile:", profileError);
    return;
  }

  const prefs = profile.preferences as any;
  const jobPrefs: JobPreferences = prefs.job_preferences || {};
  const notifPrefs: NotificationPreferences = prefs.notifications || {};

  // Check if alerts are enabled
  if (notifPrefs.job_alerts === false) {
    console.log("Job alerts are disabled for this user.");
    return;
  }

  // 2. Fetch Potential Jobs (e.g., created in the last 7 days)
  // In a real system, this would be based on "since last check" or "newly created"
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*')
    .gte('posted_at', oneWeekAgo.toISOString());

  if (jobsError || !jobs) {
    console.error("Error fetching jobs:", jobsError);
    return;
  }

  // 3. Filter Matches
  const matchingJobs = jobs.filter(job => {
    // Role Match (partial match on title)
    const roleMatch = !jobPrefs.roles?.length || jobPrefs.roles.some(role => 
      job.title.toLowerCase().includes(role.toLowerCase())
    );

    // Location Match
    const locationMatch = !jobPrefs.locations?.length || jobPrefs.locations.some(loc => 
      job.location.toLowerCase().includes(loc.toLowerCase()) || 
      (loc.toLowerCase() === 'remote' && job.remote_option === 'remote')
    );

    // Type Match
    const typeMatch = !jobPrefs.job_type?.length || jobPrefs.job_type.includes(job.employment_type);

    return roleMatch && locationMatch && typeMatch;
  });

  if (matchingJobs.length === 0) {
    console.log("No matching jobs found.");
    return;
  }

  // 4. Check for duplicates (already sent alerts)
  const { data: existingLogs } = await supabase
    .from('job_alerts_log')
    .select('job_id, channel')
    .eq('user_id', userId);

  const sentJobIdsInApp = new Set(existingLogs?.filter(l => l.channel === 'in_app').map(l => l.job_id));
  const sentJobIdsEmail = new Set(existingLogs?.filter(l => l.channel === 'email').map(l => l.job_id));

  // 5. Generate Alerts
  const newInAppAlerts = matchingJobs.filter(job => !sentJobIdsInApp.has(job.id));
  const newEmailAlerts = matchingJobs.filter(job => !sentJobIdsEmail.has(job.id));

  // Create In-App Notifications
  for (const job of newInAppAlerts) {
    // Log
    await supabase.from('job_alerts_log').insert({
      user_id: userId,
      job_id: job.id,
      channel: 'in_app'
    });

    // Notify
    await supabase.from('notifications').insert({
      user_id: userId,
      type: 'job_alert',
      title: 'New Job Match found!',
      message: `A new job "${job.title}" at ${job.company_name || 'a company'} matches your preferences.`,
      link: `/jobs?jobId=${job.id}`,
      data: { job_id: job.id }
    });
  }

  // Mock Email Sending (if frequency allows)
  if (notifPrefs.email_frequency !== 'never' && newEmailAlerts.length > 0) {
    // In a real system, we'd queue this. For now, we just log it as "sent" to avoid duplicates.
    // Logic for daily/weekly digest would go here (e.g. check last sent email time).
    // For this implementation, we'll treat 'instant' as immediate log, and others as placeholders.
    
    if (notifPrefs.email_frequency === 'instant') {
      for (const job of newEmailAlerts) {
        await supabase.from('job_alerts_log').insert({
          user_id: userId,
          job_id: job.id,
          channel: 'email'
        });
        console.log(`[MOCK EMAIL] Sent email to user ${userId} for job ${job.title}`);
      }
    }
  }
};
