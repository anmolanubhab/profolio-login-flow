import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, ChevronRight } from 'lucide-react';
import { AudienceReachBadge } from '@/components/ads/AudienceReachBadge';
import { getAudienceWithAccount, getCampaignAdSet, type AdAudience } from '@/lib/ads/api';

/** Compact "is an audience attached?" summary for the campaign detail page. */
export function CampaignAudienceSummary({ campaignId }: { campaignId: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [audience, setAudience] = useState<AdAudience | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const set = await getCampaignAdSet(campaignId);
        if (set?.audience_id) {
          const res = await getAudienceWithAccount(set.audience_id);
          if (!cancelled) setAudience(res?.audience ?? null);
        }
      } catch {
        /* non-fatal — the dedicated page surfaces errors */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  return (
    <Card className="bg-card shadow-card border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-[15px] font-bold">Audience</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-12 w-full rounded-md" />
        ) : (
          <button
            onClick={() => navigate(`/ads/campaigns/${campaignId}/audience`)}
            className="flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              {audience ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                      {audience.name}
                    </span>
                    <AudienceReachBadge reach={audience.estimated_reach} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">Tap to change targeting</p>
                </>
              ) : (
                <>
                  <span className="text-sm font-medium text-foreground">No audience yet</span>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Set who this campaign should reach
                  </p>
                </>
              )}
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        )}
      </CardContent>
    </Card>
  );
}
