import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { execSync } from "node:child_process";
import { componentTagger } from "lovable-tagger";

// Build identity, baked in at `vite build` time and surfaced in-app at
// /diagnostics (and on window.__PROFOLIO_BUILD__). Lets us confirm *which*
// production deployment the Android shell / a browser is actually running.
function resolveCommitSha(): string {
  // Vercel injects this for every production/preview build.
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try {
    return execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: Number(process.env.PORT) || 8080,
  },
  define: {
    __APP_BUILD_SHA__: JSON.stringify(resolveCommitSha()),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __APP_BUILD_REF__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_REF ?? ""),
    __APP_BUILD_ENV__: JSON.stringify(
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? mode ?? "development",
    ),
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
