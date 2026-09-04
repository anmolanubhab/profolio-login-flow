import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import {
  RANGE_PRESET_LABEL,
  resolveRange,
  type AnalyticsRange,
  type RangePreset,
} from '@/lib/ads/analytics';

const PRESETS: RangePreset[] = ['today', '7d', '30d', 'custom'];

interface Props {
  preset: RangePreset;
  range: AnalyticsRange;
  onChange: (preset: RangePreset, range: AnalyticsRange) => void;
}

/** Today / Last 7 days / Last 30 days / Custom range. */
export function AnalyticsRangePicker({ preset, range, onChange }: Props) {
  const today = new Date().toISOString().slice(0, 10);

  const pick = (next: string) => {
    if (!next) return; // ignore de-select
    const p = next as RangePreset;
    onChange(p, p === 'custom' ? range : resolveRange(p));
  };

  const setCustom = (part: Partial<AnalyticsRange>) => {
    const merged = { ...range, ...part };
    // keep from <= to
    if (merged.from > merged.to) {
      if (part.from) merged.to = merged.from;
      else merged.from = merged.to;
    }
    onChange('custom', merged);
  };

  return (
    <div className="space-y-2">
      <ToggleGroup
        type="single"
        value={preset}
        onValueChange={pick}
        className="flex flex-wrap justify-start gap-1.5"
      >
        {PRESETS.map((p) => (
          <ToggleGroupItem
            key={p}
            value={p}
            aria-label={RANGE_PRESET_LABEL[p]}
            className="h-8 rounded-full border px-3 text-xs data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-primary"
          >
            {RANGE_PRESET_LABEL[p]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-1.5">
            <span>From</span>
            <Input
              type="date"
              value={range.from}
              max={range.to || today}
              onChange={(e) => setCustom({ from: e.target.value })}
              className="h-8 w-[9.5rem] text-xs"
            />
          </label>
          <label className="flex items-center gap-1.5">
            <span>To</span>
            <Input
              type="date"
              value={range.to}
              min={range.from}
              max={today}
              onChange={(e) => setCustom({ to: e.target.value })}
              className="h-8 w-[9.5rem] text-xs"
            />
          </label>
        </div>
      )}
    </div>
  );
}
