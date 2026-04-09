const CACHE_NAME = 'tateyama-cache-v3';
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './i18n.js',
    './schedules.js',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(urlsToCache))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => response || fetch(event.request))
            .catch(() => caches.match('./index.html'))
    );
});