import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { secureUpload } from '@/lib/secure-upload';
import { notifyProfileChanged } from '@/lib/profileNav';
import { CERT_ACCEPT_MIME, MAX_FILE_BYTES } from './types';

export type UploadStatus = 'pending' | 'uploading' | 'done' | 'error' | 'canceled';

export interface UploadItem {
  id: string;
  file: File;
  status: UploadStatus;
  progress: number; // 0..100 (stepped: 10 -> 60 -> 100 — secureUpload is not streamable)
  error?: string;
  certId?: string;
}

let seq = 0;
const uid = () => `up-${Date.now()}-${seq++}`;
const baseName = (n: string) => n.replace(/\.[^./\\]+$/, '') || n;

function validate(file: File): string | null {
  const name = file.name.toLowerCase();
  const okExt = /\.(pdf|jpe?g|png|webp|gif|docx?)$/.test(name);
  const okMime = (CERT_ACCEPT_MIME as readonly string[]).includes(file.type) || (file.type === '' && okExt);
  if (!okMime && !okExt) return 'Unsupported file type. Use PDF, image or Word.';
  if (file.size > MAX_FILE_BYTES) return `File is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
  if (file.size === 0) return 'File is empty.';
  return null;
}

/**
 * Sequential upload queue with a live progress panel.
 *
 * `secureUpload` exposes no abort handle, so "Cancel" only stops items that
 * have not started yet; an in-flight PUT runs to completion but its DB row is
 * never inserted and the uploaded object is removed. Documented limitation.
 */
export function useVaultUpload(getFolderId: () => string | null, onComplete: () => void) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  const running = useRef(false);
  const canceled = useRef<Set<string>>(new Set());

  const commit = useCallback((updater: (prev: UploadItem[]) => UploadItem[]) => {
    itemsRef.current = updater(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  const patch = useCallback(
    (id: string, p: Partial<UploadItem>) =>
      commit((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it))),
    [commit],
  );

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;

      for (;;) {
        const it = itemsRef.current.find((x) => x.status === 'pending');
        if (!it) break;

        if (canceled.current.has(it.id)) {
          patch(it.id, { status: 'canceled' });
          continue;
        }
        if (!userId) {
          patch(it.id, { status: 'error', error: 'You are signed out.' });
          continue;
        }

        patch(it.id, { status: 'uploading', progress: 10, error: undefined });
        try {
          const res = await secureUpload({ bucket: 'certificates', file: it.file, userId });
          const path = res.filePath || res.url;
          if (!res.success || !path) throw new Error(res.error || 'Upload failed');

          if (canceled.current.has(it.id)) {
            await supabase.storage.from('certificates').remove([path]).catch(() => {});
            patch(it.id, { status: 'canceled' });
            continue;
          }
          patch(it.id, { progress: 60 });

          // Duplicate filename in this folder -> keep both, suffix the title.
          const folderId = getFolderId();
          let title = baseName(it.file.name);
          let dq = supabase
            .from('certificates')
            .select('title')
            .eq('user_id', userId)
            .is('deleted_at', null)
            .eq('file_name', it.file.name)
            .limit(50);
          dq = folderId ? dq.eq('folder_id', folderId) : dq.is('folder_id', null);
          const { data: dupes } = await dq;
          if (dupes && dupes.length > 0) {
            const taken = new Set((dupes as { title: string }[]).map((d) => d.title));
            let n = dupes.length + 1;
            while (taken.has(`${title} (${n})`)) n += 1;
            title = `${title} (${n})`;
          }

          const { data: row, error: dbErr } = await supabase
            .from('certificates')
            .insert({
              title,
              file_url: path,
              file_name: it.file.name,
              file_size: it.file.size,
              mime_type: it.file.type || null,
              folder_id: folderId,
              user_id: userId,
            })
            .select('id')
            .single();
          if (dbErr) {
            await supabase.storage.from('certificates').remove([path]).catch(() => {});
            throw dbErr;
          }
          patch(it.id, { status: 'done', progress: 100, certId: row.id });
        } catch (e) {
          patch(it.id, { status: 'error', error: e instanceof Error ? e.message : 'Upload failed' });
        }
      }
    } finally {
      running.current = false;
      notifyProfileChanged();
      onComplete();
    }
  }, [getFolderId, onComplete, patch]);

  const enqueue = useCallback(
    (files: File[] | FileList) => {
      const next: UploadItem[] = Array.from(files).map((file) => {
        const err = validate(file);
        return { id: uid(), file, status: err ? 'error' : 'pending', progress: 0, error: err ?? undefined };
      });
      commit((prev) => [...prev, ...next]);
      if (next.some((n) => n.status === 'pending')) void run();
    },
    [commit, run],
  );

  const retry = useCallback(
    (id: string) => {
      canceled.current.delete(id);
      patch(id, { status: 'pending', progress: 0, error: undefined });
      void run();
    },
    [patch, run],
  );

  const cancel = useCallback((id: string) => {
    canceled.current.add(id);
    commit((prev) => prev.map((it) => (it.id === id && it.status === 'pending' ? { ...it, status: 'canceled' } : it)));
  }, [commit]);

  const dismiss = useCallback(
    (id: string) => commit((prev) => prev.filter((it) => it.id !== id)),
    [commit],
  );

  const clearFinished = useCallback(
    () => commit((prev) => prev.filter((it) => it.status === 'uploading' || it.status === 'pending')),
    [commit],
  );

  const active = items.some((it) => it.status === 'uploading' || it.status === 'pending');

  return { items, enqueue, retry, cancel, dismiss, clearFinished, active };
}
