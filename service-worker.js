const CACHE_NAME = "tracking-pwa-v1";
const APP_SHELL = [
  "/system/",
  "/system/main.html",
  "/system/index.html",
  "/system/login.html",
  "/system/plan.html",
  "/system/logo.png",
  "/system/logo-192.png",
  "/system/logo-512.png",
  "/system/watermark.css"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});