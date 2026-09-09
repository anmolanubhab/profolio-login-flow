import { ChevronRight, Clock, HardDrive, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VaultFolder, VaultView } from './types';

const ROOT: Record<VaultView, { label: string; Icon: typeof HardDrive }> = {
  all: { label: 'My Certificates', Icon: HardDrive },
  recent: { label: 'Recent', Icon: Clock },
  starred: { label: 'Starred', Icon: Star },
  trash: { label: 'Trash', Icon: Trash2 },
};

export function VaultBreadcrumbs({
  view,
  chain,
  onNavigate,
}: {
  view: VaultView;
  chain: VaultFolder[];
  onNavigate: (folderId: string | null) => void;
}) {
  const { label, Icon } = ROOT[view];
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 overflow-x-auto px-3 py-2 text-sm scrollbar-hide">
      <button
        type="button"
        onClick={() => onNavigate(null)}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded px-1.5 py-1 font-medium hover:bg-muted',
          chain.length === 0 && 'text-foreground',
          chain.length > 0 && 'text-muted-foreground',
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </button>
      {chain.map((f, i) => (
        <span key={f.id} className="flex shrink-0 items-center gap-1">
          <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          <button
            type="button"
            onClick={() => onNavigate(f.id)}
            className={cn(
              'max-w-[10rem] truncate rounded px-1.5 py-1 hover:bg-muted',
              i === chain.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            {f.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
