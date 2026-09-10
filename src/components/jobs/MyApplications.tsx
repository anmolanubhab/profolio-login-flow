import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import {
  Search, Briefcase, AlertTriangle, ArrowUpRight, ArrowDownUp, SlidersHorizontal,
  FileText, Activity, CalendarClock, Trophy, Rocket, Zap, PartyPopper, ArrowRight, Check,
} from 'lucide-react';
import { ApplicationFilter, matchesFilter } from '@/lib/applicationStages';
import {
  computeStats, computeFunnel, computeNextBestAction, sortApplications,
  matchesAdvanced, EMPTY_ADVANCED_FILTERS, SORT_OPTIONS,
  type SortKey, type AdvancedFilters,
} from '@/lib/applicationInsights';
import { useMyApplicationsData, MY_APPLICATIONS_QUERY_KEY } from '@/hooks/useMyApplicationsData';
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

const PIPELINE = [
  { key: 'applied', label: 'Applied' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'interview', label: 'Interview' },
  { key: 'offers', label: 'Offer' },
  { key: 'accepted', label: 'Accepted' },
] as const;

const NBA_ICON = { follow_up: Zap, prepare_interview: CalendarClock, review_offer: Zap, caught_up: PartyPopper } as const;

// Stable empty fallbacks -- keeps memo deps from churning while data loads.
const EMPTY_APPS: ApplicationRow[] = [];
const EMPTY_INTERVIEWS: Record<string, InterviewRound[]> = {};
const EMPTY_OFFERS: Record<string, Offer> = {};
const EMPTY_MATCHES: Record<string, MatchScore> = {};

