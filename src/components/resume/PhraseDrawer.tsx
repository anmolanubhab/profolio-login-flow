import { useMemo, useState } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { suggestBullets, suggestSkills } from '@/lib/resume/phrases';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'bullets' | 'skills';
  /** Job title / section context that picks the phrase bucket. */
  context: string;
  /** Currently-present items, lower-cased compare, to show an "added" state. */
  present: string[];
  onAdd: (text: string) => void;
  onRemove?: (text: string) => void;
}

export function PhraseDrawer({
  open,
  onOpenChange,
  mode,
  context,
  present,
  onAdd,
  onRemove,
}: Props) {
  const [q, setQ] = useState('');
  const presentSet = useMemo(
    () => new Set(present.map((p) => p.trim().toLowerCase())),
    [present],
  );

  const items = useMemo(() => {
    if (mode === 'skills') {
      const all = suggestSkills(context);
      return q.trim()
        ? all.filter((s) => s.toLowerCase().includes(q.trim().toLowerCase()))
        : all;
    }
    return suggestBullets(context, q);
  }, [mode, context, q]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="space-y-1 pb-3">
          <SheetTitle>
            {mode === 'skills' ? 'Suggested skills' : 'Suggested phrases'}
          </SheetTitle>
          <SheetDescription>
            {context
              ? `Written for roles like “${context}”. `
              : 'Hand-written examples. '}
            Tap to add — you can edit anything after.
          </SheetDescription>
        </SheetHeader>

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={mode === 'skills' ? 'Filter skills…' : 'Filter phrases…'}
            className="pl-9"
          />
        </div>

        <div className="-mx-6 flex-1 overflow-y-auto px-6">
          <ul className="space-y-2 pb-6">
            {items.length === 0 && (
              <li className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                No matches. Clear the filter or type your own.
              </li>
            )}
            {items.map((text) => {
              const added = presentSet.has(text.trim().toLowerCase());
              return (
                <li key={text}>
                  <button
                    type="button"
                    onClick={() =>
                      added ? onRemove?.(text) : onAdd(text)
                    }
                    className={
                      'flex w-full items-start gap-2.5 rounded-lg border p-3 text-left text-sm transition-colors ' +
                      (added
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border hover:border-primary/40 hover:bg-accent/40')
                    }
                  >
                    <span
                      className={
                        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ' +
                        (added
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/40 text-muted-foreground')
                      }
                    >
                      {added ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    </span>
                    <span className={added ? 'text-foreground' : ''}>
                      {text.replace('{n}', '3')}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </SheetContent>
    </Sheet>
  );
}
