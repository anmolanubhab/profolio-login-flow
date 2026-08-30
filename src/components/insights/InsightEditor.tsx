import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Link2,
  Link2Off,
  ImagePlus,
  Undo2,
  Redo2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { insightExtensions } from '@/lib/insights/editor';
import { uploadInsightImage } from '@/lib/insights/api';
import { useToast } from '@/hooks/use-toast';

interface Props {
  initialContent: JSONContent;
  onChange: (doc: JSONContent) => void;
  className?: string;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
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
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent',
        active && 'bg-secondary text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export default function InsightEditor({ initialContent, onChange, className }: Props) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [, force] = useState(0);

  const editor = useEditor({
    extensions: insightExtensions({ placeholder: 'Write your article…' }),
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'insight-prose focus:outline-none min-h-[45vh]',
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    onSelectionUpdate: () => force((n) => n + 1),
    onTransaction: () => force((n) => n + 1),
  });

  useEffect(() => () => editor?.destroy(), [editor]);

  const setLink = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    let href = url.trim();
    if (!/^https?:\/\//i.test(href) && !/^mailto:/i.test(href)) href = `https://${href}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  }, [editor]);

  const pickImage = () => fileRef.current?.click();

  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !editor) return;
    setImgBusy(true);
    try {
      const url = await uploadInsightImage(file, 'inline');
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err: any) {
      toast({
        title: 'Image upload failed',
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setImgBusy(false);
    }
  };

  if (!editor) {
    return (
      <div className={cn('insight-editor', className)}>
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('insight-editor', className)}>
      {/* Sticky toolbar — stays reachable while scrolling a long article. */}
      <div className="sticky top-[calc(var(--nav-height)+0.25rem)] z-10 -mx-1 mb-3 flex flex-wrap items-center gap-0.5 rounded-lg border border-border bg-card/95 px-1 py-1 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <ToolbarButton label="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton label="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Subheading" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton label={editor.isActive('link') ? 'Remove link' : 'Add link'} active={editor.isActive('link')} onClick={setLink}>
          {editor.isActive('link') ? <Link2Off className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
        </ToolbarButton>
        <ToolbarButton label="Insert image" disabled={imgBusy} onClick={pickImage}>
          {imgBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          <Undo2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          <Redo2 className="h-4 w-4" />
        </ToolbarButton>
      </div>

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={onImage} />
      <EditorContent editor={editor} />
    </div>
  );
}
