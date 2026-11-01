// sw.js — v4: Tüm cache'leri temizle, network-first stratejisi
const CACHE_NAME = 'finans-hub-v4';

// Install: skipWaiting ile hemen aktif ol
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: TÜM eski cache'leri sil ve hemen kontrolü al
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          console.log('Service Worker: Siliniyor:', cache);
          return caches.delete(cache); // HEPSİNİ sil
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Her zaman önce ağdan çek (cache kullanma)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // Ağ yoksa boş yanıt ver
      return new Response('', { status: 503, statusText: 'Offline' });
    })
  );
});
