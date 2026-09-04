import { FileClock } from 'lucide-react';
import type { BillingEvent } from '@/lib/ads/billing';

function fmt(d: string) {
  try {
    return new Date(d).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d;
  }
}

export function BillingActivityList({ events }: { events: BillingEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-md border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
        No billing activity yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-3 rounded-md border bg-card p-3">
          <FileClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm text-foreground">{e.summary}</p>
            <p className="text-xs text-muted-foreground">{fmt(e.created_at)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
