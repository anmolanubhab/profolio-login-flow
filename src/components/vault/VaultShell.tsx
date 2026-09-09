import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileText, FolderOpen, Loader2, Menu, Search, Trash2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { CERT_ACCEPT_ATTR, type SortDir, type SortField, type VaultCertificate, type VaultFolder, type VaultView } from './types';
import { useVaultData } from './useVaultData';
import { useVaultSelection } from './useVaultSelection';
import { useVaultUpload } from './useVaultUpload';
import { VaultNav } from './VaultNav';
import { VaultToolbar } from './VaultToolbar';
import { VaultBreadcrumbs } from './VaultBreadcrumbs';
import { VaultList, VaultGrid, type ItemHandlers } from './VaultItems';
import { UploadQueue } from './UploadQueue';
import { CertificatePreview } from './CertificatePreview';
import { downloadCertificate } from './download';
import { CertificateDetailsPanel } from './CertificateDetailsPanel';
import { MoveToFolderDialog, NewFolderDialog, RenameDialog, TrashConfirmDialog } from './dialogs';
import certVaultArt from '@/assets/empty-states/certificate-vault.svg';
import {
  createFolder,
  moveCertificates,
  moveFolder,
  permanentlyDelete,
  renameCertificate,
  renameFolder,
  restoreCertificates,
  restoreFolder,
  setStarred,
  touchOpened,
  trashCertificates,
  trashFolder,
} from './vaultActions';
import type { VaultActions } from './VaultActionsMenu';

const isView = (v: string | null): v is VaultView => v === 'all' || v === 'recent' || v === 'starred' || v === 'trash';

