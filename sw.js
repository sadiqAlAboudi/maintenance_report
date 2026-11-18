const CACHE_NAME = 'maintenance-report-v15';
const STATIC_ASSETS = [
  './manifest.json',
  './images/favicon.ico',
  './images/uni_logo.png',
  './images/uni_logo.svg',
  './IBM-Plex-Sans-Arabic.woff2',
  './css/style.css',
  './js/app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Navigation requests: bypass cache to ensure server-side authentication check
  if (e.request.mode === 'navigate') {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
