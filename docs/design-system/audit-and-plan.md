# PROfolio — UI/UX & Design-System Transformation: Audit + Plan

**Status:** Audit complete. Implementation not yet started (awaiting go-ahead on phase order).
**Date:** 2026-09-04
**Scope:** Whole-frontend visual coherence. No backend / RLS / RPC / billing / consent changes.

> **Note on fonts:** the brief says "existing Roboto direction". The codebase does **not** use Roboto — `index.html` loads **Inter** and `tailwind.config.ts` sets `fontFamily.sans: ['Inter', …]`. Roboto only appears inside resume-template and story-text font stacks (intentional, document-level). This plan keeps **Inter** as the app UI face (it is already loaded, configured, and consistent) and treats "Roboto direction" as "keep the current single sans UI face, used consistently".

---

## A. COMPLETE UI INVENTORY

### A.1 Routing / product areas (`src/App.tsx`, ~70 routes)

| Area | Routes (representative) | Notes |
|---|---|---|
| Auth | `/`, `/register`, `/forgot-password`, `/reset-password`, `/mfa-challenge` | Full-bleed rainbow gradient hero; own layout, no `Layout` shell |
| Feed / Home | `/dashboard`, `/add-post`, `/post/:id`, `/saved-posts`, `/feed/preferences` | 3-column feed built ad hoc in `Dashboard.tsx` |
| Profile | `/profile`, `/profile/:userId`, `/company/:id/candidates/:candidateId` | Own vs public vs recruiter views |
| Network | `/network`, `/connect` (messaging) | |
| Notifications | `/notifications` + header `NotificationBell` | |
| Jobs | `/jobs` | list + detail + apply flow in one page |
| Companies | `/companies`, `/companies/new`, `/company/:id`, `/company/:id/candidates` | |
| Groups / Events | `/groups`, `/events` | |
| Insights | `/insights`, `/insights/:slug`, `/…/write`, `/…/:articleSlug`, `/…/edit` | Tiptap editor + article prose |
| Resume | `/resume` | native multi-template builder (recently shipped) |
| Certificates | `/certificates` | vault |
| Settings | `/settings`, `/settings/:category`, ~13 dedicated sub-pages | **already systematised** via `SettingsShell` + `settingsConfig` |
| **Ads Manager (ERP-dense)** | `/ads` + ~22 sub-routes (accounts, campaigns, audiences, ads, review, delivery, analytics, billing) | the data-heavy area; tables, builders, wizards |

### A.2 Layout & navigation components

| Component | Role | Observations |
|---|---|---|
| `src/components/Layout.tsx` | App shell wrapper | Single knob: `fullWidth?: boolean`. Non-fullWidth → `.layout` (`max-w-3xl md:max-w-4xl lg:max-w-5xl`, `px-4 sm:px-6 lg:px-8`). No 2-/3-column primitive. |
| `NavBar.tsx` (229 LOC) | Fixed desktop top bar + mobile header | Brand tile "P", `SearchBar`, 4 primary icon-tabs, "more" dropdown, `NotificationBell`, avatar `DropdownMenu`. Auto-hide on mobile scroll. Live avatar via realtime sub. |
| `BottomNavigation.tsx` | Mobile bottom bar | 4 items + center Create FAB, glass, safe-area padding, auto-hide. |
| `MobileNavDrawer.tsx` | Hamburger secondary nav | |
| `AppSidebar.tsx` | shadcn `<Sidebar>` | Legacy — most pages no longer use it; note in code says the fixed side-rail was replaced by `NavBar`. Still imported somewhere — verify before removal. |
| `FeedRightRail.tsx`, `ProfileSummaryCard.tsx`, `QuickActions.tsx`, `Stories.tsx`, `FloatingCreatePost.tsx` | Feed furniture | |
| `src/components/settings/SettingsShell.tsx` | Settings IA | Good pattern to generalise from. |

### A.3 Shared UI primitives (`src/components/ui/`, shadcn base — 60 files)

Present: `accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, empty-state, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, responsive-modal, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip`.

**Missing / not-yet-shared primitives:** `PageContainer`, `PageHeader`, `Section`, `Stack`/`Inline` (spacing), `LoadingState`, `ErrorState`, `ListItem`, typed `Avatar` sizes, a single `Tabs` style that matches the product.

### A.4 Token layer (`src/index.css`, `tailwind.config.ts`)

