import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Search, X, CornerUpRight } from 'lucide-react';
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

/** The minimum a message needs so it can be re-inserted into another thread. */
export interface ForwardableMessage {
  id: string;
  content: string;
  message_type: string;
  file_url?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
}

interface RecentConversation {
  id: string;
  otherUser?: Profile;
  lastMessage?: string;
}

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: ForwardableMessage[];
  currentUserId: string;
  conversations: RecentConversation[];
  onForwarded: () => void;
}

interface Recipient {
  userId: string;
  profile: Profile;
  lastMessage?: string;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  messages,
  currentUserId,
  conversations,
  onForwarded,
}: ForwardMessageDialogProps) {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<Map<string, Recipient>>(new Map());
  const [forwarding, setForwarding] = useState(false);

  // Reset transient state whenever the dialog is (re)opened.
  useEffect(() => {
    if (open) {
      setQuery('');
      setSearchResults([]);
      setSelected(new Map());
    }
  }, [open]);

  // Recent conversations = the fastest path to a recipient.
  const recents = useMemo<Recipient[]>(
    () =>
      conversations
        .filter((c) => c.otherUser?.user_id)
        .map((c) => ({
          userId: c.otherUser!.user_id,
          profile: c.otherUser!,
          lastMessage: c.lastMessage,
        })),
    [conversations],
  );

  // Debounced people search (same shape ChatInterface uses for New message).
  useEffect(() => {
    if (!open) return;
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
        console.error('Forward: user search failed', err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, open, currentUserId]);

  const rows = useMemo<Recipient[]>(() => {
    if (query.trim().length >= 2) {
      return searchResults.map((p) => ({ userId: p.user_id, profile: p }));
    }
    return recents;
  }, [query, searchResults, recents]);

  const toggle = (r: Recipient) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(r.userId)) next.delete(r.userId);
      else next.set(r.userId, r);
      return next;
    });
  };

  const nameOf = (p: Profile) => p.display_name || p.full_name || 'Unknown';

  /** Find (or create) the 1:1 conversation between the current user and `otherId`. */
  const resolveConversation = async (otherId: string): Promise<string | null> => {
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_1.eq.${currentUserId},participant_2.eq.${otherId}),and(participant_1.eq.${otherId},participant_2.eq.${currentUserId})`,
      )
      .maybeSingle();
    if (existing?.id) return existing.id;

    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ participant_1: currentUserId, participant_2: otherId })
      .select('id')
      .single();
    if (error) {
      console.error('Forward: could not create conversation', error);
      return null;
    }
    return created.id;
  };

  const handleForward = async () => {
    if (selected.size === 0 || messages.length === 0 || forwarding) return;
    setForwarding(true);
    let ok = 0;
    try {
      for (const recipient of selected.values()) {
        const conversationId = await resolveConversation(recipient.userId);
        if (!conversationId) continue;
        // Preserve original order: insert oldest -> newest, one at a time so
        // created_at strictly increases. Reuses file_url -- no storage copy.
        let inserted = 0;
        for (const m of messages) {
          const { error } = await supabase.from('messages').insert({
            conversation_id: conversationId,
            sender_id: currentUserId,
            content: m.content,
            message_type: m.message_type,
            file_url: m.file_url ?? null,
            file_name: m.file_name ?? null,
            mime_type: m.mime_type ?? null,
            file_size: m.file_size ?? null,
            is_forwarded: true,
          });
          if (error) {
            console.error('Forward: message insert failed', error);
            break;
          }
          inserted += 1;
        }
        if (inserted === messages.length) ok += 1;
      }

      if (ok === 0) {
        toast({ title: 'Could not forward', variant: 'destructive' });
      } else {
        toast({
          title:
            messages.length === 1
              ? `Message forwarded to ${ok} ${ok === 1 ? 'chat' : 'chats'}`
              : `${messages.length} messages forwarded to ${ok} ${ok === 1 ? 'chat' : 'chats'}`,
        });
        onForwarded();
        onOpenChange(false);
      }
    } finally {
      setForwarding(false);
    }
  };

  const previewLabel =
    messages.length === 1 ? '1 message' : `${messages.length} messages`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="text-base">Forward {previewLabel}</DialogTitle>
        </DialogHeader>

        <div className="border-b p-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people…"
              aria-label="Search people to forward to"
              className="pl-8"
            />
          </div>
          {selected.size > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...selected.values()].map((r) => (
                <span
                  key={r.userId}
                  className="flex items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2 pr-1 text-xs text-primary"
                >
                  {nameOf(r.profile)}
                  <button
                    type="button"
                    aria-label={`Remove ${nameOf(r.profile)}`}
                    onClick={() => toggle(r)}
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
            {query.trim().length >= 2 && (
              <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Search results
              </p>
            )}
            {query.trim().length < 2 && recents.length > 0 && (
              <p className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Recent chats
              </p>
            )}

            {searching && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {!searching && rows.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted-foreground">
                {query.trim().length >= 2 ? 'No people found.' : 'No recent chats yet — search for someone.'}
              </p>
            )}

            {!searching &&
              rows.map((r) => {
                const isChecked = selected.has(r.userId);
                return (
                  <button
                    key={r.userId}
                    type="button"
                    onClick={() => toggle(r)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent',
                      isChecked && 'bg-primary/5',
                    )}
                  >
                    <Checkbox checked={isChecked} tabIndex={-1} aria-hidden className="pointer-events-none" />
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={r.profile.avatar_url || undefined} />
                      <AvatarFallback>{nameOf(r.profile)[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{nameOf(r.profile)}</p>
                      {(r.lastMessage || r.profile.profession) && (
                        <p className="truncate text-xs text-muted-foreground">
                          {r.lastMessage || r.profile.profession}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex-row items-center justify-end gap-2 border-t px-4 py-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={forwarding}>
            Cancel
          </Button>
          <Button onClick={handleForward} disabled={selected.size === 0 || forwarding}>
            {forwarding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CornerUpRight className="mr-2 h-4 w-4" />
            )}
            Forward{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
