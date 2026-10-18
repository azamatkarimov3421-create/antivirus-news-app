// ============================================================================
// ANTIVIRUS NEWS — Offline Service Worker (PWA & Google Play Store TWA)
// ============================================================================

const CACHE_NAME = 'antivirus-news-v4-network-first';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/js/app.js',
  '/js/store.js',
  '/js/mediaDb.js',
  '/js/data.js',
  '/js/icons.js',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/icons/icon-maskable-192.png',
  '/assets/icons/icon-maskable-512.png'
];

// 1. Install — Statik resurslarni keshga saqlash va darhol faollashish
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. Activate — Eski barcha keshlarni darhol tozalash va nazoratni olish
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('Eski kesh tozalanmoqda:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch — Har doim Tarmoqdan yangisini olish (Network First), Offline bo'lsagina keshdan o'qish
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Faqat GET so'rovlar
  if (req.method !== 'GET') return;

  // Cloudflare API yoki tashqi so'rovlar
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Network-First strategiyasi: Har doim eng yangi versiyani olish
  event.respondWith(
    fetch(req)
      .then((networkRes) => {
        if (networkRes && networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkRes;
      })
      .catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        });
      })
  );
});
