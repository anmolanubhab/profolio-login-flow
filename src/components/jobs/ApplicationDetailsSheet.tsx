import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  MapPin, Briefcase, DollarSign, FileText, Calendar, ExternalLink,
  Video, Sparkles, Check, Undo2, Loader2, PartyPopper, XCircle, Clock3,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  STAGE_LABELS, STAGE_TONE, STAGE_TONE_CLASSES, canWithdrawApplication, getNextAction,
} from '@/lib/applicationStages';
import {
  ApplicationRow, InterviewRound, Offer, MatchScore, ApplicationEvent,
  companyName, companyLogo, formatSalary,
} from './applicationTypes';

const EVENT_LABELS: Record<string, string> = {
  created: 'Application submitted',
  stage_changed: 'Stage updated',
  note_added: 'Note added',
  interview_scheduled: 'Interview scheduled',
  interview_feedback_submitted: 'Interview feedback submitted',
  offer_created: 'Offer extended',
  offer_accepted: 'Offer accepted',
  offer_declined: 'Offer declined',
  withdrawn: 'Application withdrawn',
};

function eventLabel(event: ApplicationEvent): string {
  if (event.event_type === 'stage_changed' && event.to_stage) {
    return STAGE_LABELS[event.to_stage] || EVENT_LABELS.stage_changed;
  }
  return EVENT_LABELS[event.event_type] || event.event_type;
}

interface ApplicationDetailsSheetProps {
  application: ApplicationRow | null;
  interviewRounds: InterviewRound[];
  offer: Offer | null;
  matchScore: MatchScore | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWithdraw: (applicationId: string) => Promise<void>;
  onRespondToOffer: (offerId: string, applicationId: string, accept: boolean, reason?: string) => Promise<void>;
}