export const MyApplications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data, isLoading, error, refetch } = useMyApplicationsData();
  const applications = data?.applications ?? EMPTY_APPS;
  const interviewsByApp = data?.interviewsByApp ?? EMPTY_INTERVIEWS;
  const offersByApp = data?.offersByApp ?? EMPTY_OFFERS;
  const matchByJob = data?.matchByJob ?? EMPTY_MATCHES;

  const [filter, setFilter] = useState<ApplicationFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [advanced, setAdvanced] = useState<AdvancedFilters>(EMPTY_ADVANCED_FILTERS);
  const [selected, setSelected] = useState<ApplicationRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Deep link: /dashboard?tab=applications&app=<id> opens that application's
  // details sheet (used by the right-rail follow-up list). Consume the param
  // once so a refresh doesn't reopen it.
  useEffect(() => {
    const appId = searchParams.get('app');
    if (!appId || applications.length === 0) return;
    const match = applications.find((a) => a.id === appId);
    if (match) {
      setSelected(match);
      setSheetOpen(true);
    }
    searchParams.delete('app');
    setSearchParams(searchParams, { replace: true });
  }, [applications, searchParams, setSearchParams]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: MY_APPLICATIONS_QUERY_KEY });

  const handleWithdraw = async (applicationId: string) => {
    try {
      const { error: rpcError } = await supabase.rpc('update_application_stage', {
        p_application_id: applicationId,
        p_new_stage: 'withdrawn',
      });
      if (rpcError) throw rpcError;
      toast({ title: 'Application withdrawn' });
      setSheetOpen(false);
      invalidate();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Something went wrong', variant: 'destructive' });
    }
  };

  const handleOfferResponse = async (offerId: string, applicationId: string, accept: boolean, reason?: string) => {
    try {
      const { error: rpcError } = await supabase.rpc('accept_offer', {
        p_offer_id: offerId,
        p_accept: accept,
        p_decline_reason: reason,
      });
      if (rpcError) throw rpcError;
      toast({ title: accept ? 'Offer accepted' : 'Offer declined' });
      invalidate();
    } catch (err) {
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Something went wrong', variant: 'destructive' });
    }
  };

  const upcomingInterviewFor = (appId: string) =>
    (interviewsByApp[appId] || [])
      .filter((r) => r.status === 'scheduled')
      .sort((a, b) => new Date(a.scheduled_at || 0).getTime() - new Date(b.scheduled_at || 0).getTime())[0];

  const stats = useMemo(() => computeStats(applications, interviewsByApp), [applications, interviewsByApp]);
  const funnel = useMemo(() => computeFunnel(applications, interviewsByApp), [applications, interviewsByApp]);
  const nba = useMemo(
    () => computeNextBestAction(applications, interviewsByApp, offersByApp),
    [applications, interviewsByApp, offersByApp],
  );

  const tabCounts = useMemo(() => {
    const c: Record<ApplicationFilter, number> = { all: 0, active: 0, interviews: 0, offers: 0, closed: 0 };
    for (const a of applications) {
      c.all += 1;
      (['active', 'interviews', 'offers', 'closed'] as ApplicationFilter[]).forEach((f) => {
        if (matchesFilter(a.current_stage, f)) c[f] += 1;
      });
    }
    return c;
  }, [applications]);

  const jobTypeOptions = useMemo(
    () => Array.from(new Set(applications.map((a) => a.jobs.employment_type).filter(Boolean))) as string[],
    [applications],
  );
  const workModeOptions = useMemo(
    () => Array.from(new Set(applications.map((a) => a.jobs.remote_option).filter(Boolean))) as string[],
    [applications],
  );
  const advancedActive = advanced.jobType !== null || advanced.workMode !== null || advanced.followUpOnly;

  const filtered = useMemo(() => {
    const list = applications.filter((a) => {
      if (!matchesFilter(a.current_stage, filter)) return false;
      if (!matchesAdvanced(a, advanced)) return false;
      if (!search) return true;
      const haystack = `${a.jobs.title} ${companyName(a.jobs)} ${a.jobs.location || ''}`.toLowerCase();
      return haystack.includes(search);
    });
    return sortApplications(list, sortKey);
  }, [applications, filter, advanced, search, sortKey]);

  // ---------- loading ----------
  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
      </div>
    );
  }

  // ---------- error ----------
  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-10 text-center">
        <AlertTriangle className="mx-auto mb-3 h-9 w-9 text-destructive" />
        <h3 className="text-base font-semibold">Couldn&apos;t load your applications.</h3>
        <p className="mt-1 text-sm text-muted-foreground">Something went wrong while fetching your job search data.</p>
        <Button className="mt-4" onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-[28px] sm:leading-9">My Applications</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Track, manage &amp; accelerate your job search.</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={() => navigate('/jobs')}>
          <Briefcase className="mr-1.5 h-4 w-4" />
          Browse jobs
        </Button>
        <Button size="sm" variant="outline" onClick={() => navigate('/settings/visibility')}>
          Job preferences
        </Button>
      </div>
    </div>
  );

  // ---------- true empty (no applications at all) ----------
  if (applications.length === 0) {
    return (
      <div className="space-y-5">
        {header}
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10">
            <Briefcase className="h-6 w-6 text-primary" />
          </div>
          <h3 className="mt-4 text-base font-semibold">No applications yet</h3>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Start tracking your job search in one place — apply to a role and it&apos;ll show up here with its full timeline.
          </p>
          <Button className="mt-4" onClick={() => navigate('/jobs')}>Browse jobs</Button>
        </div>
      </div>
    );
  }

  const maxFunnel = Math.max(funnel.applied, 1);
  const NbaIcon = NBA_ICON[nba.type];

  return (
    <div className="space-y-5">
      {header}

      {/* ---- overview stats ---- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          icon={FileText}
          label="Applications"
          value={stats.total}
          sub={stats.appliedThisWeek > 0
            ? <span className="inline-flex items-center gap-0.5 text-success"><ArrowUpRight className="h-3 w-3" />{stats.appliedThisWeek} this week</span>
            : 'Keep applying'}
        />
        <StatCard
          icon={Activity}
          label="Active"
          value={stats.active}
          sub={stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}% of total` : '—'}
        />
        <StatCard
          icon={CalendarClock}
          label="Interviews"
          value={stats.interviews}
          sub={stats.interviews > 0 ? 'In progress' : 'Keep going'}
        />
        <StatCard
          icon={Trophy}
          label="Offers"
          value={stats.offers}
          sub={stats.offers > 0 ? 'Review & respond' : 'One step away'}
        />
      </div>

      {/* ---- job search progress ---- */}
      <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <h2 className="text-[15px] font-semibold text-foreground">Your job search progress</h2>
            <p className="text-xs text-muted-foreground">From application to achievement</p>
            <div className="mt-4 flex items-start">
              {PIPELINE.map((step, i) => {
                const count = funnel[step.key];
                const reached = count > 0;
                const isLast = i === PIPELINE.length - 1;
                return (
                  <div key={step.key} className="flex min-w-0 flex-1 flex-col items-center">
                    <div className="flex w-full items-center">
                      {i > 0 && <span className={cn('h-0.5 flex-1 rounded-full', reached ? 'bg-primary/60' : 'bg-border')} />}
                      <span
                        className={cn(
                          'grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold',
                          reached ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground',
                        )}
                      >
                        {!reached ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        ) : i < PIPELINE.length - 1 && funnel[PIPELINE[i + 1]?.key] > 0 ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        ) : (
                          count
                        )}
                      </span>
                      {!isLast && <span className={cn('h-0.5 flex-1 rounded-full', funnel[PIPELINE[i + 1]?.key] > 0 ? 'bg-primary/60' : 'bg-border')} />}
                    </div>
                    <span className={cn('mt-1.5 text-[11px]', reached ? 'font-medium text-foreground' : 'text-muted-foreground/70')}>
                      {step.label}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="shrink-0 rounded-lg border border-primary/20 bg-primary/5 p-3.5 lg:w-64">
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-primary">
              <Rocket className="h-4 w-4" />
              {stats.appliedThisWeek >= 3 ? 'Great momentum!' : 'Keep going!'}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.appliedThisWeek >= 3
                ? `You've applied to ${stats.appliedThisWeek} roles this week — that's a strong, consistent pace.`
                : `You've applied to ${stats.total} role${stats.total === 1 ? '' : 's'}. Aim for 3–5 relevant applications a week to improve your odds.`}
            </p>
          </div>
        </div>
      </section>

      {/* ---- next best action ---- */}
      <section
        className={cn(
          'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5',
          nba.type === 'caught_up' ? 'border-success/25 bg-success/5' : 'border-primary/25 bg-primary/5',
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={cn(
              'grid h-10 w-10 shrink-0 place-items-center rounded-full',
              nba.type === 'caught_up' ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary',
            )}
          >
            <NbaIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className={cn('text-[11px] font-semibold uppercase tracking-wide', nba.type === 'caught_up' ? 'text-success' : 'text-primary')}>
              {nba.eyebrow}
            </p>
            <p className="truncate text-sm font-semibold text-foreground">{nba.title}</p>
            <p className="text-xs text-muted-foreground">{nba.detail}</p>
          </div>
        </div>
        {nba.app && (
          <Button
            size="sm"
            variant={nba.type === 'caught_up' ? 'outline' : 'default'}
            className="shrink-0"
            onClick={() => { setSelected(nba.app); setSheetOpen(true); }}
          >
            View application
          </Button>
        )}
      </section>

      {/* ---- filter bar ---- */}
      <div className="space-y-3">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors',
                filter === f.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
              )}
            >
              {f.label}
              <span className={cn('tabular-nums', filter === f.key ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                {tabCounts[f.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search applications, companies, roles…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 pl-8"
              aria-label="Search applications"
            />
          </div>

          {/* Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 shrink-0">
                <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                Filter
                {advancedActive && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Follow-up</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={advanced.followUpOnly}
                onCheckedChange={(v) => setAdvanced((s) => ({ ...s, followUpOnly: !!v }))}
              >
                Needs a follow-up
              </DropdownMenuCheckboxItem>
              {jobTypeOptions.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Job type</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={advanced.jobType ?? '__all'}
                    onValueChange={(v) => setAdvanced((s) => ({ ...s, jobType: v === '__all' ? null : v }))}
                  >
                    <DropdownMenuRadioItem value="__all">Any</DropdownMenuRadioItem>
                    {jobTypeOptions.map((o) => <DropdownMenuRadioItem key={o} value={o}>{o}</DropdownMenuRadioItem>)}
                  </DropdownMenuRadioGroup>
                </>
              )}
              {workModeOptions.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Work mode</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={advanced.workMode ?? '__all'}
                    onValueChange={(v) => setAdvanced((s) => ({ ...s, workMode: v === '__all' ? null : v }))}
                  >
                    <DropdownMenuRadioItem value="__all">Any</DropdownMenuRadioItem>
                    {workModeOptions.map((o) => <DropdownMenuRadioItem key={o} value={o}>{o}</DropdownMenuRadioItem>)}
                  </DropdownMenuRadioGroup>
                </>
              )}
              {advancedActive && (
                <>
                  <DropdownMenuSeparator />
                  <button
                    className="w-full px-2 py-1.5 text-left text-[13px] text-primary hover:underline"
                    onClick={() => setAdvanced(EMPTY_ADVANCED_FILTERS)}
                  >
                    Clear filters
                  </button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 shrink-0">
                <ArrowDownUp className="mr-1.5 h-4 w-4" />
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuRadioGroup value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                {SORT_OPTIONS.map((o) => (
                  <DropdownMenuRadioItem key={o.key} value={o.key}>{o.label}</DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ---- list ---- */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <ArrowRight className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">No applications in this view</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filter === 'closed'
              ? 'Nothing has been closed yet — good sign.'
              : 'Try a different tab, clear filters, or adjust your search.'}
          </p>
        </div>
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
        interviewRounds={selected ? interviewsByApp[selected.id] || [] : []}
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

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: typeof FileText;
  label: string;
  value: number;
  sub: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold leading-none tracking-tight text-foreground tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
