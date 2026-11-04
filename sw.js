const CACHE_NAME = 'maintenance-report-v9';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './images/uni_logo.svg',
  './IBM-Plex-Sans-Arabic.woff2',
  './js/app.js',
  './css/style.css'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});
