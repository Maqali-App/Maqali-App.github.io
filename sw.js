
// ================================================================
// MAQALI Service Worker — caches app files for offline use
// ================================================================

// ---- Section 1: Cache name and file list ----
const CACHE_NAME = 'maqali-v1';
const ASSETS = [
  './',
  './index.html',
  './maqali.js',
  './maqali1.js',
  './manifest.json',
  './icon.svg'
];

// ---- Section 2: Install — cache all app files ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ---- Section 3: Activate — clear old caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ---- Section 4: Fetch — serve from cache first, then network ----
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
