// sw.js — v5: Tüm eski cache'leri temizle, network-first stratejisi
const CACHE_NAME = 'finans-hub-v5';

// Install: beklemeden hemen aktif ol
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: TÜM eski cache'leri derhal temizle ve anında tüm istemcileri devral
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          console.log('Service Worker: Eski Cache Siliniyor:', cache);
          return caches.delete(cache);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Her zaman öncelikle canlı ağdan getir
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
