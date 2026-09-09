import { signedUrl } from './vaultApi';
import { touchOpened } from './vaultActions';
import type { VaultCertificate } from './types';

/** Fetch a short-lived signed URL, trigger a browser download and record the activity. */
export async function downloadCertificate(cert: VaultCertificate) {
  const u = await signedUrl(cert.file_url, 120);
  const a = document.createElement('a');
  a.href = u;
  a.download = cert.file_name || cert.title;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  void touchOpened(cert.id);
}
