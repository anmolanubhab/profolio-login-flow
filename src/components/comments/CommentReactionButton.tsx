import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import {
  REACTION_META,
  REACTION_ORDER,
  ReactionType,
  ReactionSummary,
} from '@/components/ReactionBar';

const LONG_PRESS_MS = 450;
const HOVER_OPEN_MS = 200;
const HOVER_CLOSE_MS = 250;

// Per-tab memory of the last reaction this user picked on any comment, so a
// plain click applies it (same idea as ReactionBar, kept separate so comment
// and post "quick reactions" don't stomp each other).
let lastCommentReaction: ReactionType = 'like';

interface CommentReactionButtonProps {
  summary: ReactionSummary;
  onReact: (type: ReactionType | null) => void;
  disabled?: boolean;
}

/**
 * Compact "Like" control for a single comment. Hover (desktop) or long-press
 * (mobile) opens the six-reaction picker; a plain click toggles the last-used
 * reaction on/off. Reuses REACTION_META so the emoji set / colors stay in
 * lockstep with post reactions.
 */
const CommentReactionButton = ({ summary, onReact, disabled }: CommentReactionButtonProps) => {
  const isMobile = useIsMobile();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout>>();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const touchMoved = useRef(false);

  const active = summary.user_reaction;
  const activeMeta = active ? REACTION_META[active] : null;

  useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const openPicker = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ top: rect.top, left: rect.left });
    setPickerOpen(true);
  };
  const closePicker = () => setPickerOpen(false);

  const handleMouseEnter = () => {
    if (isMobile || disabled) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = setTimeout(openPicker, HOVER_OPEN_MS);
  };
  const handleMouseLeave = () => {
    if (isMobile) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(closePicker, HOVER_CLOSE_MS);
  };

  const handleTouchStart = () => {
    if (!isMobile || disabled) return;
    touchMoved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) openPicker();
    }, LONG_PRESS_MS);
  };

  const handleClick = () => {
    if (disabled || pickerOpen) return;
    if (active) onReact(null);
    else onReact(lastCommentReaction);
  };

  const pick = (type: ReactionType) => {
    lastCommentReaction = type;
    closePicker();
    onReact(active === type ? null : type);
  };

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-label={active ? `${activeMeta!.label} — tap to remove your reaction` : 'React to this comment'}
        aria-haspopup="menu"
        aria-expanded={pickerOpen}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={() => { touchMoved.current = true; }}
        onTouchEnd={() => { if (longPressTimer.current) clearTimeout(longPressTimer.current); }}
        onContextMenu={(e) => { if (isMobile) e.preventDefault(); }}
        className={cn(
          'text-xs font-semibold transition-colors disabled:opacity-50',
          active ? activeMeta!.colorClass : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {active ? `${activeMeta!.emoji} ${activeMeta!.label}` : 'Like'}
      </button>

      {pickerOpen && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[99]" onClick={closePicker} onTouchStart={closePicker} />
          <div
            role="menu"
            className="fixed z-[100] flex items-center gap-1 bg-popover border border-border rounded-full shadow-lg px-2 py-1.5 animate-in fade-in zoom-in-95"
            style={{ top: pos.top, left: pos.left, transform: 'translate(0, calc(-100% - 6px))' }}
            onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); }}
            onMouseLeave={handleMouseLeave}
          >
            {REACTION_ORDER.map((type) => (
              <button
                key={type}
                type="button"
                role="menuitem"
                title={REACTION_META[type].label}
                aria-label={REACTION_META[type].label}
                className="text-xl hover:scale-125 transition-transform p-1"
                onClick={() => pick(type)}
              >
                {REACTION_META[type].emoji}
              </button>
            ))}
          </div>
        </>,
        document.body,
      )}
    </span>
  );
};

export default CommentReactionButton;
