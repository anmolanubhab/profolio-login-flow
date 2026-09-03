import { useCallback, useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import DOMPurify from 'dompurify';
import {
  Bold,
  Italic,
  List,
  Link2,
  Undo2,
  Redo2,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  htmlToBullets,
  bulletsToHtml,
  polishBullet,
} from '@/lib/resume/phrases';
import { useToast } from '@/hooks/use-toast';

const ALLOWED = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 's', 'ul', 'ol', 'li', 'a'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
};

function clean(html: string): string {
  return DOMPurify.sanitize(html || '', ALLOWED);
}

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /** Opens the shared phrase drawer for this field. */
  onOpenSuggestions?: () => void;
}

function TB({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-secondary hover:text-foreground',
        active && 'bg-secondary text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export function BulletEditor({
  value,
  onChange,
  placeholder,
  onOpenSuggestions,
}: Props) {
  const { toast } = useToast();
  const [, force] = useState(0);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, horizontalRule: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        protocols: ['http', 'https', 'mailto'],
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Describe what you did and the result…',
      }),
    ],
    content: clean(value) || '<p></p>',
    editorProps: { attributes: { class: 'focus:outline-none' } },
    onUpdate: ({ editor }) => onChange(clean(editor.getHTML())),
    onSelectionUpdate: () => force((n) => n + 1),
    onTransaction: () => force((n) => n + 1),
  });

  useEffect(() => () => editor?.destroy(), [editor]);

  // Keep editor in sync when the value is replaced from outside (e.g. adding a
  // suggested bullet, switching entries).
  useEffect(() => {
    if (!editor) return;
    const current = clean(editor.getHTML());
    if (clean(value) !== current) {
      editor.commands.setContent(clean(value) || '<p></p>', false);
    }
  }, [value, editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('Link URL', 'https://');
    if (!url) return;
    let href = url.trim();
    if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) href = `https://${href}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }, [editor]);

  const polishAll = () => {
    const bullets = htmlToBullets(value);
    if (!bullets.length) {
      toast({ title: 'Nothing to polish yet', description: 'Add a line or two first.' });
      return;
    }
    let changed = 0;
    const next = bullets.map((b) => {
      const r = polishBullet(b);
      if (r.changed) changed += 1;
      return r.text;
    });
    onChange(bulletsToHtml(next));
    toast({
      title: changed ? `Tightened ${changed} line${changed === 1 ? '' : 's'}` : 'Looks good already',
      description: changed
        ? 'Weak openers and filler words were cleaned up.'
        : 'No weak phrasing found.',
    });
  };

  if (!editor) return null;

  return (
    <div className="resume-editor-rt rounded-md border border-input bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-input px-1.5 py-1">
        <TB active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} label="Bold">
          <Bold className="h-4 w-4" />
        </TB>
        <TB active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} label="Italic">
          <Italic className="h-4 w-4" />
        </TB>
        <TB
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="Bullet list"
        >
          <List className="h-4 w-4" />
        </TB>
        <TB active={editor.isActive('link')} onClick={setLink} label="Link">
          <Link2 className="h-4 w-4" />
        </TB>
        <span className="mx-1 h-5 w-px bg-border" />
        <TB onClick={() => editor.chain().focus().undo().run()} label="Undo">
          <Undo2 className="h-4 w-4" />
        </TB>
        <TB onClick={() => editor.chain().focus().redo().run()} label="Redo">
          <Redo2 className="h-4 w-4" />
        </TB>
        <span className="ml-auto flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 px-2 text-xs" onClick={polishAll}>
            <Wand2 className="h-3.5 w-3.5" />
            Polish
          </Button>
          {onOpenSuggestions && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={onOpenSuggestions}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Suggestions
            </Button>
          )}
        </span>
      </div>
      <EditorContent editor={editor} className="px-3 py-2" />
    </div>
  );
}
