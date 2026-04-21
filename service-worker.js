const CACHE_NAME = "tracking-pwa-v3";
const APP_SHELL = [
  "/system/",
  "/system/main.html",
  "/system/index.html",
  "/system/login.html",
  "/system/plan.html",
  "/system/admin.html",
  "/system/logo.png",
  "/system/logo-192.png",
  "/system/logo-512.png",
  "/system/watermark.css",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css",
  "https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys
          .filter(function(key){ return key !== CACHE_NAME; })
          .map(function(key){ return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  const req = event.request;

  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then(function(networkRes){
        const copy = networkRes.clone();
        caches.open(CACHE_NAME).then(function(cache){
          cache.put(req, copy);
        });
        return networkRes;
      })
      .catch(function(){
        return caches.match(req).then(function(cachedRes){
          return cachedRes || caches.match("/system/main.html");
        });
      })
  );
});

self.addEventListener("notificationclick", function(event){
  event.notification.close();

  const data = event.notification.data || {};
  const targetUrl = data.url || "/system/main.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList){
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBhWJtOWJKlBk04Ii7mm93rhfECuQLKRbM",
  authDomain: "tracking-web-218e8.firebaseapp.com",
  projectId: "tracking-web-218e8",
  storageBucket: "tracking-web-218e8.firebasestorage.app",
  messagingSenderId: "107177409442",
  appId: "1:107177409442:web:c66ec3f1ad72e5fad610fb",
  measurementId: "G-PCJX55XGQS"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const title = (payload.notification && payload.notification.title) || "إشعار جديد";
  const options = {
    body: (payload.notification && payload.notification.body) || "",
    icon: "/system/logo-192.png",
    badge: "/system/logo-192.png",
    data: {
      url: "/system/main.html"
    }
  };

  self.registration.showNotification(title, options);
});