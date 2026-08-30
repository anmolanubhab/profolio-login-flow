import { useMemo } from 'react';
import type { JSONContent } from '@tiptap/react';
import { renderInsightHtml } from '@/lib/insights/editor';
import { cn } from '@/lib/utils';

interface Props {
  /** Prefer the stored sanitized HTML; fall back to rendering the JSON doc. */
  html?: string | null;
  doc?: JSONContent | null;
  className?: string;
}

/**
 * The single renderer used by BOTH the in-editor preview and the published
 * reading page, so what an author previews is exactly what readers get.
 * HTML is always sanitized (either the cached body_html was produced by
 * renderInsightHtml on save, or we re-run it here).
 */
export default function InsightArticleRenderer({ html, doc, className }: Props) {
  const safeHtml = useMemo(() => {
    if (html && html.trim()) return html;
    return renderInsightHtml(doc);
  }, [html, doc]);

  if (!safeHtml) {
    return <p className="text-muted-foreground text-sm italic">Nothing written yet.</p>;
  }

  return (
    <div
      className={cn('insight-prose', className)}
      // safeHtml is sanitized by DOMPurify with a strict tag/attr allow-list.
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
