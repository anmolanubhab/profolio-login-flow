/*
 * Minimal Profolio service worker.
 *
 * Goal: make the app installable / launchable as a standalone PWA and give it a
 * clean offline fallback -- WITHOUT ever pinning users (Chrome PWA *or* the
 * native Android shell, which loads this same production origin) to a stale
 * build.
 *
 *  - navigations  -> network-first (so index.html, and therefore the current
 *                    hashed JS/CSS, is always fresh); offline.html on failure
 *  - hashed build assets under /assets/ -> cache-first (they're immutable;
 *                    a new deploy = new filenames = guaranteed cache miss)
 *  - other same-origin GETs (icons, manifest) -> stale-while-revalidate
 *  - cross-origin (fonts, Supabase auth/db/storage/edge) -> not touched
 *
 * Update lifecycle:
 *  - install does NOT call skipWaiting(): a new worker enters the "waiting"
 *    state instead of hijacking a running session. The page (src/main.tsx)
 *    detects the waiting worker and shows a non-blocking "Update" prompt;
 *    tapping it posts SKIP_WAITING here, we activate, and the page reloads
 *    once via the controllerchange listener.
 *  - When the app is fully closed and reopened (the native-shell "reopen APK"
 *    case), there are no clients left, so a waiting worker activates on its
 *    own at next launch -- the newest deployment is picked up with no prompt.
 *  - activate deletes any cache not in the current keep-set, so bumping
 *    CACHE_VERSION fully purges the previous version's caches.
 */
const CACHE_VERSION = 'v2';
const RUNTIME_CACHE = `profolio-runtime-${CACHE_VERSION}`;
const PRECACHE = `profolio-precache-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll([OFFLINE_URL, '/icon.svg', '/manifest.webmanifest'])),
  );
  // NOTE: no self.skipWaiting() here -- see "Update lifecycle" above.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([RUNTIME_CACHE, PRECACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

// Let the page trigger an immediate update once the user accepts the prompt.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // fonts, Supabase, etc.

  // App navigations: always try the network first so the newest build wins.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return (await caches.match(request)) || (await caches.match(OFFLINE_URL));
        }
      })(),
    );
    return;
  }

  // Immutable hashed build output.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Other same-origin GETs: serve cache fast, refresh in the background.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => hit);
      return hit || network;
    }),
  );
});
