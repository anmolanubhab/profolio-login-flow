import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FileText,
  Plus,
  Copy,
  Trash2,
  Pencil,
  Download,
  FileUp,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { notifyProfileChanged } from '@/lib/profileNav';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  type ResumeDoc,
  type TemplateId,
  emptyResume,
  normalizeResume,
  isUploadRecord,
} from '@/lib/resume/schema';
import { downloadResumePdf } from '@/lib/resume/export';
import { importFromProfile } from './profileImport';
import { ResumeEditor } from './ResumeEditor';
import { TemplateGallery } from './TemplateGallery';
import { ExportDialog } from './ExportDialog';

interface ResumeRow {
  id: string;
  title: string;
  content: unknown;
  updated_at: string;
}

type View = 'list' | 'new-template' | 'editor';

const AUTOSAVE_MS = 1400;

export function ResumeWorkspace() {
  const { toast } = useToast();
  const [view, setView] = useState<View>('list');
  const [rows, setRows] = useState<ResumeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [doc, setDoc] = useState<ResumeDoc>(() => emptyResume());
  const [uploadOnly, setUploadOnly] = useState<ResumeRow | null>(null);

  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [importing, setImporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from('resumes')
        .select('id, title, content, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as ResumeRow[]);
    } catch (e) {
      toast({
        title: 'Could not load your resumes',
        description: e instanceof Error ? e.message : 'Please refresh.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  /* ---------------- editing ---------------- */

  const patch = useCallback((recipe: (d: ResumeDoc) => void) => {
    setDoc((prev) => {
      const next = structuredClone(prev);
      recipe(next);
      return next;
    });
    setDirty(true);
  }, []);

  const openNew = () => {
    setActiveId(null);
    setTitle('');
    setDoc(emptyResume());
    setUploadOnly(null);
    setDirty(false);
    setSavedAt(null);
    setView('new-template');
  };

  const pickTemplateForNew = (tpl: TemplateId) => {
    const d = emptyResume();
    d.design.template = tpl;
    setDoc(d);
    setDirty(true);
    setView('editor');
  };

  const openExisting = (row: ResumeRow) => {
    if (isUploadRecord(row.content)) {
      setUploadOnly(row);
      return;
    }
    setActiveId(row.id);
    setTitle(row.title || '');
    setDoc(normalizeResume(row.content, row.title));
    setUploadOnly(null);
    setDirty(false);
    setSavedAt(Date.parse(row.updated_at) || Date.now());
    setView('editor');
  };

  const persist = useCallback(
    async (opts?: { silent?: boolean }): Promise<string | null> => {
      const trimmed = title.trim();
      if (!trimmed) {
        if (!opts?.silent) {
          toast({
            title: 'Name your resume',
            description: 'Add a name at the top before saving.',
          });
        }
        return null;
      }
      setSaving(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not signed in');

        if (activeId) {
          const { error } = await supabase
            .from('resumes')
            .update({
              title: trimmed,
              content: doc as unknown as Record<string, unknown>,
              updated_at: new Date().toISOString(),
            })
            .eq('id', activeId);
          if (error) throw error;
          setSavedAt(Date.now());
          setDirty(false);
          void loadRows();
          notifyProfileChanged();
          return activeId;
        }

        const { data, error } = await supabase
          .from('resumes')
          .insert({
            title: trimmed,
            content: doc as unknown as Record<string, unknown>,
            user_id: user.id,
          })
          .select('id')
          .single();
        if (error) throw error;
        setActiveId(data.id);
        setSavedAt(Date.now());
        setDirty(false);
        void loadRows();
        notifyProfileChanged();
        return data.id;
      } catch (e) {
        toast({
          title: 'Save failed',
          description: e instanceof Error ? e.message : 'Please try again.',
          variant: 'destructive',
        });
        return null;
      } finally {
        setSaving(false);
      }
    },
    [activeId, doc, title, toast, loadRows],
  );

  // Debounced autosave once the resume has a name (and, for new ones, once
  // it has been saved at least once so we don't create duplicates on keypress).
  useEffect(() => {
    if (view !== 'editor' || !dirty) return;
    if (!title.trim()) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist({ silent: true });
    }, AUTOSAVE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [doc, title, dirty, view, persist]);

  const exitEditor = async () => {
    if (dirty && title.trim()) await persist({ silent: true });
    setView('list');
    setActiveId(null);
    void loadRows();
  };

  const doImportProfile = async () => {
    setImporting(true);
    try {
      const merged = await importFromProfile(doc);
      setDoc(merged);
      setDirty(true);
      toast({
        title: 'Pulled in your profile',
        description: 'Only empty fields were filled — review and edit as needed.',
      });
    } catch (e) {
      toast({
        title: 'Import failed',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  /* ---------------- list actions ---------------- */

  const duplicate = async (row: ResumeRow) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const base = isUploadRecord(row.content)
        ? row.content
        : (normalizeResume(row.content, row.title) as unknown);
      const { error } = await supabase.from('resumes').insert({
        title: `${row.title} (copy)`,
        content: base as Record<string, unknown>,
        user_id: user.id,
      });
      if (error) throw error;
      toast({ title: 'Duplicated' });
      void loadRows();
    } catch (e) {
      toast({
        title: 'Could not duplicate',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const remove = async () => {
    if (!deleteId) return;
    try {
      const { error } = await supabase.from('resumes').delete().eq('id', deleteId);
      if (error) throw error;
      toast({ title: 'Resume deleted' });
      setDeleteId(null);
      void loadRows();
      notifyProfileChanged();
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const quickPdf = (row: ResumeRow) => {
    if (isUploadRecord(row.content)) return;
    downloadResumePdf(normalizeResume(row.content, row.title), row.title || 'resume');
  };

  /* ---------------- render ---------------- */

  if (view === 'new-template') {
    return (
      <TemplateGallery
        current={null}
        onPick={pickTemplateForNew}
        onBack={() => setView('list')}
        heading="Pick a starting template"
      />
    );
  }

  if (view === 'editor') {
    return (
      <>
        <ResumeEditor
          title={title}
          onTitleChange={(t) => {
            setTitle(t);
            setDirty(true);
          }}
          doc={doc}
          patch={patch}
          saving={saving}
          savedAt={savedAt}
          dirty={dirty}
          onSave={() => void persist()}
          onExit={() => void exitEditor()}
          onExport={() => setExportOpen(true)}
          onImportProfile={() => void doImportProfile()}
          importing={importing}
        />
        <ExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          doc={doc}
          defaultName={title || 'My Resume'}
        />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Resumes</h2>
          <p className="text-sm text-muted-foreground">
            Build, style, and export as many versions as you need.
          </p>
        </div>
        <Button onClick={openNew} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New resume
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-medium">No resumes yet</p>
              <p className="text-sm text-muted-foreground">
                Start from a template and pull in your Profolio profile.
              </p>
            </div>
            <Button onClick={openNew} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Create your first resume
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const upload = isUploadRecord(row.content);
            return (
              <Card key={row.id} className="flex flex-col">
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {upload ? <FileUp className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{row.title || 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground">
                        {upload ? 'Uploaded file' : 'Editable'} ·{' '}
                        {new Date(row.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2">
                    {upload ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled
                        className="gap-1.5"
                        title="This is an uploaded file, not an editable resume"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openExisting(row)}
                        className="gap-1.5"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                    )}
                    {!upload && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => quickPdf(row)}
                        className="gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void duplicate(row)}
                      className="gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeleteId(row.id)}
                      className="gap-1.5 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* upload-only notice */}
      <AlertDialog open={!!uploadOnly} onOpenChange={(o) => !o && setUploadOnly(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This resume is an uploaded file</AlertDialogTitle>
            <AlertDialogDescription>
              “{uploadOnly?.title}” was added as a file, so there is nothing to edit
              in the builder. You can start a fresh editable resume instead — your
              uploaded file stays where it is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep file as-is</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setUploadOnly(null);
                openNew();
              }}
            >
              Start a new resume
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this resume?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void remove()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
