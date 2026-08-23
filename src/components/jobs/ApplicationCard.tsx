import { formatDistanceToNow } from 'date-fns';
import { Building2, MapPin, Briefcase, MoreVertical, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

export function ApplicationCard({ application, upcomingInterview, offer, onView, onWithdraw }: ApplicationCardProps) {
  const job = application.jobs;
  const logo = companyLogo(job);
  const tone = STAGE_TONE[application.current_stage];
  const canWithdraw = canWithdrawApplication(application.current_stage, offer);

  const nextAction = getNextAction({
    stage: application.current_stage,
    stageUpdatedAt: application.stage_updated_at,
    upcomingInterview,
    offer,
  });

  return (
    <Card className="bg-gradient-card shadow-card border-0 hover:shadow-elegant transition-smooth cursor-pointer" onClick={onView}>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start gap-3">
          {logo ? (
            <img src={logo} alt={companyName(job)} className="h-12 w-12 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-base text-foreground truncate">{job.title}</h3>
              {canWithdraw && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem onClick={onWithdraw} className="text-destructive focus:text-destructive">
                      Withdraw application
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            <p className="text-sm text-muted-foreground truncate">{companyName(job)}</p>
            <Badge variant="outline" className={cn('text-xs whitespace-nowrap mt-1.5', STAGE_TONE_CLASSES[tone])}>
              {STAGE_LABELS[application.current_stage]}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {job.location && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
          )}
          {job.employment_type && (
            <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{job.employment_type}</span>
          )}
          {job.remote_option && <span>{job.remote_option}</span>}
        </div>

        <p className="text-xs text-muted-foreground">
          Applied {formatDistanceToNow(new Date(application.created_at), { addSuffix: true })}
        </p>

        <ApplicationProgress stage={application.current_stage} />

        {nextAction && (
          <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/5 rounded-md px-2.5 py-1.5">
            <Clock className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{nextAction.title}{nextAction.description ? ` — ${nextAction.description}` : ''}</span>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="ghost" size="sm" className="text-primary" onClick={onView}>
            View Application →
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
