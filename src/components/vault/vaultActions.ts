/**
 * Certificate Vault — mutations. Every write is RLS-scoped to the owner.
 * `updated_at` is set explicitly on real edits (the DB has no touch trigger on
 * `certificates`, so `last_opened_at` bumps never pollute "Modified").
 * DB-observable activity (uploaded/renamed/moved/starred/trashed/…) is written
 * transactionally by a trigger — never fabricated client-side.
 */
import { supabase } from '@/integrations/supabase/client';
import { notifyProfileChanged } from '@/lib/profileNav';
import type { CertCategory, CertVisibility, VaultCertificate } from './types';

const now = () => new Date().toISOString();

export async function renameCertificate(id: string, title: string) {
  const clean = title.trim();
  if (!clean) throw new Error('Name cannot be empty');
  const { error } = await supabase
    .from('certificates')
    .update({ title: clean, updated_at: now() })
    .eq('id', id);
  if (error) throw error;
  notifyProfileChanged();
}

export interface MetadataPatch {
  title?: string;
  description?: string | null;
  issuer?: string | null;
  credential_name?: string | null;
  credential_id?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  category?: CertCategory | null;
  skills?: string[];
  tags?: string[];
  verification_url?: string | null;
  visibility?: CertVisibility;
}

export async function updateMetadata(id: string, patch: MetadataPatch) {
  const body: Record<string, unknown> = { updated_at: now() };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    body[k] = typeof v === 'string' && k !== 'title' ? (v.trim() || null) : v;
  }
  if (typeof body.title === 'string') body.title = (body.title as string).trim();
  if (body.title === '') throw new Error('Name cannot be empty');
  const { error } = await supabase.from('certificates').update(body).eq('id', id);
  if (error) throw error;
  notifyProfileChanged();
}

export async function setStarred(ids: string[], starred: boolean) {
  if (!ids.length) return;
  const { error } = await supabase
    .from('certificates')
    .update({ starred, updated_at: now() })
    .in('id', ids);
  if (error) throw error;
}

export async function moveCertificates(ids: string[], folderId: string | null) {
  if (!ids.length) return;
  const { error } = await supabase
    .from('certificates')
    .update({ folder_id: folderId, updated_at: now() })
    .in('id', ids);
  if (error) throw error;
  notifyProfileChanged();
}

export async function trashCertificates(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase
    .from('certificates')
    .update({ deleted_at: now(), updated_at: now() })
    .in('id', ids);
  if (error) throw error;
  notifyProfileChanged();
}

export async function restoreCertificates(ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase
    .from('certificates')
    .update({ deleted_at: null, updated_at: now() })
    .in('id', ids);
  if (error) throw error;
  notifyProfileChanged();
}

/**
 * Permanent delete. Storage object first, then the DB row — so we never end up
 * with a live row pointing at a deleted file, and a failure leaves the row
 * intact (recoverable) rather than silently orphaning storage.
 */
export async function permanentlyDelete(certs: Pick<VaultCertificate, 'id' | 'file_url'>[]) {
  if (!certs.length) return;
  const paths = certs.map((c) => c.file_url).filter(Boolean);
  if (paths.length) {
    const { error: storageErr } = await supabase.storage.from('certificates').remove(paths);
    // Not-found is fine (already gone); anything else aborts so the row stays.
    if (storageErr && !/not.?found/i.test(storageErr.message)) {
      throw new Error(`Could not delete the file: ${storageErr.message}`);
    }
  }
  const { error } = await supabase.from('certificates').delete().in(
    'id',
    certs.map((c) => c.id),
  );
  if (error) throw error;
  notifyProfileChanged();
}

/** Recent view + a 'downloaded' activity row (owner-only RPC). */
export async function touchOpened(id: string) {
  await supabase.rpc('cert_touch_opened', { _id: id });
}

// ---- folders ----------------------------------------------------------------

export async function createFolder(name: string, parentId: string | null): Promise<string> {
  const clean = name.trim();
  if (!clean) throw new Error('Folder name cannot be empty');
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');
  const { data, error } = await supabase
    .from('certificate_folders')
    .insert({ name: clean, parent_id: parentId, user_id: auth.user.id })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function renameFolder(id: string, name: string) {
  const clean = name.trim();
  if (!clean) throw new Error('Folder name cannot be empty');
  const { error } = await supabase.from('certificate_folders').update({ name: clean }).eq('id', id);
  if (error) throw error;
}

/** Re-parent a folder. The DB trigger rejects cycles (self / descendant). */
export async function moveFolder(id: string, parentId: string | null) {
  const { error } = await supabase
    .from('certificate_folders')
    .update({ parent_id: parentId })
    .eq('id', id);
  if (error) throw error;
}

export async function trashFolder(id: string) {
  const { error } = await supabase.rpc('cert_folder_set_deleted', { _folder: id, _deleted: true });
  if (error) throw error;
  notifyProfileChanged();
}

export async function restoreFolder(id: string) {
  const { error } = await supabase.rpc('cert_folder_set_deleted', { _folder: id, _deleted: false });
  if (error) throw error;
  notifyProfileChanged();
}
