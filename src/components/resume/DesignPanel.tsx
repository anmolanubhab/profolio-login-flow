import { ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  TEMPLATES,
  ACCENT_SWATCHES,
  FONT_STACKS,
} from '@/lib/resume/templates';
import {
  type ResumeDoc,
  type FontId,
  type FontScale,
  type SectionId,
  DEFAULT_DESIGN,
  DEFAULT_ORDER,
} from '@/lib/resume/schema';

type Patch = (recipe: (d: ResumeDoc) => void) => void;

const SECTION_NAMES: Record<SectionId, string> = {
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  custom: 'Custom sections',
};

export function DesignPanel({ doc, patch }: { doc: ResumeDoc; patch: Patch }) {
  const d = doc.design;

  const moveSection = (from: number, to: number) => {
    if (to < 0 || to >= d.order.length) return;
    patch((doc) => {
      const next = doc.design.order.slice();
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      doc.design.order = next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Template */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Template
        </Label>
        <div className="grid grid-cols-2 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => patch((doc) => { doc.design.template = t.id; })}
              className={cn(
                'rounded-lg border p-2.5 text-left transition-colors',
                d.template === t.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:border-primary/40',
              )}
            >
              <div className="text-sm font-medium">{t.name}</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {t.columns === 2 ? 'Two column' : 'One column'}
                {t.photo ? ' · photo' : ''}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Accent */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Accent colour
        </Label>
        <div className="flex flex-wrap gap-2">
          {ACCENT_SWATCHES.map((s) => (
            <button
              key={s.value}
              type="button"
              title={s.label}
              aria-label={s.label}
              aria-pressed={d.accent === s.value}
              onClick={() => patch((doc) => { doc.design.accent = s.value; })}
              className={cn(
                'h-7 w-7 rounded-full border-2 transition-transform',
                d.accent === s.value
                  ? 'border-foreground scale-110'
                  : 'border-transparent hover:scale-105',
              )}
              style={{ background: `hsl(${s.value})` }}
            />
          ))}
        </div>
      </div>

      {/* Font */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Font
          </Label>
          <Select
            value={d.font}
            onValueChange={(v) => patch((doc) => { doc.design.font = v as FontId; })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(FONT_STACKS) as FontId[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {FONT_STACKS[f].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Text size
          </Label>
          <Select
            value={d.scale}
            onValueChange={(v) => patch((doc) => { doc.design.scale = v as FontScale; })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="compact">Compact</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="roomy">Roomy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Spacing */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Section spacing
          </Label>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(d.spacing * 100)}%
          </span>
        </div>
        <Slider
          value={[d.spacing]}
          min={0.8}
          max={1.35}
          step={0.05}
          onValueChange={([v]) => patch((doc) => { doc.design.spacing = v; })}
        />
      </div>

      {/* Section order */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Section order
        </Label>
        <ul className="space-y-1.5">
          {d.order.map((sec, i) => (
            <li
              key={sec}
              className="flex items-center gap-2 rounded-md border border-border/70 bg-card px-2.5 py-1.5 text-sm"
            >
              <span className="flex-1">{SECTION_NAMES[sec]}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={i === 0}
                onClick={() => moveSection(i, i - 1)}
                aria-label={`Move ${SECTION_NAMES[sec]} up`}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                disabled={i === d.order.length - 1}
                onClick={() => moveSection(i, i + 1)}
                aria-label={`Move ${SECTION_NAMES[sec]} down`}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() =>
          patch((doc) => {
            doc.design = { ...DEFAULT_DESIGN, order: [...DEFAULT_ORDER] };
          })
        }
      >
        <RotateCcw className="mr-2 h-3.5 w-3.5" />
        Reset design
      </Button>
    </div>
  );
}
