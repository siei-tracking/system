/* =========================================================
   firebase-messaging-sw.js  v3
   ارفعه في: /system/firebase-messaging-sw.js

   ✅ إصلاحات v3:
   - منع ظهور الإشعار مرتين (Firebase يعرضه تلقائياً عند وجود notification)
   - tag لكل أمر عمل: الإشعار الجديد يحلّ محل القديم بدل التكدّس
   - HTML من الشبكة أولاً (كانت الصفحات القديمة تبقى في الكاش بعد التحديث)
   - Firebase 10 (يدعم Safari / آيفون عند الإضافة للشاشة الرئيسية)
========================================================= */

importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

self.addEventListener("message", function (event) {
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

messaging.onBackgroundMessage(function (payload) {
  /* إذا وصلت الرسالة مع notification فـ Firebase عرضها بنفسه — لا نكررها */
  if (payload && payload.notification) return;

  /* رسائل data فقط (من نسخ قديمة من السيرفر) */
  const data  = (payload && payload.data) || {};
  const title = data.title || "إشعار جديد";
  const body  = data.body  || "";
  const url   = data.url   || "/system/main.html";
  const tag   = "wo-" + String(data.orderId || data.page || "general");

  return self.registration.showNotification(title, {
    body: body,
    icon: "/system/logo-192.png",
    badge: "/system/logo-192.png",
    dir: "rtl",
    lang: "ar",
    tag: tag,
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: url }
  });
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const n = event.notification || {};
  const d = n.data || {};
  /* Firebase يضع الرابط في FCM_MSG عند العرض التلقائي */
  const targetUrl = d.url
    || (d.FCM_MSG && d.FCM_MSG.data && d.FCM_MSG.data.url)
    || "/system/main.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.indexOf(targetUrl) !== -1 && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

/* =========================================================
   Cache — للعمل بدون إنترنت فقط
   الصفحات (HTML) من الشبكة أولاً حتى تصل التحديثات فوراً
========================================================= */
const CACHE_NAME = "siei-pwa-v3";
const CACHE_URLS = [
  "/system/main.html",
  "/system/manifest-main.webmanifest",
  "/system/logo-192.png",
  "/system/logo-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(CACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k !== CACHE_NAME; })
            .map(function (k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = req.url;
  if (url.indexOf("script.google.com") !== -1) return;
  if (url.indexOf("googleapis.com") !== -1) return;
  if (url.indexOf("gstatic.com") !== -1) return;

  const isPage = req.mode === "navigate" || /\.html(\?|$)/.test(url) ||
                 /\.(js|css|webmanifest)(\?|$)/.test(url);

  if (isPage) {
    /* الشبكة أولاً، والكاش عند انقطاع الإنترنت */
    event.respondWith(
      fetch(req).then(function (res) {
        if (res && res.ok && url.indexOf(self.location.origin) === 0) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match(req).then(function (cached) {
          return cached || caches.match("/system/main.html");
        });
      })
    );
    return;
  }

  /* الصور والأصوات: الكاش أولاً */
  event.respondWith(
    caches.match(req).then(function (cached) {
      return cached || fetch(req);
    })
  );
});
