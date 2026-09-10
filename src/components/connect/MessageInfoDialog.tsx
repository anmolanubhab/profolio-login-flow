import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Check, CheckCheck, FileText } from 'lucide-react';

interface MessageInfoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: {
    created_at: string | null;
    is_read: boolean | null;
    message_type: string | null;
    file_name: string | null;
    file_size: number | null;
    mime_type: string | null;
  } | null;
  isOwn: boolean;
}

function fmt(ts: string | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function size(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessageInfoDialog({ open, onOpenChange, message, isOwn }: MessageInfoDialogProps) {
  if (!message) return null;
  const hasFile = message.message_type === 'file' || message.message_type === 'image';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Message info</DialogTitle>
        </DialogHeader>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">Sent</dt>
            <dd className="text-right font-medium">{fmt(message.created_at)}</dd>
          </div>
          {isOwn && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="flex items-center gap-1.5 font-medium">
                {message.is_read ? (
                  <>
                    <CheckCheck className="h-4 w-4 text-primary" />
                    Read
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 text-muted-foreground" />
                    Delivered
                  </>
                )}
              </dd>
            </div>
          )}
          {hasFile && (
            <div className="flex items-start justify-between gap-4 border-t pt-3">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <FileText className="h-4 w-4" />
                Attachment
              </dt>
              <dd className="min-w-0 text-right">
                <p className="truncate font-medium" title={message.file_name || undefined}>
                  {message.file_name || 'File'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {[message.mime_type, size(message.file_size)].filter(Boolean).join(' · ') || '—'}
                </p>
              </dd>
            </div>
          )}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
