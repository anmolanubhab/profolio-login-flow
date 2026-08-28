import { ApplicationResumeResult } from './applicationTypes';

interface ResumeSnapshotViewProps {
  result: ApplicationResumeResult;
}

function Section({ title, value }: { title: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <h4 className="text-sm font-semibold mb-1">{title}</h4>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export function ResumeSnapshotView({ result }: ResumeSnapshotViewProps) {
  if (result.status === 'not_authorized') {
    return <p className="text-sm text-muted-foreground">Resume unavailable.</p>;
  }
  if (result.status === 'no_resume') {
    return <p className="text-sm text-muted-foreground">No resume attached.</p>;
  }
  if (result.status === 'revoked') {
    return <p className="text-sm text-muted-foreground">Resume sharing has been revoked by the candidate.</p>;
  }

  const content = result.resume_content;
  if (!content) return <p className="text-sm text-muted-foreground">No resume attached.</p>;

  if (content.type === 'pdf') {
    return <p className="text-sm text-muted-foreground">{content.fileName || content.title || 'PDF resume'}</p>;
  }

  const name = content.personalInfo?.name;
  const location = content.personalInfo?.location;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">{content.title || result.resume_title || 'Resume'}</h3>
        {(name || location) && (
          <p className="text-sm text-muted-foreground">{[name, location].filter(Boolean).join(' · ')}</p>
        )}
      </div>
      <Section title="Summary" value={content.summary} />
      <Section title="Experience" value={content.experience} />
      <Section title="Education" value={content.education} />
      <Section title="Skills" value={content.skills} />
    </div>
  );
}
