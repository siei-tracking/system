/**
 * splash-screen.js
 * شاشة بداية مخصصة تظهر عند فتح التطبيق كـ PWA
 * أضفه في كل صفحة: <script src="/system/splash-screen.js"></script>
 */
(function () {
  "use strict";

  /* تشغيل فقط في وضع PWA standalone */
  var isPwa = window.matchMedia("(display-mode: standalone)").matches
           || window.navigator.standalone;
  if (!isPwa) return;

  /* منع التكرار */
  if (window._splashShown) return;
  window._splashShown = true;

  var PAGE_NAMES = {
    "index":       "تتبع أوامر العمل",
    "plan":        "اصدار أمر العمل",
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

  function getPageName() {
    var file = window.location.pathname.split("/").pop()
               .replace(/\.html?$/i, "").toLowerCase();
    return PAGE_NAMES[file] || "منصة تتبع أوامر العمل";
  }

  /* إنشاء شاشة البداية */
  var splash = document.createElement("div");
  splash.id = "pwa-splash";
  splash.innerHTML =
    '<img src="/system/logo-192.png" width="96" height="96" style="border-radius:50%;border:3px solid rgba(255,255,255,0.3);margin-bottom:20px">' +
    '<div style="font-size:20px;font-weight:900;color:#fff;font-family:Cairo,sans-serif">' + getPageName() + '</div>' +
    '<div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:6px;font-family:Cairo,sans-serif">منصة تتبع أوامر العمل</div>';

  splash.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:999999",
    "background:#223243",
    "display:flex",
    "flex-direction:column",
    "align-items:center",
    "justify-content:center",
    "text-align:center",
    "direction:rtl",
    "transition:opacity 0.4s ease"
  ].join(";");

  /* أضفه فور جهوزية الـ DOM */
  function show() {
    document.body.appendChild(splash);

    /* اختفاء بعد 1.2 ثانية */
    setTimeout(function () {
      splash.style.opacity = "0";
      setTimeout(function () {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 400);
    }, 1200);
  }

  if (document.body) {
    show();
  } else {
    document.addEventListener("DOMContentLoaded", show);
  }

})();
