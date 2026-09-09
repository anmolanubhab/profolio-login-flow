import {
  Download,
  Pencil,
  FolderInput,
  Star,
  StarOff,
  Info,
  Trash2,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu';
import type { VaultView } from './types';

export interface VaultActions {
  onOpen?: () => void;
  onDownload?: () => void;
  onRename?: () => void;
  onMove?: () => void;
  onToggleStar?: () => void;
  onDetails?: () => void;
  onTrash?: () => void;
  onRestore?: () => void;
  onDeleteForever?: () => void;
}

interface Props {
  variant: 'dropdown' | 'context';
  view: VaultView;
  starred?: boolean;
  multi?: boolean; // multiple items selected -> hide single-item-only actions
  actions: VaultActions;
}

/**
 * The certificate action set, shared by the row/card ⋮ menu (dropdown) and the
 * right-click menu (context). Google Drive's action vocabulary, trimmed to what
 * makes sense for credential documents (no "Make a copy", "Open with", "Add
 * shortcut").
 */
export function VaultActionsMenu({ variant, view, starred, multi, actions }: Props) {
  const Item = variant === 'dropdown' ? DropdownMenuItem : ContextMenuItem;
  const Sep = variant === 'dropdown' ? DropdownMenuSeparator : ContextMenuSeparator;
  const inTrash = view === 'trash';

  if (inTrash) {
    return (
      <>
        <Item onSelect={() => actions.onRestore?.()}>
          <RotateCcw className="mr-2 h-4 w-4" /> Restore
        </Item>
        <Sep />
        <Item
          onSelect={() => actions.onDeleteForever?.()}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" /> Delete forever
        </Item>
      </>
    );
  }

  return (
    <>
      {!multi && (
        <>
          <Item onSelect={() => actions.onOpen?.()}>
            <ExternalLink className="mr-2 h-4 w-4" /> Open
          </Item>
          <Item onSelect={() => actions.onRename?.()}>
            <Pencil className="mr-2 h-4 w-4" /> Rename
          </Item>
        </>
      )}
      <Item onSelect={() => actions.onDownload?.()}>
        <Download className="mr-2 h-4 w-4" /> Download
      </Item>
      <Item onSelect={() => actions.onMove?.()}>
        <FolderInput className="mr-2 h-4 w-4" /> Move{multi ? ' all' : ''}…
      </Item>
      <Item onSelect={() => actions.onToggleStar?.()}>
        {starred ? (
          <>
            <StarOff className="mr-2 h-4 w-4" /> Remove from Starred
          </>
        ) : (
          <>
            <Star className="mr-2 h-4 w-4" /> Add to Starred
          </>
        )}
      </Item>
      {!multi && (
        <Item onSelect={() => actions.onDetails?.()}>
          <Info className="mr-2 h-4 w-4" /> Details &amp; activity
        </Item>
      )}
      <Sep />
      <Item
        onSelect={() => actions.onTrash?.()}
        className="text-destructive focus:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" /> Move to Trash
      </Item>
    </>
  );
}
