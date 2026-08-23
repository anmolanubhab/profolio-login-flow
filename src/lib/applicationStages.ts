import { Database } from '@/integrations/supabase/types';

export type ApplicationStage = Database['public']['Enums']['application_stage'];

// Candidate-facing labels for the internal hiring_applications.current_stage
// enum -- the UI must never show raw enum values like "interview_scheduled".
export const STAGE_LABELS: Record<ApplicationStage, string> = {
  applied: 'Applied',
  screening: 'Under Review',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview Scheduled',
  interview_completed: 'Interview Completed',
  offer_extended: 'Offer Received',
  offer_accepted: 'Offer Accepted',
  offer_declined: 'Offer Declined',
  hired: 'Hired',
  rejected: 'Not Selected',
  withdrawn: 'Withdrawn',
};

// Badge tone per stage -- kept to the app's existing semantic colors
// (success/primary/muted/destructive), no new palette.
export const STAGE_TONE: Record<ApplicationStage, 'default' | 'success' | 'muted' | 'destructive'> = {
  applied: 'default',
  screening: 'default',
  shortlisted: 'default',
  interview_scheduled: 'default',
  interview_completed: 'default',
  offer_extended: 'success',
  offer_accepted: 'success',
  hired: 'success',
  offer_declined: 'muted',
  rejected: 'destructive',
  withdrawn: 'muted',
};

export const STAGE_TONE_CLASSES: Record<'default' | 'success' | 'muted' | 'destructive', string> = {
  default: 'bg-primary/10 text-primary border-primary/20',
  success: 'bg-success/10 text-success border-success/20',
  muted: 'bg-muted text-muted-foreground border-transparent',
  destructive: 'bg-destructive/10 text-destructive border-destructive/20',
};

export type ApplicationFilter = 'all' | 'active' | 'interviews' | 'offers' | 'closed';

export const ACTIVE_STAGES: ApplicationStage[] = [
  'applied', 'screening', 'shortlisted', 'interview_scheduled', 'interview_completed', 'offer_extended',
];
export const INTERVIEW_STAGES: ApplicationStage[] = ['interview_scheduled', 'interview_completed'];
export const OFFER_STAGES: ApplicationStage[] = ['offer_extended', 'offer_accepted', 'hired'];
export const CLOSED_STAGES: ApplicationStage[] = ['rejected', 'withdrawn', 'offer_declined'];

export function matchesFilter(stage: ApplicationStage, filter: ApplicationFilter): boolean {
  switch (filter) {
    case 'active': return ACTIVE_STAGES.includes(stage);
    case 'interviews': return INTERVIEW_STAGES.includes(stage);
    case 'offers': return OFFER_STAGES.includes(stage);
    case 'closed': return CLOSED_STAGES.includes(stage);
    default: return true;
  }
}

// Contextual progress steps for a given stage -- never the same generic
// 4-step chain for every application (a rejected app must not show a future
// "Offer" step as if it were still coming).
export interface ProgressStep {
  label: string;
  state: 'done' | 'current' | 'upcoming' | 'stopped';
}

export function progressSteps(stage: ApplicationStage): ProgressStep[] {
  if (stage === 'withdrawn') {
    return [
      { label: 'Applied', state: 'done' },
      { label: 'Withdrawn', state: 'stopped' },
    ];
  }
  if (stage === 'rejected') {
    return [
      { label: 'Applied', state: 'done' },
      { label: 'Reviewed', state: 'done' },
      { label: 'Not Selected', state: 'stopped' },
    ];
  }
  if (stage === 'offer_declined') {
    return [
      { label: 'Applied', state: 'done' },
      { label: 'Reviewed', state: 'done' },
      { label: 'Interview', state: 'done' },
      { label: 'Offer', state: 'done' },
      { label: 'Declined', state: 'stopped' },
    ];
  }

  const chain: { key: ApplicationStage[]; label: string }[] = [
    { key: ['applied'], label: 'Applied' },
    { key: ['screening'], label: 'Reviewed' },
    { key: ['shortlisted', 'interview_scheduled', 'interview_completed'], label: 'Interview' },
    { key: ['offer_extended'], label: 'Offer' },
    { key: ['offer_accepted', 'hired'], label: stage === 'hired' ? 'Hired' : 'Accepted' },
  ];

  const currentIndex = chain.findIndex((step) => step.key.includes(stage));
  return chain.map((step, i) => ({
    label: step.label,
    state: i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'upcoming',
  }));
}

