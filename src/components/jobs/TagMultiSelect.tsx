import { useState, KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface TagMultiSelectProps {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  /** Optional fixed set of allowed values (renders as tap targets instead of free text), e.g. work modes / employment types. */
  options?: { value: string; label: string }[];
  disabled?: boolean;
}

/**
 * Lightweight tags input: free-text entries (Enter/comma to add, Backspace on
 * an empty field removes the last chip) or, when `options` is given, a set
 * of tappable chips (44px-tall touch targets) toggled on/off -- used for the
 * fixed work-mode / employment-type vocab so preferences can never drift
 * from the values PostJobDialog.tsx already uses.
 */
export function TagMultiSelect({ values, onChange, placeholder, options, disabled }: TagMultiSelectProps) {
  const [draft, setDraft] = useState('');

  if (options) {
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = values.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(active ? values.filter((v) => v !== opt.value) : [...values, opt.value])}
              className={`min-h-[44px] rounded-full border px-4 text-sm font-medium transition-colors ${
                active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  const addFromDraft = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.some((existing) => existing.toLowerCase() === v.toLowerCase())) {
      onChange([...values, v]);
    }
    setDraft('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addFromDraft();
    } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 min-h-[44px] items-center rounded-md border border-input px-2 py-1.5 focus-within:ring-1 focus-within:ring-ring">
        {values.map((v) => (
          <Badge key={v} variant="secondary" className="gap-1 py-1">
            {v}
            <button type="button" aria-label={`Remove ${v}`} onClick={() => onChange(values.filter((x) => x !== v))} disabled={disabled}>
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={addFromDraft}
          placeholder={values.length === 0 ? placeholder : undefined}
          disabled={disabled}
          className="h-8 flex-1 min-w-[120px] border-0 shadow-none focus-visible:ring-0 px-1"
        />
      </div>
    </div>
  );
}
