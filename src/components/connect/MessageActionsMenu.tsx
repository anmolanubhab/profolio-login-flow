import { useState, type ReactNode } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EmojiPicker } from '@/components/stories/EmojiPicker';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  Info, Reply, Copy, CornerUpRight, Pin, PinOff, Star, StarOff,
  CheckSquare, Download, Share2, ExternalLink, Trash2, SmilePlus,
} from 'lucide-react';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

export interface MessageMenuTarget {
  id: string;
  message_type: string | null;
  content: string;
  file_name: string | null;
  mime_type: string | null;
}

interface MessageActionsMenuProps {
  message: MessageMenuTarget;
  isOwn: boolean;
  isStarred: boolean;
  isPinned: boolean;
  myReaction?: string;
  children: ReactNode;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onCopy?: () => void;
  onForward?: () => void;
  onPin: () => void;
  onStar: () => void;
  onSelect?: () => void;
  onSaveAs?: () => void;
  onShare?: () => void;
  onOpenWith?: () => void;
  onInfo: () => void;
  /** Per-user "delete for me" -- always allowed for a readable message. */
  onDeleteForMe?: () => void;
  /** "Delete for everyone" -- only wired for the sender's own, non-deleted messages. */
  onDeleteForEveryone?: () => void;
  /**
   * The message is already deleted-for-everyone: show only Info / Select /
   * Delete for me, and hide the reaction bar. Copy / Forward / Save / Open /
   * Share have nothing to act on.
   */
  isDeleted?: boolean;
}

interface Action {
  key: string;
  label: string;
  icon: typeof Info;
  run: () => void;
  group: 1 | 2 | 3;
  destructive?: boolean;
}

function buildActions(p: MessageActionsMenuProps): Action[] {
  const t = p.message.message_type;
  const isAttachment = t === 'file' || t === 'image' || t === 'sticker';
  const isDocument = t === 'file';
  const canCopy = !isAttachment && !!p.onCopy;

  // A deleted-for-everyone tombstone: nothing to copy / forward / open / share.
  if (p.isDeleted) {
    const list: Action[] = [{ key: 'info', label: 'Message info', icon: Info, run: p.onInfo, group: 1 }];
    if (p.onSelect) list.push({ key: 'select', label: 'Select', icon: CheckSquare, run: p.onSelect, group: 2 });
    if (p.onDeleteForMe) {
      list.push({ key: 'delete-me', label: 'Delete for me', icon: Trash2, run: p.onDeleteForMe, group: 3, destructive: true });
    }
    return list;
  }

  const list: Action[] = [
    { key: 'info', label: 'Message info', icon: Info, run: p.onInfo, group: 1 },
    { key: 'reply', label: 'Reply', icon: Reply, run: p.onReply, group: 1 },
  ];
  if (canCopy) list.push({ key: 'copy', label: 'Copy', icon: Copy, run: p.onCopy!, group: 1 });
  if (p.onForward) list.push({ key: 'forward', label: 'Forward', icon: CornerUpRight, run: p.onForward, group: 1 });
  list.push(
    { key: 'pin', label: p.isPinned ? 'Unpin' : 'Pin', icon: p.isPinned ? PinOff : Pin, run: p.onPin, group: 1 },
    { key: 'star', label: p.isStarred ? 'Unstar' : 'Star', icon: p.isStarred ? StarOff : Star, run: p.onStar, group: 1 },
  );

  if (p.onSelect) list.push({ key: 'select', label: 'Select', icon: CheckSquare, run: p.onSelect, group: 2 });
  if (isAttachment && p.onSaveAs) {
    list.push({ key: 'save', label: t === 'image' ? 'Save image' : 'Save as…', icon: Download, run: p.onSaveAs, group: 2 });
  }
  if (p.onShare) list.push({ key: 'share', label: 'Share', icon: Share2, run: p.onShare, group: 2 });
  if (isDocument && p.onOpenWith) list.push({ key: 'open', label: 'Open with…', icon: ExternalLink, run: p.onOpenWith, group: 2 });

  if (p.onDeleteForMe) {
    list.push({ key: 'delete-me', label: 'Delete for me', icon: Trash2, run: p.onDeleteForMe, group: 3, destructive: true });
  }
  if (p.onDeleteForEveryone) {
    list.push({
      key: 'delete-all', label: 'Delete for everyone', icon: Trash2, run: p.onDeleteForEveryone, group: 3, destructive: true,
    });
  }

  return list;
}

