import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Calendar, Clock, ExternalLink, Users, Video, MapPin, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { InterviewRound, useInterviewActions } from '@/hooks/use-interview-rounds';
import { InterviewFeedbackDialog } from './InterviewFeedbackDialog';

const ROUND_TYPE_LABELS: Record<string, string> = {
  recruiter_screen: 'Recruiter Screen',
  hiring_manager: 'Hiring Manager Round',
  technical: 'Technical Round',
  panel: 'Panel Interview',
  culture: 'Culture Fit',
  executive: 'Executive Round',
};

const PROVIDER_LABELS: Record<string, string> = {
  zoom: 'Zoom',
  microsoft_teams: 'Microsoft Teams',
  google_meet: 'Google Meet',
  other: 'External meeting',
};

const STATUS_STYLES: Record<string, string> = {
  invited: 'bg-amber-100 text-amber-800',
  scheduled: 'bg-blue-100 text-blue-800',
  declined: 'bg-gray-100 text-gray-600',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  no_show: 'bg-red-100 text-red-800',
};

interface InterviewRoundCardProps {
  round: InterviewRound;
  role: 'candidate' | 'recruiter';
  currentUserId?: string;
  candidateName?: string;
  onChanged?: () => void;
}

export function InterviewRoundCard({ round, role, currentUserId, candidateName, onChanged }: InterviewRoundCardProps) {
  const { toast } = useToast();
  const { respondToInvite, cancelRound, markOutcome } = useInterviewActions();
  const [declineReason, setDeclineReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const scheduledDate = round.scheduled_at ? new Date(round.scheduled_at) : null;
  const now = new Date();
  const isPast = scheduledDate ? scheduledDate.getTime() < now.getTime() : false;
  const isJoinWindow = scheduledDate
    ? now.getTime() >= scheduledDate.getTime() - 10 * 60 * 1000 // allow joining 10 min early
    : false;

  const canJoin =
    round.status === 'scheduled' &&
    round.mode === 'online' &&
    !!round.meeting_link &&
    isJoinWindow;

  const isPanelist = !!currentUserId && (round.panelists || []).some((p) => p.user_id === currentUserId);

  const handleAccept = async () => {
    setBusy(true);
    try {
      await respondToInvite(round.id, true);
      toast({ title: 'Interview accepted', description: 'The interview is now scheduled.' });
      onChanged?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    setBusy(true);
    try {
      await respondToInvite(round.id, false, declineReason || undefined);
      toast({ title: 'Interview declined' });
      onChanged?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    try {
      await cancelRound(round.id);
      toast({ title: 'Interview cancelled' });
      onChanged?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleMarkOutcome = async (outcome: 'completed' | 'no_show') => {
    setBusy(true);
    try {
      await markOutcome(round.id, outcome);
      toast({ title: outcome === 'completed' ? 'Marked as completed' : 'Marked as no-show' });
      onChanged?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold">
                {round.title || ROUND_TYPE_LABELS[round.round_type] || round.round_type}
              </h4>
              <Badge variant="secondary" className={STATUS_STYLES[round.status] || 'bg-gray-100'}>
                {round.status.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Round {round.round_no} &middot; {ROUND_TYPE_LABELS[round.round_type]}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {round.description && <p className="text-sm text-muted-foreground">{round.description}</p>}

        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          {scheduledDate && (
            <>
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{format(scheduledDate, 'MMM d, yyyy')}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{format(scheduledDate, 'p')} ({round.timezone})</span>
            </>
          )}
          {round.duration_minutes && <span>{round.duration_minutes} min</span>}
          <span className="flex items-center gap-1">
            {round.mode === 'online' ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
            {round.mode === 'online' ? (round.provider ? PROVIDER_LABELS[round.provider] : 'Online') : 'In-person'}
          </span>
        </div>

        {(round.panelists?.length || 0) > 0 && (
          <div className="flex items-start gap-1.5 text-sm">
            <Users className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">
              {round.panelists!.map((p) => p.profile?.display_name || 'Panelist').join(', ')}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {role === 'candidate' && round.status === 'invited' && (
            <>
              <Button size="sm" onClick={handleAccept} disabled={busy}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Accept
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" disabled={busy}>
                    <XCircle className="h-4 w-4 mr-1" /> Decline
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Decline this interview?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Let the recruiter know why, if you'd like (optional).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="Reason (optional)"
                    rows={3}
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Back</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDecline}>Decline Interview</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          {round.status === 'invited' && role === 'candidate' && scheduledDate && (
            <p className="text-xs text-muted-foreground w-full">
              Proposed for {format(scheduledDate, "MMM d 'at' p")}. Accept to confirm the schedule.
            </p>
          )}

          {canJoin && (
            <Button size="sm" asChild>
              <a href={round.meeting_link!} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" /> Join Interview
              </a>
            </Button>
          )}
          {round.status === 'scheduled' && !canJoin && round.mode === 'online' && scheduledDate && !isPast && (
            <p className="text-xs text-muted-foreground">Interview starts at {format(scheduledDate, "MMM d, p")}.</p>
          )}

          {role === 'recruiter' && round.status === 'scheduled' && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleMarkOutcome('completed')} disabled={busy}>
                Mark Completed
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleMarkOutcome('no_show')} disabled={busy}>
                Mark No-Show
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-destructive" disabled={busy}>Cancel</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this interview?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The candidate and panel will be notified. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Back</AlertDialogCancel>
                    <AlertDialogAction onClick={handleCancel} className="bg-destructive hover:bg-destructive/90">
                      Cancel Interview
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}

          {role === 'recruiter' && (round.status === 'completed' || round.status === 'no_show') && isPanelist && (
            <Button size="sm" variant="outline" onClick={() => setFeedbackOpen(true)}>
              Submit Feedback
            </Button>
          )}
        </div>
      </CardContent>

      {feedbackOpen && (
        <InterviewFeedbackDialog
          open={feedbackOpen}
          onOpenChange={setFeedbackOpen}
          roundId={round.id}
          candidateName={candidateName || 'the candidate'}
          onSubmitted={onChanged}
        />
      )}
    </Card>
  );
}
