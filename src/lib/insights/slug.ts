/** URL-safe slug from a title, plus a short random suffix for uniqueness. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** e.g. "culture-and-values-k3f9a1" */
export function makeSlug(title: string): string {
  const base = slugify(title) || 'insight';
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
}
