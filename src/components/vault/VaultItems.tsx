import { MoreVertical } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileTypeIcon, FolderIcon } from './FileTypeIcon';
import { VaultActionsMenu, type VaultActions } from './VaultActionsMenu';
import {
  formatBytes,
  formatDate,
  type VaultCertificate,
  type VaultFolder,
  type VaultView,
} from './types';

type MouseModifiers = { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean };

export interface ItemHandlers {
  view: VaultView;
  isSelected: (id: string) => boolean;
  onSelect: (id: string, e: MouseModifiers) => void;
  onOpenFolder: (id: string) => void;
  onOpenCert: (id: string) => void;
  onFolderAction: (folder: VaultFolder, action: 'rename' | 'move' | 'trash' | 'restore' | 'delete') => void;
  certActions: (cert: VaultCertificate) => VaultActions;
  starredIds: Set<string>;
}

// ── shared context-menu wrapper ───────────────────────────────────────────
function CertMenu({
  view,
  starred,
  actions,
  children,
}: {
  view: VaultView;
  starred: boolean;
  actions: VaultActions;
  children: React.ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <VaultActionsMenu variant="context" view={view} starred={starred} actions={actions} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

function FolderMenu({
  view,
  onAction,
  children,
}: {
  view: VaultView;
  onAction: (a: 'rename' | 'move' | 'trash' | 'restore' | 'delete') => void;
  children: React.ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {view === 'trash' ? (
          <>
            <DropdownMenuItem asChild>
              <button className="w-full" onClick={() => onAction('restore')}>
                Restore
              </button>
            </DropdownMenuItem>
          </>
        ) : (
          <>
            <button
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => onAction('rename')}
            >
              Rename
            </button>
            <button
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => onAction('move')}
            >
              Move…
            </button>
            <div className="my-1 h-px bg-border" />
            <button
              className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
              onClick={() => onAction('trash')}
            >
              Move to Trash
            </button>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ══ LIST ═════════════════════════════════════════════════════════════════
export function VaultList({
  folders,
  certs,
  h,
}: {
  folders: VaultFolder[];
  certs: VaultCertificate[];
  h: ItemHandlers;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="w-9" />
            <TableHead>Name</TableHead>
            <TableHead className="hidden md:table-cell">Issuer</TableHead>
            <TableHead className="hidden lg:table-cell">Issue / expiry</TableHead>
            <TableHead className="hidden sm:table-cell">Modified</TableHead>
            <TableHead className="hidden sm:table-cell">Size</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {folders.map((f) => (
            <FolderMenu key={f.id} view={h.view} onAction={(a) => h.onFolderAction(f, a)}>
              <TableRow
                tabIndex={0}
                onDoubleClick={() => h.view !== 'trash' && h.onOpenFolder(f.id)}
                onKeyDown={(e) => e.key === 'Enter' && h.view !== 'trash' && h.onOpenFolder(f.id)}
                className="cursor-default border-border"
              >
                <td className="w-9" />
                <td className="py-2">
                  <button
                    className="flex items-center gap-2 text-left text-sm font-medium"
                    onClick={() => h.view !== 'trash' && h.onOpenFolder(f.id)}
                  >
                    <FolderIcon className="h-5 w-5" />
                    <span className="truncate">{f.name}</span>
                  </button>
                </td>
                <td className="hidden md:table-cell" />
                <td className="hidden lg:table-cell" />
                <td className="hidden text-sm text-muted-foreground sm:table-cell">
                  {formatDate(f.updated_at)}
                </td>
                <td className="hidden text-sm text-muted-foreground sm:table-cell">—</td>
                <td className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for ${f.name}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {h.view === 'trash' ? (
                        <>
                          <DropdownMenuItem onSelect={() => h.onFolderAction(f, 'restore')}>Restore</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => h.onFolderAction(f, 'delete')}
                          >
                            Delete forever
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <>
                          <DropdownMenuItem onSelect={() => h.onFolderAction(f, 'rename')}>Rename</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => h.onFolderAction(f, 'move')}>Move…</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onSelect={() => h.onFolderAction(f, 'trash')}
                          >
                            Move to Trash
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </TableRow>
            </FolderMenu>
          ))}

          {certs.map((c) => {
            const sel = h.isSelected(c.id);
            const acts = h.certActions(c);
            const expired = c.expiry_date && new Date(c.expiry_date) < new Date();
            return (
              <CertMenu key={c.id} view={h.view} starred={h.starredIds.has(c.id)} actions={acts}>
                <TableRow
                  data-selected={sel || undefined}
                  aria-selected={sel}
                  tabIndex={0}
                  onClick={(e) => h.onSelect(c.id, e)}
                  onDoubleClick={() => h.onOpenCert(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') h.onOpenCert(c.id);
                    if (e.key === ' ') {
                      e.preventDefault();
                      h.onSelect(c.id, e as unknown as MouseModifiers);
                    }
                  }}
                  className={cn(
                    'cursor-default border-border',
                    sel ? 'bg-primary/10' : 'hover:bg-muted/60',
                  )}
                >
                  <td className="w-9 pl-3">
                    <Checkbox
                      checked={sel}
                      onCheckedChange={() =>
                        h.onSelect(c.id, { shiftKey: false, ctrlKey: true, metaKey: false })
                      }
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${c.title}`}
                    />
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <FileTypeIcon cert={c} className="h-5 w-5" />
                      <span className="truncate text-sm font-medium">{c.title}</span>
                      {expired && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                          Expired
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="hidden truncate text-sm text-muted-foreground md:table-cell">
                    {c.issuer || '—'}
                  </td>
                  <td className="hidden text-sm text-muted-foreground lg:table-cell">
                    {c.issue_date ? formatDate(c.issue_date) : '—'}
                    {c.expiry_date ? ` – ${formatDate(c.expiry_date)}` : ''}
                  </td>
                  <td className="hidden text-sm text-muted-foreground sm:table-cell">
                    {formatDate(c.updated_at)}
                  </td>
                  <td className="hidden text-sm text-muted-foreground sm:table-cell">
                    {formatBytes(c.file_size)}
                  </td>
                  <td className="pr-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label={`Actions for ${c.title}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <VaultActionsMenu
                          variant="dropdown"
                          view={h.view}
                          starred={h.starredIds.has(c.id)}
                          actions={acts}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </TableRow>
              </CertMenu>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// ══ GRID ═════════════════════════════════════════════════════════════════
export function VaultGrid({
  folders,
  certs,
  h,
}: {
  folders: VaultFolder[];
  certs: VaultCertificate[];
  h: ItemHandlers;
}) {
  return (
    <div className="space-y-4 px-3 py-3">
      {folders.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {folders.map((f) => (
            <FolderMenu key={f.id} view={h.view} onAction={(a) => h.onFolderAction(f, a)}>
              <button
                type="button"
                onDoubleClick={() => h.view !== 'trash' && h.onOpenFolder(f.id)}
                onClick={() => h.view !== 'trash' && h.onOpenFolder(f.id)}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm font-medium hover:bg-muted/60"
              >
                <FolderIcon className="h-5 w-5" />
                <span className="truncate">{f.name}</span>
              </button>
            </FolderMenu>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {certs.map((c) => {
          const sel = h.isSelected(c.id);
          const acts = h.certActions(c);
          const expired = c.expiry_date && new Date(c.expiry_date) < new Date();
          return (
            <CertMenu key={c.id} view={h.view} starred={h.starredIds.has(c.id)} actions={acts}>
              <div
                role="button"
                tabIndex={0}
                aria-selected={sel}
                onClick={(e) => h.onSelect(c.id, e)}
                onDoubleClick={() => h.onOpenCert(c.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') h.onOpenCert(c.id);
                  if (e.key === ' ') {
                    e.preventDefault();
                    h.onSelect(c.id, e as unknown as MouseModifiers);
                  }
                }}
                className={cn(
                  'group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-colors',
                  sel ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-muted-foreground/30',
                )}
              >
                <div className="flex aspect-[4/3] items-center justify-center bg-muted/50">
                  <FileTypeIcon cert={c} className="h-10 w-10" />
                </div>
                <div className="flex items-start gap-1.5 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {c.issuer || (expired ? 'Expired' : formatDate(c.updated_at))}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 opacity-70 group-hover:opacity-100"
                        aria-label={`Actions for ${c.title}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <VaultActionsMenu
                        variant="dropdown"
                        view={h.view}
                        starred={h.starredIds.has(c.id)}
                        actions={acts}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {sel && (
                  <span className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                    <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3}>
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </div>
            </CertMenu>
          );
        })}
      </div>
    </div>
  );
}
