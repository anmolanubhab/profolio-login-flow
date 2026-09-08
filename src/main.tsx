import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/build-info' // sets window.__PROFOLIO_BUILD__
import { registerServiceWorker } from './lib/pwa'

createRoot(document.getElementById("root")!).render(<App />);

// Enables the standalone/installable PWA experience and an offline fallback.
// Navigations are network-first inside the worker and updates go through a
// user-accepted prompt (see src/lib/pwa.ts + public/sw.js), so this never
// serves a stale app build and never reload-loops.
registerServiceWorker();
