import { Link } from 'react-router-dom';
import { Newspaper, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Insight } from '@/lib/insights/types';
import InsightFollowButton from './InsightFollowButton';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface Props {
  insight: Insight;
  /** compact = horizontal row (used in "Latest / More from" lists) */
  layout?: 'grid' | 'row';
  showFollow?: boolean;
  onFollowChange?: (id: string, following: boolean, delta: number) => void;
  className?: string;
}

export default function InsightCard({
  insight,
  layout = 'grid',
  showFollow = true,
  onFollowChange,
  className,
}: Props) {
  const href = `/insights/${insight.slug}`;
  const authorName = insight.author?.display_name || 'Unknown author';
  const dateLabel = insight.status === 'published' ? formatDate(insight.published_at) : 'Draft';
  const subs = insight.subscriberCount ?? 0;

  if (layout === 'row') {
    return (
      <Link
        to={href}
        className={cn(
          'group flex gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary/40',
          className,
        )}
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
          {insight.cover_url ? (
            <img src={insight.cover_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted-foreground">
              <Newspaper className="h-6 w-6" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-primary">
            {insight.title}
          </div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{authorName}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            {dateLabel && <span>{dateLabel}</span>}
            {subs > 0 && (
              <span className="inline-flex items-center gap-1">
                <Users className="h-3 w-3" />
                {subs.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md',
        className,
      )}
    >
      <Link to={href} className="block aspect-[16/9] w-full overflow-hidden bg-muted">
        {insight.cover_url ? (
          <img
            src={insight.cover_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/10 to-secondary text-primary/50">
            <Newspaper className="h-10 w-10" />
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <Link to={href} className="min-w-0">
          <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-primary">
            {insight.title}
          </h3>
        </Link>
        {insight.description && (
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-normal text-muted-foreground">
            {insight.description}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={insight.author?.avatar_url ?? undefined} className="object-cover" />
            <AvatarFallback className="bg-primary/10 text-[11px] font-semibold text-primary">
              {authorName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{authorName}</div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              {dateLabel && <span>{dateLabel}</span>}
              {subs > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {subs.toLocaleString()} {subs === 1 ? 'follower' : 'followers'}
                </span>
              )}
            </div>
          </div>
        </div>

        {showFollow && !insight.isOwner && insight.status === 'published' && (
          <div className="mt-3">
            <InsightFollowButton
              insightId={insight.id}
              initialFollowing={!!insight.isSubscribed}
              size="sm"
              variant="compact"
              onChange={(f, d) => onFollowChange?.(insight.id, f, d)}
            />
          </div>
        )}
        {insight.isOwner && (
          <div className="mt-3">
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {insight.status === 'published' ? 'Your Insight' : 'Draft'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
