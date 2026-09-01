import { useState, type KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X } from 'lucide-react';

/**
 * One targeting dimension: a labelled text box that turns entries into
 * removable chips. Enter or comma commits; Backspace on an empty box removes
 * the last chip. All entries are "include" criteria for Phase F.
 */
export function CriteriaChipInput({
  label,
  help,
  placeholder,
  values,
  onChange,
}: {
  label: string;
  help?: string;
  placeholder?: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');

  const add = (raw: string) => {
    const v = raw.trim();
    if (!v) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, v]);
    setDraft('');
  };

  const removeAt = (i: number) => onChange(values.filter((_, idx) => idx !== i));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(draft);
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      removeAt(values.length - 1);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="rounded-md border px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
        <div className="flex flex-wrap items-center gap-1.5">
          {values.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => removeAt(i)}
                className="rounded-full hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Input
            value={draft}
            placeholder={values.length === 0 ? placeholder : undefined}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => add(draft)}
            className="h-7 min-w-[8rem] flex-1 border-0 p-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </div>
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
