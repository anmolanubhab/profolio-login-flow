import { useEffect, useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import {
  ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader,
  ResponsiveModalTitle, ResponsiveModalDescription,
} from '@/components/ui/responsive-modal';
import { Badge } from '@/components/ui/badge';
import { fetchMatchDetail } from '@/hooks/useJobRecommendations';
import { matchTier, explanationBullets, type JobMatchScoreRow } from '@/lib/jobMatch';

interface MatchDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  userId: string;
}

const SUB_SCORE_ROWS: { key: keyof JobMatchScoreRow; label: string; max: number }[] = [
  { key: 'skills_score', label: 'Skills', max: 35 },
  { key: 'experience_score', label: 'Experience', max: 20 },
  { key: 'title_score', label: 'Job Title', max: 15 },
  { key: 'location_score', label: 'Location', max: 10 },
  { key: 'work_mode_score', label: 'Work Mode', max: 5 },
  { key: 'employment_type_score', label: 'Employment Type', max: 5 },
  { key: 'industry_score', label: 'Industry', max: 5 },
  { key: 'salary_score', label: 'Salary', max: 5 },
];

/**
 * "Why this matches" — reads ONLY the backend-computed hiring_match_scores
 * row (score, sub-scores, matched_skills, missing_skills, explanation).
 * Nothing here recomputes or invents an explanation; every line is a direct
 * read of what calculate_job_match() already produced.
 */
export function MatchDetailsDialog({ open, onOpenChange, jobId, jobTitle, userId }: MatchDetailsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<JobMatchScoreRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchMatchDetail(jobId, userId)
      .then((r) => { if (!cancelled) setRow(r); })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load match details'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, jobId, userId]);

  const tier = row ? matchTier(row.score) : null;

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Why this matches</ResponsiveModalTitle>
          <ResponsiveModalDescription>{jobTitle}</ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {loading && (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading match details…
          </div>
        )}

        {!loading && error && (
          <p className="py-6 text-sm text-destructive">{error}</p>
        )}

        {!loading && !error && !row && (
          <p className="py-6 text-sm text-muted-foreground">No match data available for this job yet.</p>
        )}

        {!loading && row && (
          <div className="space-y-4 py-1">
            <div className="flex items-baseline justify-between rounded-lg border p-3">
              <div>
                <div className="text-2xl font-bold">{Math.round(row.score)}%</div>
                <div className={`text-sm font-medium ${tier?.className}`}>{tier?.label} match</div>
              </div>
              {row.eligibility_status === 'not_eligible' && (
                <Badge variant="destructive">Not eligible</Badge>
              )}
            </div>

            <div className="space-y-2">
              {SUB_SCORE_ROWS.map(({ key, label, max }) => {
                const val = (row[key] as number | null) ?? 0;
                const pct = max > 0 ? Math.min(100, (val / max) * 100) : 0;
                return (
                  <div key={key as string}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{val}/{max}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {row.matched_skills?.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Matched skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {row.matched_skills.map((s) => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      <Check className="h-3 w-3 text-emerald-600" /> {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {row.missing_skills?.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1.5">Missing skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {row.missing_skills.map((s) => (
                    <Badge key={s} variant="outline" className="gap-1 text-muted-foreground">
                      <X className="h-3 w-3" /> {s}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 border-t pt-3">
              {explanationBullets(row.explanation).map((line, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  {line.ok ? (
                    <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <span className={line.ok ? '' : 'text-muted-foreground'}>{line.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
