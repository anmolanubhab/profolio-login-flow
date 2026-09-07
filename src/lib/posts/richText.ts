/**
 * Phase 6A — shared rich-text model for the advanced post composer.
 *
 * A post body is a Tiptap document stored in `posts.content_rich` (jsonb).
 * `posts.content` keeps a flattened plain-text mirror (search, notification
 * snippets, repost previews, and the fallback renderer for legacy posts that
 * have no `content_rich`).
 *
 * Kept deliberately small — LinkedIn's composer is not a kitchen sink:
 * bold / italic / strike, bullet + ordered + task lists, blockquote, link,
 * hard breaks, plus the two entity nodes (@mention, #hashtag). No headings,
 * images or tables in a feed post.
 */
import type { Extensions, JSONContent } from '@tiptap/react';
import type { Json } from '@/integrations/supabase/types';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { MentionNode, HashtagNode, type MentionSuggestionConfig } from './entityNodes';

export type RichDoc = JSONContent;

export const EMPTY_DOC: RichDoc = { type: 'doc', content: [{ type: 'paragraph' }] };

/** A fresh empty document — use when resetting a composer so the new value has
 *  a new object identity (the editor only re-syncs when `value` changes). */
export function createEmptyDoc(): RichDoc {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/** Seed a doc from a legacy plain-text post body (posts.content, already
 *  HTML-unescaped by the caller). One paragraph per line; @mentions/#hashtags
 *  in old posts stay as plain text — they were never structured entities. */
export function docFromPlainText(text: string): RichDoc {
  const trimmed = (text ?? '').replace(/\r\n/g, '\n');
  if (!trimmed) return createEmptyDoc();
  return {
    type: 'doc',
    content: trimmed.split('\n').map((line) =>
      line ? { type: 'paragraph', content: [{ type: 'text', text: line }] } : { type: 'paragraph' },
    ),
  };
}

/** Matches comments' cap so the two composers feel the same. */
export const MAX_POST_CHARS = 3000;

interface PostExtensionOpts {
  placeholder?: string;
  /** Provided only by the editor; the read-only renderer passes nothing. */
  mentionSuggestion?: MentionSuggestionConfig;
  hashtagSuggestion?: MentionSuggestionConfig;
}

export function postExtensions(opts: PostExtensionOpts = {}): Extensions {
  return [
    StarterKit.configure({
      heading: false,
      horizontalRule: false,
      // link handled by the dedicated extension below
      code: { HTMLAttributes: { class: 'post-rt-code' } },
      codeBlock: false,
      dropcursor: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ['http', 'https', 'mailto'],
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    TaskList.configure({ HTMLAttributes: { class: 'post-rt-tasklist' } }),
    TaskItem.configure({ nested: false, HTMLAttributes: { class: 'post-rt-taskitem' } }),
    Placeholder.configure({ placeholder: opts.placeholder ?? 'Share an update…' }),
    MentionNode.configure(
      opts.mentionSuggestion ? { suggestion: opts.mentionSuggestion } : {},
    ),
    HashtagNode.configure(
      opts.hashtagSuggestion ? { suggestion: opts.hashtagSuggestion } : {},
    ),
  ];
}

// --------------------------------------------------------------------------
// doc -> plain text (mirror + validation)
// --------------------------------------------------------------------------
const BLOCK_TYPES = new Set([
  'paragraph', 'blockquote', 'codeBlock', 'listItem', 'taskItem',
]);

function walk(node: JSONContent, out: string[], ctx: { ordinal?: number }): void {
  switch (node.type) {
    case 'text':
      out.push(node.text ?? '');
      return;
    case 'hardBreak':
      out.push('\n');
      return;
    case 'mention':
      out.push(`@${node.attrs?.label ?? node.attrs?.id ?? ''}`.trimEnd());
      return;
    case 'hashtag':
      out.push(`#${node.attrs?.tag ?? node.attrs?.label ?? ''}`);
      return;
    case 'horizontalRule':
      out.push('\n\n———\n\n');
      return;
  }

  const children = Array.isArray(node.content) ? node.content : [];

  if (node.type === 'bulletList' || node.type === 'orderedList' || node.type === 'taskList') {
    let i = node.type === 'orderedList' ? (typeof node.attrs?.start === 'number' ? node.attrs.start : 1) : 0;
    for (const child of children) {
      if (node.type === 'orderedList') {
        walk(child, out, { ordinal: i });
        i += 1;
      } else {
        walk(child, out, {});
      }
    }
    out.push('\n');
    return;
  }

  if (node.type === 'listItem') {
    out.push(ctx.ordinal ? `${ctx.ordinal}. ` : '• ');
    children.forEach((c) => walk(c, out, {}));
    out.push('\n');
    return;
  }

  if (node.type === 'taskItem') {
    out.push(node.attrs?.checked ? '✅ ' : '⬜ ');
    children.forEach((c) => walk(c, out, {}));
    out.push('\n');
    return;
  }

  children.forEach((c) => walk(c, out, {}));

  if (BLOCK_TYPES.has(node.type ?? '') || node.type === 'doc') {
    out.push('\n\n');
  }
}

/** Readable-ish plain text: mentions become "@Name", hashtags "#tag", list
 *  items get "• " / "1. " / "✅ " markers. Used for the `content` mirror. */
export function docToPlainText(doc: RichDoc | null | undefined): string {
  if (!doc) return '';
  const out: string[] = [];
  walk(doc, out, {});
  return out
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isDocEmpty(doc: RichDoc | null | undefined): boolean {
  return docToPlainText(doc).length === 0;
}

/** Narrowing cast for writing a doc into a `jsonb` column (matches the
 *  precedent in src/lib/insights/api.ts). */
export function docToJson(doc: RichDoc | null | undefined): Json | null {
  return (doc ?? null) as unknown as Json | null;
}

/** True when `value` is a usable Tiptap doc (guards the renderer path). */
export function isRichDoc(value: unknown): value is RichDoc {
  return !!value && typeof value === 'object' && (value as { type?: string }).type === 'doc';
}

/** Distinct mentioned profile ids in the doc (client-side convenience; the
 *  server trigger is authoritative). */
export function extractMentionIds(doc: RichDoc | null | undefined): string[] {
  const ids = new Set<string>();
  const rec = (n: JSONContent) => {
    if (n.type === 'mention' && typeof n.attrs?.id === 'string') ids.add(n.attrs.id);
    if (Array.isArray(n.content)) n.content.forEach(rec);
  };
  if (doc) rec(doc);
  return [...ids];
}
