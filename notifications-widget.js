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
  const INIT_DELAY      = 0;       /* لا تأخير — الـ widget يبدأ فوراً */
  const PWA_VERSION     = "v2";    /* غيّر هذا عند كل نشر جديد */

  /* ============================================================
   * ⚙️ إعدادات الأزرار — عدّل هنا بسهولة
   * ============================================================ */

  /* زر تفعيل الإشعارات */
  /* ============================================================
   * ⚙️ زر تفعيل الإشعارات — تحكم كامل
   * ============================================================ */
  /* ============================================================
   * ⚙️ زر تفعيل الإشعارات — تحكم كامل ومستقل
   * ============================================================ */
  const NOTIF_BTN = {
    text:              "🔔 تفعيل الإشعارات", /* نص الزر */
    bg:                "#1e3c72",   /* لون الخلفية */
    color:             "#ffffff",   /* لون النص */
    border_radius:     "12px",      /* استدارة الزوايا */
    /* ── حاسبة ── */
    desktop_position:  "absolute",  /* absolute = داخل الهيدر */
    desktop_top:       "14px",      /* المسافة من الأعلى */
    desktop_left:      "14px",      /* المسافة من اليسار */
    desktop_size:      "14px",      /* حجم الخط */
    desktop_pad:       "9px 14px",  /* الحشوة */
    /* ── موبايل ── */
    mobile_position:   "fixed",     /* fixed = ثابت عند التمرير */
    mobile_top:        "10px",      /* المسافة من الأعلى */
    mobile_left:       "10px",      /* المسافة من اليسار */
    mobile_size:       "12px",      /* حجم الخط */
    mobile_pad:        "7px 11px",  /* الحشوة */
  };

  /* ============================================================
   * ⚙️ زر تثبيت التطبيق — تحكم كامل ومستقل
   * ============================================================ */
  const INSTALL_BTN = {
    text:              "📲 تثبيت التطبيق",  /* نص الزر */
    bg:                "#27ae60",   /* لون الخلفية */
    color:             "#ffffff",   /* لون النص */
    border_radius:     "12px",      /* استدارة الزوايا */
    /* ── حاسبة ── */
    desktop_position:  "absolute",  /* absolute = داخل الهيدر */
    desktop_top:       "14px",      /* المسافة من الأعلى — نفس زر الإشعارات للمحاذاة */
    desktop_left:      "175px",     /* المسافة من اليسار — بعد زر الإشعارات */
    desktop_size:      "14px",      /* حجم الخط */
    desktop_pad:       "9px 14px",  /* الحشوة */
    /* ── موبايل ── */
    mobile_position:   "fixed",     /* fixed = ثابت عند التمرير */
    mobile_top:        "50px",      /* المسافة من الأعلى — أسفل زر الإشعارات */
    mobile_left:       "-5px",      /* المسافة من اليسار — نفس زر الإشعارات */
    mobile_size:       "12px",      /* حجم الخط */
    mobile_pad:        "7px 11px",  /* الحشوة */
  };

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
   * AUTO CLEAR: كشف مسح التطبيق وتنظيف تلقائي
   *
   * المنطق:
   * - نحفظ timestamp عند التثبيت
   * - عند فتح الصفحة: إذا standalone=false + timestamp موجود
   *   + لم يفتح كـ standalone منذ فترة = مُسح على الأرجح
   * - Samsung: نعتمد على فقدان sessionStorage بين الجلسات
   * ============================================================ */
  function saveWithKeepingSession(storeFn, clearFn) {
    /* احفظ توكنات الجلسة قبل المسح ثم أعدها */
    const keep = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf("tracking_session_token") === 0) keep["ls_" + k] = localStorage.getItem(k);
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.indexOf("tracking_session_token") === 0) keep["ss_" + k] = sessionStorage.getItem(k);
      }
    } catch(e) {}

    clearFn();

    try {
      Object.keys(keep).forEach(function(k) {
        const val = keep[k];
        if (k.startsWith("ls_")) localStorage.setItem(k.slice(3), val);
        else sessionStorage.setItem(k.slice(3), val);
      });
    } catch(e) {}
  }

  async function doClear() {
    console.log("[PWA] تنظيف تلقائي...");
    saveWithKeepingSession(null, function() {
      /* احتفظ بحالة التثبيت حتى لا يظهر الزر مجدداً بعد المسح */
      const keepInstalled   = localStorage.getItem("pwa_installed_v2");
      const keepInstalledOld = localStorage.getItem("pwa_installed");
      localStorage.clear();
      sessionStorage.clear();
      if (keepInstalled)    localStorage.setItem("pwa_installed_v2", keepInstalled);
      if (keepInstalledOld) localStorage.setItem("pwa_installed", keepInstalledOld);
    });
    try {
      if ("caches" in window) {
        const keys = await caches.keys();
        keys.forEach(function(k){ caches.delete(k); });
      }
    } catch(e) {}
    console.log("[PWA] تنظيف اكتمل ✅");
  }

  async function autoClearIfUninstalled() {
    try {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches
                        || window.navigator.standalone === true;

      /* إذا مفتوح كـ standalone — حفظ الوقت والخروج */
      if (isStandalone) {
        localStorage.setItem("pwa_last_standalone", Date.now().toString());
        sessionStorage.setItem("pwa_session_standalone", "yes");
        return;
      }

      /* ── Samsung Internet ── */
      if (IS_SAMSUNG) {
        /* إذا تم التنظيف مسبقاً في هذه الجلسة — لا تكرر */
        if (sessionStorage.getItem("pwa_cleared_this_session") === "yes") return;

        const lastStandalone = localStorage.getItem("pwa_last_standalone");

        /* لا يوجد تاريخ standalone سابق = لم يُثبَّت قبلاً */
        if (!lastStandalone) return;

        const daysSince = (Date.now() - parseInt(lastStandalone)) / 86400000;

        /* إذا آخر standalone أكثر من يوم → على الأرجح مُسح */
        if (daysSince > 1) {
          console.log("[PWA Samsung] اكتُشف مسح — منذ " + daysSince.toFixed(1) + " يوم");
          /* احفظ علامة "تم التنظيف" في sessionStorage قبل المسح */
          sessionStorage.setItem("pwa_cleared_this_session", "yes");
          await doClear();
          /* امسح lastStandalone حتى لا يتكرر */
          localStorage.removeItem("pwa_last_standalone");
        }
        return;
      }

      /* ── Chrome / Edge ── */
      if (localStorage.getItem("pwa_installed") !== "yes") return;

      /* تحقق من SW */
      if (!("serviceWorker" in navigator)) return;
      const regs = await navigator.serviceWorker.getRegistrations();

      if (regs.length === 0) {
        console.log("[PWA Chrome] لا يوجد SW — اكتُشف مسح");
        await doClear();
        return;
      }

      /* SW موجود لكن تحقق من lastStandalone */
      const lastStandalone = localStorage.getItem("pwa_last_standalone");
      if (lastStandalone) {
        const daysSince = (Date.now() - parseInt(lastStandalone)) / 86400000;
        if (daysSince > 30) {
          /* لم يُفتح كـ standalone منذ 30 يوم → امسح */
          console.log("[PWA Chrome] لم يُفتح standalone منذ " + daysSince.toFixed(0) + " يوم");
          await doClear();
        }
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
        localStorage.removeItem("pwa_installed_v2");
        localStorage.removeItem("app_installed");
        localStorage.removeItem("fcm_push_token");
        localStorage.removeItem("pwa_last_standalone");

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
   * PWA — نظام تثبيت موحّد
   * يدعم: Chrome · Edge · Safari iOS · Samsung · Firefox
   * ============================================================ */

  /* ── مفتاح التخزين ── */
  const PWA_INSTALLED_KEY = "pwa_installed_v2";

  /* ── هل مثبت فعلاً؟ ── */
  function isInstalled() {
    /* 1. يعمل كـ PWA (standalone أو minimal-ui أو fullscreen) */
    if (window.matchMedia("(display-mode: standalone)").matches)  return true;
    if (window.matchMedia("(display-mode: minimal-ui)").matches)  return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches)  return true;
    /* 2. iOS Safari standalone */
    if (window.navigator.standalone === true) return true;
    /* 3. مسجّل في localStorage (Chrome/Edge/Samsung بعد التثبيت) */
    if (localStorage.getItem(PWA_INSTALLED_KEY) === "yes") return true;
    /* 4. توافق مع النسخ القديمة */
    if (localStorage.getItem("pwa_installed") === "yes") return true;
    return false;
  }

  /* ── إخفاء الزر ── */
  function hideInstallBtn() {
    const btn = $("btnInstallApp");
    if (btn) btn.style.display = "none";
  }

  /* ── إظهار الزر ── */
  function showInstallBtn(label) {
    /* لا تُظهره إذا كان مثبتاً مسبقاً */
    if (isInstalled()) { hideInstallBtn(); return; }
    const btn = $("btnInstallApp");
    if (!btn) return;
    if (label) btn.textContent = "📲 " + label;
    btn.style.display = "inline-flex";
  }

  /* ── تسجيل التثبيت ── */
  function markInstalled() {
    localStorage.setItem(PWA_INSTALLED_KEY, "yes");
    localStorage.setItem("pwa_installed", "yes");
    localStorage.setItem("pwa_last_standalone", Date.now().toString());
    deferredPrompt = null;
    hideInstallBtn();
    callShowMsg("✅ تم تثبيت التطبيق بنجاح", "ok");
  }

  /* ── تنفيذ التثبيت عند الضغط ── */
  async function installApp() {

    /* ── Chrome / Edge / Samsung: لديهم beforeinstallprompt ── */
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          markInstalled();
        } else {
          callShowMsg("ℹ️ تم إلغاء التثبيت", "warn");
          deferredPrompt = null;
        }
      } catch (e) {
        callShowMsg("⚠️ تعذر التثبيت، حاول مجدداً", "warn");
        deferredPrompt = null;
      }
      return;
    }

    /* ── iOS Safari: تعليمات يدوية ── */
    if (IS_IOS && IS_SAFARI) {
      callShowMsg("📱 اضغط زر المشاركة ↑ ثم اختر «إضافة إلى الشاشة الرئيسية»", "warn");
      return;
    }

    /* ── iOS متصفحات أخرى (Chrome على iOS) ── */
    if (IS_IOS) {
      callShowMsg("📱 افتح الصفحة في Safari ثم اضغط المشاركة ↑ وأضفها للشاشة الرئيسية", "warn");
      return;
    }

    /* ── Samsung Internet بدون prompt ── */
    if (IS_SAMSUNG) {
      callShowMsg("📲 افتح قائمة ⋮ ← «إضافة صفحة إلى» ← «الشاشة الرئيسية»", "warn");
      return;
    }

    /* ── Firefox ── */
    if (IS_FF) {
      callShowMsg("🦊 افتح القائمة ☰ ثم اختر «تثبيت»", "warn");
      return;
    }

    /* ── Chrome بدون prompt (لم يصل بعد) ── */
    if (/chrome|chromium/i.test(UA) && !/edg/i.test(UA)) {
      callShowMsg("📲 افتح قائمة Chrome ⋮ ثم اختر «تثبيت التطبيق...»", "warn");
      return;
    }

    /* ── Edge بدون prompt ── */
    if (/edg\//i.test(UA)) {
      callShowMsg("📲 افتح قائمة Edge ••• ← «التطبيقات» ← «تثبيت هذا الموقع كتطبيق»", "warn");
      return;
    }

    callShowMsg("📲 افتح قائمة المتصفح واختر «تثبيت التطبيق»", "warn");
  }

  /* ── إعداد مستمعات PWA ── */
  function setupPWA() {

    /* إذا مثبت مسبقاً — أخفِ الزر وانتهِ */
    if (isInstalled()) {
      hideInstallBtn();
      return;
    }

    /* ── beforeinstallprompt: Chrome / Edge / Samsung ── */
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (!isInstalled()) showInstallBtn("تثبيت التطبيق");
    });

    /* ── appinstalled: يُطلق بعد التثبيت الناجح ── */
    window.addEventListener("appinstalled", function () {
      markInstalled();
    });

    /* ── مراقبة التحوّل لـ standalone ── */
    try {
      window.matchMedia("(display-mode: standalone)").addEventListener("change", function (e) {
        if (e.matches) markInstalled();
      });
    } catch(e) {}

    /* ── iOS Safari: أظهر الزر دائماً ── */
    if (IS_IOS && IS_SAFARI) {
      showInstallBtn("أضف للشاشة الرئيسية");
      return;
    }

    /* ── Firefox: أظهر الزر دائماً ── */
    if (IS_FF) {
      showInstallBtn("تثبيت التطبيق");
      return;
    }

    /* ── iOS متصفحات أخرى ── */
    if (IS_IOS) {
      showInstallBtn("تثبيت التطبيق");
      return;
    }

    /* ── Samsung: انتظر أطول لأن beforeinstallprompt يتأخر ──
       ── Chrome/Edge: انتظر 1.5 ثانية ── */
    const waitTime = IS_SAMSUNG ? Math.max(PROMPT_TIMEOUT, 4000) : 1500;
    setTimeout(function () {
      if (isInstalled() || deferredPrompt) return;
      showInstallBtn("تثبيت التطبيق");
    }, waitTime);
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
   * تفعيل الإشعارات
   * Chrome / Edge / Samsung → Firebase FCM (Push حقيقي)
   * Safari / Firefox / iOS  → إذن فقط + Polling (بدون Push)
   * ============================================================ */
  async function enableNotifications() {
    try {
      if (!hasPageFunctions()) { callShowMsg("❌ الصفحة غير جاهزة بعد، حاول مجدداً", "err"); return; }
      if (!("Notification" in window)) { callShowMsg("❌ هذا المتصفح لا يدعم الإشعارات", "err"); return; }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") { callShowMsg("⚠️ لم يتم منح إذن الإشعارات", "warn"); return; }

      const sessionToken = callGetSessionToken();
      if (!sessionToken) { callShowMsg("⚠️ الجلسة غير موجودة", "warn"); return; }

      /* ══════════════════════════════════════════════════
       * Chrome / Edge / Samsung — Firebase FCM
       * Push حقيقي حتى لو الصفحة مغلقة
       * ══════════════════════════════════════════════════ */
      if (SUPPORTS_FCM) {
        try {
          await ensureFirebase();
          const reg = swReg || await registerSW();
          const pushToken = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
          if (!pushToken) { callShowMsg("⚠️ تعذر إنشاء توكن الإشعارات", "warn"); return; }

          const res = await callApiPost({ action:"savePushToken", token:sessionToken, page:getPageName(), pushToken });
          if (res && res.ok) {
            localStorage.setItem("fcm_push_token", pushToken);
            callShowMsg("✅ تم تفعيل الإشعارات بنجاح", "ok");
            updateBellShape();
            closeNotifBox();
            setupForeground();
          } else {
            callShowMsg((res && (res.message || res.error)) || "❌ فشل حفظ التوكن", "err");
          }
          return;
        } catch (e) {
          console.error("enableNotifications FCM:", e);
          callShowMsg("❌ فشل تفعيل الإشعارات: " + (e.message || ""), "err");
          return;
        }
      }

      /* ══════════════════════════════════════════════════
       * Safari / Firefox / iOS — Polling فقط (بدون Push)
       * الإشعارات تظهر فقط عند فتح الصفحة كل 30 ثانية
       * ══════════════════════════════════════════════════ */
      const res = await callApiPost({ action:"savePushToken", token:sessionToken, page:getPageName(), pushToken:"polling-only" });
      if (res && res.ok) {
        localStorage.setItem("fcm_push_token", "polling-only");
        callShowMsg("✅ تم تفعيل الإشعارات (ستظهر عند فتح الصفحة)", "ok");
        updateBellShape();
        closeNotifBox();
      } else {
        callShowMsg((res && (res.message || res.error)) || "❌ فشل تفعيل الإشعارات", "err");
      }

    } catch (e) {
      console.error("enableNotifications:", e);
      callShowMsg("❌ فشل تفعيل الإشعارات: " + (e.message || ""), "err");
    }
  }

  /* ============================================================
   * تجديد الـ Token تلقائياً
   * ============================================================ */
  async function autoRefreshToken() {
    try {
      if (Notification.permission !== "granted") return;
      if (!SUPPORTS_FCM) return; /* Safari/Firefox يعملان بـ polling فقط */
      const storedToken = localStorage.getItem("fcm_push_token");
      if (!storedToken || storedToken === "polling-only") return;

      if (!messaging) await ensureFirebase();
      const reg = swReg || await registerSW();
      const current = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
      if (!current || storedToken === current) return;

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

      /* تحميل الإشعارات من الـ cache المحلي فوراً بينما نجلب من السيرفر */
      const cachedCount = localStorage.getItem("nw_last_unread_count");
      const countEl = $("notifCount");
      if (cachedCount && countEl && countEl.textContent === "0") {
        const n = parseInt(cachedCount);
        if (n > 0) { countEl.textContent = n > 99 ? "99+" : String(n); countEl.style.display = "flex"; }
      }

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
        const serverRead = String(n.isRead).toLowerCase() === "true";
        const localRead  = !!localStorage.getItem("nw_read_" + String(n.id || "").trim());
        const isRead     = serverRead || localRead;
        if (!isRead) unread++;
        const id  = String(n.id || "").trim();
        const div = document.createElement("div");
        div.className = itemClass + (isRead ? "" : " " + unreadClass);
        div.style.color      = "#223243";
        div.style.background = isRead ? "#f0f0f0" : "#ffffff";
        div.innerHTML =
          '<div style="font-weight:900;color:#223243;">' + escapeHtml(n.message   || "إشعار جديد") + '</div>' +
          '<div class="' + dateClass + '" style="font-size:12px;color:#758292;margin-top:4px;">' + escapeHtml(n.createdAt || "") + '</div>';
        div.addEventListener("click", function () {
          /* تغيير اللون فوراً بدون انتظار السيرفر */
          this.style.background = "#f0f0f0";
          this.classList.remove(unreadClass);
          this.style.borderRight = "none";
          /* حفظ حالة القراءة محلياً */
          try { localStorage.setItem("nw_read_" + id, "1"); } catch(e){}
          markRead(id);
        });
        list.appendChild(div);
      });

      count.textContent   = unread > 99 ? "99+" : String(unread);
      count.style.display = unread > 0 ? "flex" : "none";
      /* حفظ العدد في الـ cache للتحميل السريع */
      try { localStorage.setItem("nw_last_unread_count", String(unread)); } catch(e){}

      if (newItems.length > 0) showBrowserNotif("إشعار جديد", newItems[0].message || "لديك إشعار جديد");

      /* مسح الـ cache المحلي للإشعارات المؤكدة من السيرفر */
      items.forEach(function(n) {
        if (String(n.isRead).toLowerCase() === "true") {
          try { localStorage.removeItem("nw_read_" + String(n.id || "").trim()); } catch(e){}
        }
      });
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
    const box  = $("notifBox");
    const icon = $("notifIcon");
    if (!box) return;
    const open = box.style.display !== "block";
    if (open && icon) {
      /* حساب موقع القائمة بناءً على موقع الجرس — فوق كل العناصر */
      const r = icon.getBoundingClientRect();
      box.style.top   = (r.bottom + 6) + "px";
      box.style.right = (window.innerWidth - r.right) + "px";
    }
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
    const header = document.querySelector(".company-header");
    /* إذا company-header غير موجود بعد — انتظر */
    if (!header) {
      setTimeout(buildWidget, 300);
      return;
    }
    if (getComputedStyle(header).position === "static") header.style.position = "relative";

    /* ── جرس الإشعارات — يمين الهيدر (مزدوج الوظيفة) ── */
    if (!$("notifIcon")) {
      const right = document.createElement("div");
      right.id = "nwRoot";
      right.innerHTML =
        '<style>' +
        '#nwRoot{position:absolute;top:14px;right:14px;z-index:999999;font-family:"Cairo",Arial,sans-serif;direction:rtl;}' +
        '#notifIcon{width:52px;height:52px;border-radius:50%;background:none;border:none;padding:0;' +
          'display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;' +
          'user-select:none;transition:transform .15s;}' +
        '#notifIcon:hover{transform:scale(1.08);}' +
        '#notifIcon:active{transform:scale(0.93);}' +
        '#notifIcon img{width:52px;height:52px;object-fit:contain;display:block;}' +
        '#notifCount{position:absolute;top:-5px;right:-5px;min-width:20px;height:20px;padding:0 4px;' +
          'border-radius:999px;background:#e74c3c;color:#fff;font-size:11px;font-weight:900;' +
          'display:none;align-items:center;justify-content:center;line-height:1;}' +
        '@keyframes nwRing{0%,100%{transform:rotate(0)}10%{transform:rotate(-8deg)}20%{transform:rotate(8deg)}30%{transform:rotate(-5deg)}40%{transform:rotate(5deg)}50%{transform:rotate(0)}}' +
        '#notifIcon.notif-on img{animation:nwRing 2.8s ease-in-out infinite;}' +
        '#notifBox{display:none;position:fixed;top:auto;right:14px;' +
          'width:310px;max-width:calc(100vw - 20px);max-height:360px;overflow:auto;' +
          'background:#fff !important;border-radius:14px;z-index:9999999;' +
          'box-shadow:0 14px 30px rgba(0,0,0,.22);border:1px solid #e6edf4;color:#223243 !important;}' +
        '.nw-hdr{padding:10px 14px;border-bottom:1px solid #eef2f6;font-weight:900;font-size:14px;color:#223243;}' +
        '.nw-item{padding:11px 14px;border-bottom:1px solid #eef2f6;cursor:pointer;' +
          'text-align:right;font-weight:800;font-size:14px;transition:background .12s;' +
          'color:#223243 !important;}' +
        '.nw-item:hover{filter:brightness(0.95);cursor:pointer;}' +
        '.nw-item:last-child{border-bottom:none;}' +
        '.nw-item div{color:#223243 !important;}' +
        '.nw-unread{border-right:3px solid #f5a623;}' +
        '.nw-dt{font-size:11px;color:#758292 !important;margin-top:4px;font-weight:700;}' +
        '.nw-empty{padding:20px;color:#758292 !important;font-weight:900;text-align:center;background:#fff;}' +
        '@media(max-width:700px){' +
          '#nwRoot{top:10px;right:10px;}' +
          '#notifIcon{width:44px;height:44px;}' +
          '#notifIcon img{width:44px;height:44px;}' +
          '#notifBox{width:260px;top:54px;}' +
        '}' +
        '</style>' +
        '<button id="notifIcon" class="notif-off" title="تفعيل الإشعارات" role="button" aria-label="الإشعارات">' +
          '<img id="nwBellImg" src="/system/bell-off.png" alt="الإشعارات" draggable="false"/>' +
          '<span id="notifCount">0</span>' +
        '</button>' +
        '<div id="notifBox" role="dialog" aria-label="الإشعارات">' +
          '<div class="nw-hdr"><span>الإشعارات</span></div>' +
          '<div id="notifList"><div class="nw-empty">جاري التحميل...</div></div>' +
        '</div>';
      header.appendChild(right);
      /* تحديث شكل الجرس فور البناء */
      setTimeout(updateBellShape, 50);
    }

    /* ── أزرار اليسار ── */
    if (!$("nwLeftBtns")) {
      const left = document.createElement("div");
      left.id = "nwLeftBtns";
      left.innerHTML =
        '<style>' +
        '#nwLeftBtns{' +
          'position:absolute;top:14px;left:14px;' +
          'z-index:999999;' +
          'display:flex;flex-direction:column;gap:8px;' +
          'align-items:flex-start;' +
          'font-family:"Cairo",Arial,sans-serif;' +
          'direction:ltr;' +
        '}' +
        '#nwLeftBtns button{direction:rtl;}' +
        '#btnEnableNotifications{' +
          'border:none;border-radius:50%;' +
          'background:none;' +
          'padding:0;' +
          'cursor:pointer;' +
          'box-shadow:none;' +
          'transition:transform .15s;' +
          'display:none;align-items:center;justify-content:center;' +
          'width:52px;height:52px;' +
        '}' +
        '#btnEnableNotifications:hover{transform:scale(1.08);}' +
        '#btnEnableNotifications:active{transform:scale(0.93);}' +
        /* ── الجرس المفعّل / المعطّل ── */
        '#bellActive{display:block;width:52px;height:52px;object-fit:contain;}' +
        '#bellInactive{display:none;width:52px;height:52px;object-fit:contain;}' +
        '#btnEnableNotifications.notif-on #bellActive{display:block;}' +
        '#btnEnableNotifications.notif-on #bellInactive{display:none;}' +
        '#btnEnableNotifications.notif-off #bellActive{display:none;}' +
        '#btnEnableNotifications.notif-off #bellInactive{display:block;}' +
        '@keyframes nwRing{0%,100%{transform:rotate(0)}10%{transform:rotate(-8deg)}20%{transform:rotate(8deg)}30%{transform:rotate(-5deg)}40%{transform:rotate(5deg)}50%{transform:rotate(0)}}' +
        '#btnEnableNotifications.notif-on #bellActive{animation:nwRing 2.8s ease-in-out infinite;}' +
        '#btnInstallApp{' +
          'border:none;border-radius:10px;' +
          'background:#27ae60;color:#fff;' +
          'font-size:11px;padding:6px 10px;' +
          'font-family:"Cairo",Arial,sans-serif;font-weight:900;' +
          'cursor:pointer;white-space:nowrap;' +
          'box-shadow:0 3px 8px rgba(0,0,0,.22);' +
          'transition:transform .15s,opacity .15s;' +
          'display:none;align-items:center;gap:5px;' +
        '}' +
        '#btnEnableNotifications:hover,#btnInstallApp:hover{' +
          'transform:translateY(-1px);opacity:.92;' +
        '}' +
        '@media(max-width:820px){' +
          '#nwLeftBtns{' +
            'position:absolute!important;' +
            'top:10px!important;left:10px!important;' +
          '}' +
          '#btnEnableNotifications,#btnInstallApp{' +
            'font-size:11px!important;' +
            'padding:6px 10px!important;' +
          '}' +
        '}' +
        '</style>' +
        '<button id="btnEnableNotifications" type="button" class="notif-off" style="display:none;" title="تفعيل الإشعارات">' +
        '<img id="bellActive"   src="/system/bell-on.png"  alt="الإشعارات مفعّلة"  draggable="false"/>' +
        '<img id="bellInactive" src="/system/bell-off.png" alt="الإشعارات معطّلة" draggable="false" style="display:none;"/>' +
        '</button>' +
        '<button id="btnInstallApp" type="button" style="display:none;">📲 تثبيت التطبيق</button>';
      header.appendChild(left);
    }
  }

  /* ============================================================
   * ربط الأزرار (سواء من HTML أو من widget)
   * ============================================================ */
  function bindButtons() {
    /* زر الجرس — مزدوج الوظيفة */
    const icon = $("notifIcon");
    if (icon && !icon._nwBound) {
      icon.addEventListener("click", function (e) {
        e.stopPropagation();
        /* نعتمد على class الجرس كمصدر الحقيقة الوحيد */
        if (icon.classList.contains("notif-on")) {
          toggleNotifBox();
        } else {
          enableNotifications();
        }
      });
      icon._nwBound = true;
    }
    /* زر تفعيل الإشعارات — مخفي (موحّد مع الجرس الأيمن) */
    const btnNotif = $("btnEnableNotifications");
    if (btnNotif) btnNotif.style.display = "none";
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
   * CLEAR DATA — متاح لجميع المستخدمين
   * ============================================================ */
  async function clearDataAndReload() {
    try {
      /* احفظ توكنات الجلسة */
      const keep = {}, ssKeep = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.indexOf("tracking_session_token") === 0) keep[k] = localStorage.getItem(k);
      }
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.indexOf("tracking_session_token") === 0) ssKeep[k] = sessionStorage.getItem(k);
      }
      /* امسح كل شيء */
      localStorage.clear();
      sessionStorage.clear();
      /* أعد الجلسة */
      Object.keys(keep).forEach(function(k){ localStorage.setItem(k, keep[k]); });
      Object.keys(ssKeep).forEach(function(k){ sessionStorage.setItem(k, ssKeep[k]); });
      /* مسح Cache */
      if ("caches" in window) {
        const keys = await caches.keys();
        keys.forEach(function(k){ caches.delete(k); });
      }
      /* إلغاء SW */
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        regs.forEach(function(r){ r.unregister(); });
      }
      callShowMsg("✅ تم المسح — جاري إعادة التحميل...", "ok");
      setTimeout(function(){ location.reload(true); }, 800);
    } catch(e) {
      callShowMsg("❌ خطأ في المسح", "err");
      console.warn("clearDataAndReload:", e);
    }
  }

  /* ============================================================
   * تهيئة رئيسية
   * ============================================================ */
  /* إظهار زر تفعيل الإشعارات دائماً وتحديث شكله */
  function updateNotifBtnVisibility() {
    /* تحديث شكل الجرس الأيمن حسب حالة الإشعارات */
    updateBellShape();
    /* إخفاء زر اليسار — الجرس الأيمن يقوم بكل شيء */
    const btn = document.getElementById("btnEnableNotifications");
    if (btn) btn.style.display = "none";
  }

  function updateBellShape() {
    const icon = document.getElementById("notifIcon");
    const img  = document.getElementById("nwBellImg");
    if (!icon || !img) return;
    const granted = ("Notification" in window) && Notification.permission === "granted"
                    && !!localStorage.getItem("fcm_push_token");
    if (granted) {
      icon.classList.remove("notif-off");
      icon.classList.add("notif-on");
      icon.title = "الإشعارات";
      img.src = "/system/bell-on.png";
    } else {
      icon.classList.remove("notif-on");
      icon.classList.add("notif-off");
      icon.title = "تفعيل الإشعارات";
      img.src = "/system/bell-off.png";
    }
  }

  async function init() {
    if (initialized) return;
    initialized = true;

    /* ── الخطوات الفورية: بناء الـ UI بدون أي انتظار ── */
    buildWidget();
    bindButtons();
    setupPWA();
    updateNotifBtnVisibility();

    /* ── تحميل الإشعارات فوراً في الخلفية ── */
    loadNotifications().catch(function(){});
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = setInterval(loadNotifications, POLL_INTERVAL);

    /* ── المهام الثقيلة تعمل بالتوازي في الخلفية ── */
    Promise.all([
      cleanupOnVersionChange().catch(function(){}),
      autoClearIfUninstalled().catch(function(){})
    ]).then(function() {
      /* Firebase + SW + Token بعد انتهاء التنظيف */
      return ensureFirebase()
        .then(function() { setupForeground(); return registerSW(); })
        .catch(function(e) { console.warn("Firebase/SW:", e); });
    }).then(function() {
      return autoRefreshToken().catch(function(){});
    }).then(function() {
      updateBellShape();
    }).catch(function(e) { console.warn("init background:", e); });
  }

  /* ============================================================
   * تصدير للـ window (تستخدمها الصفحات مباشرة)
   * ============================================================ */
  window.loadNotifications       = loadNotifications;
  window.clearDataAndReload      = clearDataAndReload;
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
