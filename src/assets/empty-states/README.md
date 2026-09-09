# Empty-state illustrations

Flat, Profolio-original artwork used by `@/components/ui/empty-state`
(`<EmptyState illustration={...} />`).

## Conventions

- One file per empty state, kebab-case, named after the surface:
  `certificate-vault.svg`, `saved-posts.svg`, …
- Prefer **SVG** (scales cleanly, tiny, theme-agnostic). If a raster is
  supplied by design, add `certificate-vault.webp` alongside and import that
  instead — keep the aspect ratio ~3:2 and width ≥ 960px for retina.
- No third-party / proprietary artwork (no Google Drive assets, logos, etc.).
- Transparent background. Must read correctly on both light and dark surfaces
  (avoid opaque white plates behind the art).
- Import it, don't inline base64:

  ```ts
  import certVaultArt from '@/assets/empty-states/certificate-vault.svg';
  ```

`certificate-vault.svg` is a hand-authored placeholder that matches the design
mock's composition and palette. Replace it in place with the final supplied
illustration when available — no code change needed.
