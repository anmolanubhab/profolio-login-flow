import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Strikethrough,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Link2,
  Undo2,
  Redo2,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { isValidUrl } from '@/lib/input-sanitizer';
import { useMentionSearch } from '@/hooks/use-mention-search';
import { useHashtagSearch } from '@/hooks/use-hashtag-search';
import {
  postExtensions,
  docToPlainText,
  type RichDoc,
} from '@/lib/posts/richText';
import {
  MENTION_PLUGIN_KEY,
  HASHTAG_PLUGIN_KEY,
} from '@/lib/posts/entityNodes';

type SuggestKind = 'mention' | 'hashtag';

interface SuggestUI {
  kind: SuggestKind;
  query: string;
  left: number;
  top: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  command: (attrs: Record<string, any>) => void;
}

export interface PostComposerEditorProps {
  value: RichDoc;
  onChange: (doc: RichDoc, plainText: string) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  /** min editor height, e.g. '60px' (inline) or '8rem' (full page) */
  minHeight?: string;
  className?: string;
}

const ToolbarButton = ({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={active}
    title={label}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={cn(
      'shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors',
      'hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:pointer-events-none',
      active && 'bg-secondary text-primary',
    )}
  >
    {children}
  </button>
);

const PostComposerEditor = ({
  value,
  onChange,
  placeholder = 'Share your achievement, an update, or a question…',
  disabled = false,
  autoFocus = false,
  minHeight = '60px',
  className,
}: PostComposerEditorProps) => {
  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const [suggest, setSuggest] = useState<SuggestUI | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Latest values for the imperative suggestion-plugin callbacks.
  const activeIdxRef = useRef(0);
  activeIdxRef.current = activeIdx;
  const keyDownRef = useRef<((e: KeyboardEvent) => boolean) | null>(null);

  const mention = useMentionSearch();
  const hashtag = useHashtagSearch();

  // Feed the debounced searches only while their picker is the active one.
  useEffect(() => {
    mention.setQuery(suggest?.kind === 'mention' ? suggest.query : null);
    hashtag.setQuery(suggest?.kind === 'hashtag' ? suggest.query : null);
    setActiveIdx(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggest?.kind, suggest?.query]);

  // Build one imperative render() bridge per entity kind. Stable for the
  // editor's lifetime — it only pushes plugin state into React.
  const makeRenderer = useCallback(
    (kind: SuggestKind) => () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const place = (props: any) => {
        const rect: DOMRect | null = props.clientRect?.() ?? null;
        setSuggest({
          kind,
          query: props.query ?? '',
          left: rect ? rect.left : 0,
          top: rect ? rect.bottom + 6 : 0,
          command: props.command,
        });
      };
      return {
        onStart: place,
        onUpdate: place,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onKeyDown: (props: any) => keyDownRef.current?.(props.event) ?? false,
        onExit: () => setSuggest(null),
      };
    },
    [],
  );

  const extensions = useMemo(
    () =>
      postExtensions({
        placeholder,
        mentionSuggestion: {
          char: '@',
          pluginKey: MENTION_PLUGIN_KEY,
          items: () => [],
          allow: () => true,
          render: makeRenderer('mention'),
        },
        hashtagSuggestion: {
          char: '#',
          pluginKey: HASHTAG_PLUGIN_KEY,
          items: () => [],
          allow: () => true,
          render: makeRenderer('hashtag'),
        },
      }),
    // placeholder is effectively static per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'post-rt-editor focus:outline-none',
        'aria-label': placeholder,
      },
    },
    onUpdate: ({ editor: e }) => {
      const doc = e.getJSON() as RichDoc;
      onChange(doc, docToPlainText(doc));
    },
    onTransaction: () => forceUpdate(),
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  // External resets (e.g. cleared after a successful post).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const current = JSON.stringify(editor.getJSON());
    if (current !== JSON.stringify(value)) {
      editor.commands.setContent(value, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => () => editor?.destroy(), [editor]);

  // ---- suggestion popup data ------------------------------------------------
  const results = useMemo(() => {
    if (suggest?.kind === 'mention') {
      return mention.results.map((r) => ({
        key: r.id,
        primary: r.name,
        secondary: r.subtitle,
        avatar: r.avatar,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attrs: { id: r.id, label: r.name } as Record<string, any>,
      }));
    }
    if (suggest?.kind === 'hashtag') {
      const typed = suggest.query.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      const rows = hashtag.results.map((r) => ({
        key: r.tag,
        primary: `#${r.tag}`,
        secondary:
          r.postCount > 0
            ? `${r.postCount} ${r.postCount === 1 ? 'post' : 'posts'}`
            : null,
        avatar: null as string | null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attrs: { tag: r.tag, label: r.tag } as Record<string, any>,
      }));
      if (typed && !rows.some((r) => r.key === typed)) {
        rows.unshift({
          key: typed,
          primary: `#${typed}`,
          secondary: 'New hashtag',
          avatar: null,
          attrs: { tag: typed, label: typed },
        });
      }
      return rows;
    }
    return [];
  }, [suggest?.kind, suggest?.query, mention.results, hashtag.results]);

  const loading =
    suggest?.kind === 'mention'
      ? mention.loading
      : suggest?.kind === 'hashtag'
        ? hashtag.loading
        : false;

  const resultsRef = useRef(results);
  resultsRef.current = results;
  const suggestRef = useRef(suggest);
  suggestRef.current = suggest;

  const pick = useCallback((idx: number) => {
    const s = suggestRef.current;
    const list = resultsRef.current;
    if (!s || !list[idx]) return;
    s.command(list[idx].attrs);
    setSuggest(null);
  }, []);

  keyDownRef.current = (e: KeyboardEvent) => {
    const list = resultsRef.current;
    if (!suggestRef.current) return false;
    if (e.key === 'ArrowDown') {
      setActiveIdx((i) => (list.length ? (i + 1) % list.length : 0));
      return true;
    }
    if (e.key === 'ArrowUp') {
      setActiveIdx((i) => (list.length ? (i - 1 + list.length) % list.length : 0));
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      if (list.length) {
        pick(activeIdxRef.current);
        return true;
      }
      return false;
    }
    if (e.key === 'Escape') {
      setSuggest(null);
      return true;
    }
    return false;
  };

  const setLink = useCallback(() => {
    if (!editor) return;
    const prev = editor.getAttributes('link').href as string | undefined;
    const input = window.prompt('Link URL', prev ?? 'https://');
    if (input === null) return;
    const url = input.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const href = isValidUrl(url)
      ? url
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)
        ? `mailto:${url}`
        : `https://${url}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div
        className={cn('rounded-lg bg-secondary px-4 py-3 text-sm text-muted-foreground', className)}
        style={{ minHeight }}
      >
        {placeholder}
      </div>
    );
  }

  const popupOpen = !!suggest && (results.length > 0 || loading);

  return (
    <div className={cn('flex flex-col', className)}>
      <div
        className="post-rt-toolbar flex items-center gap-0.5 overflow-x-auto border-b border-border pb-1.5 mb-1.5"
        role="toolbar"
        aria-label="Text formatting"
      >
        <ToolbarButton label="Bold" active={editor.isActive('bold')} disabled={disabled} onClick={() => editor.chain().focus().toggleBold().run()}>
          <BoldIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive('italic')} disabled={disabled} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <ItalicIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Strikethrough" active={editor.isActive('strike')} disabled={disabled} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />
        <ToolbarButton label="Bulleted list" active={editor.isActive('bulletList')} disabled={disabled} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} disabled={disabled} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Checklist" active={editor.isActive('taskList')} disabled={disabled} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <ListChecks className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Quote" active={editor.isActive('blockquote')} disabled={disabled} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Link" active={editor.isActive('link')} disabled={disabled} onClick={setLink}>
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />
        <ToolbarButton label="Undo" disabled={disabled || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={disabled || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <EditorContent
        editor={editor}
        className="post-rt-scroll text-sm"
        style={{ ['--post-rt-min-height' as string]: minHeight }}
      />

      {popupOpen &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[59]" onMouseDown={() => setSuggest(null)} />
            <div
              role="listbox"
              className="fixed z-[60] max-h-60 w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border border-border bg-popover shadow-lg py-1"
              style={{ left: suggest!.left, top: suggest!.top }}
            >
              {loading && results.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
              ) : results.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">
                  {suggest!.kind === 'mention' ? 'No people found' : 'No hashtags'}
                </div>
              ) : (
                results.map((r, i) => (
                  <button
                    key={r.key}
                    type="button"
                    role="option"
                    aria-selected={i === activeIdx}
                    onMouseEnter={() => setActiveIdx(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(i);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2 text-left',
                      i === activeIdx ? 'bg-secondary' : 'hover:bg-secondary/60',
                    )}
                  >
                    {suggest!.kind === 'mention' && (
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={r.avatar || undefined} className="object-cover" />
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                          {(r.primary[0] || 'U').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.primary}</span>
                      {r.secondary && (
                        <span className="block truncate text-xs text-muted-foreground">{r.secondary}</span>
                      )}
                    </span>
                  </button>
                ))
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
};

export default PostComposerEditor;
