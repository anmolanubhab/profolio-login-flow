import { useCallback, useEffect, useMemo, useState } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Loader2,
  Minus,
  Plus,
  RotateCw,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLockFullscreenOverlay } from '@/hooks/useFullscreenOverlay';
import { signedUrl } from './vaultApi';
import { fileKind, type VaultCertificate } from './types';

interface Props {
  certs: VaultCertificate[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onDownload: (cert: VaultCertificate) => void;
  onOpenDetails: (cert: VaultCertificate) => void;
}

/**
 * Full-screen document preview — Google Drive's overlay pattern, native to
 * Profolio. Built on the Radix Dialog primitive (focus trap, body-scroll lock,
 * ESC) + `useLockFullscreenOverlay` (hides the mobile bottom nav). Controls sit
 * inside `env(safe-area-inset-*)`.
 *
 *  - PDF  -> native browser viewer via <iframe> (page nav, zoom, print come free)
 *  - image -> fit / zoom (+/−, wheel, double-click toggles fit⇄100%) + rotate
 *  - ‹ › / ArrowLeft / ArrowRight move through the current list
 */
export function CertificatePreview({
  certs,
  index,
  onIndexChange,
  onClose,
  onDownload,
  onOpenDetails,
}: Props) {
  useLockFullscreenOverlay(true);
  const cert = certs[index];
  const kind = cert ? fileKind(cert) : 'other';

  const [url, setUrl] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [rot, setRot] = useState(0);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    setLoadErr(null);
    setZoom(1);
    setFit(true);
    setRot(0);
    if (!cert) return;
    signedUrl(cert.file_url, 3600)
      .then((u) => {
        if (alive) setUrl(u);
      })
      .catch(() => alive && setLoadErr('This file could not be loaded.'));
    // Recent view + a 'downloaded' activity row are only written on explicit
    // download; opening the preview just fetches a signed URL.
    return () => {
      alive = false;
    };
  }, [cert]);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < certs.length) onIndexChange(next);
    },
    [index, certs.length, onIndexChange],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if ((e.key === '+' || e.key === '=') && kind === 'image') {
        setFit(false);
        setZoom((z) => Math.min(5, z + 0.25));
      } else if (e.key === '-' && kind === 'image') {
        setFit(false);
        setZoom((z) => Math.max(0.25, z - 0.25));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, kind]);

  const handleOpenChange = useCallback((o: boolean) => !o && onClose(), [onClose]);

  const imgStyle = useMemo(
    () => ({
      transform: `rotate(${rot}deg) scale(${fit ? 1 : zoom})`,
      transition: 'transform 120ms ease',
      cursor: fit ? 'zoom-in' : 'zoom-out',
    }),
    [rot, fit, zoom],
  );

  if (!cert) return null;

  return (
    <DialogPrimitive.Root open onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/95 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-label={`Preview: ${cert.title}`}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed inset-0 z-[100] flex flex-col text-white outline-none"
        >
          {/* top bar */}
          <div className="flex items-center gap-2 px-3 pt-[max(0.6rem,env(safe-area-inset-top))]">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{cert.title}</span>
            {kind === 'image' && (
              <>
                <button
                  type="button"
                  aria-label="Zoom out"
                  className="rounded-full p-2 hover:bg-white/10"
                  onClick={() => {
                    setFit(false);
                    setZoom((z) => Math.max(0.25, z - 0.25));
                  }}
                >
                  <Minus className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Zoom in"
                  className="rounded-full p-2 hover:bg-white/10"
                  onClick={() => {
                    setFit(false);
                    setZoom((z) => Math.min(5, z + 0.25));
                  }}
                >
                  <Plus className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Rotate"
                  className="rounded-full p-2 hover:bg-white/10"
                  onClick={() => setRot((r) => (r + 90) % 360)}
                >
                  <RotateCw className="h-5 w-5" />
                </button>
              </>
            )}
            <button
              type="button"
              aria-label="Certificate details"
              className="rounded-full p-2 hover:bg-white/10"
              onClick={() => onOpenDetails(cert)}
            >
              <Info className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Download"
              className="rounded-full p-2 hover:bg-white/10"
              onClick={() => onDownload(cert)}
            >
              <Download className="h-5 w-5" />
            </button>
            <DialogPrimitive.Close
              aria-label="Close preview"
              className="rounded-full p-2 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <X className="h-6 w-6" />
            </DialogPrimitive.Close>
          </div>

          {/* body */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-2 sm:p-6">
            {!url && !loadErr && <Loader2 className="h-8 w-8 animate-spin text-white/70" />}
            {loadErr && (
              <div className="text-center text-sm text-white/80">
                {loadErr}
                <div className="mt-3">
                  <button
                    className="rounded-full bg-white/10 px-4 py-2 hover:bg-white/20"
                    onClick={() => onDownload(cert)}
                  >
                    Download instead
                  </button>
                </div>
              </div>
            )}
            {url && kind === 'pdf' && (
              <iframe
                title={cert.title}
                src={`${url}#toolbar=1&navpanes=0`}
                className="h-full w-full rounded bg-white"
              />
            )}
            {url && kind === 'image' && (
              <img
                src={url}
                alt={cert.title}
                draggable={false}
                onDoubleClick={() => {
                  setFit((f) => !f);
                  setZoom(1);
                }}
                style={imgStyle}
                className="max-h-full max-w-full select-none object-contain"
              />
            )}
            {url && (kind === 'doc' || kind === 'other') && (
              <div className="text-center text-sm text-white/80">
                Preview isn&apos;t available for this file type.
                <div className="mt-3">
                  <button
                    className="rounded-full bg-white/10 px-4 py-2 hover:bg-white/20"
                    onClick={() => onDownload(cert)}
                  >
                    Download to view
                  </button>
                </div>
              </div>
            )}

            {certs.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={() => go(-1)}
                  disabled={index === 0}
                  className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 disabled:pointer-events-none disabled:opacity-0 sm:block"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={() => go(1)}
                  disabled={index === certs.length - 1}
                  className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 hover:bg-white/20 disabled:pointer-events-none disabled:opacity-0 sm:block"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          {/* footer: position + mobile nav */}
          <div className="flex items-center justify-center gap-6 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 text-xs text-white/70">
            {certs.length > 1 && (
              <button
                type="button"
                aria-label="Previous"
                onClick={() => go(-1)}
                disabled={index === 0}
                className="rounded-full p-2 hover:bg-white/10 disabled:opacity-30 sm:hidden"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <span className="tabular-nums">
              {index + 1} / {certs.length}
            </span>
            {certs.length > 1 && (
              <button
                type="button"
                aria-label="Next"
                onClick={() => go(1)}
                disabled={index === certs.length - 1}
                className="rounded-full p-2 hover:bg-white/10 disabled:opacity-30 sm:hidden"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
