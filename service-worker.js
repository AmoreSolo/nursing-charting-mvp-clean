/* SMART Charting — Service Worker v3
   Forces fresh HTML after deploy, while caching for resilience. */

const CACHE_NAME = 'smart-charting-v3';
const CORE_ASSETS = ['/', '/index.html'];

// Utility: cache-safe fetch for HTML (network-first, fallback to cache)
async function networkFirst(request) {
  try {
    const fresh = await fetch(request, { cache: 'no-store' });
    const cache = await caches.open(CACHE_NAME);
    cache.put('/', fresh.clone());
    return fresh;
  } catch {
    const cached = await caches.match('/');
    return cached || new Response('Offline', { status: 503 });
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always try network first for the app shell HTML
  if (url.origin === self.location.origin && (url.pathname === '/' || url.pathname.startsWith('/index'))) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(event.request).then((cached) =>
      cached ||
      fetch(event.request).then((resp) => {
        // Only cache successful GETs
        if (event.request.method === 'GET' && resp && resp.status === 200) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return resp;
      }).catch(() => cached || new Response('', { status: 504 }))
    )
  );
});
