import { supabase } from '@/integrations/supabase/client';

/**
 * Uploads a message attachment to the private `message-attachments` bucket with
 * real progress + cancellation.
 *
 * `supabase-js` `storage.upload()` is fetch-based and exposes no progress
 * events, so this issues the raw Storage REST call over `XMLHttpRequest`
 * instead. It sends only the signed-in user's access token (never a
 * service-role key) -- the bucket's INSERT policy authorises the write from
 * that JWT + the object path, exactly as `secureUpload()` relies on today.
 *
 * Path convention matches `secureUpload()`:
 *   {conversationId}/{userId}/{timestamp}-{rand}.{ext}
 * which satisfies the Storage policy "Conversation participants can upload
 * message attachments" (depth >= 3, folder[0] = conversation the user is in,
 * folder[1] = the uploader's uid).
 */

export type MessageAttachmentKind = 'image';

interface KindRules {
  mimeTypes: string[];
  maxBytes: number;
  label: string;
}

// 3a only handles images. 3b/3c add 'video' / 'audio' entries here.
const RULES: Record<MessageAttachmentKind, KindRules> = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    maxBytes: 5 * 1024 * 1024,
    label: 'image',
  },
};

export class UploadAbortError extends Error {
  constructor() {
    super('Upload cancelled');
    this.name = 'UploadAbortError';
  }
}

export interface UploadMessageAttachmentArgs {
  conversationId: string;
  userId: string;
  file: File;
  kind: MessageAttachmentKind;
  /** 0..1 */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

export interface UploadedAttachment {
  /** Storage object path -- store this in `messages.file_url`. */
  path: string;
}

function extensionOf(name: string): string {
  const ext = name.split('.').pop();
  return ext && ext.length <= 5 ? ext.toLowerCase() : 'bin';
}

/** Human-readable validation error, or null if the file is acceptable. */
export function validateMessageAttachment(file: File, kind: MessageAttachmentKind): string | null {
  const rules = RULES[kind];
  if (!rules.mimeTypes.includes(file.type)) {
    return `That ${rules.label} format isn't supported. Use ${rules.mimeTypes
      .map((m) => m.split('/')[1].toUpperCase())
      .join(', ')}.`;
  }
  if (file.size > rules.maxBytes) {
    return `${rules.label[0].toUpperCase()}${rules.label.slice(1)} is too large (max ${(
      rules.maxBytes /
      (1024 * 1024)
    ).toFixed(0)} MB).`;
  }
  return null;
}

export async function uploadMessageAttachment({
  conversationId,
  userId,
  file,
  kind,
  onProgress,
  signal,
}: UploadMessageAttachmentArgs): Promise<UploadedAttachment> {
  const validationError = validateMessageAttachment(file, kind);
  if (validationError) throw new Error(validationError);

  if (signal?.aborted) throw new UploadAbortError();

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Your session expired. Sign in again to send attachments.');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const path = `${conversationId}/${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 12)}.${extensionOf(file.name)}`;

  const endpoint = `${supabaseUrl}/storage/v1/object/message-attachments/${path}`;

  return new Promise<UploadedAttachment>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', apikey);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=3600');
    if (file.type) xhr.setRequestHeader('content-type', file.type);

    const onAbort = () => xhr.abort();
    signal?.addEventListener('abort', onAbort);
    const cleanup = () => signal?.removeEventListener('abort', onAbort);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };

    xhr.onload = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve({ path });
      } else {
        let message = `Upload failed (${xhr.status}).`;
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
          message = body.message || body.error || message;
        } catch {
          /* keep the generic message */
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => {
      cleanup();
      reject(new Error('Network error during upload. Check your connection and retry.'));
    };

    xhr.onabort = () => {
      cleanup();
      reject(new UploadAbortError());
    };

    xhr.send(file);
  });
}
