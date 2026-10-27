// ==============================================================================
// BERDUA — Service Worker (PWA Shell Cache & Offline Fallback)
// ==============================================================================

const CACHE_NAME = 'berdua-v6';

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

// Activate: Bersihkan semua cache lama
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Menghapus cache usang:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: NETWORK-FIRST untuk SEMUA request agar file JS selalu up-to-date
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Jangan sentuh request ke Supabase API
  if (url.hostname.includes('supabase.co')) {
    return;
  }

  // Network-First dengan fallback ke cache jika offline
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./login.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
