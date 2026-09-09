# Profolio brand assets

Render brand marks in the app via **`<ProfolioLogo>`**
(`src/components/ProfolioLogo.tsx`) — never import the images directly.

| File | Role |
|---|---|
| `profolio-logo.png` | **Lockup render asset** (`variant="lockup"`, default). 880×349, transparent. Trim + downscale of `profoli-logo.png`. |
| `profolio-icon.png` | **Icon render asset** (`variant="icon"`). 221×256, transparent. Trim + downscale of `plogo.png`. |
| `profoli-logo.png` | Untrimmed lockup master exactly as supplied (1448×1086). Not referenced by code. |
| `plogo.png` | Untrimmed icon-only master exactly as supplied (1254×1254). Not referenced by code. Source for every favicon / PWA / Android icon below. |

## Generated icon set (do not hand-edit — regenerate from `plogo.png`)

`scripts/gen-icons.cjs` reads `plogo.png` and writes:

**`public/`** — `favicon.ico` (16/32/48), `favicon-16.png`, `favicon-32.png`,
`favicon-48.png`, `apple-touch-icon.png` (180), `pwa-192.png`, `pwa-512.png`
(rounded, white bg, `purpose: any`), `pwa-maskable-192.png`,
`pwa-maskable-512.png` (full-bleed white, "P" inside the 80 % safe circle).

**`android/app/src/main/res/`** — `mipmap-*/ic_launcher.png` +
`ic_launcher_round.png` (legacy pre-API-26, white bg), `mipmap-*/ic_launcher_foreground.png`
(adaptive foreground, transparent, "P" inside the 66 dp safe zone of the 108 dp
canvas — the white background comes from `@color/ic_launcher_background`),
`drawable*/splash.png` (white, centred "P").

Wired up in `index.html` (`<link rel>`), `public/manifest.webmanifest`
(`icons`), `public/sw.js` (precache list; bump `CACHE_VERSION` when changed),
and `mipmap-anydpi-v26/ic_launcher*.xml` (unchanged — already references the
foreground PNG + white background colour).

## Dark backgrounds

The lockup's wordmark is dark navy — on dark / photographic surfaces pass
`<ProfolioLogo boxed>` (light card; artwork unchanged) or use
`<ProfolioLogo variant="icon">` (the full-colour "P" needs no card). A
white-wordmark dark lockup variant is not supplied.
