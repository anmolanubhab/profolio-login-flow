import { useEffect, useMemo, useState } from 'react';
import { Globe, Users, UserCog, Search } from 'lucide-react';
import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { fetchConnectionCandidates, type AudienceCandidate } from '@/lib/stories/api';
import type { StoryPrivacy } from '@/lib/stories/types';

const OPTIONS: { value: StoryPrivacy; label: string; hint: string; Icon: typeof Globe }[] = [
  { value: 'public', label: 'Public', hint: 'Anyone on Profolio', Icon: Globe },
  { value: 'friends', label: 'Connections', hint: 'Only your accepted connections', Icon: Users },
  { value: 'custom', label: 'Custom', hint: 'Choose specific people', Icon: UserCog },
];

export function StoryPrivacyDialog({
  open,
  onOpenChange,
  userId,
  value,
  customUserIds,
  onSave,
  title = 'Story privacy',
  allowCustom = true,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  value: StoryPrivacy;
  customUserIds: string[];
  onSave: (next: { privacy: StoryPrivacy; customUserIds: string[] }) => void;
  title?: string;
  allowCustom?: boolean;
}) {
  const [privacy, setPrivacy] = useState<StoryPrivacy>(value);
  const [selected, setSelected] = useState<Set<string>>(new Set(customUserIds));
  const [candidates, setCandidates] = useState<AudienceCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    setPrivacy(value);
    setSelected(new Set(customUserIds));
  }, [open, value, customUserIds]);

  useEffect(() => {
    if (!open || privacy !== 'custom' || candidates.length) return;
    setLoading(true);
    fetchConnectionCandidates(userId)
      .then(setCandidates)
      .finally(() => setLoading(false));
  }, [open, privacy, userId, candidates.length]);

  const filtered = useMemo(
    () => candidates.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())),
    [candidates, q],
  );

  const handleSave = () => {
    onSave({
      privacy,
      customUserIds: privacy === 'custom' ? [...selected] : [],
    });
    onOpenChange(false);
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-md">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Your story is visible for 24 hours.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="space-y-1 py-1">
          {OPTIONS.filter((o) => allowCustom || o.value !== 'custom').map(({ value: v, label, hint, Icon }) => (
            <button
              key={v}
              type="button"
              onClick={() => setPrivacy(v)}
              className="flex w-full items-center gap-3 rounded-lg p-2.5 text-left hover:bg-accent"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                <Icon className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
              </span>
              <span
                className={`h-4 w-4 rounded-full border-2 ${
                  privacy === v ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                }`}
              />
            </button>
          ))}
        </div>

        {privacy === 'custom' && allowCustom && (
          <div className="border-t border-border pt-3">
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search connections"
                className="h-9 pl-8"
              />
            </div>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {loading && <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>}
              {!loading && filtered.length === 0 && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {candidates.length ? 'No matches.' : 'You have no connections yet.'}
                </p>
              )}
              {filtered.map((c) => (
                <label
                  key={c.userId}
                  className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-accent"
                >
                  <Checkbox
                    checked={selected.has(c.userId)}
                    onCheckedChange={(v) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (v) next.add(c.userId);
                        else next.delete(c.userId);
                        return next;
                      })
                    }
                  />
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={c.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-[10px]">{c.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{c.name}</span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {selected.size} {selected.size === 1 ? 'person' : 'people'} selected
            </p>
          </div>
        )}

        <ResponsiveModalFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={privacy === 'custom' && selected.size === 0}>
            Save
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

export default StoryPrivacyDialog;
