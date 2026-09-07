import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { JobCard } from './JobCard';
import { MatchDetailsDialog } from './MatchDetailsDialog';
import type { RecommendedJob } from '@/hooks/useJobRecommendations';

interface RecommendedJobsSectionProps {
  userId: string;
  loading: boolean;
  refreshing: boolean;
  jobs: RecommendedJob[];
  hasPreferenceSignal: boolean;
  error: string | null;
  onRefresh: () => void;
  appliedJobIds: Set<string>;
  savedJobIds: Set<string>;
  onToggleSave: (jobId: string) => void;
  onViewDetails: (job: RecommendedJob) => void;
  onApply: (job: RecommendedJob) => void;
  onOpenPreferences: () => void;
}

/**
 * "Recommended for You" -- purely presentational; all data comes from
 * useJobRecommendations() owned by the parent (Jobs.tsx), so saving Job
 * Preferences can trigger one shared refresh() that this section picks up
 * immediately, instead of each holding its own disconnected copy.
 * No client-side scoring, no per-job queries, no eligibility recomputation:
 * the backend's refresh_job_recommendations_for_candidate() already
 * excludes not_eligible/expired rows before this ever runs.
 */
export function RecommendedJobsSection({
  userId, loading, refreshing, jobs, hasPreferenceSignal, error, onRefresh,
  appliedJobIds, savedJobIds, onToggleSave, onViewDetails, onApply, onOpenPreferences,
}: RecommendedJobsSectionProps) {
  const [whyThisMatchesJob, setWhyThisMatchesJob] = useState<RecommendedJob | null>(null);

  const visible = jobs.filter((j) => !appliedJobIds.has(j.id));

  if (loading) return null; // main Jobs page skeleton already covers initial load

  if (!hasPreferenceSignal) {
    return (
      <Card className="bg-gradient-card shadow-card border-0">
        <CardContent className="pt-6 pb-6 text-center">
          <Sparkles className="h-8 w-8 text-primary mx-auto mb-2" />
          <p className="font-medium text-foreground mb-1">Tell us what you're looking for</p>
          <p className="text-sm text-muted-foreground mb-4">
            Complete your Job Preferences to get better job recommendations.
          </p>
          <Button onClick={onOpenPreferences}>Set Job Preferences</Button>
        </CardContent>
      </Card>
    );
  }

  if (error) return null; // don't surface a broken section on the main Jobs page; the "N jobs found" list below still works

  if (visible.length === 0) {
    return (
      <Card className="bg-gradient-card shadow-card border-0">
        <CardContent className="pt-6 pb-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">No strong job matches found yet.</p>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Refresh recommendations
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Recommended for You</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing} className="text-xs text-muted-foreground">
          {refreshing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
          Refresh
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">Based on your job preferences and profile.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4 mb-6">
        {visible.map((job) => (
          <JobCard
            key={job.id}
            job={job}
            isApplied={appliedJobIds.has(job.id)}
            isSaved={savedJobIds.has(job.id)}
            onToggleSave={onToggleSave}
            matchPercent={job.score}
            topSkills={job.matchedSkills}
            onWhyThisMatches={() => setWhyThisMatchesJob(job)}
            onViewDetails={() => onViewDetails(job)}
            onApply={() => onApply(job)}
          />
        ))}
      </div>

      {whyThisMatchesJob && (
        <MatchDetailsDialog
          open={!!whyThisMatchesJob}
          onOpenChange={(o) => !o && setWhyThisMatchesJob(null)}
          jobId={whyThisMatchesJob.id}
          jobTitle={whyThisMatchesJob.title}
          userId={userId}
        />
      )}
    </div>
  );
}
