/* =========================================================
   firebase-messaging-sw.js
   ارفعه في: /system/firebase-messaging-sw.js
========================================================= */

importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js");

self.addEventListener("message", function(event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});


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

messaging.onBackgroundMessage(function(payload){
  const title = payload?.notification?.title || payload?.data?.title || "إشعار جديد";
  const body = payload?.notification?.body || payload?.data?.body || "";
  const url = payload?.data?.url || "/system/main.html";

  self.registration.showNotification(title, {
    body: body,
    icon: "/system/logo-192.png",
    badge: "/system/logo-192.png",
    dir: "rtl",
    lang: "ar",
    data: { url: url }
  });
});

self.addEventListener("notificationclick", function(event){
  event.notification.close();
  const targetUrl = event.notification?.data?.url || "/system/main.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clientList){
      for(const client of clientList){
        if(client.url.indexOf(targetUrl) !== -1 && "focus" in client){
          return client.focus();
        }
      }
      if(clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

/* =========================================================
   Cache بسيط لتشغيل الـ PWA offline
   يكفي لإزالة تحذير "Page does not work offline"
========================================================= */
const CACHE_NAME = "siei-pwa-v1";
const CACHE_URLS = [
  "/system/main.html",
  "/system/manifest.webmanifest",
  "/system/logo-192.png",
  "/system/logo-512.png"
];

self.addEventListener("install", function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(CACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function(event){
  /* فقط للـ GET requests */
  if(event.request.method !== "GET") return;

  /* تجاهل طلبات الـ API */
  if(event.request.url.indexOf("script.google.com") !== -1) return;
  if(event.request.url.indexOf("googleapis.com") !== -1) return;

  event.respondWith(
    caches.match(event.request).then(function(cached){
      /* إذا موجود في الـ cache أرجعه، وإلا اطلبه من الشبكة */
      return cached || fetch(event.request).catch(function(){
        /* إذا الشبكة منقطعة وطلب main.html أرجع من الـ cache */
        if(event.request.url.indexOf("main.html") !== -1){
          return caches.match("/system/main.html");
        }
      });
    })
  );
});
