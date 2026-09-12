import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { secureUpload } from '@/lib/secure-upload';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Search, X, Camera, Users2, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  user_id: string;
  display_name?: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
  profession?: string;
}

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  /** Called once the group conversation exists, with its id -- the caller opens it. */
  onCreated: (conversationId: string) => void;
}

/** Matches the RPC's own floor (creator + at least this many other members). */
const MIN_OTHER_MEMBERS = 2;

export function CreateGroupDialog({ open, onOpenChange, currentUserId, onCreated }: CreateGroupDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'details' | 'members'>('details');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Map<string, Profile>>(new Map());

  const [creating, setCreating] = useState(false);

  // Reset all transient state whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setStep('details');
      setName('');
      setDescription('');
      setAvatarFile(null);
      setAvatarPreviewUrl(null);
      setQuery('');
      setSearchResults([]);
      setSelected(new Map());
      setCreating(false);
    }
  }, [open]);

  // Object URL for the local avatar preview -- revoke it on change/unmount.
  useEffect(() => {
    if (!avatarFile) return;
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  // Debounced people search (same shape as ForwardMessageDialog / the
  // Messages "New message" search).
  useEffect(() => {
    if (!open || step !== 'members') return;
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, user_id, display_name, full_name, email, avatar_url, profession')
          .neq('user_id', currentUserId)
          .or(`display_name.ilike.%${q}%,full_name.ilike.%${q}%,email.ilike.%${q}%`)
          .limit(10);
        if (error) throw error;
        setSearchResults(data ?? []);
      } catch (err) {
        console.error('Create group: member search failed', err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, open, step, currentUserId]);

  const nameOf = (p: Profile) => p.display_name || p.full_name || 'Unknown';

  const toggleMember = (p: Profile) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.user_id)) next.delete(p.user_id);
      else next.set(p.user_id, p);
      return next;
    });
  };

  const results = useMemo(
    () => searchResults.filter((p) => !selected.has(p.user_id)),
    [searchResults, selected],
  );

  const membersNeeded = Math.max(0, MIN_OTHER_MEMBERS - selected.size);
  const canCreate = name.trim().length > 0 && selected.size >= MIN_OTHER_MEMBERS && !creating;

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const uploaded = await secureUpload({ bucket: 'avatars', file: avatarFile, userId: currentUserId });
        if (!uploaded.success || !uploaded.url) {
          toast({ title: 'Could not upload group photo', description: uploaded.error, variant: 'destructive' });
          setCreating(false);
          return;
        }
        avatarUrl = uploaded.url;
      }

      const { data: conversationId, error } = await supabase.rpc('create_group_conversation', {
        p_name: name.trim(),
        p_description: description.trim() || null,
        p_avatar_url: avatarUrl,
        p_member_ids: [...selected.keys()],
      });
      if (error) throw error;

      toast({ title: 'Group created', description: `"${name.trim()}" is ready.` });
      onOpenChange(false);
      onCreated(conversationId as string);
    } catch (err) {
      console.error('Create group: RPC failed', err);
      toast({
        title: 'Could not create group',
        description: err instanceof Error ? err.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !creating && onOpenChange(o)}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="flex-row items-center gap-2 space-y-0 border-b px-4 py-3">
          {step === 'members' && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-ml-2 h-8 w-8 shrink-0"
              aria-label="Back to group details"
              onClick={() => setStep('details')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <DialogTitle className="text-base">
            {step === 'details' ? 'New group' : 'Add members'}
          </DialogTitle>
        </DialogHeader>

        {step === 'details' ? (
          <div className="space-y-4 p-4">
            <div className="flex justify-center">
              <label
                htmlFor="group-avatar-input"
                className="group relative grid h-20 w-20 cursor-pointer place-items-center overflow-hidden rounded-full bg-muted text-muted-foreground"
              >
                {avatarPreviewUrl ? (
                  <img src={avatarPreviewUrl} alt="Group photo preview" className="h-full w-full object-cover" />
                ) : (
                  <Users2 className="h-8 w-8" />
                )}
                <span className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Camera className="h-5 w-5 text-white" />
                </span>
                <input
                  id="group-avatar-input"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="group-name-input" className="text-sm font-medium">
                Group name
              </label>
              <Input
                id="group-name-input"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Frontend Team"
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="group-description-input" className="text-sm font-medium">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <Textarea
                id="group-description-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group about?"
                maxLength={280}
                rows={3}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="border-b p-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people…"
                  aria-label="Search people to add"
                  className="pl-8"
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {selected.size} selected
                  {membersNeeded > 0 && ` · add ${membersNeeded} more`}
                </p>
              </div>
              {selected.size > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {[...selected.values()].map((p) => (
                    <span
                      key={p.user_id}
                      className="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-primary"
                    >
                      {nameOf(p)}
                      <button
                        type="button"
                        aria-label={`Remove ${nameOf(p)}`}
                        onClick={() => toggleMember(p)}
                        className="rounded-full p-0.5 hover:bg-primary/20"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="p-1.5">
                {query.trim().length < 2 && (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search for people to add.
                  </p>
                )}

                {query.trim().length >= 2 && searching && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}

                {query.trim().length >= 2 && !searching && results.length === 0 && (
                  <p className="px-2 py-6 text-center text-sm text-muted-foreground">No people found.</p>
                )}

                {query.trim().length >= 2 &&
                  !searching &&
                  results.map((p) => (
                    <button
                      key={p.user_id}
                      type="button"
                      onClick={() => toggleMember(p)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                    >
                      <Checkbox checked={false} tabIndex={-1} aria-hidden className="pointer-events-none" />
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={p.avatar_url || undefined} />
                        <AvatarFallback>{nameOf(p)[0]?.toUpperCase() || 'U'}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{nameOf(p)}</p>
                        {p.profession && <p className="truncate text-xs text-muted-foreground">{p.profession}</p>}
                      </div>
                    </button>
                  ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="flex-row items-center justify-end gap-2 border-t px-4 py-3">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          {step === 'details' ? (
            <Button type="button" onClick={() => setStep('members')} disabled={name.trim().length === 0}>
              Next
            </Button>
          ) : (
            <Button type="button" onClick={handleCreate} disabled={!canCreate}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create group{selected.size > 0 ? ` (${selected.size + 1})` : ''}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
