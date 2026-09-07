// Shared types + presentation helpers for the job-matching feature. All
// scoring/eligibility itself is computed server-side (calculate_job_match(),
// see supabase/migrations) -- nothing here recomputes a score or an
// eligibility decision. This file only shapes already-computed data for
// display and defines the exact same enum values the rest of the app
// already uses, so preference UI never introduces a new convention.

// Matches PostJobDialog.tsx's existing <SelectItem> values exactly -- do not
// add/rename values here without updating that form too.
export const WORK_MODE_OPTIONS = ['remote', 'hybrid', 'on-site'] as const;
export const EMPLOYMENT_TYPE_OPTIONS = ['full-time', 'part-time', 'contract', 'internship'] as const;

export const WORK_MODE_LABELS: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  'on-site': 'On-site',
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

export interface MatchExplanation {
  skills?: {
    required_total: number;
    required_matched: number;
    preferred_total: number;
    preferred_matched: number;
    missing_required: string[];
    missing_preferred: string[];
  };
  experience?: {
    candidate_years: number;
    min_required: number | null;
    max_target: number | null;
  };
  title?: { overlap_ratio: number };
  location?: { score: number };
  work_mode?: { job_mode: string | null; score: number };
  employment_type?: { job_type: string | null; score: number };
  industry?: { job_industry: string | null; score: number };
  salary?: { status: 'match' | 'mismatch' | 'unknown'; score: number };
  eligibility_reasons?: string[];
}

/** Shape of a row from the canonical `hiring_match_scores` table. */
export interface JobMatchScoreRow {
  id: string;
  job_id: string;
  score: number;
  eligibility_status: 'eligible' | 'not_eligible';
  skills_score: number | null;
  experience_score: number | null;
  title_score: number | null;
  location_score: number | null;
  work_mode_score: number | null;
  employment_type_score: number | null;
  industry_score: number | null;
  salary_score: number | null;
  explanation: MatchExplanation;
  matched_skills: string[];
  missing_skills: string[];
  computed_at: string;
}

/** Phase 19: Excellent 90-100, Strong 80-89, Good 70-79, Low <70. Numeric score always shown alongside this label -- never color-only. */
export function matchTier(score: number): { label: string; className: string } {
  if (score >= 90) return { label: 'Excellent', className: 'text-emerald-700 dark:text-emerald-400' };
  if (score >= 80) return { label: 'Strong', className: 'text-primary' };
  if (score >= 70) return { label: 'Good', className: 'text-amber-700 dark:text-amber-400' };
  return { label: 'Low', className: 'text-muted-foreground' };
}

/** Human-readable bullet lines built ONLY from the backend's own explanation JSON -- no invented text. */
export function explanationBullets(exp: MatchExplanation): { ok: boolean; text: string }[] {
  const lines: { ok: boolean; text: string }[] = [];
  if (exp.skills) {
    const { required_total, required_matched, preferred_total, preferred_matched } = exp.skills;
    if (required_total > 0) {
      lines.push({ ok: required_matched === required_total, text: `${required_matched}/${required_total} required skills match` });
    }
    if (preferred_total > 0) {
      lines.push({ ok: preferred_matched === preferred_total, text: `${preferred_matched}/${preferred_total} preferred skills match` });
    }
  }
  if (exp.experience) {
    const { candidate_years, min_required } = exp.experience;
    if (min_required != null) {
      lines.push({ ok: candidate_years >= min_required, text: candidate_years >= min_required ? 'Experience matches the requirement' : `Requires ${min_required}+ years experience` });
    }
  }
  if (exp.location) lines.push({ ok: exp.location.score >= 10, text: exp.location.score >= 10 ? 'Preferred location matches' : 'Location may not match your preference' });
  if (exp.work_mode) lines.push({ ok: exp.work_mode.score >= 5, text: exp.work_mode.score >= 5 ? 'Work mode matches' : 'Work mode may not match your preference' });
  if (exp.employment_type) lines.push({ ok: exp.employment_type.score >= 5, text: exp.employment_type.score >= 5 ? 'Employment type matches' : 'Employment type may differ from your preference' });
  if (exp.industry?.job_industry && exp.industry.score >= 5) {
    lines.push({ ok: true, text: 'Industry matches your preference' });
  }
  if (exp.salary) {
    if (exp.salary.status === 'match') lines.push({ ok: true, text: 'Salary range overlaps' });
    else if (exp.salary.status === 'mismatch') lines.push({ ok: false, text: 'Salary preference is outside this job’s range' });
    // 'unknown' -> intentionally silent, per "missing salary is Unknown, not a failure"
  }
  if (exp.skills?.missing_required?.length) {
    for (const s of exp.skills.missing_required) lines.push({ ok: false, text: `Missing required skill: ${s}` });
  }
  if (exp.skills?.missing_preferred?.length) {
    for (const s of exp.skills.missing_preferred) lines.push({ ok: false, text: `Missing preferred skill: ${s}` });
  }
  return lines;
}