export function VaultShell() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const view: VaultView = isView(params.get('view')) ? (params.get('view') as VaultView) : 'all';
  const folderId = view === 'all' ? params.get('folder') : null;
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(
    () => (localStorage.getItem('vault:view') as 'list' | 'grid') || 'list',
  );
  const [sort, setSortField] = useState<SortField>('updated_at');
  const [dir, setDir] = useState<SortDir>('desc');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const data = useVaultData({ view, folderId, search, sort, dir });
  const orderedIds = useMemo(() => data.certs.map((c) => c.id), [data.certs]);
  const sel = useVaultSelection(orderedIds);

  const [detailCertId, setDetailCertId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ kind: 'cert' | 'folder'; id: string; name: string } | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ certIds: string[]; folderId?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ certs: VaultCertificate[] } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const folderIdRef = useRef(folderId);
  folderIdRef.current = folderId;
  const upload = useVaultUpload(() => folderIdRef.current, data.refetch);

  useEffect(() => localStorage.setItem('vault:view', viewMode), [viewMode]);
  useEffect(() => sel.clear(), [view, folderId, search]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setSearch('');
  }, [view]);

  const navigate = useCallback(
    (v: VaultView, fid: string | null) => {
      const next = new URLSearchParams(params);
      next.set('view', v);
      if (v === 'all' && fid) next.set('folder', fid);
      else next.delete('folder');
      setParams(next, { replace: false });
      setNavOpen(false);
    },
    [params, setParams],
  );

  const starredIds = useMemo(
    () => new Set(data.certs.filter((c) => c.starred).map((c) => c.id)),
    [data.certs],
  );
  const usageBytes = useMemo(
    () => data.certs.reduce((n, c) => n + (c.file_size ?? 0), 0),
    [data.certs],
  );

  // ── keyboard: Ctrl/Cmd+A, Escape ────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        sel.selectAll();
      } else if (e.key === 'Escape' && sel.count > 0) {
        sel.clear();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel]);

  // ── actions ─────────────────────────────────────────────────────────────
  const certById = useCallback((id: string) => data.certs.find((c) => c.id === id), [data.certs]);
  const folderById = useCallback(
    (id: string | null) => (id ? data.allFolders.find((f) => f.id === id) ?? null : null),
    [data.allFolders],
  );

  const openCert = useCallback(
    (id: string) => {
      const idx = data.certs.findIndex((c) => c.id === id);
      if (idx >= 0) setPreviewIndex(idx);
    },
    [data.certs],
  );

  const run = useCallback(
    async (fn: () => Promise<unknown>, ok: string) => {
      try {
        await fn();
        toast({ title: ok });
        data.refetch();
      } catch (e) {
        toast({
          title: 'Something went wrong',
          description: e instanceof Error ? e.message : undefined,
          variant: 'destructive',
        });
      }
    },
    [toast, data],
  );

  const certActions = useCallback(
    (cert: VaultCertificate): VaultActions => ({
      onOpen: () => openCert(cert.id),
      onDownload: () =>
        downloadCertificate(cert).catch(() =>
          toast({ title: 'Could not download', variant: 'destructive' }),
        ),
      onRename: () => setRenameTarget({ kind: 'cert', id: cert.id, name: cert.title }),
      onMove: () => setMoveTarget({ certIds: sel.count > 1 && sel.isSelected(cert.id) ? sel.ids : [cert.id] }),
      onToggleStar: () =>
        run(() => setStarred([cert.id], !cert.starred), cert.starred ? 'Removed from Starred' : 'Added to Starred'),
      onDetails: () => {
        setDetailCertId(cert.id);
        setDetailsOpen(true);
      },
      onTrash: () =>
        run(
          () => trashCertificates(sel.count > 1 && sel.isSelected(cert.id) ? sel.ids : [cert.id]),
          'Moved to Trash',
        ).then(() => sel.clear()),
      onRestore: () =>
        run(
          () => restoreCertificates(sel.count > 1 && sel.isSelected(cert.id) ? sel.ids : [cert.id]),
          'Restored',
        ).then(() => sel.clear()),
      onDeleteForever: () => {
        const list =
          sel.count > 1 && sel.isSelected(cert.id)
            ? (sel.ids.map(certById).filter(Boolean) as VaultCertificate[])
            : [cert];
        setDeleteTarget({ certs: list });
      },
    }),
    [openCert, sel, run, toast, certById],
  );

  const onFolderAction: ItemHandlers['onFolderAction'] = useCallback(
    (folder, action) => {
      if (action === 'rename') setRenameTarget({ kind: 'folder', id: folder.id, name: folder.name });
      if (action === 'move') setMoveTarget({ certIds: [], folderId: folder.id });
      if (action === 'trash') run(() => trashFolder(folder.id), 'Folder moved to Trash');
      if (action === 'restore') run(() => restoreFolder(folder.id), 'Folder restored');
      if (action === 'delete') {
        toast({
          title: 'Empty the folder first',
          description: 'Restore or permanently delete the certificates inside it, then it disappears from Trash.',
        });
      }
    },
    [run, toast],
  );

  const itemHandlers: ItemHandlers = {
    view,
    isSelected: sel.isSelected,
    onSelect: sel.handleClick,
    onOpenFolder: (id) => navigate('all', id),
    onOpenCert: (id) => {
      openCert(id);
      void touchOpened(id);
    },
    onFolderAction,
    certActions,
    starredIds,
  };

  // ── drag & drop ─────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (view === 'trash') return;
      if (e.dataTransfer.files?.length) upload.enqueue(e.dataTransfer.files);
    },
    [upload, view],
  );

  // ── selection-bar wiring ────────────────────────────────────────────────
  const selCerts = useMemo(
    () => sel.ids.map(certById).filter(Boolean) as VaultCertificate[],
    [sel.ids, certById],
  );
  const selAllStarred = selCerts.length > 0 && selCerts.every((c) => c.starred);

  // ── empty / loading ─────────────────────────────────────────────────────
  const nothing = !data.loading && data.certs.length === 0 && data.childFolders.length === 0;
  const emptyForView = () => {
    if (search) {
      return (
        <EmptyState
          icon={Search}
          title="No matches"
          description={`Nothing in your vault matches “${search}”.`}
          action={
            <Button variant="outline" size="sm" onClick={() => setSearch('')}>
              Clear search
            </Button>
          }
        />
      );
    }
    if (view === 'trash')
      return <EmptyState icon={Trash2} title="Trash is empty" description="Items you move to Trash appear here." />;
    if (view === 'starred')
      return (
        <EmptyState
          icon={FileText}
          title="No starred certificates"
          description="Star a certificate to find it quickly."
        />
      );
    if (view === 'recent')
      return <EmptyState icon={FileText} title="Nothing recent" description="Certificates you open appear here." />;
    if (folderId)
      return (
        <EmptyState
          icon={FolderOpen}
          title="This folder is empty"
          description="Upload a certificate here, or move existing ones into this folder."
          action={
            <Button size="sm" onClick={() => fileInput.current?.click()}>
              <UploadCloud className="mr-2 h-4 w-4" /> Upload
            </Button>
          }
        />
      );
    return (
      <EmptyState
        illustration={certVaultArt}
        title="No certificates yet"
        description="Upload your certificates and keep them organized in one place. You can also create folders and share them with others."
        action={
          <Button onClick={() => fileInput.current?.click()}>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload Certificate
          </Button>
        }
      />
    );
  };

  return (
    <div className="flex min-h-[70vh] w-full min-w-0 flex-col lg:flex-row">
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={CERT_ACCEPT_ATTR}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) upload.enqueue(e.target.files);
          e.target.value = '';
        }}
      />

      {/* Desktop nav rail */}
      <aside className="hidden w-60 shrink-0 border-r border-border lg:block">
        <VaultNav view={view} folderId={folderId} folders={data.allFolders} usageBytes={usageBytes} onNavigate={navigate} />
      </aside>

      {/* Mobile nav drawer */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <VaultNav view={view} folderId={folderId} folders={data.allFolders} usageBytes={usageBytes} onNavigate={navigate} />
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div
        className="flex min-w-0 flex-1 flex-col"
        onDragOver={(e) => {
          e.preventDefault();
          if (view !== 'trash') setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {/* mobile top row */}
        <div className="flex items-center gap-2 border-b border-border px-2 py-1.5 lg:hidden">
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Vault menu" onClick={() => setNavOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <span className="truncate text-sm font-semibold">Certificate Vault</span>
        </div>

        <VaultToolbar
          view={view}
          search={search}
          onSearch={setSearch}
          viewMode={viewMode}
          onViewMode={setViewMode}
          sort={sort}
          dir={dir}
          onSort={setSortField}
          onToggleDir={() => setDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          detailsOpen={detailsOpen}
          onToggleDetails={() => setDetailsOpen((o) => !o)}
          onNewFolder={() => setNewFolderOpen(true)}
          onUpload={() => fileInput.current?.click()}
          selectionCount={sel.count}
          onClearSelection={sel.clear}
          onDownloadSel={() =>
            selCerts.forEach((c, i) => setTimeout(() => downloadCertificate(c).catch(() => {}), i * 250))
          }
          onMoveSel={() => setMoveTarget({ certIds: sel.ids })}
          onStarSel={() => run(() => setStarred(sel.ids, !selAllStarred), 'Updated').then(sel.clear)}
          onTrashSel={() => run(() => trashCertificates(sel.ids), 'Moved to Trash').then(sel.clear)}
          onRestoreSel={() => run(() => restoreCertificates(sel.ids), 'Restored').then(sel.clear)}
          onDeleteForeverSel={() => setDeleteTarget({ certs: selCerts })}
          onDetailsSel={() => {
            setDetailCertId(sel.ids[0]);
            setDetailsOpen(true);
          }}
        />

        {view === 'all' && !search && (
          <VaultBreadcrumbs view={view} chain={data.breadcrumb} onNavigate={(fid) => navigate('all', fid)} />
        )}

        <div className="relative flex min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {data.error ? (
              <EmptyState
                icon={FileText}
                title="Couldn’t load your vault"
                description={data.error}
                action={
                  <Button variant="outline" size="sm" onClick={data.refetch}>
                    Try again
                  </Button>
                }
              />
            ) : data.loading ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-11 w-full" />
                ))}
              </div>
            ) : nothing ? (
              emptyForView()
            ) : viewMode === 'list' ? (
              <VaultList folders={data.childFolders} certs={data.certs} h={itemHandlers} />
            ) : (
              <VaultGrid folders={data.childFolders} certs={data.certs} h={itemHandlers} />
            )}

            {data.hasMore && !data.loading && (
              <div className="flex justify-center py-4">
                <Button variant="outline" size="sm" onClick={data.loadMore} disabled={data.loadingMore}>
                  {data.loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load more'}
                </Button>
              </div>
            )}
          </div>

          {/* Desktop details drawer */}
          {detailsOpen && detailCertId && certById(detailCertId) && (
            <aside className="hidden w-[22rem] shrink-0 border-l border-border lg:block">
              <CertificateDetailsPanel
                cert={certById(detailCertId)!}
                folder={folderById(certById(detailCertId)!.folder_id)}
                onClose={() => setDetailsOpen(false)}
                onSaved={data.refetch}
              />
            </aside>
          )}
        </div>

        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-30 m-2 flex items-center justify-center rounded-xl border-2 border-dashed border-primary bg-primary/5 text-sm font-medium text-primary">
            Drop files to upload
          </div>
        )}
      </div>

      {/* Mobile details as a bottom sheet */}
      <Sheet
        open={detailsOpen && !!detailCertId && window.matchMedia('(max-width: 1023px)').matches}
        onOpenChange={(o) => setDetailsOpen(o)}
      >
        <SheetContent side="bottom" className="h-[85dvh] p-0">
          {detailCertId && certById(detailCertId) && (
            <CertificateDetailsPanel
              cert={certById(detailCertId)!}
              folder={folderById(certById(detailCertId)!.folder_id)}
              onClose={() => setDetailsOpen(false)}
              onSaved={data.refetch}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Mobile FAB */}
      {view !== 'trash' && (
        <button
          type="button"
          aria-label="Upload"
          onClick={() => fileInput.current?.click()}
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg lg:hidden"
        >
          <UploadCloud className="h-6 w-6" />
        </button>
      )}

      <UploadQueue
        items={upload.items}
        onRetry={upload.retry}
        onCancel={upload.cancel}
        onDismiss={upload.dismiss}
        onClearFinished={upload.clearFinished}
      />

      {/* Preview */}
      {previewIndex !== null && data.certs[previewIndex] && (
        <CertificatePreview
          certs={data.certs}
          index={previewIndex}
          onIndexChange={setPreviewIndex}
          onClose={() => setPreviewIndex(null)}
          onDownload={(c) => downloadCertificate(c).catch(() => toast({ title: 'Could not download', variant: 'destructive' }))}
          onOpenDetails={(c) => {
            setDetailCertId(c.id);
            setDetailsOpen(true);
            setPreviewIndex(null);
          }}
        />
      )}

      {/* Dialogs */}
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        onCreate={(name) => run(() => createFolder(name, folderId), 'Folder created')}
      />
      {renameTarget && (
        <RenameDialog
          open
          onOpenChange={(o) => !o && setRenameTarget(null)}
          label={renameTarget.kind === 'folder' ? 'folder' : 'certificate'}
          initial={renameTarget.name}
          onRename={(name) =>
            run(
              () =>
                renameTarget.kind === 'folder'
                  ? renameFolder(renameTarget.id, name)
                  : renameCertificate(renameTarget.id, name),
              'Renamed',
            ).then(() => setRenameTarget(null))
          }
        />
      )}
      {moveTarget && (
        <MoveToFolderDialog
          open
          onOpenChange={(o) => !o && setMoveTarget(null)}
          folders={data.allFolders}
          count={moveTarget.folderId ? 1 : moveTarget.certIds.length}
          movingFolderId={moveTarget.folderId ?? null}
          currentFolderId={folderId}
          onMove={(dest) =>
            run(
              () =>
                moveTarget.folderId
                  ? moveFolder(moveTarget.folderId, dest)
                  : moveCertificates(moveTarget.certIds, dest),
              'Moved',
            ).then(() => {
              setMoveTarget(null);
              sel.clear();
            })
          }
          onCreateFolder={createFolder}
        />
      )}
      {deleteTarget && (
        <TrashConfirmDialog
          open
          onOpenChange={(o) => !o && setDeleteTarget(null)}
          count={deleteTarget.certs.length}
          onConfirm={() =>
            run(() => permanentlyDelete(deleteTarget.certs), 'Deleted permanently').then(() => {
              setDeleteTarget(null);
              sel.clear();
            })
          }
        />
      )}
    </div>
  );
}
