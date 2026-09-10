// Pure, data-derived analytics for the "My Applications" command center.
// Every number here comes from real hiring_applications rows -- nothing is
// invented or hard-coded. Shared by the centre workspace and the right rail
// so both always agree.
import type { ApplicationStage } from '@/lib/applicationStages';
import {
  ACTIVE_STAGES,
  INTERVIEW_STAGES,
  daysSince,
} from '@/lib/applicationStages';
import type { ApplicationRow, InterviewRound, Offer } from '@/components/jobs/applicationTypes';
import { companyName } from '@/components/jobs/applicationTypes';

const OFFER_STAGES: ApplicationStage[] = ['offer_extended', 'offer_accepted', 'hired', 'offer_declined'];
const ACCEPTED_STAGES: ApplicationStage[] = ['offer_accepted', 'hired'];
// "Reviewed or further" -- the recruiter engaged with the application beyond
// the raw submission. A withdrawal straight from `applied` never got there.
const REVIEWED_OR_BEYOND: ApplicationStage[] = [
  'screening', 'shortlisted',
  'interview_offered', 'interview_scheduled', 'interview_completed',
  'offer_extended', 'offer_accepted', 'offer_declined', 'hired',
  'rejected',
];

function hasInterview(appId: string, interviewsByApp: Record<string, InterviewRound[]>): boolean {
  return (interviewsByApp[appId]?.length ?? 0) > 0;
}

export interface AppStats {
  total: number;
  active: number;
  interviews: number;
  offers: number;
  appliedThisWeek: number;
}

export function computeStats(
  apps: ApplicationRow[],
  interviewsByApp: Record<string, InterviewRound[]>,
): AppStats {
  const total = apps.length;
  const active = apps.filter((a) => ACTIVE_STAGES.includes(a.current_stage)).length;
  const interviews = apps.filter(
    (a) => INTERVIEW_STAGES.includes(a.current_stage) || hasInterview(a.id, interviewsByApp),
  ).length;
  const offers = apps.filter((a) => a.current_stage === 'offer_extended').length;
  const appliedThisWeek = apps.filter((a) => daysSince(a.created_at) < 7).length;
  return { total, active, interviews, offers, appliedThisWeek };
}

export interface Funnel {
  applied: number;
  reviewed: number;
  interview: number;
  offers: number;
  accepted: number;
}

// "Ever reached this stage" counts -- funnel semantics, so each number is a
// superset of the one to its right wherever the pipeline is linear.
export function computeFunnel(
  apps: ApplicationRow[],
  interviewsByApp: Record<string, InterviewRound[]>,
): Funnel {
  const applied = apps.length;
  const reviewed = apps.filter(
    (a) => REVIEWED_OR_BEYOND.includes(a.current_stage) || INTERVIEW_STAGES.includes(a.current_stage) || hasInterview(a.id, interviewsByApp),
  ).length;
  const interview = apps.filter(
    (a) =>
      INTERVIEW_STAGES.includes(a.current_stage) ||
      OFFER_STAGES.includes(a.current_stage) ||
      hasInterview(a.id, interviewsByApp),
  ).length;
  const offers = apps.filter((a) => OFFER_STAGES.includes(a.current_stage)).length;
  const accepted = apps.filter((a) => ACCEPTED_STAGES.includes(a.current_stage)).length;
  return { applied, reviewed, interview, offers, accepted };
}

export interface AppMetrics {
  responseRate: number | null;
  interviewRate: number | null;
  avgResponseDays: number | null;
  applicationsThisMonth: number;
}

