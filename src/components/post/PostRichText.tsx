import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { isValidUrl } from '@/lib/input-sanitizer';
import type { RichDoc } from '@/lib/posts/richText';

interface PostRichTextProps {
  doc: RichDoc;
  /** Approx. lines shown before the "…more" clamp (collapsed state). */
  collapsedLines?: number;
  className?: string;
}

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = { type?: string; text?: string; attrs?: any; marks?: any[]; content?: Node[] };

function renderText(node: Node, key: string): ReactNode {
  let el: ReactNode = node.text ?? '';
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case 'bold':
        el = <strong key={`${key}-b`}>{el}</strong>;
        break;
      case 'italic':
        el = <em key={`${key}-i`}>{el}</em>;
        break;
      case 'strike':
        el = <s key={`${key}-s`}>{el}</s>;
        break;
      case 'code':
        el = <code key={`${key}-c`} className="post-rt-code">{el}</code>;
        break;
      case 'link': {
        const href: string = mark.attrs?.href ?? '';
        const safe = isValidUrl(href) || /^mailto:/i.test(href);
        el = safe ? (
          <a
            key={`${key}-l`}
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-primary hover:underline break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {el}
          </a>
        ) : (
          <span key={`${key}-l`}>{el}</span>
        );
        break;
      }
      default:
        break;
    }
  }
  // `el` is either a plain string (no key needed in an array) or an
  // already-keyed element. Returning it bare — rather than wrapping in
  // <Fragment> — avoids dev-tooling that injects props onto Fragments.
  return el;
}

function renderChildren(node: Node, key: string): ReactNode[] {
  return (node.content ?? []).map((child, i) => renderNode(child, `${key}.${i}`));
}

function renderNode(node: Node, key: string): ReactNode {
  switch (node.type) {
    case 'text':
      return renderText(node, key);
    case 'hardBreak':
      return <br key={key} />;
    case 'paragraph':
      return (
        <p key={key} className="post-rt-p">
          {node.content?.length ? renderChildren(node, key) : <br />}
        </p>
      );
    case 'bulletList':
      return <ul key={key} className="post-rt-ul">{renderChildren(node, key)}</ul>;
    case 'orderedList':
      return (
        <ol key={key} className="post-rt-ol" start={typeof node.attrs?.start === 'number' ? node.attrs.start : undefined}>
          {renderChildren(node, key)}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{renderChildren(node, key)}</li>;
    case 'taskList':
      return <ul key={key} className="post-rt-tasklist">{renderChildren(node, key)}</ul>;
    case 'taskItem':
      return (
        <li key={key} className="post-rt-taskitem" data-checked={node.attrs?.checked ? 'true' : 'false'}>
          <span className="post-rt-checkbox" aria-hidden>
            {node.attrs?.checked ? '✅' : '⬜'}
          </span>
          <span className="post-rt-taskitem-body">{renderChildren(node, key)}</span>
        </li>
      );
    case 'blockquote':
      return <blockquote key={key} className="post-rt-quote">{renderChildren(node, key)}</blockquote>;
    case 'codeBlock':
      return (
        <pre key={key} className="post-rt-pre">
          <code>{(node.content ?? []).map((c) => c.text ?? '').join('')}</code>
        </pre>
      );
    case 'horizontalRule':
      return <hr key={key} className="post-rt-hr" />;
    case 'mention': {
      const id: string = node.attrs?.id ?? '';
      const label: string = String(node.attrs?.label ?? node.attrs?.id ?? 'user').trim();
      // Published rendering shows the person's name only (no "@"), LinkedIn-
      // style. It stays a real structured entity: the link, the profile UUID,
      // and the post_mentions row are all unchanged — only the "@" glyph is
      // dropped from the presentation.
      if (!UUID_RE.test(id)) return label;
      return (
        <Link
          key={key}
          to={`/profile/${id}`}
          className="post-mention font-semibold text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {label}
        </Link>
      );
    }
    case 'hashtag': {
      const raw: string = node.attrs?.tag ?? node.attrs?.label ?? '';
      const tag = raw.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!tag) return null;
      return (
        <Link
          key={key}
          to={`/hashtag/${encodeURIComponent(tag)}`}
          className="post-hashtag font-medium text-primary hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          #{tag}
        </Link>
      );
    }
    case 'doc':
      return renderChildren(node, key);
    default:
      // Unknown node: render its children so nothing is silently dropped.
      return renderChildren(node, key);
  }
}

/**
 * Read-only renderer for a post's Tiptap document. Walks the JSON directly to
 * React elements — never `dangerouslySetInnerHTML` — so no stored markup can
 * execute. Mentions link to `/profile/:id`, hashtags to `/hashtag/:tag`.
 * Collapsed by default with a LinkedIn-style "…more" toggle driven by the
 * rendered height (adapts to any viewport width).
 */
const PostRichText = ({ doc, collapsedLines = 3, className }: PostRichTextProps) => {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const maxCollapsedPx = collapsedLines * 24 + 8; // ~1.5rem line box

  const measure = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    setClamped(el.scrollHeight > maxCollapsedPx + 12);
  }, [maxCollapsedPx]);

  useLayoutEffect(() => {
    measure();
  }, [measure, doc]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new ResizeObserver(() => measure());
    if (bodyRef.current) ro.observe(bodyRef.current);
    return () => ro.disconnect();
  }, [measure]);

  const collapsed = clamped && !expanded;

  return (
    <div className={className}>
      <div className="relative">
        <div
          ref={bodyRef}
          className={cn('post-rt', collapsed && 'overflow-hidden')}
          style={collapsed ? { maxHeight: maxCollapsedPx } : undefined}
        >
          {renderNode(doc as Node, 'n')}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Expand post text"
            className="absolute bottom-0 right-0 flex items-end bg-gradient-to-l from-card via-card to-transparent pl-10 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
          >
            <span aria-hidden="true">…&nbsp;</span>more
          </button>
        )}
      </div>

      {expanded && clamped && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          aria-label="Collapse post text"
          className="mt-1 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors"
        >
          less
        </button>
      )}
    </div>
  );
};

export default PostRichText;
