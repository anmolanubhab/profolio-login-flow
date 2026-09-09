import {
  ArrowDownAZ,
  ArrowUpDown,
  Check,
  Download,
  FolderInput,
  FolderPlus,
  Info,
  LayoutGrid,
  List as ListIcon,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { SortDir, SortField, VaultView } from './types';

const SORTS: { field: SortField; label: string }[] = [
  { field: 'title', label: 'Name' },
  { field: 'updated_at', label: 'Last modified' },
  { field: 'issue_date', label: 'Issue date' },
  { field: 'expiry_date', label: 'Expiry date' },
  { field: 'file_size', label: 'Size' },
];

interface Props {
  view: VaultView;
  search: string;
  onSearch: (v: string) => void;
  viewMode: 'list' | 'grid';
  onViewMode: (m: 'list' | 'grid') => void;
  sort: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
  onToggleDir: () => void;
  detailsOpen: boolean;
  onToggleDetails: () => void;
  onNewFolder: () => void;
  onUpload: () => void;
  // selection
  selectionCount: number;
  onClearSelection: () => void;
  onDownloadSel: () => void;
  onMoveSel: () => void;
  onStarSel: () => void;
  onTrashSel: () => void;
  onRestoreSel: () => void;
  onDeleteForeverSel: () => void;
  onDetailsSel: () => void;
}

export function VaultToolbar(p: Props) {
  if (p.selectionCount > 0) {
    const inTrash = p.view === 'trash';
    return (
      <div className="flex items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5">
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Clear selection" onClick={p.onClearSelection}>
          <X className="h-4 w-4" />
        </Button>
        <span className="mr-1 text-sm font-medium tabular-nums">{p.selectionCount} selected</span>
        {inTrash ? (
          <>
            <Button variant="ghost" size="sm" onClick={p.onRestoreSel}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Restore
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={p.onDeleteForeverSel}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete forever
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Download" onClick={p.onDownloadSel}>
              <Download className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Move" onClick={p.onMoveSel}>
              <FolderInput className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Star" onClick={p.onStarSel}>
              <Star className="h-4 w-4" />
            </Button>
            {p.selectionCount === 1 && (
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Details" onClick={p.onDetailsSel}>
                <Info className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              aria-label="Move to trash"
              onClick={p.onTrashSel}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-2 py-2 sm:px-3">
      {p.view !== 'trash' && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="shrink-0">
              <Plus className="mr-1.5 h-4 w-4" /> New
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={p.onUpload}>
              <Upload className="mr-2 h-4 w-4" /> Upload files
            </DropdownMenuItem>
            {p.view === 'all' && (
              <DropdownMenuItem onSelect={p.onNewFolder}>
                <FolderPlus className="mr-2 h-4 w-4" /> New folder
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="relative min-w-0 flex-1 sm:max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={p.search}
          onChange={(e) => p.onSearch(e.target.value)}
          placeholder="Search certificates"
          className="h-9 pl-8"
          aria-label="Search certificates"
        />
        {p.search && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => p.onSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        {p.view !== 'recent' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowDownAZ className="h-4 w-4" />
                <span className="hidden sm:inline">{SORTS.find((s) => s.field === p.sort)?.label}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {SORTS.map((s) => (
                <DropdownMenuItem key={s.field} onSelect={() => p.onSort(s.field)}>
                  <Check className={cn('mr-2 h-4 w-4', p.sort === s.field ? 'opacity-100' : 'opacity-0')} />
                  {s.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onSelect={p.onToggleDir}>
                <ArrowUpDown className="mr-2 h-4 w-4" />
                {p.dir === 'asc' ? 'Ascending' : 'Descending'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <ToggleGroup
          type="single"
          value={p.viewMode}
          onValueChange={(v) => v && p.onViewMode(v as 'list' | 'grid')}
          className="rounded-md border border-border"
        >
          <ToggleGroupItem value="list" aria-label="List view" className="h-8 w-8 p-0">
            <ListIcon className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="grid" aria-label="Grid view" className="h-8 w-8 p-0">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        <Button
          variant={p.detailsOpen ? 'secondary' : 'ghost'}
          size="icon"
          className="hidden h-8 w-8 lg:inline-flex"
          aria-label="Toggle details panel"
          aria-pressed={p.detailsOpen}
          onClick={p.onToggleDetails}
        >
          <Info className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