export function ApplicationDetailsSheet({
  application, interviewRounds, offer, matchScore, open, onOpenChange, onWithdraw, onRespondToOffer,
}: ApplicationDetailsSheetProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<ApplicationEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [resumeTitle, setResumeTitle] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [respondingToOffer, setRespondingToOffer] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [declineReason, setDeclineReason] = useState('');

  useEffect(() => {
    if (!open || !application) return;

    let cancelled = false;
    setLoadingEvents(true);
    supabase
      .from('hiring_application_events')
      .select('*')
      .eq('application_id', application.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!cancelled) {
          setEvents(data || []);
          setLoadingEvents(false);
        }
      });

    if (application.resume_id) {
      supabase
        .from('resumes')
        .select('title')
        .eq('id', application.resume_id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled) setResumeTitle(data?.title || null);
        });
    } else {
      setResumeTitle(null);
    }

    return () => { cancelled = true; };
  }, [open, application]);

  if (!application) return null;
  const job = application.jobs;
  const tone = STAGE_TONE[application.current_stage];
  const canWithdraw = canWithdrawApplication(application.current_stage, offer);

  const upcomingInterview = interviewRounds
    .filter((r) => r.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime())[0];

  const nextAction = getNextAction({
    stage: application.current_stage,
    stageUpdatedAt: application.stage_updated_at,
    upcomingInterview,
    offer,
  });

  const handleWithdraw = async () => {
    setWithdrawing(true);
    await onWithdraw(application.id);
    setWithdrawing(false);
  };

  const offerExpired = !!(offer?.status === 'extended' && offer.expires_at && new Date(offer.expires_at).getTime() < Date.now());

  const handleAcceptOffer = async () => {
    if (!offer) return;
    setRespondingToOffer(true);
    await onRespondToOffer(offer.id, application.id, true);
    setRespondingToOffer(false);
  };

  const handleDeclineOffer = async () => {
    if (!offer) return;
    setRespondingToOffer(true);
    await onRespondToOffer(offer.id, application.id, false, declineReason.trim() || undefined);
    setRespondingToOffer(false);
    setShowDeclineDialog(false);
    setDeclineReason('');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4 text-left space-y-2 sticky top-0 bg-background z-10 border-b">
          <SheetTitle className="text-xl">{job.title}</SheetTitle>
          <p className="text-sm text-muted-foreground -mt-1">{companyName(job)}</p>
          <Badge variant="outline" className={cn('w-fit', STAGE_TONE_CLASSES[tone])}>
            {STAGE_LABELS[application.current_stage]}
          </Badge>
        </SheetHeader>

        <div className="p-6 pt-4 space-y-6">
          {/* Job snapshot */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Job</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              {job.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
              {job.employment_type && <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" />{job.employment_type}</span>}
              {job.remote_option && <span>{job.remote_option}</span>}
            </div>
            {formatSalary(job) && (
              <div className="flex items-center gap-1.5 text-sm text-primary font-medium">
                <DollarSign className="h-3.5 w-3.5" />{formatSalary(job)}
              </div>
            )}
          </div>

          <Separator />

          {/* Your application */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Your Application</h4>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              Applied {format(new Date(application.created_at), 'MMM d, yyyy')}
            </div>
            {resumeTitle && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Resume: {resumeTitle}
              </div>
            )}
            {application.cover_note && (
              <p className="text-sm text-foreground leading-relaxed bg-secondary/50 rounded-lg p-3 mt-2">
                {application.cover_note}
              </p>
            )}
          </div>

          {/* Upcoming interview */}
          {upcomingInterview && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Upcoming Interview</h4>
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-sm font-medium capitalize">{upcomingInterview.round_type.replace(/_/g, ' ')}</p>
                  {upcomingInterview.scheduled_at && (
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(upcomingInterview.scheduled_at), 'MMM d, yyyy · h:mm a')}
                      {upcomingInterview.duration_minutes ? ` · ${upcomingInterview.duration_minutes} minutes` : ''}
                    </p>
                  )}
                  {upcomingInterview.meeting_link && (
                    <Button
                      size="sm"
                      className="mt-2"
                      onClick={() => window.open(upcomingInterview.meeting_link!, '_blank', 'noopener,noreferrer')}
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Join Interview
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Offer */}
          {offer && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Offer</h4>
                <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-1">
                  {offer.base_salary && (
                    <p className="text-sm font-semibold text-success">
                      {offer.currency || 'USD'} {offer.base_salary.toLocaleString()} base
                    </p>
                  )}
                  {offer.start_date && (
                    <p className="text-sm text-muted-foreground">Joining: {format(new Date(offer.start_date), 'MMM d, yyyy')}</p>
                  )}
                  {offer.expires_at && (
                    <p className="text-sm text-muted-foreground">Offer expires: {format(new Date(offer.expires_at), 'MMM d, yyyy')}</p>
                  )}
                  {offer.offer_letter_url && (
                    <a
                      href={offer.offer_letter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline mt-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View offer letter
                    </a>
                  )}

                  {offer.status === 'accepted' && (
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-success pt-1">
                      <Check className="h-4 w-4" /> Offer Accepted
                    </p>
                  )}
                  {offer.status === 'declined' && (
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground pt-1">
                      <XCircle className="h-4 w-4" /> Offer Declined
                    </p>
                  )}
                  {offer.status === 'extended' && offerExpired && (
                    <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground pt-1">
                      <Clock3 className="h-4 w-4" /> Offer Expired
                    </p>
                  )}
                  {offer.status === 'extended' && !offerExpired && (
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" onClick={handleAcceptOffer} disabled={respondingToOffer}>
                        {respondingToOffer ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PartyPopper className="h-4 w-4 mr-2" />}
                        Accept Offer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setShowDeclineDialog(true)}
                        disabled={respondingToOffer}
                      >
                        Decline Offer
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Match score */}
          {matchScore && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Why this role fits you</h4>
                <p className="text-sm font-medium text-primary flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  {Math.round(matchScore.score)}% profile match
                </p>
                {Array.isArray(matchScore.matched_skills) && matchScore.matched_skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(matchScore.matched_skills as string[]).map((s) => (
                      <span key={s} className="inline-flex items-center gap-1 text-xs bg-success/10 text-success rounded-full px-2 py-0.5">
                        <Check className="h-3 w-3" />{s}
                      </span>
                    ))}
                  </div>
                )}
                {Array.isArray(matchScore.missing_skills) && matchScore.missing_skills.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Missing: {(matchScore.missing_skills as string[]).join(', ')}
                  </div>
                )}
              </div>
            </>
          )}

          <Separator />

          {/* Timeline */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Application Journey</h4>
            {loadingEvents ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ol className="space-y-4">
                {events.map((event, i) => (
                  <li key={event.id} className="relative pl-5">
                    {i < events.length - 1 && (
                      <span className="absolute left-[3px] top-3 bottom-[-16px] w-px bg-border" />
                    )}
                    <span className="absolute left-0 top-1 h-2 w-2 rounded-full bg-primary" />
                    <p className="text-sm font-medium text-foreground">{eventLabel(event)}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(event.created_at), 'MMM d, yyyy')}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Next step */}
          {nextAction && (
            <>
              <Separator />
              <div className="space-y-2">
                {nextAction.eyebrow && (
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide">{nextAction.eyebrow}</p>
                )}
                <p className="text-sm font-semibold text-foreground">{nextAction.title}</p>
                {nextAction.description && <p className="text-sm text-muted-foreground">{nextAction.description}</p>}
                {nextAction.kind === 'explore_similar' && (
                  <Button size="sm" onClick={() => navigate('/jobs')}>Find Similar Jobs</Button>
                )}
              </div>
            </>
          )}

          {canWithdraw && (
            <>
              <Separator />
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={handleWithdraw}
                disabled={withdrawing}
              >
                {withdrawing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Undo2 className="h-4 w-4 mr-2" />}
                Withdraw Application
              </Button>
            </>
          )}
        </div>
      </SheetContent>

      <AlertDialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this offer?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. You can optionally let the company know why.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason (optional)"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={respondingToOffer}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeclineOffer} disabled={respondingToOffer} className="bg-destructive hover:bg-destructive/90">
              {respondingToOffer ? 'Declining...' : 'Decline Offer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
