import { useState } from 'react';
import { ChevronRight, Clock, HardDrive, Star, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FolderIcon } from './FileTypeIcon';
import { buildFolderTree, type FolderNode } from './folderTree';
import type { VaultFolder, VaultView } from './types';

interface Props {
  view: VaultView;
  folderId: string | null;
  folders: VaultFolder[];
  usageBytes: number;
  onNavigate: (view: VaultView, folderId: string | null) => void;
}

const NAV: { view: VaultView; label: string; Icon: typeof Clock }[] = [
  { view: 'all', label: 'My Certificates', Icon: HardDrive },
  { view: 'recent', label: 'Recent', Icon: Clock },
  { view: 'starred', label: 'Starred', Icon: Star },
  { view: 'trash', label: 'Trash', Icon: Trash2 },
];

function fmt(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function TreeNode({
  node,
  activeId,
  view,
  onNavigate,
}: {
  node: FolderNode;
  activeId: string | null;
  view: VaultView;
  onNavigate: Props['onNavigate'];
}) {
  const [open, setOpen] = useState(false);
  const active = view === 'all' && activeId === node.id;
  return (
    <li>
      <div
        className={cn(
          'group flex items-center rounded-md text-sm',
          active ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
        )}
        style={{ paddingLeft: 4 + node.depth * 12 }}
      >
        {node.children.length > 0 ? (
          <button
            type="button"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => setOpen((o) => !o)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-6" />
        )}
        <button
          type="button"
          onClick={() => onNavigate('all', node.id)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left"
        >
          <FolderIcon className="h-4 w-4" />
          <span className="truncate">{node.name}</span>
        </button>
      </div>
      {open && node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} activeId={activeId} view={view} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function VaultNav({ view, folderId, folders, usageBytes, onNavigate }: Props) {
  const tree = buildFolderTree(folders);
  return (
    <nav className="flex h-full min-h-0 flex-col gap-1 p-2 text-sm" aria-label="Vault sections">
      {NAV.map(({ view: v, label, Icon }) => {
        const active = view === v && (v !== 'all' || !folderId);
        return (
          <button
            key={v}
            type="button"
            onClick={() => onNavigate(v, null)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-3 rounded-full px-3 py-2 text-left transition-colors',
              active ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-muted',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        );
      })}

      {tree.length > 0 && (
        <>
          <div className="mt-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Folders
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {tree.map((n) => (
              <TreeNode key={n.id} node={n} activeId={folderId} view={view} onNavigate={onNavigate} />
            ))}
          </ul>
        </>
      )}

      <div className="mt-auto border-t border-border px-3 pt-3 text-xs text-muted-foreground">
        {fmt(usageBytes)} used in your vault
      </div>
    </nav>
  );
}
