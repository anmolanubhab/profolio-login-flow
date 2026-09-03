import { useState } from 'react';
import { FileText, FileType, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import type { ResumeDoc } from '@/lib/resume/schema';
import { downloadResumePdf, downloadResumeText } from '@/lib/resume/export';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  doc: ResumeDoc;
  defaultName: string;
}

export function ExportDialog({ open, onOpenChange, doc, defaultName }: Props) {
  const { toast } = useToast();
  const [format, setFormat] = useState<'pdf' | 'txt'>('pdf');
  const [name, setName] = useState(defaultName || 'My Resume');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      if (format === 'pdf') downloadResumePdf(doc, name);
      else downloadResumeText(doc, name);
      toast({ title: 'Download started', description: `${name}.${format}` });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Export failed',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const opt = (
    value: 'pdf' | 'txt',
    icon: React.ReactNode,
    label: string,
    hint: string,
  ) => (
    <label
      htmlFor={`fmt-${value}`}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
        format === value ? 'border-primary bg-primary/5' : 'hover:bg-accent/40',
      )}
    >
      <RadioGroupItem id={`fmt-${value}`} value={value} className="mt-1" />
      <span className="flex items-start gap-2.5">
        <span className="mt-0.5 text-muted-foreground">{icon}</span>
        <span>
          <span className="block text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
      </span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Download resume</DialogTitle>
          <DialogDescription>
            Both formats are text-based and stay ATS-readable.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={format}
          onValueChange={(v) => setFormat(v as 'pdf' | 'txt')}
          className="gap-2"
        >
          {opt('pdf', <FileText className="h-4 w-4" />, 'PDF', 'Styled to your template. Best for sending.')}
          {opt('txt', <FileType className="h-4 w-4" />, 'Plain text', 'For pasting into web forms and ATS boxes.')}
        </RadioGroup>

        <div className="space-y-1.5">
          <Label htmlFor="export-name" className="text-xs text-muted-foreground">
            File name
          </Label>
          <Input
            id="export-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={run} disabled={busy} className="gap-1.5">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
