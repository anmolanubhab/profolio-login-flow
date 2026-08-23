import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Search, Briefcase, Bookmark, AlertTriangle } from 'lucide-react';
import {
  ApplicationFilter, matchesFilter, ACTIVE_STAGES, INTERVIEW_STAGES,
} from '@/lib/applicationStages';
import { ApplicationCard } from './ApplicationCard';
import { ApplicationDetailsSheet } from './ApplicationDetailsSheet';
import { ApplicationRow, InterviewRound, Offer, MatchScore, companyName } from './applicationTypes';

const FILTERS: { key: ApplicationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'interviews', label: 'Interviews' },
  { key: 'offers', label: 'Offers' },
  { key: 'closed', label: 'Closed' },
];

export const MyApplications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [interviewsByApp, setInterviewsByApp] = useState<Record<string, InterviewRound[]>>({});
  const [offersByApp, setOffersByApp] = useState<Record<string, Offer>>({});
  const [matchByJob, setMatchByJob] = useState<Record<string, MatchScore>>({});
  const [profileCompletion, setProfileCompletion] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ApplicationFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ApplicationRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Debounce search input -- avoids re-filtering on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // hiring_applications is the single authoritative table for a
      // candidate's applications -- the same one the recruiter Hiring
      // Pipeline reads/writes. RLS scopes this to candidate_user_id = auth.uid().
      const { data: apps, error: appsError } = await supabase
        .from('hiring_applications')
        .select(`
          id, job_id, current_stage, stage_updated_at, created_at, cover_note, resume_id, source, rejection_reason,
          jobs (
            id, title, location, employment_type, remote_option, salary_min, salary_max, currency, posted_at, company_id, company_name,
            companies ( name, logo_url )
          )
        `)
        .eq('candidate_user_id', user.id)
        .order('created_at', { ascending: false });

      if (appsError) throw appsError;
      const list = (apps || []) as unknown as ApplicationRow[];
      setApplications(list);

      if (list.length === 0) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('avatar_url, profession, location, bio, phone, linkedin_url')
          .eq('user_id', user.id)
          .maybeSingle();
        if (profile) {
          const fields = [profile.avatar_url, profile.profession, profile.location, profile.bio, profile.phone, profile.linkedin_url];
          const filled = fields.filter(Boolean).length;
          setProfileCompletion(Math.round((filled / fields.length) * 100));
        }
        setLoading(false);
        return;
      }

      const ids = list.map((a) => a.id);
      const jobIds = list.map((a) => a.job_id);

      // Batched, not per-card: one query each for interviews/offers/match
      // scores across every application on the page, avoiding N+1 fetching.
      const [{ data: rounds }, { data: offers }, { data: matches }] = await Promise.all([
        supabase.from('hiring_interview_rounds').select('*').in('application_id', ids).order('scheduled_at', { ascending: true }),
        supabase.from('hiring_offers').select('*').in('application_id', ids),
        supabase.from('hiring_match_scores').select('*').eq('candidate_user_id', user.id).in('job_id', jobIds),
      ]);

      const interviewMap: Record<string, InterviewRound[]> = {};
      (rounds || []).forEach((r) => {
        (interviewMap[r.application_id] ||= []).push(r);
      });
      setInterviewsByApp(interviewMap);

      const offerMap: Record<string, Offer> = {};
      (offers || []).forEach((o) => { offerMap[o.application_id] = o; });
      setOffersByApp(offerMap);

      const matchMap: Record<string, MatchScore> = {};
      (matches || []).forEach((m) => { matchMap[m.job_id] = m; });
      setMatchByJob(matchMap);
    } catch (err: any) {
      console.error('Error fetching applications:', err);
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (applicationId: string) => {
    try {
      const { error: rpcError } = await supabase.rpc('update_application_stage', {
        p_application_id: applicationId,
        p_new_stage: 'withdrawn',
      });
      if (rpcError) throw rpcError;

      setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, current_stage: 'withdrawn' } : a)));
      toast({ title: 'Application withdrawn' });
      setSheetOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleOfferResponse = async (offerId: string, applicationId: string, accept: boolean, reason?: string) => {
    try {
      // accept_offer() is the only place a candidate is allowed to drive a
      // stage change beyond 'withdrawn' -- it verifies offer ownership
      // itself and atomically updates hiring_offers + hiring_applications +
      // hiring_application_events, rather than going through the generic
      // update_application_stage() RPC (which still rejects any
      // candidate-requested stage other than 'withdrawn').
      const { error: rpcError } = await supabase.rpc('accept_offer', {
        p_offer_id: offerId,
        p_accept: accept,
        p_decline_reason: reason,
      });
      if (rpcError) throw rpcError;

      const newStage = accept ? 'hired' : 'offer_declined';
      setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, current_stage: newStage } : a)));
      setOffersByApp((prev) => {
        const existing = prev[applicationId];
        if (!existing) return prev;
        return {
          ...prev,
          [applicationId]: {
            ...existing,
            status: accept ? 'accepted' : 'declined',
            accepted_at: accept ? new Date().toISOString() : existing.accepted_at,
            declined_at: accept ? existing.declined_at : new Date().toISOString(),
            decline_reason: accept ? existing.decline_reason : (reason || null),
          },
        };
      });
      toast({ title: accept ? 'Offer accepted' : 'Offer declined' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const upcomingInterviewFor = (appId: string): InterviewRound | undefined =>
    (interviewsByApp[appId] || [])
      .filter((r) => r.status === 'scheduled')
      .sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime())[0];

  const stats = useMemo(() => {
    const total = applications.length;
    const underReview = applications.filter((a) => ['applied', 'screening', 'shortlisted'].includes(a.current_stage)).length;
    const interviews = applications.filter((a) => INTERVIEW_STAGES.includes(a.current_stage) || (interviewsByApp[a.id]?.length ?? 0) > 0).length;
    const offers = applications.filter((a) => a.current_stage === 'offer_extended').length;
    return { total, underReview, interviews, offers };
  }, [applications, interviewsByApp]);

  const filtered = useMemo(() => {
    return applications.filter((a) => {
      if (!matchesFilter(a.current_stage, filter)) return false;
      if (!search) return true;
      const haystack = `${a.jobs.title} ${companyName(a.jobs)} ${a.jobs.location || ''}`.toLowerCase();
      return haystack.includes(search);
    });
  }, [applications, filter, search]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
        <Skeleton className="h-9 w-full" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full rounded-lg" />)}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-10 text-center bg-gradient-card shadow-card border-0">
        <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-1">We couldn't load your applications.</h3>
        <p className="text-sm text-muted-foreground mb-4">Please try again.</p>
        <Button onClick={fetchAll}>Try Again</Button>
      </Card>
    );
  }

  if (applications.length === 0) {
    return (
      <Card className="p-10 text-center bg-gradient-card shadow-card border-0">
        <Briefcase className="h-12 w-12 text-primary mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Your career journey starts here</h3>
        <p className="text-sm text-muted-foreground mb-5 max-w-sm mx-auto">
          Apply to opportunities that match your skills and goals.
        </p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Button onClick={() => navigate('/jobs')}>Explore Jobs</Button>
        </div>
        {profileCompletion !== null && profileCompletion < 100 && (
          <div className="max-w-xs mx-auto mt-8 text-left">
            <p className="text-xs text-muted-foreground mb-1.5">
              Complete your profile to get better job recommendations. {profileCompletion}% complete
            </p>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
              <div className="h-full bg-primary rounded-full" style={{ width: `${profileCompletion}%` }} />
            </div>
            <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate('/profile')}>Complete Profile →</Button>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">My Applications</h2>
        <p className="text-sm text-muted-foreground">Your complete job search, in one place.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Applications', value: stats.total },
          { label: 'Under Review', value: stats.underReview },
          { label: 'Interviews', value: stats.interviews },
          { label: 'Offers', value: stats.offers },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-card p-3 text-center">
            <p className="text-xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs sm:ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search applications..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center bg-gradient-card shadow-card border-0">
          <Bookmark className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No applications match this view.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => (
            <ApplicationCard
              key={app.id}
              application={app}
              upcomingInterview={upcomingInterviewFor(app.id)}
              offer={offersByApp[app.id]}
              onView={() => { setSelected(app); setSheetOpen(true); }}
              onWithdraw={() => handleWithdraw(app.id)}
            />
          ))}
        </div>
      )}

      <ApplicationDetailsSheet
        application={selected}
        interviewRounds={selected ? (interviewsByApp[selected.id] || []) : []}
        offer={selected ? offersByApp[selected.id] || null : null}
        matchScore={selected ? matchByJob[selected.job_id] || null : null}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onWithdraw={handleWithdraw}
        onRespondToOffer={handleOfferResponse}
      />
    </div>
  );
};
