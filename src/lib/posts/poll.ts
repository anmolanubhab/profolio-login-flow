/**
 * Phase 6B — shared poll composer constants + validation.
 *
 * Durations mirror the `p_duration` values create_poll_post() understands
 * ('1_day' | '3_days' | '1_week' | '2_weeks'); anything else => a poll with no
 * expiry. Option/question limits mirror the DB CHECK constraints and the RPC's
 * own guards, so the client can fail fast with a clear message.
 */
export const POLL_DURATIONS = [
  { value: '1_day', label: '1 day' },
  { value: '3_days', label: '3 days' },
  { value: '1_week', label: '1 week' },
  { value: '2_weeks', label: '2 weeks' },
] as const;

export type PollDuration = (typeof POLL_DURATIONS)[number]['value'];

export const DEFAULT_POLL_DURATION: PollDuration = '1_week';

export const POLL_MIN_OPTIONS = 2;
export const POLL_MAX_OPTIONS = 6;
export const POLL_MAX_QUESTION = 200;
export const POLL_MAX_OPTION = 80;

/**
 * Client-side pre-check that mirrors create_poll_post()'s server validation.
 * Returns a human-readable error string, or null when the poll is valid.
 */
export function validatePoll(question: string, options: string[]): string | null {
  const q = question.trim();
  if (!q) return 'Add a poll question.';
  if (q.length > POLL_MAX_QUESTION) return `Poll question is too long (max ${POLL_MAX_QUESTION} characters).`;

  const cleaned = options.map((o) => o.trim()).filter(Boolean);
  if (cleaned.length < POLL_MIN_OPTIONS) return `Add at least ${POLL_MIN_OPTIONS} poll options.`;
  if (cleaned.length > POLL_MAX_OPTIONS) return `A poll can have at most ${POLL_MAX_OPTIONS} options.`;
  if (cleaned.some((o) => o.length > POLL_MAX_OPTION)) return `A poll option is too long (max ${POLL_MAX_OPTION} characters).`;

  const lower = cleaned.map((o) => o.toLowerCase());
  if (new Set(lower).size !== lower.length) return 'Poll options must be unique.';

  return null;
}
