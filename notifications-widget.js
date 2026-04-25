/* =========================================================
   notifications-widget.js
   نظام إشعارات موحد لكل الصفحات
========================================================= */
(function(){
  "use strict";

  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBhWJtOWJKlBk04Ii7mm93rhfECuQLKRbM",
    authDomain: "tracking-web-218e8.firebaseapp.com",
    projectId: "tracking-web-218e8",
    storageBucket: "tracking-web-218e8.firebasestorage.app",
    messagingSenderId: "107177409442",
    appId: "1:107177409442:web:c66ec3f1ad72e5fad610fb",
    measurementId: "G-PCJX55XGQS"
  };

  const VAPID_KEY = "BCVh972jCSmGqdWe7nDcWtepOrPGq7CwKdFNjT2gJ8IsMmhE1T0CEgOk9t5g8NQOlMNCW9peG67kUzrui6pFgFU";
  const SW_PATH = "/system/firebase-messaging-sw.js";
  const SW_SCOPE = "/system/";

  let messaging = null;
  let swRegistration = null;
  let initialized = false;
  let deferredInstallPrompt = null;
  let lastNotificationIds = [];
  let notificationsTimer = null;

  function $(id){
    return document.getElementById(id);
  }

  function safePageName(){
    return String(window.PAGE_NAME || "main").trim().toLowerCase();
  }

  function toast(msg, type){
    if(typeof window.showMsg === "function"){
      window.showMsg(msg, type || "ok");
    }else{
      console.log(msg);
    }
  }

  function hasRequiredPageFunctions(){
    return (
      typeof window.apiPost === "function" &&
      typeof window.getSessionToken === "function"
    );
  }

  function escapeHtml(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function loadScript(src){
    return new Promise(function(resolve, reject){
      if(document.querySelector('script[src="' + src + '"]')){
        resolve();
        return;
      }

      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = function(){
        reject(new Error("فشل تحميل: " + src));
      };

      document.head.appendChild(s);
    });
  }

  async function ensureFirebase(){
    if(!window.firebase){
      await loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js");
    }

    if(!window.firebase.apps || !window.firebase.apps.length){
      window.firebase.initializeApp(FIREBASE_CONFIG);
    }

    messaging = window.firebase.messaging();
    return messaging;
  }

  async function registerServiceWorker(){
    if(!("serviceWorker" in navigator)){
      throw new Error("هذا المتصفح لا يدعم Service Worker");
    }

    swRegistration = await navigator.serviceWorker.register(SW_PATH, {
      scope: SW_SCOPE
    });

    await navigator.serviceWorker.ready;
    return swRegistration;
  }

  function createWidget(){
    if($("notifWidgetRoot")) return;

    const root = document.createElement("div");
    root.id = "notifWidgetRoot";

    root.innerHTML = `
      <style>
        #notifWidgetRoot{
          position:absolute;
          top:16px;
          right:16px;
          z-index:999999;
          font-family:'Cairo',Arial,sans-serif;
          direction:rtl;
        }

        #notifWidgetRoot .nw-row{
          display:flex;
          gap:8px;
          align-items:center;
          flex-wrap:wrap;
        }

        #notifIcon{
          width:48px;
          height:48px;
          border-radius:50%;
          background:#fff;
          color:#223243;
          box-shadow:0 5px 14px rgba(0,0,0,.22);
          display:flex;
          align-items:center;
          justify-content:center;
          cursor:pointer;
          user-select:none;
          position:relative;
          font-size:20px;
        }

        #notifCount{
          position:absolute;
          top:-6px;
          right:-6px;
          min-width:22px;
          height:22px;
          padding:0 5px;
          border-radius:999px;
          background:#e74c3c;
          color:#fff;
          font-size:12px;
          font-weight:900;
          display:flex;
          align-items:center;
          justify-content:center;
          line-height:1;
        }

        #btnEnableNotifications,
        #btnInstallApp{
          border:none;
          border-radius:12px;
          padding:10px 12px;
          font-family:'Cairo',Arial,sans-serif;
          font-weight:900;
          cursor:pointer;
          box-shadow:0 5px 14px rgba(0,0,0,.18);
          color:#fff;
          white-space:nowrap;
        }

        #btnEnableNotifications{
          background:#1e3c72;
        }

        #btnInstallApp{
          background:#27ae60;
          display:none;
        }

        #notifBox{
          display:none;
          position:absolute;
          top:58px;
          right:0;
          width:320px;
          max-width:calc(100vw - 24px);
          max-height:380px;
          overflow:auto;
          background:#fff;
          border-radius:14px;
          box-shadow:0 14px 30px rgba(0,0,0,.25);
          border:1px solid #e6edf4;
          color:#223243;
        }

        .notif-item{
          padding:12px;
          border-bottom:1px solid #eef2f6;
          cursor:pointer;
          text-align:right;
          font-weight:800;
        }

        .notif-item:hover{
          background:#f6f8fb;
        }

        .notif-date{
          font-size:12px;
          color:#758292;
          margin-top:5px;
          font-weight:700;
        }

        .notif-empty{
          padding:16px;
          color:#758292;
          font-weight:900;
          text-align:center;
        }

        @media(max-width:700px){
          #notifWidgetRoot{
            top:10px;
            right:10px;
          }

          #btnEnableNotifications,
          #btnInstallApp{
            padding:8px 10px;
            font-size:12px;
          }

          #notifIcon{
            width:42px;
            height:42px;
            font-size:18px;
          }

          #notifBox{
            width:280px;
            top:52px;
          }
        }
      </style>

      <div class="nw-row">
        <div id="notifIcon" title="الإشعارات">
          🔔
          <span id="notifCount">0</span>
        </div>

        <button id="btnEnableNotifications" type="button">تفعيل الإشعارات</button>
        <button id="btnInstallApp" type="button">تثبيت التطبيق</button>
      </div>

      <div id="notifBox">
        <div id="notifList">
          <div class="notif-empty">جاري التحميل...</div>
        </div>
      </div>
    `;

    const header = document.querySelector(".company-header") || document.body;

    if(header && getComputedStyle(header).position === "static"){
      header.style.position = "relative";
    }

    header.appendChild(root);

    $("notifIcon").addEventListener("click", function(e){
      e.stopPropagation();
      toggleNotificationsBox();
    });

    $("btnEnableNotifications").addEventListener("click", enableNotifications);
    $("btnInstallApp").addEventListener("click", installApp);

    document.addEventListener("click", function(e){
      const rootEl = $("notifWidgetRoot");
      if(rootEl && !rootEl.contains(e.target)){
        closeNotificationsBox();
      }
    });
  }

  async function installApp(){
    if(!deferredInstallPrompt){
      toast("ℹ️ خيار التثبيت غير متاح حالياً. جرّب من قائمة المتصفح ⋮ ثم Install app.", "warn");
      return;
    }

    deferredInstallPrompt.prompt();

    const choice = await deferredInstallPrompt.userChoice;

    if(choice && choice.outcome === "accepted"){
      toast("✅ تم قبول تثبيت التطبيق", "ok");
    }else{
      toast("ℹ️ تم إلغاء التثبيت", "warn");
    }

    deferredInstallPrompt = null;

    const btn = $("btnInstallApp");
    if(btn) btn.style.display = "none";
  }

  function setupInstallPrompt(){
    window.addEventListener("beforeinstallprompt", function(e){
      e.preventDefault();
      deferredInstallPrompt = e;

      const btn = $("btnInstallApp");
      if(btn){
        btn.style.display = "inline-flex";
      }
    });

    window.addEventListener("appinstalled", function(){
      deferredInstallPrompt = null;

      const btn = $("btnInstallApp");
      if(btn){
        btn.style.display = "none";
      }

      toast("✅ تم تثبيت التطبيق بنجاح", "ok");
    });
  }

  async function enableNotifications(){
    try{
      if(!hasRequiredPageFunctions()){
        toast("❌ دوال الصفحة غير معرفة قبل تحميل الإشعارات", "err");
        return;
      }

      if(!("Notification" in window)){
        toast("❌ هذا المتصفح لا يدعم الإشعارات", "err");
        return;
      }

      const permission = await Notification.requestPermission();

      if(permission !== "granted"){
        toast("⚠️ لم يتم منح إذن الإشعارات", "warn");
        return;
      }

      await ensureFirebase();

      const registration = await registerServiceWorker();

      const pushToken = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if(!pushToken){
        toast("⚠️ تعذر إنشاء توكن الإشعارات", "warn");
        return;
      }

      const sessionToken = window.getSessionToken();

      if(!sessionToken){
        toast("⚠️ الجلسة غير موجودة", "warn");
        return;
      }

      const res = await window.apiPost({
        action: "savePushToken",
        token: sessionToken,
        page: safePageName(),
        pushToken: pushToken
      });

      if(res && res.ok){
        toast("✅ تم تفعيل الإشعارات بنجاح", "ok");
      }else{
        toast((res && (res.message || res.error)) || "❌ فشل حفظ توكن الإشعارات", "err");
      }

    }catch(err){
      console.error("enableNotifications error:", err);
      toast("❌ فشل تفعيل الإشعارات", "err");
    }
  }

  async function loadNotifications(){
    try{
      if(!hasRequiredPageFunctions()) return;

      const sessionToken = window.getSessionToken();
      if(!sessionToken) return;

      const res = await window.apiPost({
        action: "getNotifications",
        token: sessionToken,
        page: safePageName()
      });

      const list = $("notifList");
      const count = $("notifCount");

      if(!list || !count) return;

      const items = Array.isArray(res && res.items) ? res.items : [];

      if(!items.length){
        list.innerHTML = '<div class="notif-empty">لا توجد إشعارات</div>';
        count.textContent = "0";
        lastNotificationIds = [];
        return;
      }

      const currentIds = items.map(function(n){
        return String(n.id || "");
      });

      const newItems = items.filter(function(n){
        const id = String(n.id || "");
        return id && lastNotificationIds.length && lastNotificationIds.indexOf(id) === -1;
      });

      let unread = 0;
      list.innerHTML = "";

      items.forEach(function(n){
        if(String(n.isRead).toLowerCase() !== "true"){
          unread++;
        }

        const id = String(n.id || "").trim();
        const div = document.createElement("div");

        div.className = "notif-item";
        div.innerHTML =
          '<div>' + escapeHtml(n.message || "إشعار جديد") + '</div>' +
          '<div class="notif-date">' + escapeHtml(n.createdAt || "") + '</div>';

        div.addEventListener("click", function(){
          markNotificationRead(id);
        });

        list.appendChild(div);
      });

      count.textContent = unread > 99 ? "99+" : String(unread);

      if(newItems.length > 0){
        showBrowserNotification("إشعار جديد", newItems[0].message || "لديك إشعار جديد");
      }

      lastNotificationIds = currentIds;

    }catch(err){
      console.log("loadNotifications error:", err);
    }
  }

  async function markNotificationRead(notificationId){
    try{
      const id = String(notificationId || "").trim();

      if(!id || !hasRequiredPageFunctions()) return;

      const sessionToken = window.getSessionToken();

      if(!sessionToken) return;

      await window.apiPost({
        action: "markNotificationRead",
        token: sessionToken,
        page: safePageName(),
        notificationId: id
      });

      await loadNotifications();

    }catch(err){
      console.log("markNotificationRead error:", err);
    }
  }

  function toggleNotificationsBox(){
    const box = $("notifBox");
    if(!box) return;

    const open = box.style.display !== "block";
    box.style.display = open ? "block" : "none";

    if(open){
      loadNotifications();
    }
  }

  function closeNotificationsBox(){
    const box = $("notifBox");
    if(box){
      box.style.display = "none";
    }
  }

  async function showBrowserNotification(title, body){
    try{
      if(!("Notification" in window)) return;
      if(Notification.permission !== "granted") return;

      let reg = swRegistration;

      if(!reg && "serviceWorker" in navigator){
        reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      }

      if(!reg && "serviceWorker" in navigator){
        reg = await registerServiceWorker();
      }

      if(reg && reg.showNotification){
        reg.showNotification(title || "إشعار جديد", {
          body: body || "",
          icon: "/system/logo-192.png",
          badge: "/system/logo-192.png",
          dir: "rtl",
          lang: "ar",
          data: {
            url: "/system/" + safePageName() + ".html"
          }
        });
      }

    }catch(err){
      console.log("showBrowserNotification error:", err);
    }
  }

  function setupForegroundMessages(){
    try{
      if(!messaging) return;

      messaging.onMessage(function(payload){
        const title =
          (payload && payload.notification && payload.notification.title) ||
          (payload && payload.data && payload.data.title) ||
          "إشعار جديد";

        const body =
          (payload && payload.notification && payload.notification.body) ||
          (payload && payload.data && payload.data.body) ||
          "";

        toast(title + (body ? " - " + body : ""), "ok");
        showBrowserNotification(title, body);
        loadNotifications();
      });

    }catch(err){
      console.log("foreground setup error:", err);
    }
  }

  async function initNotificationsWidget(){
    if(initialized) return;

    initialized = true;

    createWidget();
    setupInstallPrompt();

    try{
      await ensureFirebase();
      setupForegroundMessages();
    }catch(err){
      console.log("Firebase init warning:", err);
    }

    try{
      await registerServiceWorker();
    }catch(err){
      console.log("Service Worker warning:", err);
    }

    loadNotifications();

    if(notificationsTimer){
      clearInterval(notificationsTimer);
    }

    notificationsTimer = setInterval(loadNotifications, 30000);
  }

  window.initNotificationsWidget = initNotificationsWidget;
  window.loadNotifications = loadNotifications;
  window.enableNotifications = enableNotifications;
  window.showBrowserNotification = showBrowserNotification;

  window.addEventListener("load", function(){
    setTimeout(initNotificationsWidget, 200);
  });

})();