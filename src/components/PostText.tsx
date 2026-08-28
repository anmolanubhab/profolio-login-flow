import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface PostTextProps {
  content: string;
  /** Lines shown before truncating in the collapsed state (LinkedIn-style). */
  collapsedLines?: number;
  className?: string;
}

/**
 * Post body text with a LinkedIn-style collapsed state: at most
 * `collapsedLines` rendered lines, then "…more" appended at the end of the
 * last visible line. Truncation is decided from the *rendered* height, not a
 * character count, so it adapts to any viewport width. Clicking "…more"
 * expands; "less" collapses again. Whitespace/newlines are preserved.
 */
const PostText = ({ content, collapsedLines = 3, className }: PostTextProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // `scrollHeight` reports the full, un-truncated content height regardless of
  // whether the CSS line-clamp is currently applied, so we can compare it to
  // the height of `collapsedLines` rows without toggling any styles.
  const measureClamp = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    const styles = window.getComputedStyle(el);
    let lineHeight = parseFloat(styles.lineHeight);
    if (!Number.isFinite(lineHeight)) {
      lineHeight = parseFloat(styles.fontSize) * 1.5;
    }
    const collapsedHeight = lineHeight * collapsedLines;
    setIsClamped(el.scrollHeight > collapsedHeight + lineHeight * 0.5);
  }, [collapsedLines]);

  useLayoutEffect(() => {
    measureClamp();
  }, [measureClamp, content]);

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measureClamp);
      return () => window.removeEventListener('resize', measureClamp);
    }
    const observer = new ResizeObserver(() => measureClamp());
    if (textRef.current) observer.observe(textRef.current);
    return () => observer.disconnect();
  }, [measureClamp]);

  const showToggle = isClamped || isExpanded;
  const collapsed = showToggle && !isExpanded;

  return (
    <div className={className}>
      <div className="relative">
        <p
          ref={textRef}
          className={cn(
            'whitespace-pre-wrap break-words',
            collapsed && 'overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical]',
          )}
          style={collapsed ? { WebkitLineClamp: collapsedLines } : undefined}
        >
          {content}
        </p>

        {collapsed && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label="Expand post text"
            className="absolute bottom-0 right-0 flex items-end pl-8 bg-gradient-to-r from-transparent to-card to-[1.25rem] text-muted-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
          >
            <span aria-hidden="true">…&nbsp;</span>more
          </button>
        )}
      </div>

      {isExpanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          aria-label="Collapse post text"
          className="mt-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 rounded-sm"
        >
          less
        </button>
      )}
    </div>
  );
};

export default PostText;
