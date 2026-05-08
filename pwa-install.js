/**
 * pwa-install.js  v3.1
 * يُشير لملف manifest خاص بكل صفحة
 * بحيث start_url = الصفحة التي ثبّت منها المستخدم
 *
 * الاستخدام: <script src="/system/pwa-install.js"></script>
 * يشترط رفع ملفات manifest في /system/ بالأسماء:
 *   manifest-main.webmanifest , manifest-elev.webmanifest ... إلخ
 */
(function () {
  "use strict";

  var PAGE_NAMES = {
    "index":       "تتبع اوامر العمل",
    "plan":        "اصدار امر العمل وتثبت السعر",
    "finance":     "التسديد",
    "lab1":        "المختبرات",
    "workshop":    "الورشة",
    "elev":        "المصاعد",
    "testresults": "نتائج الفحص",
    "official":    "الكتاب الرسمي",
    "barcode":     "الباركود",
    "email":       "الإيميل",
    "results":     "تسليم النتائج",
    "main":        "المعاملات"
  };

  var PAGES_WITH_MANIFEST = [
    "main","results","plan","finance","lab1",
    "workshop","elev","testresults","official","barcode","email"
  ];

  var THEME_COLOR      = "#223243";
  var MANIFEST_BASE    = "/system/manifest-";
  var MANIFEST_EXT     = ".webmanifest";
  var MANIFEST_DEFAULT = "/system/manifest-main.webmanifest";

  /* ── معرف الجهاز — ينشأ مرة واحدة ويبقى ثابتاً ── */
  function ensureDeviceId() {
    var key = "pwa_device_id";
    try {
      var id = localStorage.getItem(key);
      if (!id) {
        id = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
        localStorage.setItem(key, id);
      }
      /* اجعله متاحاً لكل الملفات الأخرى */
      window.PWA_DEVICE_ID = id;
    } catch(e) {
      window.PWA_DEVICE_ID = "unknown";
    }
  }

  function getCurrentPageKey() {
    var path = window.location.pathname;
    var file = path.split("/").pop()
                   .replace(/\.html?$/i, "")
                   .toLowerCase();
    return file || "main";
  }

  function getManifestPath(pageKey) {
    if (PAGES_WITH_MANIFEST.indexOf(pageKey) !== -1) {
      return MANIFEST_BASE + pageKey + MANIFEST_EXT;
    }
    return MANIFEST_DEFAULT;
  }

  function injectManifestLink(manifestPath) {
    var existing = document.querySelector('link[rel="manifest"]');
    if (existing) {
      if (existing.getAttribute("href") !== manifestPath) {
        existing.setAttribute("href", manifestPath);
      }
      return;
    }
    var link = document.createElement("link");
    link.rel  = "manifest";
    link.setAttribute("href", manifestPath);
    document.head.appendChild(link);
  }

  function injectThemeColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = THEME_COLOR;
  }

  function injectAppleMeta(pageName) {
    var pairs = [
      ["apple-mobile-web-app-title",            pageName],
      ["apple-mobile-web-app-capable",          "yes"],
      ["apple-mobile-web-app-status-bar-style", "black-translucent"],
      ["mobile-web-app-capable",                "yes"]
    ];
    pairs.forEach(function (pair) {
      var meta = document.querySelector('meta[name="' + pair[0] + '"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = pair[0];
        document.head.appendChild(meta);
      }
      meta.content = pair[1];
    });
  }

  function init() {
    ensureDeviceId();   /* ✅ أنشئ Device ID فوراً عند أول فتح */

    var pageKey      = getCurrentPageKey();
    var pageName     = PAGE_NAMES[pageKey] || pageKey;
    var manifestPath = getManifestPath(pageKey);

    injectManifestLink(manifestPath);
    injectThemeColor();
    injectAppleMeta(pageName);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();