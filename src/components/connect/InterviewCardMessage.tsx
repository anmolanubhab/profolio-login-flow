import { Badge } from '@/components/ui/badge';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';

interface InterviewCardMetadata {
  title?: string;
  status?: string;
  scheduled_at?: string;
  timezone?: string;
  duration_minutes?: number;
  provider?: string;
  job_title?: string;
  company_name?: string;
}

const STATUS_LABELS: Record<string, string> = {
  invited: 'Awaiting your response',
  scheduled: 'Scheduled',
  declined: 'Declined',
  cancelled: 'Cancelled',
  rescheduled: 'Rescheduled',
};

const PROVIDER_LABELS: Record<string, string> = {
  zoom: 'Zoom',
  microsoft_teams: 'Microsoft Teams',
  google_meet: 'Google Meet',
  other: 'External meeting',
};

/** Renders the structured interview_card message type. Never carries private feedback. */
export function InterviewCardMessage({ content, metadata }: { content: string; metadata: InterviewCardMetadata | null | undefined }) {
  if (!metadata) {
    return <div className="text-sm break-words">{content}</div>;
  }

  const scheduledDate = metadata.scheduled_at ? new Date(metadata.scheduled_at) : null;

  return (
    <div className="text-sm min-w-[220px]">
      <div className="flex items-center gap-1.5 font-medium mb-1">
        <CalendarDays className="h-3.5 w-3.5" />
        {metadata.title || content}
      </div>
      {metadata.job_title && (
        <div className="text-xs opacity-80 mb-1">
          {metadata.job_title}{metadata.company_name ? ` — ${metadata.company_name}` : ''}
        </div>
      )}
      {scheduledDate && (
        <div className="text-xs opacity-80">
          {format(scheduledDate, 'MMM d, yyyy · p')} {metadata.timezone ? `(${metadata.timezone})` : ''}
          {metadata.duration_minutes ? ` · ${metadata.duration_minutes} min` : ''}
        </div>
      )}
      {metadata.provider && (
        <div className="text-xs opacity-80">{PROVIDER_LABELS[metadata.provider] || metadata.provider}</div>
      )}
      {metadata.status && (
        <Badge variant="secondary" className="mt-1.5 text-[10px]">
          {STATUS_LABELS[metadata.status] || metadata.status}
        </Badge>
      )}
    </div>
  );
}
