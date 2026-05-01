/**
 * pwa-install.js
 * يُولّد manifest ديناميكي بحيث start_url = الصفحة الحالية
 * أضفه في كل صفحة HTML:  <script src="/system/pwa-install.js"></script>
 */
(function(){
  "use strict";

  /* ── أسماء الصفحات بالعربي ── */
  var PAGE_NAMES = {
    "main":    "المعاملات المفتوحة",
    "results": "نتائج البحث",
    "admin":   "إدارة المستخدمين",
    "login":   "تسجيل الدخول"
  };

  /* ── بيانات الـ manifest الثابتة ── */
  var BASE_MANIFEST = {
    name:             "منصة تتبع أوامر العمل",
    short_name:       "تتبع العمل",
    description:      "منصة تتبع أوامر العمل - الشركة العامة للفحص والتأهيل الهندسي",
    scope:            "/system/",
    display:          "standalone",
    background_color: "#223243",
    theme_color:      "#223243",
    lang:             "ar",
    dir:              "rtl",
    orientation:      "portrait-primary",
    categories:       ["business", "productivity"],
    icons: [
      { src:"/system/logo-192.png",          sizes:"192x192", type:"image/png", purpose:"any"      },
      { src:"/system/logo-192-maskable.png", sizes:"192x192", type:"image/png", purpose:"maskable" },
      { src:"/system/logo-512.png",          sizes:"512x512", type:"image/png", purpose:"any"      },
      { src:"/system/logo-512-maskable.png", sizes:"512x512", type:"image/png", purpose:"maskable" }
    ]
  };

  function getCurrentPageKey(){
    var path = window.location.pathname;           // e.g. /system/main.html
    var file = path.split("/").pop()               // main.html
                   .replace(/\.html?$/i, "")       // main
                   .toLowerCase();
    return file || "main";
  }

  function buildManifest(){
    var pageKey  = getCurrentPageKey();
    var pageName = PAGE_NAMES[pageKey] || pageKey;
    var startUrl = window.location.pathname + "?source=pwa";

    var manifest = Object.assign({}, BASE_MANIFEST, {
      start_url:  startUrl,
      short_name: pageName,           /* اسم الأيقونة يعكس الصفحة */
      shortcuts: [
        {
          name:       "المعاملات المفتوحة",
          short_name: "معاملات",
          url:        "/system/main.html?source=pwa-shortcut",
          icons:      [{ src:"/system/logo-192.png", sizes:"192x192" }]
        },
        {
          name:       "نتائج البحث",
          short_name: "نتائج",
          url:        "/system/results.html?source=pwa-shortcut",
          icons:      [{ src:"/system/logo-192.png", sizes:"192x192" }]
        }
      ]
    });

    return JSON.stringify(manifest);
  }

  function injectManifest(){
    /* احذف أي manifest موجود */
    var existing = document.querySelector('link[rel="manifest"]');
    if(existing) existing.parentNode.removeChild(existing);

    /* أنشئ Blob URL من الـ manifest الديناميكي */
    var json = buildManifest();
    var blob = new Blob([json], { type:"application/manifest+json" });
    var url  = URL.createObjectURL(blob);

    var link = document.createElement("link");
    link.rel  = "manifest";
    link.href = url;
    document.head.appendChild(link);
  }

  /* ── تشغيل عند جهوزية الـ DOM ── */
  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", injectManifest);
  } else {
    injectManifest();
  }

})();