- **Colour:** semantic HSL tokens exist — `background, foreground, card, popover, primary, secondary, muted, accent, destructive, success` + full `sidebar-*` set, light + `.dark`. Gaps: no `warning`, no `info`, no `surface-elevated`, no explicit `hover/active/selected/disabled` state tokens, no distinct `divider` (only `border`), `--ring` is just `--primary`.
- **Gradients:** `--gradient-primary`, `--gradient-card`, `--gradient-hero`, `--gradient-glass` (glassmorphism — brief says avoid), `--gradient-create-fab`, `--bg-gradient` (a **fixed full-page background image** on `<body>`).
- **Radius:** one `--radius: 0.5rem` → Tailwind `sm/md/lg`. Reality: `rounded-lg ×185`, `rounded-full ×185`, `rounded-md ×138`, `rounded-xl ×58`, `rounded-2xl ×9`, `rounded-[10px] ×1` (hardcoded in `.post-card`).
- **Elevation:** `--shadow-elegant` **=== `--shadow-card`** (identical value — redundant alias), `--shadow-glow`. Raw `shadow-lg ×22`, `shadow-md ×20`, `shadow-sm ×14`, `shadow-xl/2xl ×8`, plus arbitrary `shadow-[…]`.
- **Spacing:** **no spacing scale tokens.** Only `--feed-card-gap: 9px` and `--nav-height: 3.5rem`.
- **Typography:** **no type-scale tokens.** `.heading-lg/.heading-md/.subtle` component classes (≈3 `.tsx` refs — near-dead) + ad-hoc `text-*` on 17+ pages.
- **Motion:** one `--transition-smooth: all .3s cubic-bezier(.4,0,.2,1)` applied via a `transition-smooth` utility (9 files) + inside Button/Input. `all` + 300 ms is heavy for micro-interactions.
- **Legacy CSS component classes in `index.css`:** `.btn-primary`, `.btn-ghost`, `.fab`, `.navbar/.navbar-inner/.nav-*`, `.avatar`, `.post-card` + ~15 `.post-*`, `.action-btn*`, `.insight-prose*`, `.resume-*`. Mix of load-bearing (`.navbar`, `.post-card`, `.insight-prose`) and near-dead (`.btn-primary`, `.fab`, `.heading-*`).
- **`src/App.css`:** Vite starter cruft (`.logo`, `.read-the-docs`, `logo-spin`), **not imported anywhere**, and it re-declares `#root { overflow-x-hidden }` which `index.css` explicitly warns breaks `position: sticky`. → dead file, safe delete.

### A.5 States

- `EmptyState` primitive exists — **used in only 5 files**; the other ~45 pages hand-roll empty blocks.
- No shared `LoadingState` / `ErrorState`. Loading is a mix of `Skeleton`, ad-hoc `animate-spin` divs (e.g. `SettingsPage`), and `Loader2` spinners.
- To?asts: **two systems mounted at once** in `App.tsx` — `@/components/ui/toaster` (Radix) **and** `@/components/ui/sonner` (Sonner). Call sites use both.

---

## B. CURRENT INCONSISTENCIES (evidence-backed)

