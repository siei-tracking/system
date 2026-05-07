/**
 * pwa-install.js  v2.0
 * يُعدّل <link rel="manifest"> ليشير للملف الثابت manifest.webmanifest
 * ويحدّث theme-color وعنوان الصفحة حسب الصفحة الحالية
 *
 * الاستخدام: <script src="/system/pwa-install.js"></script>
 * يشترط وجود: /system/manifest.webmanifest  (ملف ثابت على السيرفر)
 */
(function () {
  "use strict";

  /* ── أسماء الصفحات بالعربي (كاملة) ── */
  var PAGE_NAMES = { 
    "plan":        "خطة العمل",
    "finance":     "الشؤون المالية",
    "lab1":        "المختبر",
    "workshop":    "الورشة",
    "elev":        "الرفع والمناولة",
    "testresults": "نتائج الفحص",
    "official":    "المراسلات الرسمية",
    "barcode":     "الباركود",
    "email":       "البريد الإلكتروني",
    "results":     "نتائج البحث",
  "main":        "المعاملات المفتوحة"
  };

  var THEME_COLOR    = "#223243";
  var MANIFEST_PATH  = "/system/manifest.webmanifest";

  /* ── استخراج مفتاح الصفحة من الـ URL ── */
  function getCurrentPageKey() {
    var path = window.location.pathname;
    var file = path.split("/").pop()
                   .replace(/\.html?$/i, "")
                   .toLowerCase();
    return file || "main";
  }

  /* ── تعديل <link rel="manifest"> ليشير للملف الثابت ── */
  function injectManifestLink() {
    var existing = document.querySelector('link[rel="manifest"]');
    if (existing) {
      /* إذا كان يشير لـ blob أو مسار خاطئ — صحّحه */
      if (existing.href.indexOf("blob:") === 0 ||
          existing.href.indexOf(MANIFEST_PATH) === -1) {
        existing.href = MANIFEST_PATH;
      }
      return; /* موجود وصحيح */
    }
    var link  = document.createElement("link");
    link.rel  = "manifest";
    link.href = MANIFEST_PATH;
    document.head.appendChild(link);
  }

  /* ── تعيين theme-color ── */
  function injectThemeColor() {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = THEME_COLOR;
  }

  /* ── تعيين apple-mobile-web-app-title ── */
  function injectAppleMeta() {
    var pageKey  = getCurrentPageKey();
    var pageName = PAGE_NAMES[pageKey] || pageKey;

    /* عنوان التطبيق على iOS */
    var appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (!appleTitleMeta) {
      appleTitleMeta = document.createElement("meta");
      appleTitleMeta.name = "apple-mobile-web-app-title";
      document.head.appendChild(appleTitleMeta);
    }
    appleTitleMeta.content = pageName;

    /* قابل للتثبيت على iOS */
    var appleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    if (!appleCapable) {
      appleCapable = document.createElement("meta");
      appleCapable.name    = "apple-mobile-web-app-capable";
      appleCapable.content = "yes";
      document.head.appendChild(appleCapable);
    }
  }

  /* ── التشغيل ── */
  function init() {
    injectManifestLink();
    injectThemeColor();
    injectAppleMeta();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
