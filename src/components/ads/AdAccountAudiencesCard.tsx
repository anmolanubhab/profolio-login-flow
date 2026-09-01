import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, AlertCircle, RefreshCw, Users, ChevronRight } from 'lucide-react';
import { AudienceReachBadge } from '@/components/ads/AudienceReachBadge';
import {
  audienceCriteriaCount,
  listAudiences,
  type AdAudience,
  type AudienceSpec,
} from '@/lib/ads/api';

export function AdAccountAudiencesCard({
  adAccountId,
  disabled,
}: {
  adAccountId: string;
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  const [audiences, setAudiences] = useState<AdAudience[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    listAudiences(adAccountId)
      .then(setAudiences)
      .catch((e) => {
        setAudiences([]);
        setError(e instanceof Error ? e.message : 'Failed to load audiences.');
      });
  };

  useEffect(load, [adAccountId]);

  const loading = audiences === null;
  const criteria = (a: AdAudience) =>
    audienceCriteriaCount(typeof a.spec === 'object' && a.spec ? (a.spec as AudienceSpec) : {});

  return (
    <Card className="bg-card shadow-card border-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-[15px] font-bold">Audiences</CardTitle>
        {!loading && !error && audiences.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => navigate(`/ads/accounts/${adAccountId}/audiences/new`)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <span className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </span>
            <Button size="sm" variant="outline" onClick={load}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && audiences.length === 0 && (
          <div className="rounded-md border border-dashed px-4 py-8 text-center">
            <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No saved audiences</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
              Reusable sets of professional targeting criteria. Attach one to a campaign from its
              Audience step.
            </p>
            <Button
              className="mt-4"
              size="sm"
              disabled={disabled}
              onClick={() => navigate(`/ads/accounts/${adAccountId}/audiences/new`)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create audience
            </Button>
          </div>
        )}

        {!loading && !error && audiences.length > 0 && (
          <ul className="divide-y divide-border/60">
            {audiences.map((a) => {
              const n = criteria(a);
              return (
                <li key={a.id}>
                  <button
                    onClick={() => navigate(`/ads/audiences/${a.id}`)}
                    className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-foreground">{a.name}</span>
                        <AudienceReachBadge reach={a.estimated_reach} />
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {n === 0 ? 'No criteria' : `${n} ${n === 1 ? 'criterion' : 'criteria'}`}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
