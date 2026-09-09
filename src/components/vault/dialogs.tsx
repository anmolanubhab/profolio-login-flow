import { useEffect, useMemo, useState } from 'react';
import { FolderPlus, Home } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { FolderIcon } from './FileTypeIcon';
import { buildFolderTree, descendantIds, flattenTree } from './folderTree';
import type { VaultFolder } from './types';

// ── New folder ─────────────────────────────────────────────────────────────
export function NewFolderDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState('Untitled folder');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setName('Untitled folder');
  }, [open]);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onCreate(name.trim());
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Folder name"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Rename (certificate or folder) ─────────────────────────────────────────
export function RenameDialog({
  open,
  onOpenChange,
  label,
  initial,
  onRename,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  label: string;
  initial: string;
  onRename: (name: string) => Promise<void> | void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await onRename(name.trim());
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename {label}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="New name"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim()}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Move to folder ────────────────────────────────────────────────────────
export function MoveToFolderDialog({
  open,
  onOpenChange,
  folders,
  count,
  /** when moving a folder: its own id + descendants are disabled */
  movingFolderId,
  currentFolderId,
  onMove,
  onCreateFolder,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folders: VaultFolder[];
  count: number;
  movingFolderId?: string | null;
  currentFolderId: string | null;
  onMove: (folderId: string | null) => Promise<void> | void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<string>;
}) {
  const [target, setTarget] = useState<string | null>(currentFolderId ?? null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (open) {
      setTarget(currentFolderId ?? null);
      setCreating(false);
      setNewName('');
    }
  }, [open, currentFolderId]);

  const disabled = useMemo(
    () => (movingFolderId ? descendantIds(folders, movingFolderId) : new Set<string>()),
    [folders, movingFolderId],
  );
  const flat = useMemo(() => flattenTree(buildFolderTree(folders)), [folders]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onMove(target);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const doCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const id = await onCreateFolder(newName.trim(), target);
      setTarget(id);
      setCreating(false);
      setNewName('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move {count > 1 ? `${count} items` : 'item'}</DialogTitle>
          <DialogDescription>Choose a destination folder.</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[46vh] rounded-md border">
          <button
            type="button"
            onClick={() => setTarget(null)}
            className={cn(
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted',
              target === null && 'bg-primary/10 text-primary',
            )}
          >
            <Home className="h-4 w-4 shrink-0" /> My Certificates
          </button>
          {flat.map((f) => {
            const isDisabled = disabled.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                disabled={isDisabled}
                onClick={() => setTarget(f.id)}
                className={cn(
                  'flex w-full items-center gap-2 py-2 pr-3 text-left text-sm hover:bg-muted disabled:opacity-40',
                  target === f.id && 'bg-primary/10 text-primary',
                )}
                style={{ paddingLeft: 12 + f.depth * 16 }}
              >
                <FolderIcon className="h-4 w-4" />
                <span className="truncate">{f.name}</span>
              </button>
            );
          })}
        </ScrollArea>

        {creating ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doCreate()}
              placeholder="New folder name"
              aria-label="New folder name"
            />
            <Button size="sm" onClick={doCreate} disabled={!newName.trim() || busy}>
              Add
            </Button>
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="self-start" onClick={() => setCreating(true)} disabled={busy}>
            <FolderPlus className="mr-2 h-4 w-4" /> New folder here
          </Button>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Move here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Permanent-delete confirm ──────────────────────────────────────────────
export function TrashConfirmDialog({
  open,
  onOpenChange,
  count,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  count: number;
  onConfirm: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {count > 1 ? `${count} items` : 'this item'} forever?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the file and its record. It can&apos;t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void go();
            }}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? 'Deleting…' : 'Delete forever'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
