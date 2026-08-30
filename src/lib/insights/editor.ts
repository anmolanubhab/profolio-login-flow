import { generateHTML, type Extensions, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import DOMPurify from 'dompurify';

export const EMPTY_DOC: JSONContent = { type: 'doc', content: [{ type: 'paragraph' }] };

/**
 * Shared Tiptap extension set — used by the editor AND by the renderer that
 * turns stored JSON into HTML, so the reading page and the editor stay in
 * sync. Kept intentionally small (LinkedIn's article editor is not a
 * kitchen-sink): headings, bold/italic, lists, blockquote, links, images, hr.
 */
export function insightExtensions(opts?: { placeholder?: string }): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      // link handled by the dedicated extension below (autolink + paste)
      // codeBlock kept from StarterKit; drop horizontalRule? keep it.
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ['http', 'https', 'mailto'],
      HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
    }),
    Image.configure({ inline: false, HTMLAttributes: { class: 'insight-img' } }),
    Placeholder.configure({
      placeholder: opts?.placeholder ?? 'Write your insight…',
    }),
  ];
}

/** Tiptap JSON -> sanitized HTML string for rendering. */
export function renderInsightHtml(doc: JSONContent | null | undefined): string {
  if (!doc || !doc.content || (Array.isArray(doc.content) && doc.content.length === 0)) return '';
  let raw = '';
  try {
    raw = generateHTML(doc, insightExtensions());
  } catch {
    return '';
  }
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 's', 'code', 'pre', 'blockquote', 'hr',
      'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class'],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|\/|data:image\/(?:png|jpe?g|gif|webp);base64,)/i,
  });
}

/** Plain-text length of a doc, for validation + reading-time. */
export function docText(doc: JSONContent | null | undefined): string {
  if (!doc) return '';
  const walk = (n: JSONContent): string => {
    if (n.type === 'text') return n.text ?? '';
    const kids = Array.isArray(n.content) ? n.content.map(walk).join(' ') : '';
    return kids;
  };
  return walk(doc).replace(/\s+/g, ' ').trim();
}

export function readingMinutes(doc: JSONContent | null | undefined): number {
  const words = docText(doc).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function isDocEmpty(doc: JSONContent | null | undefined): boolean {
  return docText(doc).length === 0;
}
