import { useEffect, useState } from 'react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const MAX = 300;

/**
 * LinkedIn-style "Add a note to your invitation?" step. Opens on Connect,
 * lets the sender attach an optional personal note (<= 300 chars) or send
 * without one. Resolves via `onSend(note | null)`.
 */
export function ConnectNoteDialog({
  open,
  onOpenChange,
  personName,
  onSend,
  sending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  personName: string;
  onSend: (note: string | null) => void;
  sending?: boolean;
}) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setShowNote(false);
      setNote('');
    }
  }, [open]);

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Add a note to your invitation?</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Personalise your invitation to {personName}. Members are more likely to accept an
            invitation that includes a note.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        {showNote && (
          <div className="py-1">
            <Textarea
              autoFocus
              value={note}
              maxLength={MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder={`Hi ${personName.split(' ')[0]}, I'd like to connect…`}
              rows={4}
            />
            <p className="mt-1 text-right text-xs text-muted-foreground">
              {note.length}/{MAX}
            </p>
          </div>
        )}

        <ResponsiveModalFooter className="gap-2">
          {showNote ? (
            <>
              <Button variant="ghost" onClick={() => setShowNote(false)} disabled={sending}>
                Back
              </Button>
              <Button onClick={() => onSend(note.trim() || null)} disabled={sending}>
                Send
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setShowNote(true)} disabled={sending}>
                Add a note
              </Button>
              <Button onClick={() => onSend(null)} disabled={sending}>
                Send without a note
              </Button>
            </>
          )}
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

export default ConnectNoteDialog;
