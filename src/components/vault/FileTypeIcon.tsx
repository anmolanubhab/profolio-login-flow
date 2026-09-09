import { FileText, FileImage, File as FileIcon, FileType, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fileKind, type VaultCertificate } from './types';

const KIND_STYLE: Record<string, { Icon: typeof FileText; className: string }> = {
  pdf: { Icon: FileText, className: 'text-red-600 dark:text-red-400' },
  image: { Icon: FileImage, className: 'text-emerald-600 dark:text-emerald-400' },
  doc: { Icon: FileType, className: 'text-blue-600 dark:text-blue-400' },
  other: { Icon: FileIcon, className: 'text-muted-foreground' },
};

export function FileTypeIcon({
  cert,
  className,
}: {
  cert: Pick<VaultCertificate, 'mime_type' | 'file_name'>;
  className?: string;
}) {
  const { Icon, className: colour } = KIND_STYLE[fileKind(cert)];
  return <Icon className={cn('shrink-0', colour, className)} aria-hidden />;
}

export function FolderIcon({ className }: { className?: string }) {
  return <Folder className={cn('shrink-0 text-amber-500', className)} aria-hidden />;
}
