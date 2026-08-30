import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { EMOJI_GROUPS } from '@/lib/stories/constants';

// Lightweight, dependency-free emoji picker for the composer. Emits the raw
// emoji character; the caller decides where it goes (into the text box, or as
// its own text overlay).
export function EmojiPicker({
  children,
  onPick,
  align = 'end',
  side = 'top',
}: {
  children: React.ReactNode;
  onPick: (emoji: string) => void;
  align?: 'start' | 'center' | 'end';
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState(EMOJI_GROUPS[0].id);

  const list = useMemo(() => {
    if (q.trim()) return EMOJI_GROUPS.flatMap((g) => g.emojis);
    return EMOJI_GROUPS.find((g) => g.id === tab)?.emojis ?? [];
  }, [q, tab]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align={align} side={side} className="w-72 p-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search emoji"
          className="h-8 mb-2"
        />
        {!q.trim() && (
          <div className="flex gap-1 mb-2">
            {EMOJI_GROUPS.map((g) => (
              <button
                key={g.id}
                onClick={() => setTab(g.id)}
                className={`flex-1 rounded-md py-1 text-xs ${tab === g.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60'}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-8 gap-1 max-h-52 overflow-y-auto">
          {list.map((e, i) => (
            <button
              key={`${e}-${i}`}
              onClick={() => { onPick(e); setOpen(false); }}
              className="text-xl leading-none rounded-md p-1 hover:bg-accent"
            >
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default EmojiPicker;
