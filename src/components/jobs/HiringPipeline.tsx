import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users2, Sparkles } from 'lucide-react';

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

export default function HiringPipeline({ companyId, jobs }: HiringPipelineProps) {
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [applications, setApplications] = useState<PipelineApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    }
  }, [isAdmin, selectedJobId]);

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

  if (checkingAdmin || !isAdmin || jobs.length === 0) {
    return null;
  }

  return (
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
