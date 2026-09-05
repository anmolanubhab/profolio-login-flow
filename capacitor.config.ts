import type { CapacitorConfig } from '@capacitor/cli';

// Additive native Android shell for Profolio. This does NOT replace the
// existing web/PWA build (Vercel deploy, installed Chrome PWA) -- `npm run
// build` still produces the normal web output; this config only tells
// Capacitor which built assets to copy into the native android/ project when
// `npx cap sync android` is run.
const config: CapacitorConfig = {
  appId: 'com.profolio.app',
  appName: 'Profolio',
  // Vite's build output (see vite.config.ts / `vite build` default).
  webDir: 'dist',
};

export default config;
