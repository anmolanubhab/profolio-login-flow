import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Search } from 'lucide-react';
import { searchTaggablePeople, type DraftTag, type TaggablePerson } from '@/lib/posts/mediaTags';

interface PostTagSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** profileIds already tagged on the current image (hidden from results). */
  excludeIds: string[];
  onPick: (tag: Pick<DraftTag, 'profileId' | 'name' | 'avatarUrl'>) => void;
}

/** Debounced, privacy-aware person picker for photo tagging. */
const PostTagSearchDialog = ({ open, onOpenChange, excludeIds, onPick }: PostTagSearchDialogProps) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<TaggablePerson[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!open) {
      setQ('');
      setResults([]);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const query = q.trim();
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const people = await searchTaggablePeople(query);
      setResults(people);
      setLoading(false);
    }, 250);
    return () => timer.current && clearTimeout(timer.current);
  }, [q]);

  const visible = results.filter((p) => !excludeIds.includes(p.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tag a person</DialogTitle>
          <DialogDescription>
            Search people to tag in this photo. Only people who allow being discovered appear here.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name"
            className="pl-9"
            aria-label="Search people to tag"
          />
        </div>

        <div className="max-h-72 overflow-y-auto" role="listbox" aria-label="People">
          {loading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
          {!loading && q.trim() && visible.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No people found.</p>
          )}
          {!loading &&
            visible.map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => {
                  onPick({ profileId: p.id, name: p.display_name || 'Someone', avatarUrl: p.avatar_url });
                  onOpenChange(false);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-muted"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={p.avatar_url ?? undefined} alt="" />
                  <AvatarFallback>{(p.display_name || '?').slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{p.display_name || 'Someone'}</span>
                  {(p.headline || p.profession) && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.headline || p.profession}
                    </span>
                  )}
                </span>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PostTagSearchDialog;
