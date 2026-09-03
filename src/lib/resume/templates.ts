import type { TemplateId, FontId } from './schema';

/**
 * Template catalogue. Every template is an ORIGINAL layout built from our own
 * CSS — no third-party template artwork is copied. A template is a set of
 * layout switches the single parametric <ResumePreview> renderer reads; that
 * keeps the previews, the PDF export, and the thumbnails perfectly in sync.
 */

export interface TemplateDef {
  id: TemplateId;
  name: string;
  blurb: string;
  columns: 1 | 2;
  /** Where the name / contact block lives. */
  header: 'band' | 'plain' | 'sidebar';
  /** Section headings style. */
  heading: 'underline' | 'bar' | 'caps' | 'plain';
  /** Reserve a photo slot in the header/sidebar. */
  photo: boolean;
  /** Default typeface for this template (user can override). */
  font: FontId;
  recommendedFor: string[];
}

export const TEMPLATES: TemplateDef[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    blurb: 'Bold colour header, single column. Reads well on screen and in ATS.',
    columns: 1,
    header: 'band',
    heading: 'plain',
    photo: false,
    font: 'sans',
    recommendedFor: ['Product', 'Design', 'Marketing', 'Early career'],
  },
  {
    id: 'ledger',
    name: 'Ledger',
    blurb: 'Classic, ink-on-paper. Serif headings, ruled section breaks.',
    columns: 1,
    header: 'plain',
    heading: 'underline',
    photo: false,
    font: 'serif',
    recommendedFor: ['Finance', 'Legal', 'Operations', 'Academia'],
  },
  {
    id: 'sidebar',
    name: 'Sidebar',
    blurb: 'Two columns with a tinted rail for skills and contact details.',
    columns: 2,
    header: 'sidebar',
    heading: 'bar',
    photo: true,
    recommendedFor: ['Engineering', 'Data', 'Senior IC'],
    font: 'grotesk',
  },
  {
    id: 'minimal',
    name: 'Minimal',
    blurb: 'Quiet, typographic, generous whitespace. Uppercase section labels.',
    columns: 1,
    header: 'plain',
    heading: 'caps',
    photo: false,
    font: 'sans',
    recommendedFor: ['Consulting', 'Research', 'Writing'],
  },
];

export function getTemplate(id: TemplateId): TemplateDef {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

export const ACCENT_SWATCHES: { label: string; value: string }[] = [
  { label: 'Profolio blue', value: '211 100% 40%' },
  { label: 'Slate', value: '215 25% 27%' },
  { label: 'Teal', value: '178 60% 34%' },
  { label: 'Forest', value: '150 45% 30%' },
  { label: 'Plum', value: '280 40% 42%' },
  { label: 'Burgundy', value: '345 55% 38%' },
  { label: 'Rust', value: '18 70% 45%' },
  { label: 'Graphite', value: '220 10% 25%' },
];

export const FONT_STACKS: Record<FontId, { label: string; stack: string }> = {
  sans: {
    label: 'Sans (Inter-like)',
    stack:
      'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  grotesk: {
    label: 'Grotesk',
    stack:
      '"Segoe UI", "Helvetica Neue", "Arial Nova", Arial, system-ui, sans-serif',
  },
  serif: {
    label: 'Serif',
    stack: 'Georgia, "Times New Roman", "Iowan Old Style", Times, serif',
  },
  mono: {
    label: 'Mono',
    stack:
      '"SFMono-Regular", "JetBrains Mono", "Cascadia Code", Consolas, "Liberation Mono", monospace',
  },
};

export const SCALE_PX: Record<string, { base: number; h1: number; h2: number }> = {
  compact: { base: 12.5, h1: 22, h2: 12.5 },
  normal: { base: 13.5, h1: 26, h2: 13.5 },
  roomy: { base: 15, h1: 30, h2: 15 },
};
