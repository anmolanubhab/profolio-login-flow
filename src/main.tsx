import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);

// Register the service worker only in production builds -- it enables the
// standalone/installable PWA experience and an offline fallback. Navigations
// are network-first inside the worker, so this never serves a stale app build.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline-first is a progressive enhancement; ignore registration errors */
    });
  });
}
