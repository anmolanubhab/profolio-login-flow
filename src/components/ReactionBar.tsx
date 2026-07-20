import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useIsMobile } from '@/hooks/use-mobile';

export type ReactionType = 'like' | 'celebrate' | 'support' | 'love' | 'insightful' | 'funny';

export interface ReactionSummary {
  total_reactions: number;
  user_reaction: ReactionType | null;
  reactions: Partial<Record<ReactionType, number>>;
}

export const REACTION_META: Record<ReactionType, { emoji: string; label: string; verb: string; colorClass: string }> = {
  like: { emoji: '👍', label: 'Like', verb: 'liked', colorClass: 'text-blue-600' },
  love: { emoji: '❤️', label: 'Love', verb: 'loved', colorClass: 'text-red-600' },
  celebrate: { emoji: '🎉', label: 'Celebrate', verb: 'celebrated', colorClass: 'text-green-600' },
  support: { emoji: '🤝', label: 'Support', verb: 'supported', colorClass: 'text-amber-700' },
  insightful: { emoji: '💡', label: 'Insightful', verb: 'found this insightful', colorClass: 'text-yellow-500' },
  funny: { emoji: '😂', label: 'Funny', verb: 'found this funny', colorClass: 'text-orange-500' },
};

// Display order for the reaction picker -- matches the order the product
// spec listed the reaction bar icons in.
export const REACTION_ORDER: ReactionType[] = ['like', 'love', 'celebrate', 'support', 'insightful', 'funny'];

// Remembers the last reaction type THIS user picked, across every post, for
// the lifetime of the tab. Not persisted (no localStorage) -- it only needs
// to answer "what should a plain click apply", not survive a reload.
let lastUsedReaction: ReactionType = 'like';

const LONG_PRESS_MS = 450;
const HOVER_OPEN_MS = 200;
const HOVER_CLOSE_MS = 250;

interface ReactionBarProps {
  summary: ReactionSummary;
  onReact: (type: ReactionType | null) => void;
  disabled?: boolean;
}

export const ReactionBar = ({ summary, onReact, disabled }: ReactionBarProps) => {
  const isMobile = useIsMobile();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerPos, setPickerPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout>>();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const touchMoved = useRef(false);

  const activeReaction = summary.user_reaction;
  const activeMeta = activeReaction ? REACTION_META[activeReaction] : null;

  useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const positionPicker = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPickerPos({ top: rect.top, left: rect.left });
  };

  const openPicker = () => {
    positionPicker();
    setPickerOpen(true);
  };

  const closePicker = () => setPickerOpen(false);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const scheduleClose = () => {
    closeTimer.current = setTimeout(closePicker, HOVER_CLOSE_MS);
  };

  // --- Desktop: hover reveals the picker ---
  const handleMouseEnter = () => {
    if (isMobile || disabled) return;
    cancelClose();
    openTimer.current = setTimeout(openPicker, HOVER_OPEN_MS);
  };
  const handleMouseLeave = () => {
    if (isMobile) return;
    if (openTimer.current) clearTimeout(openTimer.current);
    scheduleClose();
  };

  // --- Mobile: long-press reveals the picker, a plain tap toggles ---
  const handleTouchStart = () => {
    if (!isMobile || disabled) return;
    touchMoved.current = false;
    longPressTimer.current = setTimeout(() => {
      if (!touchMoved.current) openPicker();
    }, LONG_PRESS_MS);
  };
  const handleTouchMove = () => {
    touchMoved.current = true;
  };
  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  // Click on the main button = apply the last-used reaction, or remove the
  // active one if already reacted (this covers "double-click the same
  // reaction removes it" -- first click sets it, a second click removes it).
  const handleMainClick = () => {
    if (disabled || pickerOpen) return;
    if (activeReaction) {
      onReact(null);
    } else {
      onReact(lastUsedReaction);
    }
  };

  const handlePick = (type: ReactionType) => {
    lastUsedReaction = type;
    closePicker();
    if (activeReaction === type) {
      onReact(null);
    } else {
      onReact(type);
    }
  };

  const mainLabel = activeMeta ? activeMeta.label : 'Like';
  const mainEmoji = activeMeta ? activeMeta.emoji : '👍';

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`action-btn ${activeReaction ? `active ${activeMeta!.colorClass}` : ''}`}
        onClick={handleMainClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => {
          if (isMobile) e.preventDefault();
        }}
        disabled={disabled}
      >
        <span className="text-base leading-none">{mainEmoji}</span>
        <span>{mainLabel}</span>
      </button>

      {pickerOpen && pickerPos && createPortal(
        <>
          {/* Invisible backdrop so a tap/click anywhere else closes the
              picker. Rendered before the picker in the DOM, so a click that
              actually lands on an emoji hits the picker, not this. */}
          <div
            className="fixed inset-0 z-[99]"
            onClick={closePicker}
            onTouchStart={closePicker}
          />
          <div
            className="fixed z-[100] flex items-center gap-1 bg-popover border border-border rounded-full shadow-lg px-2 py-1.5 animate-in fade-in zoom-in-95"
            style={{ top: pickerPos.top, left: pickerPos.left, transform: 'translate(0, calc(-100% - 8px))' }}
            onMouseEnter={cancelClose}
            onMouseLeave={handleMouseLeave}
          >
            {REACTION_ORDER.map((type) => {
              const meta = REACTION_META[type];
              return (
                <button
                  key={type}
                  type="button"
                  title={meta.label}
                  className="text-2xl hover:scale-125 transition-transform p-1"
                  onClick={() => handlePick(type)}
                >
                  {meta.emoji}
                </button>
              );
            })}
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

interface ReactionCountSummaryProps {
  summary: ReactionSummary;
  onClick?: () => void;
}

// Small "👍❤️🎉 124" cluster shown above the action row -- clicking it opens
// the full per-emoji breakdown (Phase 6).
export const ReactionCountSummary = ({ summary, onClick }: ReactionCountSummaryProps) => {
  if (summary.total_reactions === 0) return null;

  const topTypes = REACTION_ORDER
    .filter((t) => (summary.reactions[t] || 0) > 0)
    .sort((a, b) => (summary.reactions[b] || 0) - (summary.reactions[a] || 0))
    .slice(0, 3);

  return (
    <button
      type="button"
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:underline"
      onClick={onClick}
    >
      <span className="flex -space-x-1">
        {topTypes.map((t) => (
          <span
            key={t}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-background text-[10px] ring-1 ring-background"
          >
            {REACTION_META[t].emoji}
          </span>
        ))}
      </span>
      <span>{summary.total_reactions}</span>
    </button>
  );
};