| # | Inconsistency | Evidence |
|---|---|---|
| B1 | **Page width** — no shared container | ~40 distinct `max-w-*` values: `max-w-[720px] ×19`, `max-w-6xl ×10`, `max-w-2xl ×10`, `max-w-3xl ×7`, plus one-offs `[1128px] [960px] [880px] [860px] [820px] [760px] [680px] [560px] [520px] [480px] [440px] [425px] [420px] [45vw] [70%]` … |
| B2 | **Button** — two systems, tall default | `ui/button.tsx` default `h-12` (48px; shadcn norm 40px), `sm h-9`, `lg h-14`; `default` variant hard-codes `shadow-elegant`; extra `social` variant. Parallel `.btn-primary`/`.btn-ghost`/`.fab` in `index.css` (pill, gradient, `translateY` hover). |
| B3 | **Radius drift on cards** | `ui/card.tsx` `rounded-lg`; `.post-card` `rounded-[10px]`; pages use `rounded-xl ×58` / `rounded-2xl ×9` directly on card-like divs. |
| B4 | **Elevation drift** | `Card` `shadow-sm`; `.post-card` `--shadow-card`; pages sprinkle `shadow-md/lg/xl/2xl`. `--shadow-elegant` is a duplicate of `--shadow-card`. |
| B5 | **Input** — 3 styles, 2 focus tokens | `ui/input.tsx` `h-12` `focus:ring-primary`; `Button` `focus:ring-ring`; `.nav-search-input` `rounded-full` + bespoke focus shadow. |
| B6 | **Tabs** — two paradigms | shadcn `Tabs` = pill-in-`bg-muted` box (`h-10`, `rounded-md`, active `shadow-sm`). Hand-rolled **underline tabs** (`border-b-2`) in **27 files** (profile, insights, jobs, company…). |
| B7 | **Avatars** — no size system | `ui/avatar.tsx` fixed `h-10 w-10`; call sites override to `h-6/h-8/h-9/h-12/h-16/h-20/h-24`. `.avatar` CSS class is a 4th definition. |
| B8 | **Headings** | `CardTitle` is `text-2xl`; page titles range `text-lg → text-4xl`; `.heading-lg/.heading-md` classes exist but barely used. No scale. |
| B9 | **Dialog width/behaviour** | ~12 distinct widths; several bare `max-w-md` (no `sm:` → not phone-safe); each re-implements `max-h-[…] overflow-y-auto`. |
| B10 | **Empty / loading / error states** | `EmptyState` used 5×; everything else bespoke. No `LoadingState`/`ErrorState`. |
| B11 | **Two toast systems** | Radix `Toaster` + `Sonner` both mounted; inconsistent confirmation UX. |
| B12 | **Dark mode half-built** | `next-themes` `defaultTheme="system"` + a full `.dark` token block, but only ~2 real `dark:` overrides in components → OS-dark users get broken contrast in many custom surfaces. |
| B13 | **Decorative background** | `<body>` carries a `background-attachment: fixed` gradient image on every page; `--gradient-glass` glassmorphism token; login/register full-screen animated float blobs. |
| B14 | **Motion** | single `all .3s` transition token; no standard fast (120–160 ms) interaction timing; `prefers-reduced-motion` handled in some places, not centrally. |
| B15 | **Legacy vs system** | `index.css` `@layer components` holds a parallel component vocabulary (`.btn-*`, `.fab`, `.action-btn`, `.avatar`, `.nav-*`) competing with `ui/`. |

---

## C. DESIGN SYSTEM PROPOSAL — "One PROfolio"

**Principle:** neutral, dense, professional canvas; the PROfolio rainbow is an **accent only** (brand mark, active nav, selected state, progress, focus glow, celebratory moments). Content and actions outrank decoration. Borders + spacing + hierarchy do the work; shadows only float things that genuinely float (menus, popovers, dialogs, FAB).

**Two density modes, one system:**
- **`comfortable`** (default) — social/professional surfaces (feed, profile, network, jobs, messaging, notifications, settings).
- **`compact`** — data-dense surfaces (Ads Manager tables, builders, analytics, candidate search). Same tokens, tighter row height / padding / font-size step, via a `data-density="compact"` scope on a container — **not** a separate theme.

**Delivery rule (brief §24):** fix the **token / primitive / layout / type** layer; let pages inherit. No page-by-page patching for systemic issues.

---

## D. GLOBAL TOKEN PLAN (Phase 1)

All added in `src/index.css` `:root` (+ `.dark`) and surfaced through `tailwind.config.ts`. **Additive** — existing tokens keep working; nothing renamed in Phase 1.

### D.1 Colour — add semantic + state tokens
```
--surface            = card                     /* base raised surface */
--surface-sunken     = 225 15% 94%              /* wells, code, table stripes */
--surface-elevated   = 0 0% 100%                /* menus/dialogs (with shadow) */
--divider            = 217 16% 92%              /* lighter than --border */
--hover              = 210 16% 96%              /* neutral row/control hover */
--active             = 210 16% 93%
--selected           = 206 100% 96%             /* tint of primary */
--selected-foreground= primary
--warning            = 35 92% 45%
--warning-foreground = 0 0% 100%
--info               = 211 100% 40%
--info-foreground    = 0 0% 100%
--focus              = 211 100% 45%             /* == ring; single source */
```
Dark-mode counterparts defined in the same commit. `--ring` re-pointed to `--focus`.

### D.2 Radius — collapse to 4 steps
```
--radius-sm: 6px    /* chips, badges, small controls */
--radius-md: 8px    /* buttons, inputs, menus  (== current --radius) */
--radius-lg: 12px   /* cards, dialogs, sheets */
--radius-full: 9999px
```
Tailwind: `rounded-sm|md|lg|xl` remapped so `xl → --radius-lg` (kills the `xl` vs `lg` vs `2xl` card drift without touching markup). `rounded-2xl` usages migrated to `rounded-xl` in Phase 4/5. `.post-card` `rounded-[10px]` → `rounded-lg` token.

