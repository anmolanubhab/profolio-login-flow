# Android Native Shell — Live‑Web Architecture

> **Status:** implemented in code; **ON‑DEVICE VERIFICATION: UNVERIFIED**
> (the installed‑APK round‑trip must be run on a physical device — see
> [§15 Verification procedure](#15-verification-procedure)).

---

## 1. Current architecture (before this change)

| Aspect | Before |
| --- | --- |
| Wrapper | Capacitor 8.5.1 (`@capacitor/android`, `@capacitor/core`), `MainActivity extends BridgeActivity` |
| `capacitor.config.ts` | `webDir: 'dist'`, **no `server` block** |
| What the WebView loaded | The Vite `dist/` build **copied into the APK** at `android/app/src/main/assets/public/`, served from the Capacitor local origin `https://localhost` |
| React bundled in APK? | **Yes** — full `dist/assets/*.js|*.css` (~3 MB) shipped inside the APK |
| Loads a remote URL? | **No** |
| Consequence | A normal React/CSS change required `vite build` → `npx cap sync android` → **new APK build + reinstall**. The shipped APK was frozen on whatever `dist/` existed when it was built. |
| Capacitor plugins | none (`capacitor.plugins.json` = `[]`) |
| Service worker | `public/sw.js` (`CACHE_VERSION='v1'`), registered only in prod, network‑first navigations |

## 2. New architecture (after this change)

```
Android APK
   └─ Capacitor WebView (BridgeActivity)
        └─ server.url  →  https://profolio-login-flow.vercel.app/   (HTTPS, live)
             └─ React / Vite production app  (served by Vercel)
                  └─ Supabase  (same project: auth, DB, Storage, Edge Functions)
```

* The WebView navigates straight to the **live production URL** on launch.
* The React bundle is **no longer packaged** in the APK. `android/app/src/main/assets/public/` now contains only a ~700‑byte placeholder `index.html` (+ Capacitor's own `cordova.js` shims) — **4 KB total**, never rendered.
* The WebView's document origin **is** `https://profolio-login-flow.vercel.app` — identical to the Chrome PWA — so the service worker, Supabase auth, React Router and hashed assets all behave exactly as they do in a browser.

**Result:** after one final APK rebuild/reinstall, a React/TS/CSS change reaches the installed APK via a plain Vercel deploy + app reopen. No APK rebuild.

## 3. Production URL

```
https://profolio-login-flow.vercel.app/
```

Never localhost / `127.0.0.1` / `10.0.2.2` / the Supabase URL / the Lovable URL.
A build‑time guard in `capacitor.config.ts` throws if the resolved URL is a dev host or non‑HTTPS.

## 4. Where the URL is configured — single source of truth

**`capacitor.config.ts`**, constant `PRODUCTION_URL`. That is the only file that contains the literal.

Optional override for a local `npx cap sync` (e.g. pointing a throwaway build at a staging deploy):

```bash
CAP_SERVER_URL="https://some-staging-deploy.vercel.app/" npx cap sync android
```

`.env.example` documents the variable (commented out). It is **not** required and is **not** a second source of truth — if unset, the committed `PRODUCTION_URL` is used.

## 5. Capacitor server configuration

`capacitor.config.ts`:

```ts
const PRODUCTION_URL = 'https://profolio-login-flow.vercel.app/';
const serverUrl = (process.env.CAP_SERVER_URL ?? PRODUCTION_URL).trim();
// + guards: reject localhost/dev hosts, reject non-https

const config: CapacitorConfig = {
  appId: 'com.profolio.app',
  appName: 'Profolio',
  webDir: 'native/shell-www',      // tiny placeholder only; see below
  server: { url: serverUrl, cleartext: false },
  android: { webContentsDebuggingEnabled: false },
};
```

**Why `webDir` still exists:** `npx cap sync` / `cap copy` require a `webDir` containing an `index.html` or the command errors. `native/shell-www/index.html` is a near‑empty committed stub that satisfies the tool. It is **never** shown at runtime — `server.url` makes the WebView load the remote app immediately, and the stub contains no redirect and no app logic. This is the smallest technically‑correct artifact; the full `dist/` is not copied.

Generated at sync time → `android/app/src/main/assets/capacitor.config.json` (git‑ignored by Capacitor's `android/app/.gitignore`).

## 6. WebView cache behaviour

Set explicitly in `MainActivity.java`:

```java
WebSettings settings = this.getBridge().getWebView().getSettings();
settings.setCacheMode(WebSettings.LOAD_DEFAULT);
```

* **`LOAD_DEFAULT`** = use a cached resource only while it is still fresh per its HTTP `Cache-Control`; otherwise go to the network. This is the correct network‑aware default.
* We set it **explicitly** so no plugin/config can silently fall back to `LOAD_CACHE_ELSE_NETWORK` (which would serve stale bundles). `LOAD_CACHE_ELSE_NETWORK` is **not** used.
* Why this never pins an old build:
  * `index.html` / navigations — Vercel serves them effectively `no-store`, and the service worker is network‑first for navigations, so every launch re‑fetches current HTML → current hashed asset URLs.
  * `/assets/*.js|*.css` — content‑hashed and immutable. A new deploy = new filenames, so a cache hit is only ever the identical bytes and a new deploy is always a cache miss → network.
* Hardware acceleration: left at Capacitor's default (**enabled**). No reason found to disable it.

## 7. Service‑worker update behaviour

`public/sw.js` + `src/lib/pwa.ts` + `src/components/SWUpdatePrompt.tsx`.

Caching strategy (unchanged, already correct):

| Request | Strategy |
| --- | --- |
| navigations (`index.html`) | **network‑first**, `offline.html` on failure |
| `/assets/*` hashed build output | **cache‑first** (immutable) |
| other same‑origin GETs (icons, manifest) | **stale‑while‑revalidate** |
| cross‑origin (Supabase, fonts) | **not intercepted** — straight to network |

Update lifecycle (changed):

1. `install` **no longer calls `skipWaiting()`** — a redeployed worker enters the **waiting** state instead of hijacking a live session.
2. `src/lib/pwa.ts` registers with **`updateViaCache: 'none'`** (the HTTP cache is never consulted for `sw.js` itself), and calls `registration.update()` **every 60 s** and on every **`visibilitychange` → visible** (covers the shell "resume" that isn't a full process kill).
3. When a worker is waiting, a **non‑blocking Sonner toast** ("A new version of Profolio is available — Update") is shown. Tapping **Update** posts `SKIP_WAITING`; the worker activates, its `activate` handler **purges all non‑current caches**, and `controllerchange` triggers **exactly one** `location.reload()` (guarded against loops).
4. If the user never taps Update, the waiting worker **activates automatically on the next cold start** (no clients left) — so a fully‑closed‑and‑reopened APK always ends up on the newest worker.
5. `CACHE_VERSION` bumped `v1 → v2`; the `activate` handler deletes any cache not in the current keep‑set, so the bump fully clears the previous version's caches.

**Important:** `sw.js` is a static file that rarely changes. A *normal* frontend deploy does **not** change `sw.js`, so steps 1–4 don't even fire — the app still updates purely via network‑first navigation + new hashed asset filenames. The waiting/prompt path only matters when `sw.js` logic itself changes.

Offline support is preserved: `offline.html` + precache of `icon.svg` / `manifest.webmanifest` are untouched.

Because the APK loads the **production origin**, there is exactly **one** service worker and **one** origin — the shell and Chrome share it. No service worker is ever created for `https://localhost`.

## 8. Authentication behaviour (Supabase, in WebView)

* `@supabase/supabase-js` uses its default `localStorage` persistence, keyed by **origin**. The APK's origin is now `https://profolio-login-flow.vercel.app` — the **same origin as the PWA** — so login, logout, session persistence, silent refresh, `RequireAal2` MFA step‑up, OAuth redirects and password‑reset deep links all work identically to the browser, with **no auth code changes**.
* One‑time effect of the migration: existing APK installs currently hold their session under the old `https://localhost` origin. After the shell update they start at the production origin with **no session → users log in once**. This is expected and not a regression.
* OAuth / email deep links: they already target the production origin for the PWA, so they already work for the shell. If a provider redirect ever needs an app‑scheme, that is a native change (new APK).
* No credentials are weakened. Only the existing **publishable/anon** key ships client‑side (`VITE_SUPABASE_PUBLISHABLE_KEY`). No service‑role key anywhere in the client or the APK.

## 9. Upload findings (image/video slower from the APK than the PWA)

**This is audited separately and is NOT claimed to be fixed by the shell change.**

Current path (identical in PWA and shell):
`<input type="file">` → `URL.createObjectURL` for preview → `supabase.storage.from(bucket).upload(path, file)` (`src/lib/secure-upload.ts`, `src/lib/ads/api.ts`, `PostInput.tsx`, `AddPost.tsx`, story/profile components). No native camera/filesystem plugin. No client‑side resize/transcode.

Findings:

1. **`supabase-js` `.upload()` is a single `PUT`** — the whole file in one non‑resumable request. A 50 MB video on mobile is one long request; a mid‑upload network blip restarts from zero. This is the dominant large‑media cost and is **independent of shell vs. PWA**.
2. **Android System WebView `Blob`/`File` handling is slower than desktop Chrome.** Reading the picked `File` (and any `createObjectURL`/`FileReader` round‑trip) into an XHR body goes through the WebView's IPC/marshalling layer; on large binaries this is measurably slower than Chrome's. Moving to the remote origin does **not** change this — the file bytes still transit the same WebView networking stack.
3. **No downscale before upload.** Full‑resolution phone photos (often 4–12 MB) and 1080p/4K video are uploaded as‑is. The biggest single win is client‑side image resize + (optionally) video bitrate capping *before* the upload starts.
4. **Not a timeout problem** — do not "fix" by raising timeouts.

Recommended improvements (**separate task, not implemented here**):

* **Resumable (TUS) uploads for large media** — Supabase Storage supports resumable uploads via `@supabase/storage-js` / `tus-js-client` (`https://<project>.supabase.co/storage/v1/upload/resumable`), 6 MB chunks, automatic retry/resume. Route videos and >~5 MB images through it; keep the simple `.upload()` for small images/avatars.
* **Image optimisation** — downscale to a sane max dimension (e.g. 1920 px long edge) and re‑encode to WebP/JPEG ~0.8 in a `<canvas>` / `createImageBitmap` before upload. Typically 3–10× smaller payloads.
* **Video** — enforce a max size/duration client‑side; surface a clear message rather than a silent slow upload. Full native transcode is out of scope (would need a plugin — a new APK).
* Optional: a `@capacitor/camera` / native picker would also bypass some WebView `File` marshalling, but that is a native dependency (new APK) and should only be added if the JS‑only wins above prove insufficient.

## 10. Native functionality (what actually needs native code)

Genuinely native today: app icon/splash, `versionCode`/`versionName`, `MainActivity` edge‑to‑edge insets + WebView cache mode, `INTERNET` permission, `FileProvider`, `network_security_config.xml`. Nothing else — no push, no deep‑link filters, no camera plugin.

## 11. Changes that REQUIRE a new APK build + reinstall

* Any edit to `android/**` (Java/Kotlin, `AndroidManifest.xml`, Gradle, resources, `network_security_config.xml`)
* Android permissions
* Adding/updating/removing a Capacitor or Cordova plugin
* `appId` / application‑id / package changes
* App icon, splash screen, app name
* Native deep‑link (`<intent-filter>`) configuration
* Native push‑notification implementation
* Any native Android API usage
* Android SDK / native dependency / `targetSdk` changes
* **Changing the production URL** (`PRODUCTION_URL` in `capacitor.config.ts`) — it is baked into the APK at sync time
* Capacitor major/minor upgrade

## 12. Changes that DO **NOT** require a new APK

* React / TypeScript / JavaScript
* CSS / Tailwind / UI / UX
* React Router routes and route logic
* Normal frontend business logic and validation
* Frontend API calls, Supabase queries, Edge Function *calls*
* Service‑worker logic in `public/sw.js` (ships with the web deploy; picked up via the update lifecycle in §7)
* `index.html`, web manifest, PWA metadata
* Normal frontend bug fixes

→ these ship by: **commit → Vercel production deploy → reopen the installed APK**.

## 13. One‑time migration / rebuild procedure

Run once, by whoever builds the APK:

```bash
# 1. Pull this branch, install deps
npm ci

# 2. Sync the native project with the new remote-shell config
#    (NO `vite build` needed — the bundle is not shipped)
npm run android:sync            # = npx cap sync android

# 3. Sanity-check the generated native config
cat android/app/src/main/assets/capacitor.config.json
#   expect: "server": { "url": "https://profolio-login-flow.vercel.app/", "cleartext": false }
find android/app/src/main/assets/public -type f
#   expect: only index.html (+ cordova.js, cordova_plugins.js) — NO assets/ bundle

# 4. Build the APK
npm run android:open            # Android Studio → Build > Generate Signed Bundle / APK
#   or:  cd android && ./gradlew assembleRelease

# 5. Bump versionCode in android/app/build.gradle for the store release
```

Install this APK once on the device(s). From then on, §12 changes need no APK work.

## 14. Future deployment procedure (normal frontend change)

```bash
git commit ... && git push        # Vercel auto-deploys production
# → open (or fully close + reopen) the already-installed APK
# → the new UI is live; verify the commit SHA at /diagnostics
```

## 15. Verification procedure

**ON‑DEVICE VERIFICATION: UNVERIFIED** — must be performed on a physical Android device; it cannot be done from the dev environment.

What *was* verified locally (browser, `vite preview` of the production build):

* `/diagnostics` renders the build commit SHA, build time, origin, display‑mode, SW state, and sets `window.__PROFOLIO_BUILD__`.
* SW update lifecycle: a changed `sw.js` installs as **waiting** (no forced takeover) → toast appears → **Update** activates it → **old `v*` caches are purged** → page reloads once.
* **Core requirement:** with the SW controller and caches unchanged, rebuilding the frontend with a changed label (`ANDROID LIVE TEST A` → `B`) and reloading showed **`B`** and the **new hashed JS filename** — i.e. a frontend change propagates through the exact same SW/cache state that an installed APK would have.
* `npx cap sync android` produces `server.url = https://profolio-login-flow.vercel.app/` and copies **only** the 4 KB stub into the APK (no React bundle).

### Device runbook (you perform this)

**Phase 1 — one‑time build & baseline**

1. `npm ci && npm run android:sync`
2. Build + install the APK (see §13). This is the **only** APK build in this procedure.
3. Launch the APK. Navigate to `/diagnostics` (e.g. from the URL bar of a debug build, or add a temporary link).
   * Confirm **Origin** = `https://profolio-login-flow.vercel.app`
   * Note **Build (commit)** — call it `SHA_1`
4. Log in. Confirm: feed loads, a DB write works (post a comment), navigate between routes, background/foreground the app → still logged in.
5. Confirm an **image upload** and a **video upload** complete (note rough timings for the separate upload task).
6. Confirm **logout** then **login** again works.

**Phase 2 — the central proof (no APK rebuild)**

7. In the React app, make a visible change, e.g. in `src/pages/Diagnostics.tsx` change the card title text, or add `ANDROID LIVE TEST B` somewhere on `/dashboard`.
8. `git commit && git push` → wait for the **Vercel production** deploy to finish.
9. **Do not rebuild or reinstall the APK.**
10. Fully close the APK (swipe from recents) and reopen it.
11. Confirm the change from step 7 is visible.
12. Open `/diagnostics` → **Build (commit)** is now `SHA_2` ≠ `SHA_1`.
    → **If 11 + 12 pass, the architecture goal is proven.**

**Phase 3 — cache / service‑worker**

13. Make a second visible frontend change; push; wait for deploy.
14. Reopen the APK → confirm the second change appears and `/diagnostics` shows a third SHA.
15. In Chrome on the same device, open the production URL as a normal tab and as the installed PWA → confirm both still work and show the latest SHA.
16. Re‑test login/session, image upload, video upload, navigation (React Router deep link + in‑app back), logout/login in the APK.
17. If any step shows a *stale* bundle that a reopen doesn't clear: on the device, clear the app's storage once (Settings → Apps → Profolio → Storage) — this drops any `v1` SW cache from before the migration — then repeat from step 10. A permanent stale pin (survives reopen **and** storage clear) is a bug; report it.

### Do not declare "production ready" / "verified" until Phase 2 (steps 11–12) has passed on a real device.
