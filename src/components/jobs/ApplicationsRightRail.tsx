import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Building2, TrendingUp, Sparkles, BellRing, Lightbulb } from 'lucide-react';
import { useMyApplicationsData } from '@/hooks/useMyApplicationsData';
import { useJobRecommendations } from '@/hooks/useJobRecommendations';
import { computeFunnel, computeMetrics, followUpsDue } from '@/lib/applicationInsights';
import { companyName, companyLogo } from './applicationTypes';

const WIDGET = 'rounded-xl border border-border bg-card overflow-hidden';

export function ApplicationsRightRail() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data, isLoading } = useMyApplicationsData();
  const applications = useMemo(() => data?.applications ?? [], [data]);
  const interviewsByApp = useMemo(() => data?.interviewsByApp ?? {}, [data]);

  const { jobs: recJobs, loading: recLoading } = useJobRecommendations(userId);

  const funnel = useMemo(() => computeFunnel(applications, interviewsByApp), [applications, interviewsByApp]);
  const metrics = useMemo(() => computeMetrics(applications, interviewsByApp), [applications, interviewsByApp]);
  const followUps = useMemo(() => followUpsDue(applications).slice(0, 3), [applications]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-52 rounded-xl" />
      </div>
    );
  }

  const hasApps = applications.length > 0;

  const funnelRows: { label: string; value: number }[] = [
    { label: 'Applied', value: funnel.applied },
    { label: 'Under review', value: funnel.reviewed },
    { label: 'Interview', value: funnel.interview },
    { label: 'Offers', value: funnel.offers },
    { label: 'Accepted', value: funnel.accepted },
  ];
  const funnelMax = Math.max(...funnelRows.map((r) => r.value), 1);

  return (
    <div className="space-y-4">
      {/* ---- Application Funnel ---- */}
      <section className={WIDGET}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Application funnel</h3>
        </div>
        <div className="space-y-2.5 p-4">
          {hasApps ? (
            funnelRows.map((r) => (
              <div key={r.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{r.label}</span>
                  <span className="font-semibold tabular-nums text-foreground">{r.value}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.max(r.value === 0 ? 0 : 6, (r.value / funnelMax) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">Apply to a role to start building your funnel.</p>
          )}

          <div className="mt-3 grid grid-cols-1 gap-2 border-t border-border pt-3 text-xs">
            <Metric label="Response rate" value={metrics.responseRate === null ? '—' : `${metrics.responseRate}%`} />
            <Metric label="Interview rate" value={metrics.interviewRate === null ? '—' : `${metrics.interviewRate}%`} />
            <Metric
              label="Avg. response time"
              value={metrics.avgResponseDays === null ? '—' : `${metrics.avgResponseDays} day${metrics.avgResponseDays === 1 ? '' : 's'}`}
            />
          </div>
        </div>
      </section>

      {/* ---- Job Search Insights ---- */}
      <section className={WIDGET}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Job search insights</h3>
        </div>
        <div className="space-y-2.5 p-4">
          <Metric label="Applications this month" value={String(metrics.applicationsThisMonth)} />
          <Metric label="Response rate" value={metrics.responseRate === null ? '—' : `${metrics.responseRate}%`} />
          <Metric label="Interview rate" value={metrics.interviewRate === null ? '—' : `${metrics.interviewRate}%`} />

          <div className="mt-1 flex items-start gap-2 rounded-lg bg-primary/5 p-3 text-xs text-muted-foreground">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              {metrics.interviewRate !== null && metrics.interviewRate >= 20
                ? "You're converting applications into interviews well — keep the momentum going."
                : metrics.responseRate !== null && metrics.responseRate >= 40
                  ? "You're getting solid responses. Tailoring each application further can lift your interview rate."
                  : 'Apply to 3–5 relevant roles a week and keep your profile current to build a stronger pipeline.'}
            </span>
          </div>
        </div>
      </section>

      {/* ---- Jobs matching your profile ---- */}
      <section className={WIDGET}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Jobs matching your profile</h3>
          <button className="text-xs font-medium text-primary hover:underline" onClick={() => navigate('/jobs')}>
            View all
          </button>
        </div>
        <div className="divide-y divide-border">
          {recLoading ? (
            [0, 1, 2].map((i) => <div key={i} className="p-4"><Skeleton className="h-14 w-full" /></div>)
          ) : recJobs.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-xs text-muted-foreground">No matching jobs right now.</p>
              <Button variant="outline" size="sm" className="mt-2 h-8" onClick={() => navigate('/jobs')}>
                Explore jobs
              </Button>
            </div>
          ) : (
            recJobs.slice(0, 3).map((j) => {
              const pct = Math.round((j.score <= 1 ? j.score * 100 : j.score));
              const logo = j.company?.logo_url || null;
              return (
                <div key={j.id} className="flex items-start gap-3 p-4">
                  {logo ? (
                    <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">{j.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{j.company?.name || j.company_name || 'Company'}</p>
                    <p className="truncate text-[11px] text-muted-foreground/80">
                      {[j.location, j.employment_type || j.remote_option].filter(Boolean).join(' · ')}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      {pct > 0 && (
                        <span className="rounded-full bg-success/10 px-1.5 py-0.5 text-[11px] font-semibold text-success">
                          {pct}% match
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-7 px-2 text-xs text-primary"
                        onClick={() => navigate(`/jobs?job=${j.id}`)}
                      >
                        View job
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ---- Follow-ups due ---- */}
      <section className={WIDGET}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <BellRing className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Follow-ups due</h3>
        </div>
        <div className="divide-y divide-border">
          {followUps.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">You&apos;re all caught up 🎉</div>
          ) : (
            followUps.map(({ app, idleDays }) => {
              const logo = companyLogo(app.jobs);
              return (
                <div key={app.id} className="flex items-start gap-3 p-4">
                  {logo ? (
                    <img src={logo} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-border object-cover" loading="lazy" />
                  ) : (
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">{companyName(app.jobs)}</p>
                    <p className="truncate text-xs text-muted-foreground">{app.jobs.title?.trim() || 'Job title unavailable'}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                      Applied {formatDistanceToNowStrict(new Date(app.created_at), { addSuffix: true })}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                          idleDays >= 14 ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning',
                        )}
                      >
                        {idleDays >= 21 ? 'Overdue' : `${idleDays}d no update`}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-7 px-2 text-xs text-primary"
                        onClick={() => navigate(`/dashboard?tab=applications&app=${app.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}
