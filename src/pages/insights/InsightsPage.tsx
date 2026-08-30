import { useCallback, useEffect, useState } from 'react';
import { Newspaper, Plus, PenSquare } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useLayoutUser } from '@/lib/insights/useLayoutUser';
import { fetchInsightsLanding, type InsightsLandingData } from '@/lib/insights/api';
import type { Insight } from '@/lib/insights/types';
import InsightCard from '@/components/insights/InsightCard';
import CreateInsightDialog from '@/components/insights/CreateInsightDialog';
import { useNavigate } from 'react-router-dom';

function SectionSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border">
          <Skeleton className="aspect-[16/9] w-full" />
          <div className="space-y-2 p-4">
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InsightsPage() {
  const { user, onSignOut } = useLayoutUser();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [data, setData] = useState<InsightsLandingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErrored(false);
    try {
      setData(await fetchInsightsLanding());
    } catch (err) {
      console.error('Insights landing load failed', err);
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onCreated = (insight: Insight) => {
    // straight into writing the first article
    navigate(`/insights/${insight.slug}/write`);
  };

  const patchFollow = (id: string, following: boolean, delta: number) => {
    setData((d) =>
      d
        ? {
            ...d,
            latest: d.latest.map((i) =>
              i.id === id
                ? { ...i, isSubscribed: following, subscriberCount: Math.max(0, (i.subscriberCount ?? 0) + delta) }
                : i,
            ),
          }
        : d,
    );
  };

  const mine = data?.mine ?? [];
  const following = data?.following ?? [];
  const latest = data?.latest ?? [];
  const nothingAnywhere = !loading && !errored && mine.length === 0 && following.length === 0 && latest.length === 0;

  return (
    <Layout user={user} onSignOut={onSignOut} fullWidth>
      <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5 sm:px-6">
        {/* header + intro + CTA */}
        <div className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Newspaper className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Insights</h1>
            </div>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Publish articles under your own Insight. People who follow it get notified every time
              you post a new one.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" />
            Create Insight
          </Button>
        </div>

        {loading ? (
          <div className="space-y-8 pt-6">
            <div>
              <Skeleton className="mb-4 h-5 w-40" />
              <SectionSkeletonGrid />
            </div>
          </div>
        ) : errored ? (
          <div className="py-16 text-center">
            <p className="font-medium">Couldn’t load Insights</p>
            <p className="mt-1 text-sm text-muted-foreground">Check your connection and try again.</p>
            <Button variant="outline" className="mt-4" onClick={load}>
              Retry
            </Button>
          </div>
        ) : nothingAnywhere ? (
          <div className="py-16 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-secondary text-muted-foreground">
              <PenSquare className="h-7 w-7" />
            </div>
            <p className="mt-4 font-semibold">No insights yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Be the first to publish. Create your Insight and write your first article.
            </p>
            <Button className="mt-4 gap-1.5" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Create your first Insight
            </Button>
          </div>
        ) : (
          <div className="space-y-10 pt-6">
            {mine.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold">Your Insights</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {mine.map((i) => (
                    <InsightCard key={i.id} insight={i} showFollow={false} />
                  ))}
                </div>
              </section>
            )}

            {following.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold">Following</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {following.map((i) => (
                    <InsightCard
                      key={i.id}
                      insight={{ ...i, isSubscribed: true }}
                      onFollowChange={patchFollow}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              <h2 className="mb-4 text-lg font-semibold">Latest Insights</h2>
              {latest.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No published Insights from other people yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {latest.map((i) => (
                    <InsightCard key={i.id} insight={i} onFollowChange={patchFollow} />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <CreateInsightDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onCreated} />
    </Layout>
  );
}
