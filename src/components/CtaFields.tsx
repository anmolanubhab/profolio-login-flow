import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { CTA_LABELS } from '@/lib/cta';

interface CtaFieldsProps {
  label: string;
  url: string;
  openNewTab: boolean;
  urlError: string | null;
  onLabelChange: (value: string) => void;
  onUrlChange: (value: string) => void;
  onOpenNewTabChange: (value: boolean) => void;
}

// The actual "Button text / URL / open in new tab" form, shared verbatim by
// the post composer (adding a CTA) and the post-options edit dialog
// (changing one) -- one implementation, so the two can't quietly drift.
export function CtaFields({ label, url, openNewTab, urlError, onLabelChange, onUrlChange, onOpenNewTabChange }: CtaFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="cta-label" className="text-xs text-muted-foreground">Button text</Label>
        <Select value={label} onValueChange={onLabelChange}>
          <SelectTrigger id="cta-label" className="h-9">
            <SelectValue placeholder="Choose a button label" />
          </SelectTrigger>
          <SelectContent>
            {CTA_LABELS.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cta-url" className="text-xs text-muted-foreground">Destination URL</Label>
        <Input
          id="cta-url"
          type="url"
          inputMode="url"
          placeholder="https://example.com/login"
          value={url}
          onChange={(e) => onUrlChange(e.target.value)}
          aria-invalid={!!urlError}
          className="h-9"
        />
        {urlError && <p className="text-xs text-destructive">{urlError}</p>}
      </div>

      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
        <Checkbox checked={openNewTab} onCheckedChange={(v) => onOpenNewTabChange(v === true)} />
        Open in new tab
      </label>
    </div>
  );
}

export default CtaFields;
