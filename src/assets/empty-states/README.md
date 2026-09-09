# Empty-state illustrations

Flat, Profolio-original artwork used by `@/components/ui/empty-state`
(`<EmptyState illustration={...} />`).

## Conventions

- One file per empty state, kebab-case, named after the surface:
  `certificate-vault.png`, `saved-posts.png`, …
- Aspect ratio ~3:2, width ≥ 960px so it stays crisp at the largest
  render size (440px @2x). SVG is also fine when the art is simple.
- No third-party / proprietary artwork (no Google Drive assets, logos, etc.).
- Transparent background. Must read correctly on both light and dark surfaces
  (avoid opaque plates behind the art).
- Import it, don't inline base64:

  ```ts
  import certVaultArt from '@/assets/empty-states/certificate-vault.png';
  ```

`certificate-vault.png` is the original Profolio Certificate Vault
illustration (1536×1024, transparent).
