const CACHE_NAME = "tracking-pwa-v4";

const APP_SHELL = [
  "/system/",
  "/system/index.html",
  "/system/login.html",
  "/system/main.html",
  "/system/plan.html",
  "/system/admin.html",

  "/system/manifest.webmanifest", // 👈 هنا تضيفه

  "/system/watermark.css",
  "/system/logo.png",
  "/system/logo-192.png",
  "/system/logo-512.png"
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
   PUSH
========================= */
self.addEventListener("push", function (event) {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = {};
  }

  const title =
    (payload.notification && payload.notification.title) ||
    payload.title ||
    "إشعار جديد";

  const body =
    (payload.notification && payload.notification.body) ||
    payload.body ||
    "لديك إشعار جديد من النظام";

  const icon =
    (payload.notification && payload.notification.icon) ||
    "/system/logo-192.png";

  const badge =
    (payload.notification && payload.notification.badge) ||
    "/system/logo-192.png";

  const targetUrl =
    (payload.fcmOptions && payload.fcmOptions.link) ||
    (payload.data && payload.data.url) ||
    "/system/main.html";

  const data = {
    url: targetUrl,
    rawData: payload.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: icon,
      badge: badge,
      data: data,
      dir: "rtl",
      lang: "ar",
      renotify: true,
      requireInteraction: false,
      tag: (payload.data && payload.data.orderNo)
        ? "order-" + payload.data.orderNo
        : "tracking-notification"
    })
  );
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
self.addEventListener("notificationclose", function (event) {
  // اختياري: يمكن إضافة log مستقبلاً
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