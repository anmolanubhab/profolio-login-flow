import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Loader2,
  RotateCcw,
  X,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { formatBytes } from './types';
import type { UploadItem } from './useVaultUpload';

interface Props {
  items: UploadItem[];
  onRetry: (id: string) => void;
  onCancel: (id: string) => void;
  onDismiss: (id: string) => void;
  onClearFinished: () => void;
}

export function UploadQueue({ items, onRetry, onCancel, onDismiss, onClearFinished }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  if (items.length === 0) return null;

  const done = items.filter((i) => i.status === 'done').length;
  const failed = items.filter((i) => i.status === 'error').length;
  const inFlight = items.some((i) => i.status === 'uploading' || i.status === 'pending');
  const title = inFlight
    ? `Uploading ${done + failed + 1} / ${items.length}`
    : failed
      ? `${done} uploaded · ${failed} failed`
      : `${done} upload${done === 1 ? '' : 's'} complete`;

  return (
    <div
      className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-3 z-40 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-border bg-card shadow-lg lg:bottom-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        {inFlight ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
        ) : failed ? (
          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{title}</span>
        <button
          type="button"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          onClick={() => setCollapsed((c) => !c)}
          className="rounded p-1 hover:bg-muted"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
        {!inFlight && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onClearFinished}
            className="rounded p-1 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {!collapsed && (
        <ul className="max-h-64 divide-y divide-border overflow-y-auto">
          {items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate">{it.file.name}</div>
                <div className="text-xs text-muted-foreground">
                  {it.status === 'error' ? (
                    <span className="text-destructive">{it.error}</span>
                  ) : it.status === 'canceled' ? (
                    'Canceled'
                  ) : it.status === 'done' ? (
                    'Done'
                  ) : (
                    formatBytes(it.file.size)
                  )}
                </div>
                {(it.status === 'uploading' || it.status === 'pending') && (
                  <Progress value={it.status === 'pending' ? 0 : it.progress} className="mt-1 h-1" />
                )}
              </div>
              {it.status === 'error' ? (
                <button
                  type="button"
                  aria-label="Retry"
                  onClick={() => onRetry(it.id)}
                  className="rounded p-1 hover:bg-muted"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              ) : null}
              {it.status === 'pending' ? (
                <button
                  type="button"
                  aria-label="Cancel"
                  onClick={() => onCancel(it.id)}
                  className="rounded p-1 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : it.status !== 'uploading' ? (
                <button
                  type="button"
                  aria-label="Remove from list"
                  onClick={() => onDismiss(it.id)}
                  className="rounded p-1 hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <CheckCircle2 className="h-4 w-4 text-transparent" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
