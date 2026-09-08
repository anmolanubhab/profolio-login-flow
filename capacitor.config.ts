import type { CapacitorConfig } from '@capacitor/cli';

/*
 * Profolio native Android shell -- THIN REMOTE SHELL.
 *
 * The APK is a native WebView wrapper that loads the LIVE production web app
 * over HTTPS. The React/Vite bundle is NOT packaged into the APK; normal
 * frontend changes ship via the Vercel production deploy and are picked up by
 * the existing installed APK on next launch -- no APK rebuild required.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PRODUCTION URL -- SINGLE SOURCE OF TRUTH
 * ─────────────────────────────────────────────────────────────────────────────
 * The production origin lives in exactly ONE place: `PRODUCTION_URL` below.
 * It can be overridden at `npx cap sync` time via the `CAP_SERVER_URL`
 * environment variable (e.g. a staging build) -- but the committed default is
 * the authoritative production URL and no other file repeats it.
 *
 *   CAP_SERVER_URL=https://profolio-login-flow.vercel.app/   # optional override
 *
 * See docs/android-shell/architecture.md for the full architecture + the
 * one-time migration / verification procedure.
 */
const PRODUCTION_URL = 'https://profolio-login-flow.vercel.app/';

const serverUrl = (process.env.CAP_SERVER_URL ?? PRODUCTION_URL).trim();

// Guard: never let a dev URL be baked into a shipped APK.
if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.0\.2\.2)(:|\/|$)/i.test(serverUrl)) {
  throw new Error(
    `[capacitor.config] CAP_SERVER_URL points at a development host (${serverUrl}). ` +
      'The Android shell must load the production HTTPS URL. Unset CAP_SERVER_URL ' +
      'to use the committed production default.',
  );
}
if (!serverUrl.startsWith('https://')) {
  throw new Error(
    `[capacitor.config] Server URL must be HTTPS (got ${serverUrl}).`,
  );
}

const config: CapacitorConfig = {
  appId: 'com.profolio.app',
  appName: 'Profolio',

  // `cap sync` still needs a webDir with an index.html to copy. We point it at
  // a tiny committed placeholder (native/shell-www) instead of the real Vite
  // `dist/` -- so the full React bundle is NOT shipped inside the APK. This
  // placeholder is never rendered at runtime: `server.url` below makes the
  // WebView navigate straight to the remote production app on launch.
  webDir: 'native/shell-www',

  server: {
    // Load the live production web app directly. This is what makes the APK a
    // thin shell: the WebView's document origin IS the production origin, so
    // the production service worker, Supabase auth, routing and hashed assets
    // all behave exactly as they do in Chrome.
    url: serverUrl,
    // HTTPS only -- no cleartext fallback.
    cleartext: false,
  },

  android: {
    // Production APK: no remote WebView debugging surface.
    // (Android Studio "debug" builds can still be inspected locally via a
    // separate debuggable build; this flag only governs the packaged app.)
    webContentsDebuggingEnabled: false,
  },
};

export default config;
