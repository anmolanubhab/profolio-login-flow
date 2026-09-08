/**
 * Frontend build identity.
 *
 * Values are baked in by vite.config.ts (`define`) at `vite build` time, so
 * they identify the exact production deployment currently loaded -- useful for
 * confirming the Android shell is running the latest Vercel deploy (it loads
 * the live URL, so this updates without an APK rebuild).
 *
 * Contains NO secrets: only a public git SHA, branch ref, environment name and
 * a timestamp.
 */
export interface BuildInfo {
  /** Full commit SHA the bundle was built from (or "unknown"). */
  sha: string;
  /** First 7 chars of `sha`, for display. */
  shortSha: string;
  /** ISO timestamp of the build. */
  builtAt: string;
  /** Git branch/ref (Vercel builds only; "" otherwise). */
  ref: string;
  /** "production" | "preview" | "development" | vite mode. */
  env: string;
}

const sha = typeof __APP_BUILD_SHA__ === "string" ? __APP_BUILD_SHA__ : "unknown";

export const BUILD_INFO: BuildInfo = {
  sha,
  shortSha: sha === "unknown" ? "unknown" : sha.slice(0, 7),
  builtAt: typeof __APP_BUILD_TIME__ === "string" ? __APP_BUILD_TIME__ : "",
  ref: typeof __APP_BUILD_REF__ === "string" ? __APP_BUILD_REF__ : "",
  env: typeof __APP_BUILD_ENV__ === "string" ? __APP_BUILD_ENV__ : "development",
};

declare global {
  interface Window {
    /** Quick diagnostics hook: read from devtools or `adb`-attached inspector. */
    __PROFOLIO_BUILD__?: BuildInfo;
  }
}

if (typeof window !== "undefined") {
  window.__PROFOLIO_BUILD__ = BUILD_INFO;
}