export function computeMetrics(
  apps: ApplicationRow[],
  interviewsByApp: Record<string, InterviewRound[]>,
): AppMetrics {
  const total = apps.length;
  if (total === 0) {
    return { responseRate: null, interviewRate: null, avgResponseDays: null, applicationsThisMonth: 0 };
  }

  const responded = apps.filter((a) => REVIEWED_OR_BEYOND.includes(a.current_stage) || INTERVIEW_STAGES.includes(a.current_stage));
  const interviewed = apps.filter(
    (a) => INTERVIEW_STAGES.includes(a.current_stage) || OFFER_STAGES.includes(a.current_stage) || hasInterview(a.id, interviewsByApp),
  );

  // We only have created_at (submitted) + stage_updated_at (last change), not
  // a first-response timestamp, so this approximates "time to first movement"
  // for applications that have moved off `applied`.
  const moved = apps.filter((a) => a.current_stage !== 'applied');
  const avgResponseDays =
    moved.length > 0
      ? Math.round(
          moved.reduce((sum, a) => sum + Math.max(0, daysSince(a.created_at) - daysSince(a.stage_updated_at)), 0) /
            moved.length,
        )
      : null;

  const now = new Date();
  const applicationsThisMonth = apps.filter((a) => {
    const d = new Date(a.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  return {
    responseRate: Math.round((responded.length / total) * 100),
    interviewRate: Math.round((interviewed.length / total) * 100),
    avgResponseDays,
    applicationsThisMonth,
  };
}

// --- Follow-ups ----------------------------------------------------------------

export interface FollowUpItem {
  app: ApplicationRow;
  idleDays: number;
}

// An application in an active, non-interview stage with no movement for a
// week+ -- the same rule getNextAction() uses for its "Follow up recommended".
export function followUpsDue(apps: ApplicationRow[]): FollowUpItem[] {
  return apps
    .filter(
      (a) =>
        ACTIVE_STAGES.includes(a.current_stage) &&
        !INTERVIEW_STAGES.includes(a.current_stage) &&
        a.current_stage !== 'offer_extended' &&
        daysSince(a.stage_updated_at) >= 7,
    )
    .map((a) => ({ app: a, idleDays: daysSince(a.stage_updated_at) }))
    .sort((x, y) => y.idleDays - x.idleDays);
}

// --- Next best action --------------------------------------------------------

export type NextActionType = 'follow_up' | 'prepare_interview' | 'review_offer' | 'caught_up';

export interface NextBestAction {
  type: NextActionType;
  app: ApplicationRow | null;
  eyebrow: string;
  title: string;
  detail: string;
}

export function computeNextBestAction(
  apps: ApplicationRow[],
  interviewsByApp: Record<string, InterviewRound[]>,
  offersByApp: Record<string, Offer>,
): NextBestAction {
  // 1. an offer awaiting a response is the most time-critical.
  const offerApp = apps.find((a) => a.current_stage === 'offer_extended');
  if (offerApp) {
    const offer = offersByApp[offerApp.id];
    let detail = 'Review the offer details and respond.';
    if (offer?.expires_at) {
      const days = Math.ceil((new Date(offer.expires_at).getTime() - Date.now()) / 86_400_000);
      detail = days >= 0 ? `Offer expires in ${days} day${days === 1 ? '' : 's'}.` : 'This offer has expired.';
    }
    return {
      type: 'review_offer',
      app: offerApp,
      eyebrow: 'Action required',
      title: `Respond to your offer from ${companyName(offerApp.jobs)}`,
      detail,
    };
  }

  // 2. an upcoming interview to prepare for.
  const withInterview = apps
    .map((a) => {
      const next = (interviewsByApp[a.id] || [])
        .filter((r) => r.status === 'scheduled' && r.scheduled_at && new Date(r.scheduled_at).getTime() > Date.now())
        .sort((x, y) => new Date(x.scheduled_at || 0).getTime() - new Date(y.scheduled_at || 0).getTime())[0];
      return next ? { a, when: new Date(next.scheduled_at as string) } : null;
    })
    .filter(Boolean)
    .sort((x, y) => x!.when.getTime() - y!.when.getTime())[0];
  if (withInterview) {
    const { a, when } = withInterview;
    return {
      type: 'prepare_interview',
      app: a,
      eyebrow: 'Coming up',
      title: `Prepare for your interview with ${companyName(a.jobs)}`,
      detail: `${when.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
    };
  }

  // 3. the most overdue follow-up.
  const overdue = followUpsDue(apps)[0];
  if (overdue) {
    return {
      type: 'follow_up',
      app: overdue.app,
      eyebrow: 'Your next move',
      title: `Follow up with ${companyName(overdue.app.jobs)}`,
      detail: `You applied ${overdue.idleDays} days ago and haven't had an update.`,
    };
  }

  return {
    type: 'caught_up',
    app: null,
    eyebrow: 'Nice work',
    title: "You're all caught up 🎉",
    detail: apps.length > 0 ? 'No applications need your attention right now.' : 'Start applying to track your search here.',
  };
}

// --- Sorting ---------------------------------------------------------------

export type SortKey = 'updated' | 'applied' | 'followup' | 'company' | 'status';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'updated', label: 'Recently updated' },
  { key: 'applied', label: 'Recently applied' },
  { key: 'followup', label: 'Follow-up due' },
  { key: 'company', label: 'Company A–Z' },
  { key: 'status', label: 'Status' },
];

const STATUS_ORDER: ApplicationStage[] = [
  'offer_extended', 'interview_scheduled', 'interview_offered', 'interview_completed',
  'shortlisted', 'screening', 'applied',
  'offer_accepted', 'hired',
  'offer_declined', 'rejected', 'withdrawn',
];

export function sortApplications(apps: ApplicationRow[], key: SortKey): ApplicationRow[] {
  const copy = [...apps];
  switch (key) {
    case 'applied':
      return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'followup':
      return copy.sort((a, b) => {
        const af = followsUp(a) ? daysSince(a.stage_updated_at) : -1;
        const bf = followsUp(b) ? daysSince(b.stage_updated_at) : -1;
        return bf - af;
      });
    case 'company':
      return copy.sort((a, b) => companyName(a.jobs).localeCompare(companyName(b.jobs)));
    case 'status':
      return copy.sort((a, b) => STATUS_ORDER.indexOf(a.current_stage) - STATUS_ORDER.indexOf(b.current_stage));
    case 'updated':
    default:
      return copy.sort((a, b) => new Date(b.stage_updated_at).getTime() - new Date(a.stage_updated_at).getTime());
  }
}

function followsUp(a: ApplicationRow): boolean {
  return (
    ACTIVE_STAGES.includes(a.current_stage) &&
    !INTERVIEW_STAGES.includes(a.current_stage) &&
    a.current_stage !== 'offer_extended' &&
    daysSince(a.stage_updated_at) >= 7
  );
}

// --- Advanced filters (client-side, over the already-loaded list) ---------

export interface AdvancedFilters {
  jobType: string | null;
  workMode: string | null;
  followUpOnly: boolean;
}

export const EMPTY_ADVANCED_FILTERS: AdvancedFilters = { jobType: null, workMode: null, followUpOnly: false };

export function matchesAdvanced(a: ApplicationRow, f: AdvancedFilters): boolean {
  if (f.jobType && (a.jobs.employment_type || '') !== f.jobType) return false;
  if (f.workMode && (a.jobs.remote_option || '') !== f.workMode) return false;
  if (f.followUpOnly && !followsUp(a)) return false;
  return true;
}
