/* =========================================================
   notifications-widget.js  v3.0
   ملف موحد للإشعارات وتثبيت PWA — يعمل مع جميع الصفحات
   الاستخدام: أضف هذا السطر قبل </body> في كل صفحة:
   <script src="/system/notifications-widget.js" defer></script>
   ⚠️ تأكد أن الصفحة تعرض:
       window.PAGE_NAME , window.apiPost , window.getSessionToken
       (أو أن هذه الدوال معرّفة في النطاق العام)
========================================================= */
(function () {
  "use strict";

  /* ============================================================
   * CONFIG
   * ============================================================ */
  const FIREBASE_CONFIG = {
    apiKey:            "AIzaSyBhWJtOWJKlBk04Ii7mm93rhfECuQLKRbM",
    authDomain:        "tracking-web-218e8.firebaseapp.com",
    projectId:         "tracking-web-218e8",
    storageBucket:     "tracking-web-218e8.firebasestorage.app",
    messagingSenderId: "107177409442",
    appId:             "1:107177409442:web:c66ec3f1ad72e5fad610fb",
    measurementId:     "G-PCJX55XGQS"
  };
  const VAPID_KEY       = "BCVh972jCSmGqdWe7nDcWtepOrPGq7CwKdFNjT2gJ8IsMmhE1T0CEgOk9t5g8NQOlMNCW9peG67kUzrui6pFgFU";
  const SW_PATH         = "/system/firebase-messaging-sw.js";
  const SW_SCOPE        = "/system/";
  const POLL_INTERVAL   = 30000;   /* 30 ثانية */
  const INIT_DELAY      = 400;     /* انتظر حتى تنتهي الصفحة من التهيئة */
  const PWA_VERSION     = "v2";    /* غيّر هذا عند كل نشر جديد */

  /* ============================================================
   * STATE
   * ============================================================ */
  let messaging             = null;
  let swReg                 = null;
  let initialized           = false;
  let deferredPrompt        = null;
  let lastNotifIds          = [];
  let notifReady            = false;
  let pollTimer             = null;

  /* ============================================================
   * AUTO CLEAR: إذا التطبيق مُسح يعمل clear تلقائياً
   * الشروط: standalone=false + pwa_installed=yes + لا يوجد SW
   * ============================================================ */
  async function autoClearIfUninstalled() {
    try {
      /* Samsung: يستخدم sessionStorage فقط — لا حاجة للفحص */
      if (IS_SAMSUNG) return;

      /* فقط إذا pwa_installed=yes وليس standalone */
      if (localStorage.getItem("pwa_installed") !== "yes") return;
      if (window.matchMedia("(display-mode: standalone)").matches) return;
      if (window.navigator.standalone === true) return;

      /* تحقق من وجود SW */
      if (!("serviceWorker" in navigator)) return;
      const regs = await navigator.serviceWorker.getRegistrations();

      if (regs.length === 0) {
        /* لا يوجد SW = التطبيق مُسح */
        console.log("[PWA] اكتُشف مسح التطبيق — جاري التنظيف التلقائي...");

        /* مسح localStorage ما عدا توكنات الجلسة */
        const keysToKeep = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf("tracking_session_token") === 0) {
            keysToKeep[k] = localStorage.getItem(k);
          }
        }
        localStorage.clear();
        Object.keys(keysToKeep).forEach(function(k){
          localStorage.setItem(k, keysToKeep[k]);
        });

        /* مسح sessionStorage ما عدا توكنات الجلسة */
        const ssKeysToKeep = {};
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && k.indexOf("tracking_session_token") === 0) {
            ssKeysToKeep[k] = sessionStorage.getItem(k);
          }
        }
        sessionStorage.clear();
        Object.keys(ssKeysToKeep).forEach(function(k){
          sessionStorage.setItem(k, ssKeysToKeep[k]);
        });

        /* مسح الـ Cache */
        if ("caches" in window) {
          const keys = await caches.keys();
          for (const k of keys) await caches.delete(k);
        }

        console.log("[PWA] تنظيف تلقائي اكتمل");
      }
    } catch (e) {
      console.warn("[PWA] autoClearIfUninstalled:", e);
    }
  }

  /* ============================================================
   * تنظيف تلقائي عند تغيير الإصدار أو إعادة التثبيت
   * يحل مشكلة "التطبيق مثبت مسبقاً" في Chrome
   * ============================================================ */
  async function cleanupOnVersionChange() {
    try {
      const storedVersion = localStorage.getItem("pwa_version");

      /* إذا الإصدار تغيير أو لا يوجد — نظّف كل شيء */
      if (storedVersion !== PWA_VERSION) {
        console.log("[PWA] إصدار جديد — تنظيف البيانات القديمة");

        /* 1. مسح مفاتيح PWA */
        localStorage.removeItem("pwa_installed");
        localStorage.removeItem("app_installed");
        localStorage.removeItem("fcm_push_token");

        /* 2. إلغاء تسجيل Service Workers القديمة */
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          for (const reg of regs) {
            await reg.unregister();
            console.log("[PWA] SW unregistered:", reg.scope);
          }
        }

        /* 3. مسح الـ Cache القديم */
        if ("caches" in window) {
          const keys = await caches.keys();
          for (const key of keys) {
            await caches.delete(key);
            console.log("[PWA] Cache deleted:", key);
          }
        }

        /* 4. حفظ الإصدار الجديد */
        localStorage.setItem("pwa_version", PWA_VERSION);
        console.log("[PWA] تنظيف اكتمل — إصدار:", PWA_VERSION);
      }
    } catch (e) {
      console.warn("[PWA] cleanupOnVersionChange:", e);
    }
  }

  /* ============================================================
   * كشف المتصفح
   * ============================================================ */
  const UA         = navigator.userAgent || "";
  const IS_IOS     = /iphone|ipad|ipod/i.test(UA);
  const IS_SAFARI  = /safari/i.test(UA) && !/chrome/i.test(UA);
  const IS_FF      = /firefox/i.test(UA);
  const IS_SAMSUNG = /samsungbrowser/i.test(UA);
  /* Samsung Internet يدعم beforeinstallprompt لكن يتأخر أحياناً */
  const PROMPT_TIMEOUT = IS_SAMSUNG ? 4000 : 0;

  /* ============================================================
   * HELPERS — الوصول لدوال الصفحة بأمان
   * يعمل سواء كانت معرّفة كـ window.x أو في النطاق العام
   * ============================================================ */
  function getPageName() {
    return String(window.PAGE_NAME || "main").trim().toLowerCase();
  }

  function callApiPost(payload) {
    /* حاول window.apiPost أولاً، ثم apiPost العام */
    const fn = window.apiPost || (typeof apiPost !== "undefined" ? apiPost : null);
    if (typeof fn === "function") return fn(payload);
    return Promise.reject(new Error("apiPost غير معرّف"));
  }

  function callGetSessionToken() {
    const fn = window.getSessionToken || (typeof getSessionToken !== "undefined" ? getSessionToken : null);
    if (typeof fn === "function") return fn();
    return null;
  }

  function callShowMsg(msg, type) {
    const fn = window.showMsg || (typeof showMsg !== "undefined" ? showMsg : null);
    if (typeof fn === "function") { fn(msg, type || "ok"); return; }
    console.log("[Widget]", msg);
  }

  function hasPageFunctions() {
    return !!(
      (window.apiPost        || typeof apiPost        !== "undefined") &&
      (window.getSessionToken || typeof getSessionToken !== "undefined")
    );
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function $(id) { return document.getElementById(id); }

  /* ============================================================
   * تحميل سكريبت خارجي
   * ============================================================ */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("فشل تحميل: " + src)); };
      document.head.appendChild(s);
    });
  }

  /* ============================================================
   * PWA: هل التطبيق مثبت؟
   * ============================================================ */
  function isInstalled() {
    /* 1. مفتوح كـ PWA standalone (Install الحقيقي) */
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.navigator.standalone === true) return true;

    /* 2. Samsung: تحقق من علم "add_to_home" — يُحفظ عند الضغط على الزر */
    if (IS_SAMSUNG) {
      return sessionStorage.getItem("samsung_installed") === "yes";
    }

    /* 3. Chrome / Edge: استخدم localStorage */
    return localStorage.getItem("pwa_installed") === "yes";
  }

  /* ============================================================
   * PWA: إظهار / إخفاء زر التثبيت
   * ============================================================ */
  function hideInstallBtn() {
    const btn = $("btnInstallApp");
    if (btn) btn.style.display = "none";
  }

  function showInstallBtn(label) {
    if (isInstalled()) { hideInstallBtn(); return; }
    const btn = $("btnInstallApp");
    if (!btn) return;
    if (label) btn.textContent = label;
    btn.style.display = "inline-flex";
  }

  /* ============================================================
   * PWA: تثبيت التطبيق
   * ============================================================ */
  async function installApp() {
    /* Chrome / Edge / Samsung */
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          if (IS_SAMSUNG) {
            /* Samsung: sessionStorage فقط — يُمسح تلقائياً عند إغلاق المتصفح */
            sessionStorage.setItem("samsung_installed", "yes");
          } else {
            localStorage.setItem("pwa_installed", "yes");
          }
          hideInstallBtn();
          callShowMsg("✅ تم تثبيت التطبيق بنجاح", "ok");
        } else {
          callShowMsg("ℹ️ تم إلغاء التثبيت", "warn");
        }
      } catch (e) {
        callShowMsg("⚠️ تعذر التثبيت: " + e.message, "warn");
      }
      deferredPrompt = null;
      return;
    }
    /* iOS Safari */
    if (IS_IOS && IS_SAFARI) { callShowMsg("📱 اضغط زر المشاركة ثم 'أضف إلى الشاشة الرئيسية'", "warn"); return; }
    /* iOS غير Safari */
    if (IS_IOS)  { callShowMsg("📱 افتح الصفحة في Safari ثم أضفها للشاشة الرئيسية", "warn"); return; }
    /* Firefox */
    if (IS_FF)   { callShowMsg("🦊 افتح القائمة ☰ ثم اختر 'تثبيت'", "warn"); return; }
    /* Samsung Internet بدون prompt */
    if (IS_SAMSUNG) {
      callShowMsg("📲 افتح قائمة ⋮ ثم 'إضافة صفحة إلى' ← 'الشاشة الرئيسية'", "warn");
      return;
    }

    /* Chrome / Edge بدون prompt — إرشادات واضحة */
    const isChrome = /chrome|chromium/i.test(UA) && !/edg/i.test(UA);
    const isEdge   = /edg\//i.test(UA);
    if (isChrome) {
      callShowMsg("📲 افتح قائمة Chrome ⋮ ثم اختر 'تثبيت منصة تتبع أوامر العمل...'", "warn");
      return;
    }
    if (isEdge) {
      callShowMsg("📲 افتح قائمة Edge ••• ثم اختر 'التطبيقات' ← 'تثبيت هذا الموقع كتطبيق'", "warn");
      return;
    }

    /* بقية المتصفحات */
    callShowMsg("ℹ️ افتح قائمة المتصفح واختر 'تثبيت التطبيق'", "warn");
  }

  /* ============================================================
   * PWA: إعداد مستمعات التثبيت
   * ============================================================ */
  function setupPWA() {
    if (isInstalled()) { hideInstallBtn(); return; }

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      if (isInstalled()) { hideInstallBtn(); return; }
      deferredPrompt = e;
      showInstallBtn("تثبيت التطبيق");
    });

    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      if (IS_SAMSUNG) {
        sessionStorage.setItem("samsung_installed", "yes");
      } else {
        localStorage.setItem("pwa_installed", "yes");
      }
      hideInstallBtn();
      callShowMsg("✅ تم تثبيت التطبيق", "ok");
    });

    /* iOS Safari: أظهر الزر دائماً */
    if (IS_IOS && IS_SAFARI) { showInstallBtn("أضف للشاشة الرئيسية"); return; }

    /* Firefox: أظهر الزر دائماً */
    if (IS_FF) { showInstallBtn("تثبيت التطبيق"); return; }

    /* انتظر وصول beforeinstallprompt
       Samsung: 4 ثواني — Chrome/Edge: 5 ثواني */
    setTimeout(function () {
      if (!deferredPrompt && !isInstalled()) {
        showInstallBtn("تثبيت التطبيق");
      }
    }, IS_SAMSUNG ? PROMPT_TIMEOUT : 5000);

    /* مراقبة standalone */
    window.matchMedia("(display-mode: standalone)").addEventListener("change", function (e) {
      if (e.matches) { localStorage.setItem("pwa_installed", "yes"); hideInstallBtn(); }
    });
  }

  /* ============================================================
   * Firebase: تهيئة
   * ============================================================ */
  async function ensureFirebase() {
    if (!window.firebase) {
      await loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js");
      await loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js");
    }
    if (!window.firebase.apps || !window.firebase.apps.length) {
      window.firebase.initializeApp(FIREBASE_CONFIG);
    }
    messaging = window.firebase.messaging();
    return messaging;
  }

  /* ============================================================
   * Service Worker: تسجيل
   * ============================================================ */
  async function registerSW() {
    if (!("serviceWorker" in navigator)) throw new Error("هذا المتصفح لا يدعم Service Worker");
    swReg = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
    await navigator.serviceWorker.ready;
    return swReg;
  }

  /* ============================================================
   * إشعارات المتصفح
   * ============================================================ */
  async function showBrowserNotif(title, body) {
    try {
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      let reg = swReg;
      if (!reg && "serviceWorker" in navigator) reg = await navigator.serviceWorker.getRegistration(SW_SCOPE);
      if (!reg) reg = await registerSW();
      if (reg && reg.showNotification) {
        reg.showNotification(title || "إشعار جديد", {
          body:    body || "",
          icon:    "/system/logo-192.png",
          badge:   "/system/logo-192.png",
          dir:     "rtl",
          lang:    "ar",
          vibrate: [200, 100, 200],
          data:    { url: "/system/" + getPageName() + ".html" }
        });
      }
    } catch (e) { console.warn("showBrowserNotif:", e); }
  }

  /* ============================================================
   * تفعيل الإشعارات (زر تفعيل الإشعارات)
   * ============================================================ */
  async function enableNotifications() {
    try {
      if (!hasPageFunctions())          { callShowMsg("❌ الصفحة غير جاهزة بعد، حاول مجدداً", "err"); return; }
      if (!("Notification" in window))  { callShowMsg("❌ هذا المتصفح لا يدعم الإشعارات", "err"); return; }

      const permission = await Notification.requestPermission();
      if (permission !== "granted")     { callShowMsg("⚠️ لم يتم منح إذن الإشعارات", "warn"); return; }

      await ensureFirebase();
      const reg = swReg || await registerSW();

      const pushToken = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      if (!pushToken) { callShowMsg("⚠️ تعذر إنشاء توكن الإشعارات", "warn"); return; }

      const sessionToken = callGetSessionToken();
      if (!sessionToken) { callShowMsg("⚠️ الجلسة غير موجودة", "warn"); return; }

      const res = await callApiPost({
        action: "savePushToken",
        token:  sessionToken,
        page:   getPageName(),
        pushToken
      });

      if (res && res.ok) {
        localStorage.setItem("fcm_push_token", pushToken);
        callShowMsg("✅ تم تفعيل الإشعارات بنجاح", "ok");
        setupForeground();
      } else {
        callShowMsg((res && (res.message || res.error)) || "❌ فشل حفظ التوكن", "err");
      }
    } catch (e) {
      console.error("enableNotifications:", e);
      callShowMsg("❌ فشل تفعيل الإشعارات", "err");
    }
  }

  /* ============================================================
   * تجديد الـ Token تلقائياً
   * ============================================================ */
  async function autoRefreshToken() {
    try {
      if (Notification.permission !== "granted") return;
      if (!messaging) await ensureFirebase();
      const reg = swReg || await registerSW();
      const current = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      if (!current) return;
      if (localStorage.getItem("fcm_push_token") === current) return;
      const sessionToken = callGetSessionToken();
      if (!sessionToken) return;
      const res = await callApiPost({ action:"savePushToken", token:sessionToken, page:getPageName(), pushToken:current });
      if (res && res.ok) localStorage.setItem("fcm_push_token", current);
    } catch (e) { console.warn("autoRefreshToken:", e); }
  }

  /* ============================================================
   * استقبال الرسائل Foreground
   * ============================================================ */
  function setupForeground() {
    try {
      if (!messaging) return;
      messaging.onMessage(function (payload) {
        const title = (payload && payload.notification && payload.notification.title) || "إشعار جديد";
        const body  = (payload && payload.notification && payload.notification.body)  || "";
        callShowMsg(title + (body ? " - " + body : ""), "ok");
        showBrowserNotif(title, body);
        loadNotifications();
      });
    } catch (e) { console.warn("setupForeground:", e); }
  }

  /* ============================================================
   * تحميل الإشعارات من السيرفر
   * ============================================================ */
  async function loadNotifications() {
    try {
      if (!hasPageFunctions()) return;
      const sessionToken = callGetSessionToken();
      if (!sessionToken) return;

      const res   = await callApiPost({ action:"getNotifications", token:sessionToken, page:getPageName() });
      const list  = $("notifList");
      const count = $("notifCount");
      if (!list || !count) return;

      const items = Array.isArray(res && res.items) ? res.items : [];

      if (!items.length) {
        list.innerHTML = '<div class="nw-empty" style="padding:20px;text-align:center;color:#758292;font-weight:900;">لا توجد إشعارات</div>';
        count.textContent = "0";
        count.style.display = "none";
        lastNotifIds = [];
        notifReady   = true;
        return;
      }

      const currentIds = items.map(function (n) { return String(n.id || ""); });
      const newItems   = items.filter(function (n) {
        const id = String(n.id || "");
        return id && notifReady && lastNotifIds.indexOf(id) === -1;
      });

      /* اكتشف تلقائياً هل الصفحة تستخدم notif-item أم nw-item */
      const usePageClass = !!document.querySelector(".notif-item, .notif-header");
      const itemClass    = usePageClass ? "notif-item" : "nw-item";
      const unreadClass  = usePageClass ? "unread"     : "nw-unread";
      const dateClass    = usePageClass ? "notif-date" : "nw-dt";

      let unread = 0;
      list.innerHTML = "";
      items.forEach(function (n) {
        const isRead = String(n.isRead).toLowerCase() === "true";
        if (!isRead) unread++;
        const id  = String(n.id || "").trim();
        const div = document.createElement("div");
        div.className = itemClass + (isRead ? "" : " " + unreadClass);
        div.style.color = "#223243";
        div.innerHTML =
          '<div style="font-weight:900;color:#223243;">' + escapeHtml(n.message   || "إشعار جديد") + '</div>' +
          '<div class="' + dateClass + '" style="font-size:12px;color:#758292;margin-top:4px;">' + escapeHtml(n.createdAt || "") + '</div>';
        div.addEventListener("click", function () { markRead(id); });
        list.appendChild(div);
      });

      count.textContent   = unread > 99 ? "99+" : String(unread);
      count.style.display = unread > 0 ? "flex" : "none";

      if (newItems.length > 0) showBrowserNotif("إشعار جديد", newItems[0].message || "لديك إشعار جديد");

      lastNotifIds = currentIds;
      notifReady   = true;
    } catch (e) { console.warn("loadNotifications:", e); }
  }

  /* ============================================================
   * تعليم إشعار كمقروء
   * ============================================================ */
  async function markRead(notifId) {
    try {
      const id = String(notifId || "").trim();
      if (!id || !hasPageFunctions()) return;
      const sessionToken = callGetSessionToken();
      if (!sessionToken) return;
      await callApiPost({ action:"markNotificationRead", token:sessionToken, page:getPageName(), notificationId:id });
      await loadNotifications();
    } catch (e) { console.warn("markRead:", e); }
  }

  /* ============================================================
   * فتح / إغلاق قائمة الإشعارات
   * ============================================================ */
  function toggleNotifBox() {
    const box = $("notifBox");
    if (!box) return;
    const open = box.style.display !== "block";
    box.style.display = open ? "block" : "none";
    if (open) loadNotifications();
  }

  function closeNotifBox() {
    const box = $("notifBox");
    if (box) box.style.display = "none";
  }

  /* ============================================================
   * إنشاء الـ Widget في الـ DOM
   * (فقط إذا لم تكن العناصر موجودة مسبقاً في HTML)
   * ============================================================ */
  function buildWidget() {
    /* إذا الصفحة لديها notifIcon مسبقاً لا تنشئ widget جديد */
    if ($("notifIcon")) return;

    const root = document.createElement("div");
    root.id = "nwRoot";
    root.innerHTML = `
      <style>
        #nwRoot{
          position:absolute;top:14px;right:14px;
          z-index:999999;font-family:'Cairo',Arial,sans-serif;direction:rtl;
        }
        .nw-row{ display:flex;gap:8px;align-items:center;flex-wrap:wrap; }
        #notifIcon{
          width:46px;height:46px;border-radius:50%;background:#fff;color:#223243;
          box-shadow:0 5px 14px rgba(0,0,0,.22);display:flex;align-items:center;
          justify-content:center;cursor:pointer;position:relative;font-size:20px;
          user-select:none;transition:transform .15s,box-shadow .15s;
        }
        #notifIcon:hover{ transform:scale(1.08);box-shadow:0 7px 18px rgba(0,0,0,.28); }
        #notifCount{
          position:absolute;top:-5px;right:-5px;min-width:20px;height:20px;padding:0 4px;
          border-radius:999px;background:#e74c3c;color:#fff;font-size:11px;font-weight:900;
          display:none;align-items:center;justify-content:center;line-height:1;
        }
        #btnEnableNotifications{
          border:none;border-radius:12px;padding:9px 12px;
          font-family:'Cairo',Arial,sans-serif;font-weight:900;font-size:14px;
          cursor:pointer;background:#1e3c72;color:#fff;white-space:nowrap;
          box-shadow:0 5px 14px rgba(0,0,0,.18);transition:transform .15s,opacity .15s;
          display:inline-flex;align-items:center;gap:6px;
        }
        #btnEnableNotifications:hover{ transform:translateY(-1px);opacity:.92; }
        #btnInstallApp{
          border:none;border-radius:12px;padding:9px 12px;
          font-family:'Cairo',Arial,sans-serif;font-weight:900;font-size:14px;
          cursor:pointer;background:#27ae60;color:#fff;white-space:nowrap;
          box-shadow:0 5px 14px rgba(0,0,0,.18);transition:transform .15s,opacity .15s;
          display:none;align-items:center;gap:6px;
        }
        #btnInstallApp:hover{ transform:translateY(-1px);opacity:.92; }
        #notifBox{
          display:none;position:absolute;top:56px;right:0;
          width:310px;max-width:calc(100vw - 20px);max-height:360px;overflow:auto;
          background:#fff !important;border-radius:14px;
          box-shadow:0 14px 30px rgba(0,0,0,.22);border:1px solid #e6edf4;color:#223243 !important;
        }
        .nw-hdr{
          padding:10px 14px;border-bottom:1px solid #eef2f6;
          font-weight:900;font-size:14px;color:#223243;
          display:flex;justify-content:space-between;align-items:center;
        }
        .nw-item{
          padding:11px 14px;border-bottom:1px solid #eef2f6;cursor:pointer;
          text-align:right;font-weight:800;font-size:14px;transition:background .12s;
          color:#223243 !important;background:#fff !important;
        }
        .nw-item:hover{ background:#f6f8fb !important; }
        .nw-item:last-child{ border-bottom:none; }
        .nw-item div{ color:#223243 !important; }
        .nw-unread{ border-right:3px solid #f5a623; }
        .nw-dt{ font-size:11px;color:#758292 !important;margin-top:4px;font-weight:700; }
        .nw-empty{ padding:20px;color:#758292 !important;font-weight:900;text-align:center;background:#fff; }
        @media(max-width:700px){
          #nwRoot{ top:10px;right:10px; }
          #btnEnableNotifications,#btnInstallApp{ padding:7px 10px;font-size:12px; }
          #notifIcon{ width:40px;height:40px;font-size:17px; }
          #notifBox{ width:260px;top:50px; }
        }
      </style>
      <div class="nw-row">
        <div id="notifIcon" title="الإشعارات" role="button" aria-label="الإشعارات">
          🔔<span id="notifCount">0</span>
        </div>
        <button id="btnEnableNotifications" type="button">🔔 تفعيل الإشعارات</button>
        <button id="btnInstallApp" type="button">📲 تثبيت التطبيق</button>
      </div>
      <div id="notifBox" role="dialog" aria-label="الإشعارات">
        <div class="nw-hdr"><span>الإشعارات</span></div>
        <div id="notifList"><div class="nw-empty">جاري التحميل...</div></div>
      </div>
    `;

    const header = document.querySelector(".company-header") || document.body;
    if (header && getComputedStyle(header).position === "static") header.style.position = "relative";
    header.appendChild(root);
  }

  /* ============================================================
   * ربط الأزرار (سواء من HTML أو من widget)
   * ============================================================ */
  function bindButtons() {
    /* زر الجرس */
    const icon = $("notifIcon");
    if (icon && !icon._nwBound) {
      icon.addEventListener("click", function (e) { e.stopPropagation(); toggleNotifBox(); });
      icon._nwBound = true;
    }
    /* زر تفعيل الإشعارات */
    const btnNotif = $("btnEnableNotifications");
    if (btnNotif && !btnNotif._nwBound) {
      btnNotif.addEventListener("click", enableNotifications);
      btnNotif._nwBound = true;
    }
    /* زر تثبيت التطبيق */
    const btnInstall = $("btnInstallApp");
    if (btnInstall && !btnInstall._nwBound) {
      btnInstall.addEventListener("click", installApp);
      btnInstall._nwBound = true;
    }
    /* إغلاق عند النقر خارج القائمة */
    if (!window._nwOutsideBound) {
      document.addEventListener("click", function (e) {
        const root = $("nwRoot") || $("notifWrapper");
        if (root && !root.contains(e.target)) closeNotifBox();
      });
      window._nwOutsideBound = true;
    }
  }

  /* ============================================================
   * تهيئة رئيسية
   * ============================================================ */
  async function init() {
    if (initialized) return;
    initialized = true;

    /* تنظيف عند تغيير الإصدار */
    await cleanupOnVersionChange();

    /* تنظيف تلقائي إذا اكتُشف مسح التطبيق */
    await autoClearIfUninstalled();

    /* بناء الـ Widget أو الربط بالعناصر الموجودة */
    buildWidget();
    bindButtons();
    setupPWA();

    /* Firebase + Service Worker */
    try { await ensureFirebase(); setupForeground(); } catch (e) { console.warn("Firebase:", e); }
    try { await registerSW();     } catch (e) { console.warn("SW:", e); }

    /* تجديد الـ Token إذا كان الإذن مفعلاً مسبقاً */
    try { await autoRefreshToken(); } catch (e) {}

    /* تحميل الإشعارات + بدء الـ Polling */
    await loadNotifications();
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(loadNotifications, POLL_INTERVAL);
  }

  /* ============================================================
   * تصدير للـ window (تستخدمها الصفحات مباشرة)
   * ============================================================ */
  window.loadNotifications       = loadNotifications;
  window.enableNotifications     = enableNotifications;
  window.showBrowserNotification = showBrowserNotif;
  window.markNotificationRead    = markRead;

  /* ============================================================
   * بدء تلقائي بعد تحميل الصفحة
   * ============================================================ */
  if (document.readyState === "complete") {
    setTimeout(init, INIT_DELAY);
  } else {
    window.addEventListener("load", function () { setTimeout(init, INIT_DELAY); });
  }

})();