### D.3 Elevation — 3 steps, menus/dialogs/FAB only
```
--elevation-0: none                                  /* default content: border only */
--elevation-1: 0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)   /* dropdown, popover, hover-lift */
--elevation-2: 0 8px 24px rgba(16,24,40,.12)         /* dialog, sheet, command palette */
```
`--shadow-card`/`--shadow-elegant` kept as **aliases → `--elevation-0`** (i.e. become `border`-only) so 129 `shadow-card` call sites flatten automatically; opt-in lift is `shadow-[--elevation-1]` via a `shadow-e1` utility. `--shadow-glow` retained for focus/brand moments only.

### D.4 Spacing — expose the 4px scale as semantics
Tailwind's 4px scale stays; add **named layout tokens** so pages stop inventing values:
```
--space-page-x-mobile: 16px
--space-page-x-desktop: 24px
--space-section: 24px       /* gap between page sections */
--space-card: 16px          /* card inner padding (comfortable) */
--space-card-compact: 12px
--space-field: 12px         /* form control vertical rhythm */
--gutter: 24px              /* column gap in multi-col layouts */
--feed-card-gap stays (9px)
```

### D.5 Typography — one scale (utility classes, `@layer components`)
| Token | Size / line-height / weight | Use |
|---|---|---|
| `text-display` | 30/36, 700 | marketing / empty-hero |
| `text-title` | 22/28, 600 | page title |
| `text-section` | 18/24, 600 | section header |
| `text-card-title` | 15/20, 600 | card / list-item title |
| `text-body` | 14/20, 400 | default |
| `text-body-strong` | 14/20, 600 | |
| `text-small` | 13/18, 400 | secondary |
| `text-caption` | 12/16, 400 | metadata / timestamps |
| `text-label` | 12/16, 600, tracking-wide, uppercase optional | form labels, overlines |
`CardTitle` default drops `text-2xl` → `text-card-title`. `compact` mode shifts body→13, card-title→14.

### D.6 Motion
```
--motion-fast: 120ms      /* hover, press, checkbox */
--motion-base: 180ms      /* menus, tabs, toggles */
--motion-slow: 240ms      /* dialog/sheet enter, mobile header hide */
--motion-ease: cubic-bezier(.2,0,0,1)
```
`--transition-smooth` kept as alias → `--motion-base`. All wrapped in a global `@media (prefers-reduced-motion: reduce) { *,*::before,*::after { transition-duration:.01ms!important; animation-duration:.01ms!important } }`.

### D.7 Brand / rainbow policy
- Keep `--gradient-hero` for auth screens + the "P" mark + one profile-cover default.
- **Retire** `--gradient-glass` (glassmorphism) and the `background-attachment: fixed` body gradient → flat `--background`.
- Rainbow accent allowed on: brand mark, active nav indicator, selected tab underline, `Progress`, profile-strength ring, focus ring glow, celebratory toasts/badges. Nowhere else.

---

## E. SHARED COMPONENT PLAN

