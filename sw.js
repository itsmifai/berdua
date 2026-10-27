// ==============================================================================
// BERDUA — Service Worker (PWA Shell Cache & Offline Fallback)
// ==============================================================================

const CACHE_NAME = 'berdua-v1';

// Daftar aset inti app shell yang di-cache
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/auth.js',
  './js/supabaseClient.js',
  './js/agenda.js',
  './js/misi.js',
  './js/streak.js',
  './js/poin.js',
  './js/profil.js',
  './js/fx.js',
  './img/icons/icon.svg',
  './img/icons/icon-192.png',
  './img/icons/icon-512.png'
];

// Install: Cache seluruh aset app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Bersihkan cache versi lama saat update
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first untuk navigasi, Stale-while-revalidate untuk shell, jangan cache Supabase API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // JANGAN cache request ke Supabase API atau eksternal CDN dinamis
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Navigasi halaman HTML: Network-first dengan fallback ke cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('./index.html') || caches.match('./login.html');
        })
    );
    return;
  }

  // Aset statis: Cache-first dengan network update di background
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Update cache di background
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});
