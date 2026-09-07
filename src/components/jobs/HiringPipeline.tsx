import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { Users2, Sparkles, FileText, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { ApplicationResumeResult } from './applicationTypes';
import { ResumeSnapshotView } from './ResumeSnapshotView';
import { MatchDetailsDialog } from './MatchDetailsDialog';

interface CandidateResourcesResult {
  status: 'ok' | 'not_authorized';
  online_resume: { label: string | null; url: string } | null;
  professional_links: { resource_type: string; label: string | null; url: string; sort_order: number }[] | null;
}

const LINK_TYPE_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio',
  website: 'Personal Website',
  other: 'Other',
};

type ApplicationStage =
  | 'applied'
  | 'screening'
  | 'shortlisted'
  | 'interview_scheduled'
  | 'interview_completed'
  | 'offer_extended'
  | 'offer_accepted'
  | 'offer_declined'
  | 'hired'
  | 'rejected'
  | 'withdrawn';

const STAGE_OPTIONS: { value: ApplicationStage; label: string }[] = [
  { value: 'applied', label: 'Applied' },
  { value: 'screening', label: 'Screening' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'interview_completed', label: 'Interview Completed' },
  { value: 'offer_extended', label: 'Offer Extended' },
  { value: 'offer_accepted', label: 'Offer Accepted' },
  { value: 'offer_declined', label: 'Offer Declined' },
  { value: 'hired', label: 'Hired' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

interface HiringJob {
  id: string;
  title: string;
}

interface PipelineApplication {
  id: string;
  candidate_profile_id: string;
  current_stage: ApplicationStage;
  created_at: string;
  candidate: {
    display_name: string | null;
    avatar_url: string | null;
    profession: string | null;
  } | null;
  matchScore: number | null;
}

interface HiringPipelineProps {
  companyId: string;
  jobs: HiringJob[];
}

interface CandidateMatch {
  candidate_profile_id: string;
  candidate_user_id: string;
  display_name: string | null;
  headline: string | null;
  location: string | null;
  avatar_url: string | null;
  score: number;
  eligibility_status: 'eligible' | 'not_eligible';
  matched_skills: string[];
  missing_skills: string[];
  has_applied: boolean;
}

export default function HiringPipeline({ companyId, jobs }: HiringPipelineProps) {
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [applications, setApplications] = useState<PipelineApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resumeDialogAppId, setResumeDialogAppId] = useState<string | null>(null);
  const [resumeResult, setResumeResult] = useState<ApplicationResumeResult | null>(null);
  const [loadingResume, setLoadingResume] = useState(false);
  const [candidateResources, setCandidateResources] = useState<CandidateResourcesResult | null>(null);
  const [loadingPdfUrl, setLoadingPdfUrl] = useState(false);
  const [candidateMatches, setCandidateMatches] = useState<CandidateMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [refreshingMatches, setRefreshingMatches] = useState(false);
  const [matchesOffset, setMatchesOffset] = useState(0);
  const [hasMoreMatches, setHasMoreMatches] = useState(false);
  const [whyMatchCandidate, setWhyMatchCandidate] = useState<CandidateMatch | null>(null);
  const MATCHES_PAGE_SIZE = 20;

  useEffect(() => {
    checkAdmin();
  }, [companyId]);

  useEffect(() => {
    if (jobs.length > 0 && !selectedJobId) {
      setSelectedJobId(jobs[0].id);
    }
  }, [jobs, selectedJobId]);

  useEffect(() => {
    if (isAdmin && selectedJobId) {
      fetchApplications(selectedJobId);
      setMatchesOffset(0);
      fetchCandidateMatches(selectedJobId, 0);
    }
  }, [isAdmin, selectedJobId]);

  /** Reads the canonical hiring_match_scores via get_job_candidate_matches -- one paginated RPC call, no client-side scoring, no per-candidate queries. */
  const fetchCandidateMatches = async (jobId: string, offset: number) => {
    setLoadingMatches(true);
    try {
      const { data, error } = await supabase.rpc('get_job_candidate_matches', {
        p_job_id: jobId,
        p_limit: MATCHES_PAGE_SIZE,
        p_offset: offset,
      });
      if (error) throw error;
      const rows = (data || []).map((r) => ({
        ...r,
        matched_skills: Array.isArray(r.matched_skills) ? (r.matched_skills as string[]) : [],
        missing_skills: Array.isArray(r.missing_skills) ? (r.missing_skills as string[]) : [],
      })) as CandidateMatch[];
      setCandidateMatches((prev) => (offset === 0 ? rows : [...prev, ...rows]));
      setHasMoreMatches(rows.length === MATCHES_PAGE_SIZE);
      setMatchesOffset(offset);
    } catch (error) {
      toast({ title: 'Error loading candidate matches', description: error instanceof Error ? error.message : 'Please try again', variant: 'destructive' });
    } finally {
      setLoadingMatches(false);
    }
  };

  /** Manual "Refresh matches" -- Phase 3 scope: recalculated on request, not on every page load or via an always-on cron. */
  const handleRefreshMatches = async () => {
    if (!selectedJobId) return;
    setRefreshingMatches(true);
    try {
      await supabase.rpc('refresh_job_candidate_matches', { p_job_id: selectedJobId, p_limit: 200 });
      await fetchCandidateMatches(selectedJobId, 0);
      toast({ title: 'Candidate matches refreshed' });
    } catch (error) {
      toast({ title: 'Error refreshing matches', description: error instanceof Error ? error.message : 'Please try again', variant: 'destructive' });
    } finally {
      setRefreshingMatches(false);
    }
  };

  const checkAdmin = async () => {
    setCheckingAdmin(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }
      // Unified recruiter model (Phase A/B1/B6): company owner or an
      // explicit is_recruiter=true grant -- not is_company_admin's broader
      // "any member" check, and not automatic for every super_admin/
      // content_admin (that legacy behavior is now backfilled per-row, see
      // the B6 migration, not re-derived from role here).
      const { data, error } = await supabase.rpc('is_authorized_search_recruiter', {
        _company_id: companyId,
      });
      if (error) throw error;
      setIsAdmin(!!data);
    } catch (error) {
      console.error('Error checking company admin status:', error);
      setIsAdmin(false);
    } finally {
      setCheckingAdmin(false);
    }
  };

  const fetchApplications = async (jobId: string) => {
    setLoading(true);
    try {
      const { data: appsData, error: appsError } = await supabase
        .from('hiring_applications')
        .select('id, candidate_profile_id, current_stage, created_at, candidate:profiles!hiring_applications_candidate_profile_id_fkey(display_name, avatar_url, profession)')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false });

      if (appsError) throw appsError;

      const { data: scoresData } = await supabase
        .from('hiring_match_scores')
        .select('candidate_profile_id, score')
        .eq('job_id', jobId);

      const scoreMap = new Map<string, number>();
      (scoresData || []).forEach((s) => scoreMap.set(s.candidate_profile_id, s.score));

      const merged: PipelineApplication[] = (appsData || []).map((a: any) => ({
        id: a.id,
        candidate_profile_id: a.candidate_profile_id,
        current_stage: a.current_stage,
        created_at: a.created_at,
        candidate: a.candidate,
        matchScore: scoreMap.get(a.candidate_profile_id) ?? null,
      }));

      setApplications(merged);
    } catch (error: any) {
      toast({
        title: 'Error loading pipeline',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStageChange = async (applicationId: string, newStage: ApplicationStage) => {
    setUpdatingId(applicationId);
    try {
      const { error } = await supabase.rpc('update_application_stage', {
        p_application_id: applicationId,
        p_new_stage: newStage,
      });
      if (error) throw error;

      setApplications((prev) =>
        prev.map((a) => (a.id === applicationId ? { ...a, current_stage: newStage } : a))
      );
      toast({ title: 'Stage updated', description: 'Candidate stage has been updated.' });
    } catch (error: any) {
      toast({
        title: 'Error updating stage',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleViewResume = async (applicationId: string) => {
    setResumeDialogAppId(applicationId);
    setResumeResult(null);
    setCandidateResources(null);
    setLoadingResume(true);
    try {
      const [{ data, error }, resourcesRes] = await Promise.all([
        supabase.rpc('get_application_resume', { p_application_id: applicationId }),
        supabase.rpc('get_application_candidate_resources', { p_application_id: applicationId }),
      ]);
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setResumeResult(row ? (row as ApplicationResumeResult) : { status: 'not_authorized', candidate_name: null, resume_title: null, resume_content: null });

      const resourcesRow = Array.isArray(resourcesRes.data) ? resourcesRes.data[0] : resourcesRes.data;
      if (resourcesRow) setCandidateResources(resourcesRow as CandidateResourcesResult);
    } catch (error: any) {
      toast({ title: 'Error loading resume', description: error.message, variant: 'destructive' });
      setResumeDialogAppId(null);
    } finally {
      setLoadingResume(false);
    }
  };

  const handleViewPdf = async (applicationId: string) => {
    setLoadingPdfUrl(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-recruiter-resume-url', {
        body: { application_id: applicationId },
      });
      if (error || !data?.ok || !data?.url) {
        toast({ title: 'Resume unavailable', description: 'Could not open the PDF resume.', variant: 'destructive' });
        return;
      }
      window.open(data.url, '_blank');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingPdfUrl(false);
    }
  };

  if (checkingAdmin || !isAdmin || jobs.length === 0) {
    return null;
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users2 className="w-5 h-5 text-primary" />
          Candidate Pipeline (Beta)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Advanced applicant tracking for this company. Separate from the standard job applications flow.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="w-full max-w-xs">
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a job" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((job) => (
                <SelectItem key={job.id} value={job.id}>
                  {job.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : applications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No candidates in the pipeline for this job yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications.map((app) => (
              <div
                key={app.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={app.candidate?.avatar_url || undefined} />
                    <AvatarFallback>{app.candidate?.display_name?.charAt(0) || 'C'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {app.candidate?.display_name || 'Candidate'}
                    </p>
                    {app.candidate?.profession && (
                      <p className="text-xs text-muted-foreground truncate">{app.candidate.profession}</p>
                    )}
                    {app.matchScore !== null && (
                      <div className="flex items-center gap-1 mt-1">
                        <Sparkles className="w-3 h-3 text-primary" />
                        <Badge variant="outline" className="text-xs">
                          Match: {Math.round(app.matchScore)}%
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleViewResume(app.id)}
                    className="shrink-0"
                  >
                    <FileText className="w-4 h-4 mr-1.5" />
                    View Resume
                  </Button>
                  <div className="w-full sm:w-56 shrink-0">
                    <Select
                      value={app.current_stage}
                      onValueChange={(value) => handleStageChange(app.id, value as ApplicationStage)}
                      disabled={updatingId === app.id}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={!!resumeDialogAppId} onOpenChange={(open) => !open && setResumeDialogAppId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{resumeResult?.candidate_name || 'Candidate'} — Resume</DialogTitle>
          </DialogHeader>
          {loadingResume ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : resumeResult ? (
            <div className="space-y-4">
              {resumeResult.status === 'ok' && resumeResult.resume_content?.type === 'pdf' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => resumeDialogAppId && handleViewPdf(resumeDialogAppId)}
                  disabled={loadingPdfUrl}
                >
                  <FileText className="w-4 h-4 mr-1.5" />
                  {loadingPdfUrl ? 'Opening…' : 'View PDF Resume'}
                </Button>
              )}
              {!(resumeResult.status === 'ok' && resumeResult.resume_content?.type === 'pdf') && (
                <ResumeSnapshotView result={resumeResult} />
              )}

              {candidateResources?.online_resume && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Online Resume</h4>
                  <a
                    href={candidateResources.online_resume.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    {candidateResources.online_resume.label || 'Open Resume'} <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {candidateResources?.professional_links && candidateResources.professional_links.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-1">Professional Profiles</h4>
                  <div className="space-y-1">
                    {candidateResources.professional_links.map((link, i) => (
                      <a
                        key={i}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary flex items-center gap-1 hover:underline"
                      >
                        {link.label || LINK_TYPE_LABELS[link.resource_type] || link.resource_type} <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>

    {/* Best Matching Candidates -- Phase 3. Same job selector/authorization
        as the pipeline above; a single canonical engine (calculate_job_match)
        and table (hiring_match_scores) power both this and the "Match: X%"
        badge above. Applicants and non-applicant strong matches are clearly
        labeled separately, per product decision that this is a decision-
        support signal, not an automatic hiring/shortlisting action. */}
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Best Matching Candidates
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleRefreshMatches} disabled={refreshingMatches || !selectedJobId}>
            {refreshingMatches ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
            Refresh matches
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Decision-support signal based on skills, experience and preferences -- not an automatic hiring decision. You still choose who to shortlist.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadingMatches ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : candidateMatches.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="mb-1">No strong matching candidates found yet.</p>
            <p className="text-xs">Try broadening the job requirements, or check again later.</p>
          </div>
        ) : (
          <>
            {candidateMatches.filter((c) => c.has_applied).length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Matching Applicants</h4>
                {candidateMatches.filter((c) => c.has_applied).map((c) => (
                  <CandidateMatchRow key={c.candidate_profile_id} candidate={c} onWhyMatch={() => setWhyMatchCandidate(c)} />
                ))}
              </div>
            )}
            {candidateMatches.filter((c) => !c.has_applied).length > 0 && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">Recommended Candidates (not yet applied)</h4>
                {candidateMatches.filter((c) => !c.has_applied).map((c) => (
                  <CandidateMatchRow key={c.candidate_profile_id} candidate={c} onWhyMatch={() => setWhyMatchCandidate(c)} />
                ))}
              </div>
            )}
            {hasMoreMatches && (
              <div className="text-center pt-2">
                <Button variant="outline" size="sm" onClick={() => fetchCandidateMatches(selectedJobId, matchesOffset + MATCHES_PAGE_SIZE)} disabled={loadingMatches}>
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>

    {whyMatchCandidate && (
      <MatchDetailsDialog
        open={!!whyMatchCandidate}
        onOpenChange={(o) => !o && setWhyMatchCandidate(null)}
        jobId={selectedJobId}
        jobTitle={jobs.find((j) => j.id === selectedJobId)?.title || ''}
        userId={whyMatchCandidate.candidate_user_id}
      />
    )}
    </>
  );
}

function CandidateMatchRow({ candidate, onWhyMatch }: { candidate: CandidateMatch; onWhyMatch: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border">
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-10 w-10">
          <AvatarImage src={candidate.avatar_url || undefined} />
          <AvatarFallback>{candidate.display_name?.charAt(0) || 'C'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-foreground truncate">{candidate.display_name || 'Candidate'}</p>
            <Badge variant="secondary" className="text-xs shrink-0">{Math.round(candidate.score)}% Match</Badge>
          </div>
          {candidate.headline && <p className="text-xs text-muted-foreground truncate">{candidate.headline}</p>}
          {candidate.location && <p className="text-xs text-muted-foreground truncate">{candidate.location}</p>}
          {candidate.matched_skills.length > 0 && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              Skills: {candidate.matched_skills.slice(0, 4).join(' · ')}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
        <Button variant="ghost" size="sm" onClick={onWhyMatch}>Why this matches</Button>
        <Button variant="outline" size="sm" asChild>
          <Link to={`/profile/${candidate.candidate_user_id}`}>View Profile</Link>
        </Button>
      </div>
    </div>
  );
}
