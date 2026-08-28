/**
 * Mentions are stored inside `comments.content` as the token
 *     @[Display Name](<profile-uuid>)
 * The uuid is what reliably identifies the mentioned user (names change).
 * The DB trigger `notify_comment_mentions` parses the same token to send
 * `comment_mention` notifications. These helpers parse/format it on the client.
 */

// Global + capture groups: 1 = display name, 2 = profile uuid.
export const MENTION_TOKEN_RE = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/g;

// While typing: "@" that starts a word, followed by up to 40 name chars
// (no spaces -- the query is a single token; a space ends it), anchored to the
// caret. Disallowing spaces also means an already-inserted "@Full Name " can
// never re-open the picker on the next keystroke.
export const MENTION_TYPING_RE = /(^|[\s(])@([\p{L}\p{N}\p{M}._-]{0,40})$/u;

const URL_RE = /(https?:\/\/[^\s<]+)/g;

export type CommentSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; name: string; profileId: string }
  | { type: 'link'; href: string; text: string };

/** Display name normalised for use in a mention: no bracket/paren chars that
 *  would break the token grammar, trimmed, non-empty. */
export function normalizeMentionName(name: string): string {
  return name.replace(/[[\]()]/g, '').trim() || 'User';
}

export function buildMentionToken(name: string, profileId: string): string {
  return `@[${normalizeMentionName(name)}](${profileId})`;
}

/** "@[Jane Doe](uuid) hi" -> "@Jane Doe hi" (for previews, edit box, search text). */
export function mentionToPlainText(raw: string): string {
  return raw.replace(MENTION_TOKEN_RE, (_m, name) => `@${name}`);
}

/** Distinct profile ids mentioned in the text. */
export function extractMentionIds(raw: string): string[] {
  const ids = new Set<string>();
  for (const m of raw.matchAll(MENTION_TOKEN_RE)) ids.add(m[2]);
  return [...ids];
}

export interface EditableMention {
  name: string;
  profileId: string;
}

export interface ParsedForEditing {
  /** editor-facing text: every `@[Name](uuid)` collapsed to `@Name` */
  text: string;
  /** the {name, profileId} pairs, in document order, needed to re-serialize */
  mentions: EditableMention[];
}

const isWordChar = (ch: string | undefined): boolean =>
  ch !== undefined && /[\p{L}\p{N}]/u.test(ch);

/**
 * DB canonical -> editor representation. The user edits `Hello @Anmol Anubhav!`
 * and never sees the uuid; the returned `mentions` array carries the identities
 * so `serializeEditedContent` can put the tokens back.
 */
export function parseForEditing(raw: string): ParsedForEditing {
  const mentions: EditableMention[] = [];
  const text = raw.replace(MENTION_TOKEN_RE, (_m, rawName: string, profileId: string) => {
    // Normalise the name the same way buildMentionToken() does, so a
    // round-trip (parse -> serialize) of clean content is byte-identical.
    const name = normalizeMentionName(rawName);
    mentions.push({ name, profileId });
    return `@${name}`;
  });
  return { text, mentions };
}

/**
 * Editor representation -> DB canonical. Each known mention consumes the
 * earliest still-plain `@<name>` occurrence whose following character is a
 * non-word boundary (end / space / punctuation), rewriting it to
 * `@[name](uuid)`. When several known names could match at the same `@`, the
 * longest wins (so "@Anmol Anubhav" is not shortened to "@Anmol"). A mention
 * the user deleted never matches and is simply dropped. Plain text that merely
 * resembles a name is left untouched.
 */
export function serializeEditedContent(text: string, mentions: EditableMention[]): string {
  const pool = mentions.map((m) => ({ ...m, used: false }));
  let out = '';
  let i = 0;

  while (i < text.length) {
    const at = text.indexOf('@', i);
    if (at === -1) {
      out += text.slice(i);
      break;
    }
    out += text.slice(i, at);

    const candidates = pool.filter(
      (m) =>
        !m.used &&
        text.startsWith(`@${m.name}`, at) &&
        !isWordChar(text[at + 1 + m.name.length]),
    );
    candidates.sort((a, b) => b.name.length - a.name.length);
    const picked = candidates[0];

    if (picked) {
      picked.used = true;
      out += buildMentionToken(picked.name, picked.profileId);
      i = at + 1 + picked.name.length;
    } else {
      out += '@';
      i = at + 1;
    }
  }

  return out;
}

/**
 * Split raw content into renderable segments: mention chips, autolinked URLs,
 * and plain text (which the caller renders with whitespace preserved).
 */
export function parseCommentContent(raw: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let lastIndex = 0;
  MENTION_TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  const pushText = (text: string) => {
    if (!text) return;
    let idx = 0;
    text.replace(URL_RE, (url, _g, offset: number) => {
      if (offset > idx) segments.push({ type: 'text', text: text.slice(idx, offset) });
      segments.push({ type: 'link', href: url, text: url });
      idx = offset + url.length;
      return url;
    });
    if (idx < text.length) segments.push({ type: 'text', text: text.slice(idx) });
  };

  while ((match = MENTION_TOKEN_RE.exec(raw)) !== null) {
    if (match.index > lastIndex) pushText(raw.slice(lastIndex, match.index));
    segments.push({ type: 'mention', name: match[1], profileId: match[2] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < raw.length) pushText(raw.slice(lastIndex));
  return segments;
}
