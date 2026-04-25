/* =========================================================
   firebase-messaging-sw.js
   ارفعه في: /system/firebase-messaging-sw.js
========================================================= */

importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js");

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
