# Profolio brand mark

Render this via the **`<ProfolioLogo>`** component
(`src/components/ProfolioLogo.tsx`) — never import the image directly.

| File | Role |
|---|---|
| `profolio-logo.png` | **The render asset.** 880×349, transparent, 2.52:1. Same official artwork as the master below — transparent margins trimmed and area-downscaled for web/PWA delivery. This is what the component ships. |
| `profoli-logo.png` | The untrimmed master exactly as supplied (1448×1086). Kept for provenance / re-exporting other sizes. Not referenced by code. |

## Still needed (icon-only)

`profolio-logo.png` is the full **lockup** (ribbon "P" + "Profolio" wordmark).
The favicon, PWA manifest icons and Android launcher/splash still use the
previous placeholder mark because an **icon-only rainbow-"P"** asset was not
supplied and cannot be cropped cleanly from the lockup (the ribbon P overlaps
the wordmark's first letter). Drop an icon-only PNG/SVG (ideally 1024² with
maskable safe-area padding) into this folder and those can be migrated too,
along with a `variant="icon"` on `<ProfolioLogo>`.

## Dark backgrounds

The wordmark is dark navy. On dark / photographic surfaces pass
`<ProfolioLogo boxed>` (light rounded card — artwork unchanged). A dedicated
white-wordmark dark variant would remove the card; not supplied yet.