function ReactionRow({
  myReaction,
  onReact,
  close,
}: {
  myReaction?: string;
  onReact: (e: string) => void;
  close: () => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1.5">
      {QUICK_REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          aria-label={`React ${e}`}
          onClick={() => {
            onReact(e);
            close();
          }}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-full text-lg transition-transform hover:scale-110 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            myReaction === e && 'bg-primary/15 ring-1 ring-primary/40',
          )}
        >
          {e}
        </button>
      ))}
      <EmojiPicker
        onPick={(e) => {
          onReact(e);
          close();
        }}
        side="bottom"
        align="end"
      >
        <button
          type="button"
          aria-label="More reactions"
          className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <SmilePlus className="h-4 w-4" />
        </button>
      </EmojiPicker>
    </div>
  );
}

export function MessageActionsMenu(props: MessageActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const actions = buildActions(props);
  const close = () => setOpen(false);

  const renderItems = (onRun: (run: () => void) => void) =>
    ([1, 2, 3] as const).map((g, gi) => {
      const groupActions = actions.filter((a) => a.group === g);
      if (groupActions.length === 0) return null;
      return (
        <div key={g}>
          {gi > 0 && <DropdownMenuSeparator />}
          {groupActions.map((a) => (
            <DropdownMenuItem
              key={a.key}
              onSelect={(e) => {
                e.preventDefault();
                onRun(a.run);
              }}
              className={cn(a.destructive && 'text-destructive focus:bg-destructive/10 focus:text-destructive')}
            >
              <a.icon className="mr-2 h-4 w-4" />
              {a.label}
            </DropdownMenuItem>
          ))}
        </div>
      );
    });

  // -------- mobile: bottom sheet --------
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          aria-label="Message actions"
          className="grid h-7 w-7 place-items-center rounded-full text-current/70 hover:bg-black/5"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
        >
          {props.children}
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="max-h-[80vh] overflow-y-auto rounded-t-2xl p-0 data-[state=closed]:!animate-none"
          >
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle className="text-sm">Message actions</SheetTitle>
            </SheetHeader>
            {!props.isDeleted && (
              <div className="border-b">
                <ReactionRow myReaction={props.myReaction} onReact={props.onReact} close={close} />
              </div>
            )}
            <div className="p-1">
              {actions.map((a, i) => {
                const prev = actions[i - 1];
                return (
                  <div key={a.key}>
                    {prev && prev.group !== a.group && <div className="my-1 h-px bg-border" />}
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        a.run();
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition-colors hover:bg-accent',
                        a.destructive && 'text-destructive hover:bg-destructive/10',
                      )}
                    >
                      <a.icon className="h-5 w-5 shrink-0" />
                      {a.label}
                    </button>
                  </div>
                );
              })}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  // -------- desktop: portal dropdown (modal={false} => no page scroll-lock) --------
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Message actions"
          className="grid h-7 w-7 place-items-center rounded-full text-current/70 opacity-0 transition-opacity hover:bg-black/5 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {props.children}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        collisionPadding={12}
        onClick={(e) => e.stopPropagation()}
        // Don't let the menu's close-time focus restore scroll the trigger
        // into view -- for a message that's scrolled partly out of the
        // conversation, that yanks the whole list. The menu was opened by
        // pointer; leaving focus where it is is fine.
        onCloseAutoFocus={(e) => e.preventDefault()}
        className="w-56 data-[state=closed]:!animate-none"
      >
        {!props.isDeleted && (
          <>
            <ReactionRow myReaction={props.myReaction} onReact={props.onReact} close={close} />
            <DropdownMenuSeparator />
          </>
        )}
        {renderItems((run) => {
          setOpen(false);
          run();
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
