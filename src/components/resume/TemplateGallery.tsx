import { useMemo, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { TEMPLATES } from '@/lib/resume/templates';
import type { TemplateId } from '@/lib/resume/schema';
import { ResumePreview } from './ResumePreview';
import { sampleDoc } from './sampleDoc';

interface Props {
  /** null when starting fresh; set when swapping an existing resume's template. */
  current: TemplateId | null;
  onPick: (id: TemplateId) => void;
  onBack?: () => void;
  heading?: string;
}

export function TemplateGallery({ current, onPick, onBack, heading }: Props) {
  const [selected, setSelected] = useState<TemplateId | null>(current);
  const [oneColumn, setOneColumn] = useState(false);
  const [twoColumn, setTwoColumn] = useState(false);
  const [withPhoto, setWithPhoto] = useState(false);

  const list = useMemo(() => {
    return TEMPLATES.filter((t) => {
      if (oneColumn && t.columns !== 1) return false;
      if (twoColumn && t.columns !== 2) return false;
      if (withPhoto && !t.photo) return false;
      return true;
    });
  }, [oneColumn, twoColumn, withPhoto]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        <h2 className="text-lg font-semibold">{heading ?? 'Choose a template'}</h2>
        <p className="w-full text-sm text-muted-foreground sm:w-auto">
          You can change this any time — your content stays.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-card p-3 text-sm">
        <span className="font-medium text-muted-foreground">Filter</span>
        <label className="flex items-center gap-2">
          <Checkbox checked={oneColumn} onCheckedChange={(c) => setOneColumn(c === true)} />
          One column
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={twoColumn} onCheckedChange={(c) => setTwoColumn(c === true)} />
          Two column
        </label>
        <label className="flex items-center gap-2">
          <Checkbox checked={withPhoto} onCheckedChange={(c) => setWithPhoto(c === true)} />
          Has photo
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => {
          const active = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t.id)}
              className={cn(
                'group flex flex-col overflow-hidden rounded-xl border-2 bg-muted/30 text-left transition-all',
                active
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-transparent hover:border-primary/40',
              )}
            >
              <div className="relative flex h-[300px] items-start justify-center overflow-hidden bg-white p-3">
                <ResumePreview doc={sampleDoc(t.id)} fitWidth={250} />
                {active && (
                  <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </div>
              <div className="space-y-1 border-t bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{t.name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {t.columns === 2 ? '2 col' : '1 col'}
                  </span>
                </div>
                <p className="text-xs leading-snug text-muted-foreground">{t.blurb}</p>
                <p className="pt-1 text-[11px] text-muted-foreground">
                  Good for: {t.recommendedFor.join(', ')}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-3 border-t bg-background/95 py-3 lg:sticky lg:bottom-0 lg:backdrop-blur">
        <Button
          disabled={!selected}
          onClick={() => selected && onPick(selected)}
          size="lg"
          className="w-full sm:w-auto"
        >
          {current ? 'Use this template' : 'Start with this template'}
        </Button>
      </div>
    </div>
  );
}
