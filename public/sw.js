const CACHE_NAME = 'profolio-fonts-v1';
const FONT_CSS_MATCH = /https:\/\/fonts\.googleapis\.com\/css2\?family=Grand\+Hotel/i;
const FONT_FILE_MATCH = /https:\/\/fonts\.gstatic\.com\/s\/.*\.(?:woff2?|ttf|otf)/i;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  if (FONT_FILE_MATCH.test(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            cache.put(req, res.clone());
          }
          return res;
        } catch (e) {
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  if (FONT_CSS_MATCH.test(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(req);
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached || Response.error());
        return cached || fetchPromise;
      })()
    );
    return;
  }
});
