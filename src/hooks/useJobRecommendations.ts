import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { JobMatchScoreRow } from '@/lib/jobMatch';

export interface RecommendedJob {
  id: string;
  title: string;
  company_name: string | null;
  company_id: string | null;
  description: string;
  location: string;
  employment_type: string;
  remote_option: string;
  salary_min: number | null;
  salary_max: number | null;
  currency: string | null;
  posted_at: string;
  company?: { name: string; logo_url: string | null } | null;
  score: number;
  matchedSkills: string[];
}

/** Candidate's stated preferences empty check -- drives which empty state Phase 2D shows. Mirrors the same "reuse existing profile columns" fields Phase 1 added/kept. */
export interface PreferenceSignals {
  open_to_roles: string[] | null;
  preferred_locations: string[] | null;
  job_type: string[] | null;
  preferred_work_modes: string[] | null;
  preferred_industries: string[] | null;
  open_to_work: boolean;
  actively_looking: boolean;
  salary_min_expected: number | null;
  salary_max_expected: number | null;
  salary_currency: string | null;
  expected_salary: string | null;
}

function hasAnyPreferenceSignal(p: PreferenceSignals | null): boolean {
  if (!p) return false;
  return Boolean(
    (p.open_to_roles && p.open_to_roles.length > 0) ||
    (p.preferred_locations && p.preferred_locations.length > 0) ||
    (p.job_type && p.job_type.length > 0) ||
    (p.preferred_work_modes && p.preferred_work_modes.length > 0)
  );
}

const RECOMMENDATION_LIMIT = 8;

/**
 * Reads server-generated recommendations only (job_recommendations +
 * jobs/companies for display) -- never computes or re-ranks a match score
 * in the browser. Two queries total for the list (recommendations, then one
 * batched `jobs.in(ids)` lookup), no per-card query.
 */
export function useJobRecommendations(userId: string | null) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState<RecommendedJob[]>([]);
  const [preferences, setPreferences] = useState<PreferenceSignals | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setError(null);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('open_to_roles, preferred_locations, job_type, preferred_work_modes, preferred_industries, open_to_work, actively_looking, salary_min_expected, salary_max_expected, salary_currency, expected_salary')
        .eq('user_id', userId)
        .single();
      setPreferences(profile as PreferenceSignals | null);

      const { data: recs, error: recErr } = await supabase
        .from('job_recommendations')
        .select('job_id, score, expires_at')
        .eq('user_id', userId)
        // Respect expires_at -- an expired row is stale, not a current
        // recommendation. `expires_at IS NULL` also passes (no expiry set).
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
        .order('rank', { ascending: true })
        .limit(RECOMMENDATION_LIMIT);
      if (recErr) throw recErr;

      if (!recs || recs.length === 0) {
        setJobs([]);
        return;
      }

      const jobIds = recs.map((r) => r.job_id);
      // Two batched queries for the whole list (never one per card): job
      // details, and matched_skills from the canonical hiring_match_scores.
      const [{ data: jobRows, error: jobsErr }, { data: scoreRows, error: scoresErr }] = await Promise.all([
        supabase
          .from('jobs')
          .select('id, title, company_name, company_id, description, location, employment_type, remote_option, salary_min, salary_max, currency, posted_at, company:companies(name, logo_url)')
          .in('id', jobIds),
        supabase
          .from('hiring_match_scores')
          .select('job_id, matched_skills')
          .eq('candidate_user_id', userId)
          .in('job_id', jobIds),
      ]);
      if (jobsErr) throw jobsErr;
      if (scoresErr) throw scoresErr;

      const scoreByJob = new Map(recs.map((r) => [r.job_id, r.score]));
      const skillsByJob = new Map((scoreRows || []).map((r) => [r.job_id, (r.matched_skills as string[]) || []]));
      const merged = (jobRows || [])
        .map((j) => ({ ...j, score: scoreByJob.get(j.id) ?? 0, matchedSkills: skillsByJob.get(j.id) ?? [] }))
        .sort((a, b) => b.score - a.score);
      setJobs(merged as RecommendedJob[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  /** Triggers the server-side batch recompute (refresh_job_recommendations_for_candidate), then re-reads. */
  const refresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      await supabase.rpc('refresh_job_recommendations_for_candidate', { p_user_id: userId, p_limit: RECOMMENDATION_LIMIT });
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [userId, load]);

  return {
    loading,
    refreshing,
    jobs,
    preferences,
    hasPreferenceSignal: hasAnyPreferenceSignal(preferences),
    error,
    refresh,
  };
}

/** Fetches the full breakdown for ONE job, on demand (only when "Why this matches" is opened) -- never fetched per-card up front. Reads the canonical hiring_match_scores table. */
export async function fetchMatchDetail(jobId: string, userId: string): Promise<JobMatchScoreRow | null> {
  const { data, error } = await supabase
    .from('hiring_match_scores')
    .select('id, job_id, score, eligibility_status, skills_score, experience_score, title_score, location_score, work_mode_score, employment_type_score, industry_score, salary_score, explanation, matched_skills, missing_skills, computed_at')
    .eq('job_id', jobId)
    .eq('candidate_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as JobMatchScoreRow | null;
}
