import { formatDistanceToNow } from 'date-fns';
import { Building2, MapPin, Briefcase, MoreVertical, Zap, CalendarClock, PartyPopper, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  STAGE_LABELS,
  STAGE_TONE,
  STAGE_TONE_CLASSES,
  canWithdrawApplication,
  getNextAction,
} from '@/lib/applicationStages';
import { ApplicationProgress } from './ApplicationProgress';
import { ApplicationRow, InterviewRound, Offer, companyName, companyLogo } from './applicationTypes';

interface ApplicationCardProps {
  application: ApplicationRow;
  upcomingInterview?: InterviewRound | null;
  offer?: Offer | null;
  onView: () => void;
  onWithdraw: () => void;
}

const NEXT_ACTION_ICON = {
  follow_up: Zap,
  prepare_interview: CalendarClock,
  review_offer: Zap,
  explore_similar: ArrowRight,
  celebrate: PartyPopper,
} as const;

// Tone for the inline "next action" strip -- reuses the app's semantic
// colours, no new palette.
const NEXT_ACTION_TONE = {
  follow_up: 'bg-warning/10 text-warning border-warning/20',
  prepare_interview: 'bg-primary/10 text-primary border-primary/20',
  review_offer: 'bg-success/10 text-success border-success/20',
  explore_similar: 'bg-muted text-muted-foreground border-transparent',
  celebrate: 'bg-success/10 text-success border-success/20',
} as const;

export function ApplicationCard({ application, upcomingInterview, offer, onView, onWithdraw }: ApplicationCardProps) {
  const job = application.jobs;
  const logo = companyLogo(job);
  const tone = STAGE_TONE[application.current_stage];
  const canWithdraw = canWithdrawApplication(application.current_stage, offer);
  const company = companyName(job);
  const title = job.title?.trim() || 'Job title unavailable';

  const nextAction = getNextAction({
    stage: application.current_stage,
    stageUpdatedAt: application.stage_updated_at,
    upcomingInterview,
    offer,
  });
  const NextIcon = nextAction ? NEXT_ACTION_ICON[nextAction.kind] : null;

  return (
    <article
      onClick={onView}
      className="group cursor-pointer rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30 focus-within:border-primary/40 sm:p-5"
    >
      {/* header row */}
      <div className="flex items-start gap-3">
        {logo ? (
          <img
            src={logo}
            alt=""
            className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover"
            loading="lazy"
          />
        ) : (
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-border bg-muted">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold leading-tight text-foreground sm:text-base">{title}</h3>
              <p className="truncate text-[13px] text-muted-foreground">{company}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Badge
                variant="outline"
                className={cn('whitespace-nowrap text-[11px] font-medium', STAGE_TONE_CLASSES[tone])}
              >
                {STAGE_LABELS[application.current_stage]}
              </Badge>
              {canWithdraw && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      aria-label="Application options"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={onView}>View details</DropdownMenuItem>
                    <DropdownMenuItem onClick={onWithdraw} className="text-destructive focus:text-destructive">
                      Withdraw application
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* metadata */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {job.location}
              </span>
            )}
            {job.employment_type && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {job.employment_type}
              </span>
            )}
            {job.remote_option && <span>{job.remote_option}</span>}
            <span className="text-muted-foreground/70">
              · Applied {formatDistanceToNow(new Date(application.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>

      {/* timeline */}
      <div className="mt-3.5 border-t border-border pt-3.5">
        <ApplicationProgress stage={application.current_stage} />
      </div>

      {/* next action + view */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        {nextAction && NextIcon ? (
          <span
            className={cn(
              'inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] font-medium',
              NEXT_ACTION_TONE[nextAction.kind],
            )}
          >
            <NextIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {nextAction.title}
              {nextAction.description ? ` · ${nextAction.description}` : ''}
            </span>
          </span>
        ) : (
          <span />
        )}
        <Button
          variant="secondary"
          size="sm"
          className="h-8 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
        >
          View application
        </Button>
      </div>
    </article>
  );
}
