// Shared CTA (call-to-action) constants and validation for company posts.
// Kept as its own small module so the composer, the edit dialog, and the
// post renderer all agree on exactly the same label list and URL rules --
// one source of truth instead of three copies that could drift.

export const CTA_LABELS = [
  'Sign In',
  'Register',
  'Get Started',
  'Learn More',
  'Apply Now',
  'Visit Website',
  'Contact Us',
  'Shop Now',
  'Book Now',
  'Download',
  'Subscribe',
] as const;

export type CtaLabel = typeof CTA_LABELS[number];

export interface CtaConfig {
  cta_enabled: boolean;
  cta_label: string | null;
  cta_url: string | null;
  cta_open_new_tab: boolean;
}

export const EMPTY_CTA: CtaConfig = {
  cta_enabled: false,
  cta_label: null,
  cta_url: null,
  cta_open_new_tab: true,
};

/**
 * A CTA destination must be an absolute http(s) URL -- this is the only
 * scheme ever rendered as a real `href`, so `javascript:`, `data:`, and
 * every other scheme are rejected outright, and the raw string is never
 * passed through dangerouslySetInnerHTML anywhere in this feature.
 */
export function validateCtaUrl(url: string): { valid: true; normalized: string } | { valid: false; error: string } {
  const trimmed = url.trim();
  if (!trimmed) return { valid: false, error: 'Enter a destination URL.' };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Enter a valid URL, e.g. https://example.com' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, error: 'The URL must start with https:// or http://' };
  }

  return { valid: true, normalized: parsed.toString() };
}

export function isCtaLabel(value: string): value is CtaLabel {
  return (CTA_LABELS as readonly string[]).includes(value);
}
