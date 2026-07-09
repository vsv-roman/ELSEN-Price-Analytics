// Service Worker для ELSEN Price Dashboard
const CACHE_NAME = 'elsen-price-v1.0.0';
const RUNTIME_CACHE = 'elsen-runtime-v1';

// Файлы для офлайн-кэширования (app shell)
const APP_SHELL_FILES = [
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/apple-touch-icon.svg',
  // CDN-ресурсы из вашего дашборда
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
];

// ─── INSTALL ───
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll(APP_SHELL_FILES);
      })
      .then(() => self.skipWaiting())
  );
});

// ─── ACTIVATE ───
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── FETCH (Stale-While-Revalidate strategy) ───
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s)
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Возвращаем кэш сразу, но обновляем в фоне
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const cache = caches.open(RUNTIME_CACHE);
            cache.then((c) => c.put(request, networkResponse.clone()));
          }
          return networkResponse;
        })
        .catch((err) => {
          console.log('[SW] Fetch failed:', request.url, err);
          // Офлайн-фолбэк для навигации
          if (request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// ─── MESSAGE (обновление кэша по команде) ───
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((names) => {
      names.forEach((name) => caches.delete(name));
    });
  }
});

// ─── BACKGROUND SYNC (для будущих фич) ───
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-prices') {
    console.log('[SW] Syncing price data...');
  }
});