### E.1 Layout primitives (new — `src/components/layout/`)
| Primitive | API | Replaces |
|---|---|---|
| `AppShell` | wraps `NavBar` + main + `BottomNavigation` (absorbs today's `Layout`) | `Layout` (kept as thin re-export for 48 call sites) |
| `PageContainer` | `width: 'feed' \| 'standard' \| 'narrow' \| 'wide' \| 'full'` → one canonical max-width + page gutters each | ~40 `max-w-*` literals |
| `PageHeader` | `title`, `description?`, `actions?`, `back?`, `tabs?` — one sticky header pattern | bespoke settings/ads/profile headers |
| `Section` | titled block, standard `--space-section` rhythm, optional `as="card"` | ad-hoc `<div className="space-y-…">` |
| `TwoColumn` / `ThreeColumn` | feed & profile layouts, right-rail collapse rules baked in | `Dashboard.tsx` inline grid |

`width` map: `feed` 555 / `standard` 704 / `narrow` 560 / `wide` 1128 / `full` none — mirrors LinkedIn's column math, expressed once.

### E.2 Control primitives (revise existing shadcn — no new libs)
- **Button:** default `h-10`, `sm h-8`, `lg h-11`, `icon h-10 w-10`, `xs h-7` (compact). Remove `shadow-elegant` from `default`. Keep variants `default/secondary/outline/ghost/destructive/link`; fold `social` into `outline`. Add `loading` prop (spinner + `aria-busy`, disables). Retire `.btn-primary/.btn-ghost`.
- **Input / Textarea / Select:** unify `h-10`, `rounded-md`, `focus-visible:ring-2 ring-[--focus] ring-offset-2`, shared error/disabled. `.nav-search-input` → `SearchInput` primitive (rounded-full is fine as a `SearchInput` variant, not a bespoke class).
- **Card / Surface:** `Surface` (border-only, `--radius-lg`, `--space-card`, no shadow) as the default; `Card` re-based on `Surface`; `elevated` prop → `--elevation-1`. `CardTitle` → `text-card-title`.
- **Tabs:** make the **underline** style the default `Tabs` look (active = 2px `--primary` indicator, horizontal-scroll on overflow, `role=tablist` intact); keep the pill style as `<Tabs variant="segmented">` for filter toggles. Migrate the 27 hand-rolled `border-b-2` tab bars.
- **Avatar:** `size: 'xs'(24) | 'sm'(32) | 'md'(40) | 'lg'(56) | 'xl'(96)`, built-in fallback initials, `presence` + `verified` slots. Retire `.avatar` class.
- **Dialog / Sheet:** `Dialog` `size: 'sm'(420) | 'md'(560) | 'lg'(720) | 'xl'(920)`, always `sm:` responsive, built-in `max-h` + scroll region, standard header/footer slots. On `< md`, `Dialog` auto-routes to a bottom `Sheet` (via existing `responsive-modal`/`drawer`). One dismiss behaviour.
- **List / ListItem:** `ListItem` = leading (avatar/icon) · title + metadata · trailing (action) · consistent height (`comfortable` 64 / `compact` 44), hover/selected/disabled, optional divider. Powers network cards, notifications, messaging list, search results, saved items.

### E.3 State primitives (new)
- `LoadingState` — `variant: 'skeleton' | 'spinner'`, `rows?`, matches the surface it replaces.
- `ErrorState` — icon + message + `retry` action; used by route error boundaries + query error branches.
- `EmptyState` — already good; add `size` (`inline` | `page`) and adopt everywhere (replace the ~45 hand-rolled blocks in Phase 5–7).
- **Toasts:** pick **Sonner** as the single system (lighter, better stacking); remove Radix `Toaster` from `App.tsx`; codemod `useToast()` call sites to a thin `toast()` wrapper keeping the same signature.

### E.4 Density
`data-density="compact"` scope (set by `PageContainer width="wide"` on ERP routes, or explicitly) → CSS custom-property overrides for row height, card padding, font step. No component forks.

---

## F. LAYOUT / NAVIGATION PLAN

- **Desktop nav:** keep `NavBar` structure; normalise to `--nav-height` (56), token type, `--space-*` gutters, active state = rainbow underline + `--selected` icon, hover = `--hover`. Single centred content rail `1128px` max, `24px` gutters. Right rail present ≥ `xl`, hidden below.
- **Mobile nav:** keep `BottomNavigation` + auto-hide + Create FAB + safe-area handling (already solid). Standardise touch targets ≥ 44px (mostly done), badge style, and the header→sticky/`env(safe-area-inset-top)` behaviour (already done — document it as the canonical PWA pattern, don't reinvent).
- **PWA:** preserve `viewport-fit=cover`, `theme-color` pair, `manifest`, SW registration, `env(safe-area-inset-*)` insets, transparent Android nav handled by the bar's own translucent padding. **No fake nav UI.** No changes to `sw.js` / `manifest.webmanifest`.
- **Page headers:** every route renders `PageHeader` (or intentionally opts out for full-bleed feed). Kills per-page header drift.
- **`AppSidebar` / `ui/sidebar.tsx`:** audit remaining imports; if only Ads Manager uses it, keep it scoped there; otherwise retire.

---

## G. RESPONSIVE PLAN

Breakpoints reviewed at **375 / 390 / 430 / 549 / 768 / 1024 / 1280 / 1440**. Intentional behaviour per pattern:

| Pattern | < 768 | 768–1023 | ≥ 1024 | ≥ 1280 |
|---|---|---|---|---|
| Feed | 1 col, edge-to-edge cards (current `.post-card` full-bleed — keep) | 1 col, contained | 2 col (feed + left) | 3 col (+ right rail) |
| Profile | stacked, cover 33vh | stacked | 2 col (main + side) | 2 col wider |
| Jobs | list → detail as full-screen push | list + detail split | split | split |
| Ads tables | horizontal scroll inside `overflow-x-auto`, sticky first col | same | full table | full table + filters rail |
| Dialogs | bottom `Sheet` | centred `Dialog` | centred | centred |
| Tabs overflow | horizontal scroll, no wrap | scroll | full | full |
| Filters | `Sheet` triggered by "Filters" button | inline collapsible | inline | inline |
| Right rail | hidden | hidden | hidden | shown |

Rule: mobile layouts are **designed** (what collapses / drawers / scrolls), not scaled-down desktop.

---

## H. PAGE-BY-PAGE PRIORITY

| Tier | Pages | Why first |
|---|---|---|
| **0 — system** | tokens, `tailwind.config`, typography layer, motion, `index.css` cleanup | everything inherits |
| **1 — shell** | `AppShell`, `PageContainer`, `PageHeader`, `Section`, `NavBar`, `BottomNavigation` | every page sits in these |
| **2 — primitives** | Button, Input/Select/Textarea, Card/Surface, Tabs, Avatar, Dialog/Sheet, List/ListItem, Loading/Error/Empty, toast unification | highest reuse |
| **3 — core social** | Dashboard/Feed, `PostCard`/`PostInput`/`ReactionBar`/comments, Profile (+ public/recruiter), Network, Connect (messaging), Notifications | most-used, most-seen |
| **4 — career/business** | Jobs, Companies, Company profile, Groups, Events, Insights (list/detail/article/editor) | shared card/list/tab language |
| **5 — settings + specialised** | `SettingsShell` polish, Resume builder, Certificates, auth screens | settings already structured; light touch |
| **6 — ERP** | Ads Manager: dashboard, tables, campaign/audience/ad builders, review, analytics, billing | apply `compact` density within the same system |
| **7 — QA** | full route sweep, old-pattern grep + removal | close visual drift |

---

## I. LINKEDIN REFERENCE FINDINGS (principles, not pixels)

From studying the live product (desktop + mobile web):

1. **One 1128px centred rail** across every area; feed column ≈ 555, side ≈ 300, gutter 24. Width never changes between Feed / Network / Jobs / Company.
2. **Border-first surfaces.** Cards are white with a 1px `#e0e0e0`-ish border and `~8px` radius; shadow appears **only** on hover-lift, dropdowns, and modals. Very little elevation.
3. **Dense type.** Body 14/1.4, secondary 12, names 600. Generous vertical padding, tight horizontal. Metadata is muted grey, never coloured.
4. **Underline tabs** everywhere (profile, notifications, jobs, company) — active = 2px brand underline, not a pill; horizontal-scroll on mobile.
5. **List rows are the workhorse.** Avatar 48–56 · title + 1–2 metadata lines · single trailing action. Same row anatomy in search, network, notifications, messaging.
6. **Global nav is immovable.** 52px bar, icon+label tabs, active = filled icon + underline; identical on every page. Secondary actions live in a "Me"/"Work" dropdown, never in page chrome.
7. **Mobile = bottom tab bar** (Home / Network / Post / Notifications / Jobs), full-bleed feed cards, filters and secondary flows as bottom sheets.
8. **Restrained colour.** Brand blue for primary action + links + active state; green for "open to work"/success; everything else greyscale. No gradients in-product.
9. **States are systematic.** Every empty state = small illustration/icon + one line + one CTA; skeletons match final layout; errors offer retry.
10. **Motion is 120–200ms**, ease-out, opacity/transform only; respects reduced-motion.

**PROfolio keeps its identity by:** rainbow brand mark + rainbow *accents* (active underline, progress, focus, celebration) on top of this neutral, dense, border-first structure — where LinkedIn is monochrome-blue, PROfolio is monochrome + a controlled spectrum accent.

---

## J. PROfolio BRAND DIRECTION

- **Canvas:** `--background` flat light grey (`#f2f3f5`), white bordered surfaces, `--foreground` near-black, muted grey metadata. Dark mode reaches parity (Phase 1 finishes the `.dark` set + Phase 4 adds the missing `dark:` overrides on custom surfaces).
- **Accent:** PROfolio spectrum used deliberately — brand "P", active nav underline, selected tab, `Progress`, profile-strength ring, focus glow, success/celebration moments. Primary buttons are **solid `--primary` blue**, not gradient (gradient reserved for brand moments + FAB).
- **Type:** Inter, one scale (D.5), 600 for titles/names, 400 body.
- **Feel:** premium, quiet, fast, dense-but-readable. No glass, no fixed background art, no float-blobs outside auth.

---

## K. IMPLEMENTATION PHASES (with QA gate after each)

QA gate = `npx tsc --noEmit` · `npx eslint` (no *new* errors) · `npx vite build` · browser sweep of affected routes at mobile **and** desktop · spot-check that auth/routing/queries/posts/messaging/jobs/settings/consent still work.

| Phase | Content | Risk |
|---|---|---|
| **1. Tokens** | Add colour/state/radius/elevation/spacing/motion tokens + reduced-motion guard; alias legacy tokens; flatten `--shadow-card`→border; retire glass + body gradient; delete `src/App.css`. `tailwind.config` remaps radius. | Low (additive + alias) — visual: shadows soften globally |
| **2. Typography** | Type-scale utility classes; re-base `CardTitle`; sweep `.heading-*`. | Low |
| **3. Shell / nav / layout** | `AppShell`, `PageContainer`, `PageHeader`, `Section`, `TwoColumn/ThreeColumn`; normalise `NavBar` + `BottomNavigation` to tokens; `Layout` becomes re-export. | Med — every page renders through it |
| **4. Primitives** | Button, Input/Select/Textarea, Card/Surface, Tabs (underline default), Avatar sizes, Dialog/Sheet sizes + mobile routing, List/ListItem, Loading/Error/Empty, Sonner-only toasts. | Med–High — wide blast radius; codemods + call-site review |
| **5. Core social** | Feed, PostCard & interactions, Profile (+public/recruiter), Network, Messaging, Notifications → adopt primitives + `PageContainer(feed/standard)` + shared states. | Med |
| **6. Career/business** | Jobs, Companies, Company profile, Groups, Events, Insights. | Med |
| **7. Settings + specialised** | `SettingsShell` visual polish, Resume, Certificates, auth. **Advertising Data: presentation only** — no config/consent/audit/RLS/RPC/billing changes. | Low–Med |
| **8. ERP density** | Ads Manager under `compact` density: `Table` primitive, filter rail/sheet, builder steppers, analytics cards, billing. | Med |
| **9. Mobile / PWA refinement** | Full breakpoint pass 375→1440; safe-area, sheets, touch targets, keyboard; confirm SW/manifest untouched. | Med |
| **10. Consistency audit** | Route-by-route visual QA; grep + remove obsolete patterns (`btn-primary`, stray `rounded-2xl`, `shadow-2xl`, bare-`max-w` dialogs, hand-rolled tab bars); a11y focus-visible sweep. | Low |

**Do not begin Phase 5 while 1–4 are incomplete.**

---

## L. RISK / REGRESSION AREAS

| Area | Risk | Mitigation |
|---|---|---|
| `position: sticky` rails | `index.css` has hard-won sticky fixes (html-only `overflow-x-hidden`, no `#root` overflow). | Don't add `overflow` to shell wrappers; keep the documented comments; re-test dashboard rails each phase. |
| PWA safe-area / auto-hide header | Sophisticated existing behaviour in `.navbar` media query + `BottomNavigation`. | Treat as canonical; refactor to tokens **without** changing the mechanics; test installed PWA on Android. |
| `.post-card` full-bleed mobile | `calc(50% - 50vw)` break-out is deliberate LinkedIn-style. | Preserve; only swap radius/border/shadow to tokens. |
| Two toast systems | Removing Radix `Toaster` could drop notifications if a call site imports it directly. | Grep all `useToast`/`toast` imports; wrapper keeps signature; verify each surface. |
| Dark mode | Finishing `.dark` may expose pages that assumed light. | Phase 1 tokens only; Phase 4/5 add `dark:` on custom surfaces; visual QA in both schemes. |
| `Button` height 48→40 | Vertical rhythm shifts app-wide; some layouts may have hard-coded sibling heights. | Phase 4 with full browser sweep; check forms, nav, toolbars. |
| Dialog→Sheet auto-routing on mobile | Behaviour change for ~40 dialogs. | Opt-in per dialog initially; default-on after Phase 4 QA. |
| Insights Tiptap / Resume / Stories editors | Bespoke `.prose`/`.resume-rt`/story CSS. | Out of restyle scope beyond token substitution; leave editor internals alone. |
| Ads Manager | Financial/consent-adjacent; dense. | Phase 8, presentation only; **zero** logic/schema/RPC/RLS/billing edits. |
| ERP tables horizontal scroll | Must not cause body horizontal scroll (breaks the html overflow guard). | Scroll strictly inside `overflow-x-auto` containers. |

---

## M. FILES THAT WILL BE MODIFIED (by phase)

- **Phase 1:** `src/index.css`, `tailwind.config.ts`; **delete** `src/App.css`.
- **Phase 2:** `src/index.css` (type layer), `src/components/ui/card.tsx`; grep-sweep `.heading-lg/.heading-md/.subtle` call sites.
- **Phase 3:** new `src/components/layout/{AppShell,PageContainer,PageHeader,Section,TwoColumn,ThreeColumn}.tsx`; `src/components/Layout.tsx` (→ re-export), `NavBar.tsx`, `BottomNavigation.tsx`, `MobileNavDrawer.tsx`; `src/pages/Dashboard.tsx` (column primitives).
- **Phase 4:** `src/components/ui/{button,input,textarea,select,card,tabs,avatar,dialog,sheet,badge}.tsx`; new `src/components/ui/{surface,list-item,loading-state,error-state}.tsx`; `src/components/ui/{toaster,sonner}.tsx` + `src/App.tsx` (toast unification); `src/hooks/use-toast.ts` (wrapper).
- **Phase 5:** `src/components/{Feed,PostCard,PostInput,PostText,ReactionBar,RepostButton,FeedRightRail,ProfileSummaryCard,Stories}.tsx`, `src/components/comments/**`, `src/components/post/**`, `src/components/profile/**`, `src/components/network/**`, `src/components/connect/**`; `src/pages/{Profile,PublicProfile,RecruiterCandidateProfile,Network,Connect,Notifications,SavedPosts,PostDetail}.tsx`.
- **Phase 6:** `src/pages/{Jobs,Companies,CreateCompany,CompanyProfile,CandidateSearch,Groups,Events}.tsx`, `src/components/jobs/**`, `src/components/insights/**`, `src/pages/insights/**`.
- **Phase 7:** `src/components/settings/**`, `src/pages/settings/**` (visual only), `src/components/resume/**`, `src/pages/Resume.tsx`, `src/components/CertificateVault.tsx`, `src/pages/Certificates.tsx`, `src/components/Login.tsx`, `src/pages/{Index,Register,ForgotPassword,ResetPassword,MfaChallenge}.tsx`.
- **Phase 8:** `src/pages/ads/**`, `src/components/ads/**`, new `src/components/ui/data-table.tsx`.
- **Phase 9:** responsive tuning across the above; no new files expected.
- **Phase 10:** cleanup edits only.

## N. FILES / AREAS THAT MUST NOT BE TOUCHED

- **DB / server:** `supabase/**` (migrations, functions, RLS, RPCs) — **none**.
- **Advertising Data logic:** `src/config/advertisingDataConfig.ts`, `src/hooks/useAdvertisingDataSettings.ts`, `src/pages/settings/AdvertisingDataDetailPage.tsx` behaviour, `src/lib/advertisingDataSummary.ts`, consent/audit paths, `src/lib/mySettings.ts`, `update_my_preferences_patch` / `get_my_consent_history` / `consent_audit_log`. Presentation may be aligned only if it needs **zero** behavioural change; otherwise leave as-is.
- **Billing / ads infra:** `src/lib/ads/{billing,payments,spend,analytics}.ts`, `ad_provider_config`, Stripe, `supabase/functions/ad-billing-*`, K-phase migrations.
- **Auth / security flows:** `RequireAal2.tsx`, `MfaChallenge`, `src/integrations/supabase/client.ts`, `src/lib/secure-upload.ts`, `rate-limiter.ts`.
- **PWA runtime:** `public/sw.js`, `public/manifest.webmanifest`, service-worker registration in `main.tsx` (meta tags in `index.html` may only be touched if a token value changes, e.g. `theme-color`).
- **Data/query hooks & lib logic:** everything in `src/hooks/**` and `src/lib/**` that isn't purely presentational (no changes to `use-comments`, `use-post-reposts`, `network/**`, `jobRecommendations`, `postAggregation`, `commentRanking`, etc.).
- **Editor internals:** Tiptap config, `resume/templates.ts`, `stories/constants.ts` font/style data.
- `src/integrations/supabase/types.ts` — no edits for this work.

---

## Acceptance mapping (brief §35)

Every checkbox in the brief maps to a phase: tokens/type/spacing/width → 1–3; nav → 3; buttons/inputs/cards/tabs/avatars/icons/dialogs/lists → 4; empty/loading/error → 4 + adoption 5–7; desktop/mobile consistency → 5–9; PWA preserved → 3 + 9 (no SW/manifest edits); a11y → 4 + 10; performance → 1 (flatten shadows, drop fixed bg, `all`→scoped transitions) + ongoing; branding distinct → J; LinkedIn reference-only → I; no backend/ads/billing changes → N.