// An offer that's currently awaiting the candidate's response -- once it's
// been accepted/declined, or its expires_at has passed, it no longer blocks
// withdrawal (mirrors the server-side guard in update_application_stage()).
export function hasActiveOffer(offer?: { status: string; expires_at: string | null } | null): boolean {
  if (!offer || offer.status !== 'extended') return false;
  if (!offer.expires_at) return true;
  return new Date(offer.expires_at).getTime() > Date.now();
}

export function canWithdrawApplication(
  stage: ApplicationStage,
  offer?: { status: string; expires_at: string | null } | null
): boolean {
  return ACTIVE_STAGES.includes(stage) && !hasActiveOffer(offer);
}

export function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export type NextActionKind = 'prepare_interview' | 'follow_up' | 'review_offer' | 'explore_similar' | 'celebrate';

export interface NextActionInfo {
  kind: NextActionKind;
  eyebrow: string;
  title: string;
  description: string;
}

// Every action here is derived from real application state -- never invented
// when the underlying data (an interview round, an offer expiry) isn't there.
export function getNextAction(params: {
  stage: ApplicationStage;
  stageUpdatedAt: string;
  upcomingInterview?: { scheduled_at: string | null } | null;
  offer?: { expires_at: string | null } | null;
}): NextActionInfo | null {
  const { stage, stageUpdatedAt, upcomingInterview, offer } = params;

  if (INTERVIEW_STAGES.includes(stage) && upcomingInterview?.scheduled_at) {
    const when = new Date(upcomingInterview.scheduled_at);
    const isFuture = when.getTime() > Date.now();
    return {
      kind: 'prepare_interview',
      eyebrow: 'NEXT STEP',
      title: isFuture ? 'Prepare for your interview' : 'Interview feedback pending',
      description: isFuture
        ? `Interview on ${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
        : 'Waiting to hear back on your recent interview.',
    };
  }

  if (stage === 'offer_extended') {
    if (offer?.expires_at) {
      const days = Math.ceil((new Date(offer.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        kind: 'review_offer',
        eyebrow: 'ACTION REQUIRED',
        title: days >= 0 ? `Your offer expires in ${days} day${days === 1 ? '' : 's'}` : 'Your offer has expired',
        description: 'Review the offer details and respond.',
      };
    }
    return {
      kind: 'review_offer',
      eyebrow: 'ACTION REQUIRED',
      title: 'You have an offer!',
      description: 'Review the offer details and respond.',
    };
  }

  if (ACTIVE_STAGES.includes(stage) && !INTERVIEW_STAGES.includes(stage)) {
    const idleDays = daysSince(stageUpdatedAt);
    if (idleDays >= 7) {
      return {
        kind: 'follow_up',
        eyebrow: 'NEXT STEP',
        title: 'Follow up recommended',
        description: `No update for ${idleDays} days.`,
      };
    }
  }

  if (CLOSED_STAGES.includes(stage)) {
    return {
      kind: 'explore_similar',
      eyebrow: 'NEXT STEP',
      title: 'Keep going',
      description: 'Explore similar roles that match your skills.',
    };
  }

  if (stage === 'hired' || stage === 'offer_accepted') {
    return {
      kind: 'celebrate',
      eyebrow: '',
      title: stage === 'hired' ? "You're hired! 🎉" : 'Offer accepted 🎉',
      description: 'Congratulations on the next step in your career.',
    };
  }

  return null;
}
