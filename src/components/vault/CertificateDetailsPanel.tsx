import { useEffect, useMemo, useState } from 'react';
import {
  Activity as ActivityIcon,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FolderInput,
  Loader2,
  Star,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { FileTypeIcon } from './FileTypeIcon';
import { fetchActivity } from './vaultApi';
import { updateMetadata, type MetadataPatch } from './vaultActions';
import {
  CATEGORY_LABELS,
  formatBytes,
  formatDate,
  type CertActivity,
  type CertCategory,
  type VaultCertificate,
  type VaultFolder,
} from './types';

const ACTIVITY_META: Record<CertActivity['action'], { Icon: typeof Upload; label: string }> = {
  uploaded: { Icon: Upload, label: 'Uploaded' },
  renamed: { Icon: ExternalLink, label: 'Renamed' },
  moved: { Icon: FolderInput, label: 'Moved to another folder' },
  starred: { Icon: Star, label: 'Added to Starred' },
  unstarred: { Icon: Star, label: 'Removed from Starred' },
  metadata_updated: { Icon: CheckCircle2, label: 'Details updated' },
  downloaded: { Icon: Download, label: 'Downloaded' },
  trashed: { Icon: X, label: 'Moved to Trash' },
  restored: { Icon: ActivityIcon, label: 'Restored from Trash' },
};

function ChipInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim().replace(/,$/, '');
    if (t && !values.includes(t)) onChange([...values, t]);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap gap-1.5 rounded-md border border-input bg-background p-2 focus-within:ring-1 focus-within:ring-ring">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
        >
          {v}
          <button
            type="button"
            aria-label={`Remove ${v}`}
            onClick={() => onChange(values.filter((x) => x !== v))}
            className="rounded-full hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          } else if (e.key === 'Backspace' && !draft && values.length) {
            onChange(values.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={values.length ? '' : placeholder}
        className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none"
        aria-label={placeholder}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

interface Props {
  cert: VaultCertificate;
  folder: VaultFolder | null;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Google Drive's Details drawer, adapted for credentials: an editable metadata
 * form (Details tab) + a real, backend-sourced Activity tab.
 */
export function CertificateDetailsPanel({ cert, folder, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<MetadataPatch>({});
  const [saving, setSaving] = useState(false);
  const [acts, setActs] = useState<CertActivity[] | null>(null);
  const [tab, setTab] = useState('details');

  useEffect(() => {
    setForm({
      title: cert.title,
      issuer: cert.issuer ?? '',
      credential_name: cert.credential_name ?? '',
      credential_id: cert.credential_id ?? '',
      issue_date: cert.issue_date ?? '',
      expiry_date: cert.expiry_date ?? '',
      category: cert.category ?? undefined,
      skills: cert.skills ?? [],
      tags: cert.tags ?? [],
      verification_url: cert.verification_url ?? '',
      description: cert.description ?? '',
    });
    setActs(null);
  }, [cert]);

  useEffect(() => {
    if (tab === 'activity' && acts === null) {
      fetchActivity(cert.id)
        .then(setActs)
        .catch(() => setActs([]));
    }
  }, [tab, acts, cert.id]);

  const dirty = useMemo(() => {
    const norm = (v: unknown) => (v == null || v === '' ? null : v);
    return (
      norm(form.title) !== norm(cert.title) ||
      norm(form.issuer) !== norm(cert.issuer) ||
      norm(form.credential_name) !== norm(cert.credential_name) ||
      norm(form.credential_id) !== norm(cert.credential_id) ||
      norm(form.issue_date) !== norm(cert.issue_date) ||
      norm(form.expiry_date) !== norm(cert.expiry_date) ||
      (form.category ?? null) !== (cert.category ?? null) ||
      JSON.stringify(form.skills ?? []) !== JSON.stringify(cert.skills ?? []) ||
      JSON.stringify(form.tags ?? []) !== JSON.stringify(cert.tags ?? []) ||
      norm(form.verification_url) !== norm(cert.verification_url) ||
      norm(form.description) !== norm(cert.description)
    );
  }, [form, cert]);

  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await updateMetadata(cert.id, form);
      toast({ title: 'Certificate updated' });
      onSaved();
    } catch (e) {
      toast({
        title: 'Could not save',
        description: e instanceof Error ? e.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const expired = cert.expiry_date && new Date(cert.expiry_date) < new Date();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <FileTypeIcon cert={cert} className="h-5 w-5" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{cert.title}</span>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Close details" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
        <TabsList className="mx-4 mt-3 grid w-auto grid-cols-2">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <div className="space-y-3">
            <Field label="Name">
              <Input
                value={form.title ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Issuing organization">
                <Input
                  value={form.issuer ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, issuer: e.target.value }))}
                  placeholder="e.g. Google"
                />
              </Field>
              <Field label="Category">
                <Select
                  value={form.category ?? ''}
                  onValueChange={(v) => setForm((f) => ({ ...f, category: (v || undefined) as CertCategory }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_LABELS) as CertCategory[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {CATEGORY_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Credential name">
                <Input
                  value={form.credential_name ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, credential_name: e.target.value }))}
                />
              </Field>
              <Field label="Credential ID">
                <Input
                  value={form.credential_id ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, credential_id: e.target.value }))}
                />
              </Field>
              <Field label="Issue date">
                <Input
                  type="date"
                  value={form.issue_date ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
                />
              </Field>
              <Field label="Expiry date">
                <Input
                  type="date"
                  value={form.expiry_date ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="Skills">
              <ChipInput
                values={form.skills ?? []}
                onChange={(v) => setForm((f) => ({ ...f, skills: v }))}
                placeholder="Add a skill and press Enter"
              />
            </Field>
            <Field label="Tags">
              <ChipInput
                values={form.tags ?? []}
                onChange={(v) => setForm((f) => ({ ...f, tags: v }))}
                placeholder="Add a tag and press Enter"
              />
            </Field>
            <Field label="Verification URL">
              <Input
                type="url"
                value={form.verification_url ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, verification_url: e.target.value }))}
                placeholder="https://…"
              />
            </Field>
            <Field label="Description">
              <Textarea
                rows={3}
                value={form.description ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>

            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div className="mb-1 text-xs font-medium text-muted-foreground">File</div>
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                <dt className="text-muted-foreground">Type</dt>
                <dd className="truncate">{cert.mime_type || cert.file_name.split('.').pop()?.toUpperCase() || '—'}</dd>
                <dt className="text-muted-foreground">Size</dt>
                <dd>{formatBytes(cert.file_size)}</dd>
                <dt className="text-muted-foreground">Location</dt>
                <dd className="truncate">{folder ? folder.name : 'My Certificates'}</dd>
                <dt className="text-muted-foreground">Created</dt>
                <dd>{formatDate(cert.created_at)}</dd>
                <dt className="text-muted-foreground">Modified</dt>
                <dd>{formatDate(cert.updated_at)}</dd>
                <dt className="text-muted-foreground">Visibility</dt>
                <dd className="capitalize">{cert.visibility}</dd>
              </dl>
              {expired ? (
                <Badge variant="outline" className="mt-2 border-destructive/40 text-destructive">
                  Expired {formatDate(cert.expiry_date)}
                </Badge>
              ) : cert.expiry_date ? (
                <Badge variant="outline" className="mt-2">
                  Expires {formatDate(cert.expiry_date)}
                </Badge>
              ) : null}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {acts === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : acts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ol className="space-y-3">
              {acts.map((a) => {
                const meta = ACTIVITY_META[a.action];
                const Icon = meta?.Icon ?? Clock;
                return (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div>{meta?.label ?? a.action}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString()}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </TabsContent>
      </Tabs>

      <div
        className={cn(
          'flex items-center justify-end gap-2 border-t border-border px-4 py-3 transition-opacity',
          !dirty && 'pointer-events-none opacity-0',
        )}
      >
        <span className="mr-auto text-xs text-muted-foreground">Unsaved changes</span>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
