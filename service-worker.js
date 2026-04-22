const CACHE_NAME = "tracking-pwa-v4";

const APP_SHELL = [
  "/system/",
  "/system/index.html",
  "/system/login.html",
  "/system/main.html",
  "/system/plan.html",
  "/system/admin.html",
  "/system/watermark.css",
  "/system/logo.png",
  "/system/logo-192.png",
  "/system/logo-512.png",
  "/system/manifest.webmanifest"
];

/* =========================
   INSTALL
========================= */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    }).catch(function (err) {
      console.log("Cache install error:", err);
    })
  );
  self.skipWaiting();
});

/* =========================
   ACTIVATE
========================= */
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE_NAME;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

/* =========================
   FETCH
========================= */
self.addEventListener("fetch", function (event) {
  const req = event.request;

  if (req.method !== "GET") return;

  event.respondWith(
    fetch(req)
      .then(function (networkRes) {
        const copy = networkRes.clone();

        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(req, copy).catch(function () {});
        });

        return networkRes;
      })
      .catch(function () {
        return caches.match(req).then(function (cachedRes) {
          if (cachedRes) return cachedRes;

          if (req.mode === "navigate") {
            return caches.match("/system/main.html");
          }

          return new Response("Offline", {
            status: 503,
            statusText: "Offline"
          });
        });
      })
  );
});

/* =========================
   Firebase Messaging SW
========================= */
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

/* =========================
   BACKGROUND MESSAGE
========================= */
messaging.onBackgroundMessage(function (payload) {
  const title =
    (payload.notification && payload.notification.title) ||
    "إشعار جديد";

  const body =
    (payload.notification && payload.notification.body) ||
    "لديك إشعار جديد من النظام";

  const targetUrl =
    (payload.data && payload.data.url) ||
    "/system/main.html";

  self.registration.showNotification(title, {
    body: body,
    icon: "/system/logo-192.png",
    badge: "/system/logo-192.png",
    data: {
      url: targetUrl,
      orderNo: (payload.data && payload.data.orderNo) || "",
      page: (payload.data && payload.data.page) || "main"
    },
    dir: "rtl",
    lang: "ar",
    renotify: true,
    requireInteraction: false,
    tag: (payload.data && payload.data.orderNo)
      ? "order-" + payload.data.orderNo
      : "tracking-notification"
  });
});

/* =========================
   NOTIFICATION CLICK
========================= */
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const targetUrl =
    (event.notification &&
      event.notification.data &&
      event.notification.data.url) ||
    "/system/main.html";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];

        if ("focus" in client) {
          if (client.url.includes("/system/")) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

/* =========================
   NOTIFICATION CLOSE
========================= */
self.addEventListener("notificationclose", function () {
  // يمكن إضافة تتبع لاحقاً عند الحاجة
});

/* =========================
   MESSAGE
========================= */
self.addEventListener("message", function (event) {
  if (!event.data) return;

  if (event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});