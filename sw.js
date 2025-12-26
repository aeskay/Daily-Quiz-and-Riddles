const CACHE_NAME = 'dqr-cache-v9';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Space+Grotesk:wght@700&family=JetBrains+Mono&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use Settled to ensure we cache what we can even if one fails
      return Promise.allSettled(
        ASSETS.map(url => fetch(url).then(response => {
          if (response.ok) return cache.put(url, response);
          return Promise.reject(`Failed to fetch ${url}`);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never cache Gemini API calls
  if (url.origin.includes('generativelanguage')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      
      return fetch(event.request).then((response) => {
        // Only cache valid basic responses from the same origin or known CDNs
        const isSameOrigin = url.origin === self.location.origin;
        const isKnownCDN = url.origin.includes('cdn.tailwindcss.com') || url.origin.includes('fonts.googleapis.com');

        if (!response || response.status !== 200 || (!isSameOrigin && !isKnownCDN)) {
          return response;
        }

        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Fallback for navigation requests when offline
        if (event.request.mode === 'navigate') {
          return caches.match('./') || caches.match('./index.html');
        }
        return null;
      });
    })
  );
});