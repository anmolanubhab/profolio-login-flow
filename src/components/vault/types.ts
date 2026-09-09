/**
 * Certificate Vault — Google Drive-style document manager.
 * Shared types + constants. The DB model lives in
 * supabase/migrations/20260910000000_certificate_vault_drive.sql.
 */

export type VaultView = 'all' | 'recent' | 'starred' | 'trash';

export type CertCategory =
  | 'course'
  | 'license'
  | 'certification'
  | 'award'
  | 'education'
  | 'identity'
  | 'membership'
  | 'other';

export type CertVisibility = 'private' | 'connections' | 'public';

export interface VaultFolder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VaultCertificate {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  file_url: string; // storage path inside the private `certificates` bucket
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  folder_id: string | null;
  issuer: string | null;
  credential_name: string | null;
  credential_id: string | null;
  issue_date: string | null; // 'YYYY-MM-DD'
  expiry_date: string | null;
  category: CertCategory | null;
  skills: string[];
  tags: string[];
  verification_url: string | null;
  verified_status: 'unverified' | 'self_attested' | 'link_provided';
  visibility: CertVisibility;
  starred: boolean;
  thumb_path: string | null;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CertActivity {
  id: string;
  certificate_id: string;
  user_id: string;
  action:
    | 'uploaded'
    | 'renamed'
    | 'moved'
    | 'starred'
    | 'unstarred'
    | 'metadata_updated'
    | 'downloaded'
    | 'trashed'
    | 'restored';
  detail: Record<string, unknown> | null;
  created_at: string;
}

export type SortField = 'title' | 'updated_at' | 'file_size' | 'issue_date' | 'expiry_date';
export type SortDir = 'asc' | 'desc';

export interface VaultQueryState {
  view: VaultView;
  folderId: string | null; // only meaningful for view === 'all'
  search: string;
  sort: SortField;
  dir: SortDir;
  page: number; // 0-based
}

export const PAGE_SIZE = 40;

/** Accepted upload MIME types (mirrors ALLOWED_CERTIFICATE_TYPES in secure-upload.ts). */
export const CERT_ACCEPT_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const CERT_ACCEPT_ATTR = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.doc,.docx';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB — unchanged from the original vault

export const CATEGORY_LABELS: Record<CertCategory, string> = {
  course: 'Course',
  license: 'License',
  certification: 'Certification',
  award: 'Award',
  education: 'Education',
  identity: 'Identity document',
  membership: 'Membership',
  other: 'Other',
};

export const VISIBILITY_LABELS: Record<CertVisibility, string> = {
  private: 'Private — only you',
  connections: 'Connections',
  public: 'Anyone with the link',
};

/** Coarse file-kind for icon/preview routing. */
export function fileKind(c: Pick<VaultCertificate, 'mime_type' | 'file_name'>): 'pdf' | 'image' | 'doc' | 'other' {
  const mt = (c.mime_type || '').toLowerCase();
  const name = (c.file_name || '').toLowerCase();
  if (mt === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mt.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/.test(name)) return 'image';
  if (/word|msword|officedocument/.test(mt) || /\.(docx?)$/.test(name)) return 'doc';
  return 'other';
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
