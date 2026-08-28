import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { parseCommentContent } from '@/lib/commentMentions';

interface CommentTextProps {
  content: string;
  collapsedLines?: number;
  className?: string;
}

/**
 * Comment body renderer: same LinkedIn-style "… more / less" height clamp as
 * PostText, but renders @mention chips (links to the profile) and autolinked
 * URLs instead of plain text. Hashtags, emoji, whitespace and newlines are
 * preserved as-is. PostText itself is left untouched (still used for posts).
 */
const CommentText = ({ content, collapsedLines = 4, className }: CommentTextProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  const measureClamp = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    const styles = window.getComputedStyle(el);
    let lineHeight = parseFloat(styles.lineHeight);
    if (!Number.isFinite(lineHeight)) lineHeight = parseFloat(styles.fontSize) * 1.5;
    setIsClamped(el.scrollHeight > lineHeight * collapsedLines + lineHeight * 0.5);
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

  const collapsed = (isClamped || isExpanded) && !isExpanded;
  const segments = parseCommentContent(content);

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
          {segments.map((seg, i) => {
            if (seg.type === 'mention') {
              return (
                <Link
                  key={i}
                  to={`/profile/${seg.profileId}`}
                  className="font-semibold text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  @{seg.name}
                </Link>
              );
            }
            if (seg.type === 'link') {
              return (
                <a
                  key={i}
                  href={seg.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline break-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  {seg.text}
                </a>
              );
            }
            return <Fragment key={i}>{seg.text}</Fragment>;
          })}
        </p>

        {collapsed && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-label="Expand comment"
            className="absolute bottom-0 right-0 flex items-end pl-8 bg-gradient-to-r from-transparent to-secondary/60 to-[1.25rem] text-muted-foreground hover:text-primary transition-colors rounded-sm"
          >
            <span aria-hidden="true">…&nbsp;</span>more
          </button>
        )}
      </div>

      {isExpanded && (
        <button
          type="button"
          onClick={() => setIsExpanded(false)}
          aria-label="Collapse comment"
          className="mt-0.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
        >
          less
        </button>
      )}
    </div>
  );
};

export default CommentText;
