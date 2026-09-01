import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, AlertCircle, RefreshCw, Megaphone, ChevronRight } from 'lucide-react';
import { CampaignStatusBadge } from '@/components/ads/CampaignStatusBadge';
import { campaignObjectiveLabel, listCampaigns, type Campaign } from '@/lib/ads/api';

function budgetSummary(c: Campaign, currency: string): string {
  const parts: string[] = [];
  if (c.daily_budget_cents && c.daily_budget_cents > 0)
    parts.push(`${currency} ${(c.daily_budget_cents / 100).toLocaleString()}/day`);
  if (c.total_budget_cents && c.total_budget_cents > 0)
    parts.push(`${currency} ${(c.total_budget_cents / 100).toLocaleString()} total`);
  return parts.join(' · ') || 'No budget yet';
}

export function AdAccountCampaignsCard({
  adAccountId,
  currency,
  disabled,
}: {
  adAccountId: string;
  currency: string;
  disabled?: boolean;
}) {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setError(null);
    listCampaigns(adAccountId)
      .then(setCampaigns)
      .catch((e) => {
        setCampaigns([]);
        setError(e instanceof Error ? e.message : 'Failed to load campaigns.');
      });
  };

  useEffect(load, [adAccountId]);

  const loading = campaigns === null;

  return (
    <Card className="bg-card shadow-card border-0">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-[15px] font-bold">Campaigns</CardTitle>
        {!loading && !error && campaigns.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={() => navigate(`/ads/accounts/${adAccountId}/campaigns/new`)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-md" />
            <Skeleton className="h-14 w-full rounded-md" />
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

        {!loading && !error && campaigns.length === 0 && (
          <div className="rounded-md border border-dashed px-4 py-8 text-center">
            <Megaphone className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">No campaigns yet</p>
            <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
              A campaign holds your objective, budget and schedule. It starts as a draft.
            </p>
            <Button
              className="mt-4"
              size="sm"
              disabled={disabled}
              onClick={() => navigate(`/ads/accounts/${adAccountId}/campaigns/new`)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create campaign
            </Button>
            {disabled && (
              <p className="mt-2 text-xs text-muted-foreground">
                Reopen this ad account to create campaigns.
              </p>
            )}
          </div>
        )}

        {!loading && !error && campaigns.length > 0 && (
          <ul className="divide-y divide-border/60">
            {campaigns.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => navigate(`/ads/campaigns/${c.id}`)}
                  className="flex w-full items-center gap-3 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                      <CampaignStatusBadge status={c.status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {campaignObjectiveLabel(c.objective)} · {budgetSummary(c, currency)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
