
const CACHE_NAME = 'army-hrm-v2026-offline-v3';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  // Removed CDN URLs that might cause CORS issues during precache.
  // The browser will cache them via HTTP cache or we can runtime cache them.
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
          // Attempt to cache, but don't fail installation if one resource fails
          return Promise.allSettled(
              PRECACHE_URLS.map(url => 
                  fetch(url).then(res => {
                      if(res.ok) return cache.put(url, res);
                      // Fail silently for precache items that might be problematic (e.g. CORS)
                      console.warn('Failed to precache', url);
                  }).catch(err => console.warn('Precache fetch error', url, err))
              )
          );
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Ignore Firestore/Firebase API requests (handled by SDK persistence)
  if (url.hostname.includes('firestore.googleapis.com') || 
      url.hostname.includes('identitytoolkit.googleapis.com') ||
      url.pathname.includes('/firestore/') ||
      url.pathname.includes('/forwardAuthCookie')) { // Ignore Cloud Workstation Auth
    return;
  }

  // 2. Ignore CDN scripts that might cause CORS issues if cached opaquely without proper handling
  if (url.hostname === 'cdn.tailwindcss.com') {
      return;
  }

  // 3. Cache Images (Cache First)
  if (event.request.destination === 'image') {
     event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((response) => {
          if (!response || response.status !== 200 || (response.type !== 'basic' && response.type !== 'cors')) {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        }).catch(() => {
            return new Response('', { status: 404, statusText: 'Not Found' });
        });
      })
    );
    return;
  }

  // 4. Cache Local Source Files (TSX, TS, JS) - Stale-While-Revalidate for development speed
  if (url.origin === self.location.origin && /\.(tsx|ts|js|css)$/.test(url.pathname)) {
      event.respondWith(
          caches.open(CACHE_NAME).then(async (cache) => {
            const cachedResponse = await cache.match(event.request);
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if(networkResponse.ok) cache.put(event.request, networkResponse.clone());
                return networkResponse;
            }).catch(() => cachedResponse);
            return cachedResponse || fetchPromise;
          })
      );
      return;
  }

  // 5. Default Strategy: Network First, Fallback to Cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
          return response;
      })
      .catch(() => {
          return caches.match(event.request);
      })
  );
});
