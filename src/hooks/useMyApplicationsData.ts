import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  ApplicationRow,
  InterviewRound,
  Offer,
  MatchScore,
} from '@/components/jobs/applicationTypes';

export interface MyApplicationsData {
  applications: ApplicationRow[];
  interviewsByApp: Record<string, InterviewRound[]>;
  offersByApp: Record<string, Offer>;
  matchByJob: Record<string, MatchScore>;
}

export const MY_APPLICATIONS_QUERY_KEY = ['my-applications'] as const;

async function fetchMyApplications(): Promise<MyApplicationsData> {
  const empty: MyApplicationsData = { applications: [], interviewsByApp: {}, offersByApp: {}, matchByJob: {} };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return empty;

  // hiring_applications is the single authoritative table for a candidate's
  // applications (RLS scopes it to candidate_user_id = auth.uid()).
  const { data: apps, error: appsError } = await supabase
    .from('hiring_applications')
    .select(`
      id, job_id, current_stage, stage_updated_at, created_at, resume_id, resume_sharing_revoked, source, rejection_reason,
      jobs (
        id, title, location, employment_type, remote_option, salary_min, salary_max, currency, posted_at, company_id, company_name,
        companies ( name, logo_url )
      )
    `)
    .eq('candidate_user_id', user.id)
    .order('created_at', { ascending: false });

  if (appsError) throw appsError;
  const list = (apps || []) as unknown as ApplicationRow[];
  if (list.length === 0) return empty;

  const ids = list.map((a) => a.id);
  const jobIds = list.map((a) => a.job_id);

  const [{ data: rounds }, { data: offers }, { data: matches }] = await Promise.all([
    supabase.from('hiring_interview_rounds').select('*').in('application_id', ids).order('scheduled_at', { ascending: true }),
    supabase.from('hiring_offers').select('*').in('application_id', ids),
    supabase.from('hiring_match_scores').select('*').eq('candidate_user_id', user.id).in('job_id', jobIds),
  ]);

  const interviewsByApp: Record<string, InterviewRound[]> = {};
  (rounds || []).forEach((r) => {
    (interviewsByApp[r.application_id] ||= []).push(r);
  });

  const offersByApp: Record<string, Offer> = {};
  (offers || []).forEach((o) => {
    offersByApp[o.application_id] = o;
  });

  const matchByJob: Record<string, MatchScore> = {};
  (matches || []).forEach((m) => {
    matchByJob[m.job_id] = m;
  });

  return { applications: list, interviewsByApp, offersByApp, matchByJob };
}

/**
 * One shared, cached fetch of everything the My Applications command center
 * needs. Both the centre workspace and the right-rail analytics call this and
 * read the same React Query cache, so their numbers never disagree. Mutations
 * (withdraw, respond-to-offer) invalidate `MY_APPLICATIONS_QUERY_KEY`.
 */
export function useMyApplicationsData() {
  return useQuery({
    queryKey: MY_APPLICATIONS_QUERY_KEY,
    queryFn: fetchMyApplications,
    staleTime: 30_000,
  });
}
