const CACHE_VERSION = 'muuvlink-v3';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

const PRECACHE_URLS = ['/', '/index.html'];

// Install: precache shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Activate: remove old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => !k.startsWith(CACHE_VERSION))
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Never cache API calls, SSE, or non-GET requests
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return;
  if (request.method !== 'GET') return;

  // JS/CSS/fonts — cache-first (long-lived hashed assets)
  if (/\.(js|css|woff2?|ttf)(\?.*)?$/.test(url.pathname)) {
    e.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // Images — cache-first with dynamic cache (up to 60 cached)
  if (/\.(png|jpe?g|gif|svg|webp|avif|ico)(\?.*)?$/.test(url.pathname)) {
    e.respondWith(
      caches.open(DYNAMIC_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached;
          return fetch(request).then(res => {
            if (res.ok && url.origin === self.location.origin) {
              cache.put(request, res.clone());
            }
            return res;
          });
        })
      )
    );
    return;
  }

  // HTML navigation — network-first, fallback to cached index.html
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then(c => c.put(request, clone));
          }
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Everything else — stale-while-revalidate
  e.respondWith(
    caches.open(DYNAMIC_CACHE).then(cache =>
      cache.match(request).then(cached => {
        const fetchPromise = fetch(request).then(res => {
          if (res.ok && url.origin === self.location.origin) {
            cache.put(request, res.clone());
          }
          return res;
        });
        return cached || fetchPromise;
      })
    )
  );
});
