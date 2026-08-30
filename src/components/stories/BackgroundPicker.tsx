import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  STORY_BACKGROUNDS,
  STORY_BACKGROUNDS_COLLAPSED_COUNT,
} from '@/lib/stories/constants';
import type { StoryBackground } from '@/lib/stories/types';

export function BackgroundPicker({
  value,
  onChange,
}: {
  value: StoryBackground | null;
  onChange: (bg: StoryBackground) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded
    ? STORY_BACKGROUNDS
    : STORY_BACKGROUNDS.slice(0, STORY_BACKGROUNDS_COLLAPSED_COUNT);

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs font-semibold text-muted-foreground mb-2">Backgrounds</p>
      <div className="grid grid-cols-8 gap-2">
        {shown.map((bg) => (
          <button
            key={bg.id}
            type="button"
            aria-label={bg.label}
            aria-pressed={value?.id === bg.id}
            onClick={() => onChange(bg)}
            className={`h-7 w-7 rounded-full border transition-transform hover:scale-110 ${
              value?.id === bg.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'border-border'
            }`}
            style={{ background: bg.css }}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 flex w-full items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        {expanded ? <><ChevronUp className="h-3.5 w-3.5" /> Fewer backgrounds</> : <><ChevronDown className="h-3.5 w-3.5" /> More backgrounds</>}
      </button>
    </div>
  );
}

export default BackgroundPicker;
