// Client-side "jobs based on your preferences" ranking -- deliberately
// simple and honest: it only uses signals that actually exist on the
// candidate's profile (open_to_roles, preferred_locations, job_type,
// skills), never fabricates experience/salary matches, and returns no
// recommendations at all when none of those signals are set.

export interface CandidateSignals {
  openToRoles: string[] | null;
  preferredLocations: string[] | null;
  jobType: string[] | null;
  skills: string[] | null;
}

export interface RecommendableJob {
  id: string;
  title: string;
  location: string | null;
  employment_type: string | null;
  remote_option: string | null;
  description: string | null;
}

export function hasAnySignal(signals: CandidateSignals): boolean {
  return Boolean(
    (signals.openToRoles && signals.openToRoles.length > 0) ||
    (signals.preferredLocations && signals.preferredLocations.length > 0) ||
    (signals.jobType && signals.jobType.length > 0) ||
    (signals.skills && signals.skills.length > 0)
  );
}

const norm = (s: string) => s.trim().toLowerCase();

/** Returns { job, score, reasons } for jobs that match at least one real signal, sorted by score desc. */
export function rankJobsByPreference<T extends RecommendableJob>(
  jobs: T[],
  signals: CandidateSignals
): { job: T; score: number; reasons: string[] }[] {
  const roles = (signals.openToRoles || []).map(norm);
  const locations = (signals.preferredLocations || []).map(norm);
  const types = (signals.jobType || []).map(norm);
  const skills = (signals.skills || []).map(norm);

  const results = jobs.map((job) => {
    let score = 0;
    const reasons: string[] = [];
    const title = norm(job.title || '');
    const location = norm(job.location || '');
    const type = norm(job.employment_type || '');
    const remote = norm(job.remote_option || '');
    const description = norm(job.description || '');

    if (roles.length > 0 && roles.some((r) => title.includes(r) || r.includes(title))) {
      score += 3;
      reasons.push('Matches a role you’re open to');
    }
    if (locations.length > 0 && locations.some((l) => location.includes(l) || l.includes(location))) {
      score += 2;
      reasons.push('In a preferred location');
    }
    if (types.length > 0 && types.some((t) => type.includes(t) || t.includes(type) || remote.includes(t))) {
      score += 1;
      reasons.push('Matches your preferred job type');
    }
    if (skills.length > 0 && skills.some((s) => description.includes(s) || title.includes(s))) {
      score += 1;
      reasons.push('Matches your skills');
    }

    return { job, score, reasons };
  });

  return results.filter((r) => r.score > 0).sort((a, b) => b.score - a.score);
}
