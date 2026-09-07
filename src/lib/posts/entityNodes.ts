/**
 * Phase 6A — the two entity nodes for the post composer.
 *
 * Both are built on `@tiptap/extension-mention` (atomic inline nodes + a
 * suggestion plugin), so a raw "@" or "#" keystroke is just text: an entity
 * only exists once the user picks a result from the popup.
 *
 *   mention  -> attrs { id: <profile uuid>, label: <display name> }
 *               renders <span data-type="mention" data-id data-label>@Name</span>
 *   hashtag  -> attrs { tag: <normalized>, label: <as typed> }
 *               renders <span data-type="hashtag" data-tag>#tag</span>
 *
 * The server (sync_post_entities trigger) is the source of truth for
 * post_mentions / post_hashtags — these attrs are only a hint.
 */
import Mention from '@tiptap/extension-mention';
import { PluginKey } from '@tiptap/pm/state';
import { mergeAttributes } from '@tiptap/core';

// The editor supplies these; the read-only renderer supplies nothing and the
// `allow: () => false` default below keeps the suggestion plugin inert.
export interface MentionSuggestionConfig {
  char: string;
  pluginKey: PluginKey;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items?: (props: { query: string }) => any[] | Promise<any[]>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render?: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allow?: (props: any) => boolean;
}

export const MENTION_PLUGIN_KEY = new PluginKey('postMentionSuggestion');
export const HASHTAG_PLUGIN_KEY = new PluginKey('postHashtagSuggestion');

export const MentionNode = Mention.extend({
  name: 'mention',
  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: { class: 'post-mention', 'data-type': 'mention' },
      deleteTriggerWithBackspace: true,
      renderText: ({ node }: { node: { attrs: Record<string, unknown> } }) =>
        `@${(node.attrs.label as string) ?? (node.attrs.id as string) ?? ''}`,
      suggestion: {
        char: '@',
        pluginKey: MENTION_PLUGIN_KEY,
        allow: () => false,
      },
    };
  },
});

export const HashtagNode = Mention.extend({
  name: 'hashtag',
  addOptions() {
    return {
      ...this.parent?.(),
      HTMLAttributes: { class: 'post-hashtag', 'data-type': 'hashtag' },
      deleteTriggerWithBackspace: true,
      renderText: ({ node }: { node: { attrs: Record<string, unknown> } }) =>
        `#${(node.attrs.tag as string) ?? (node.attrs.label as string) ?? ''}`,
      suggestion: {
        char: '#',
        pluginKey: HASHTAG_PLUGIN_KEY,
        allow: () => false,
      },
    };
  },
  addAttributes() {
    return {
      tag: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-tag'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.tag ? { 'data-tag': attrs.tag } : {},
      },
      label: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-label'),
        renderHTML: (attrs: Record<string, unknown>) =>
          attrs.label ? { 'data-label': attrs.label } : {},
      },
    };
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes),
      `#${(node.attrs.tag as string) ?? (node.attrs.label as string) ?? ''}`,
    ];
  },
  parseHTML() {
    return [{ tag: 'span[data-type="hashtag"]' }];
  },
});
