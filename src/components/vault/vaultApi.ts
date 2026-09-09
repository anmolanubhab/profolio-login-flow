/**
 * Certificate Vault — server-side data access.
 *
 * All reads are RLS-scoped to the owner (certificates SELECT is strictly
 * `auth.uid() = user_id`). Search + paging happen in Postgres, never by pulling
 * every row into the browser.
 */
import { supabase } from '@/integrations/supabase/client';
import {
  PAGE_SIZE,
  type CertActivity,
  type VaultCertificate,
  type VaultFolder,
  type VaultQueryState,
} from './types';

const CERT_COLUMNS =
  'id,user_id,title,description,file_url,file_name,file_size,mime_type,folder_id,issuer,credential_name,credential_id,issue_date,expiry_date,category,skills,tags,verification_url,verified_status,visibility,starred,thumb_path,last_opened_at,created_at,updated_at,deleted_at';

export interface CertPage {
  rows: VaultCertificate[];
  total: number;
}

/** One page of certificates for the current view / folder / search / sort. */
export async function fetchCertificates(q: VaultQueryState): Promise<CertPage> {
  let query = supabase
    .from('certificates')
    .select(CERT_COLUMNS, { count: 'exact' });

  if (q.view === 'trash') {
    query = query.not('deleted_at', 'is', null);
  } else {
    query = query.is('deleted_at', null);
    if (q.view === 'starred') query = query.eq('starred', true);
    if (q.view === 'all' && !q.search) {
      // folder scoping only applies to the browsable "All" tree with no search
      query = q.folderId ? query.eq('folder_id', q.folderId) : query.is('folder_id', null);
    }
  }

  const term = q.search.trim();
  if (term) {
    const like = `%${term.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    query = query.or(
      [
        `title.ilike.${like}`,
        `issuer.ilike.${like}`,
        `credential_name.ilike.${like}`,
        `credential_id.ilike.${like}`,
        `description.ilike.${like}`,
        `file_name.ilike.${like}`,
        `category.ilike.${like}`,
      ].join(','),
    );
  }

  if (q.view === 'recent') {
    // "Recent" is a fixed sort by last touch; ignore the column sort.
    query = query
      .order('last_opened_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false });
  } else {
    query = query.order(q.sort, { ascending: q.dir === 'asc', nullsFirst: false });
    if (q.sort !== 'title') query = query.order('title', { ascending: true });
  }

  const from = q.page * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: (data ?? []) as VaultCertificate[], total: count ?? 0 };
}

/** Immediate child folders of `parentId` (root when null). Only for the "All" view without a search. */
export async function fetchChildFolders(parentId: string | null): Promise<VaultFolder[]> {
  let query = supabase
    .from('certificate_folders')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true });
  query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as VaultFolder[];
}

/** Trashed folders (top-level of the trash — those whose parent is not itself trashed / is null). */
export async function fetchTrashedFolders(): Promise<VaultFolder[]> {
  const { data, error } = await supabase
    .from('certificate_folders')
    .select('*')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });
  if (error) throw error;
  const all = (data ?? []) as VaultFolder[];
  const trashedIds = new Set(all.map((f) => f.id));
  // show only the roots of each trashed subtree
  return all.filter((f) => !f.parent_id || !trashedIds.has(f.parent_id));
}

/** Every live folder (for the nav tree + move picker). Small dataset per user. */
export async function fetchAllFolders(): Promise<VaultFolder[]> {
  const { data, error } = await supabase
    .from('certificate_folders')
    .select('*')
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as VaultFolder[];
}

/** Breadcrumb chain root→folderId, derived from the flat folder list (no extra query). */
export function buildBreadcrumb(folders: VaultFolder[], folderId: string | null): VaultFolder[] {
  if (!folderId) return [];
  const byId = new Map(folders.map((f) => [f.id, f]));
  const chain: VaultFolder[] = [];
  let cur = byId.get(folderId);
  let guard = 0;
  while (cur && guard++ < 50) {
    chain.unshift(cur);
    cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
  }
  return chain;
}

export async function fetchActivity(certificateId: string): Promise<CertActivity[]> {
  const { data, error } = await supabase
    .from('certificate_activity')
    .select('*')
    .eq('certificate_id', certificateId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as CertActivity[];
}

/** Short-lived signed URL for previewing / downloading a private file. */
export async function signedUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from('certificates')
    .createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not generate file link');
  return data.signedUrl;
}
