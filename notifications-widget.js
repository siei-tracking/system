/* notifications-widget.js */

(function(){
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyBhWJtOWJKlBk04Ii7mm93rhfECuQLKRbM",
    authDomain: "tracking-web-218e8.firebaseapp.com",
    projectId: "tracking-web-218e8",
    messagingSenderId: "107177409442",
    appId: "1:107177409442:web:c66ec3f1ad72e5fad610fb"
  };

  const VAPID_KEY = "BCVh972jCSmGqdWe7nDcWtepOrPGq7CwKdFNjT2gJ8IsMmhE1T0CEgOk9t5g8NQOlMNCW9peG67kUzrui6pFgFU";

  let deferredPrompt = null;

  function addStyle(){
    if(document.getElementById("notifWidgetStyle")) return;

    const style = document.createElement("style");
    style.id = "notifWidgetStyle";
    style.textContent = `
      #notifWidget{
        position:absolute;
        top:16px;
        right:16px;
        z-index:9999;
        display:flex;
        gap:8px;
        align-items:center;
        font-family:'Cairo',sans-serif;
      }

      #notifIcon{
        background:#fff;
        border-radius:50%;
        width:48px;
        height:48px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:20px;
        cursor:pointer;
        box-shadow:0 4px 10px rgba(0,0,0,.22);
        position:relative;
        color:#223243;
        user-select:none;
      }

      #notifCount{
        position:absolute;
        top:-6px;
        right:-6px;
        background:#e74c3c;
        color:#fff;
        font-size:12px;
        padding:3px 6px;
        border-radius:999px;
        min-width:22px;
        text-align:center;
        line-height:1.2;
        font-weight:900;
      }

      #notifBox{
        display:none;
        position:absolute;
        top:58px;
        right:0;
        width:280px;
        max-height:330px;
        overflow:auto;
        background:#fff;
        border-radius:12px;
        box-shadow:0 10px 25px rgba(0,0,0,.22);
        color:#223243;
      }

      .notif-item{
        padding:10px;
        border-bottom:1px solid #eee;
        text-align:right;
        cursor:pointer;
        font-weight:800;
        line-height:1.6;
      }

      .notif-item:hover{
        background:#f5f7fa;
      }

      .notif-item:last-child{
        border-bottom:none;
      }

      .notif-time{
        font-size:11px;
        color:#758292;
        margin-top:4px;
        font-weight:700;
      }

      #notifActions{
        position:absolute;
        top:16px;
        left:16px;
        z-index:9999;
        display:flex;
        gap:8px;
        align-items:center;
        font-family:'Cairo',sans-serif;
      }

      .notif-action-btn{
        border:none;
        border-radius:10px;
        padding:9px 12px;
        font-family:'Cairo',sans-serif;
        font-weight:900;
        cursor:pointer;
        color:#fff;
        box-shadow:0 6px 14px rgba(0,0,0,.16);
      }

      #btnEnableNotifications{
        background:#27ae60;
      }

      #btnInstallApp{
        background:#223243;
        display:none;
      }

      @media(max-width:600px){
        #notifWidget{
          top:10px;
          right:10px;
        }

        #notifActions{
          top:10px;
          left:10px;
          flex-direction:column;
          align-items:flex-start;
        }

        .notif-action-btn{
          padding:7px 9px;
          font-size:12px;
        }

        #notifIcon{
          width:42px;
          height:42px;
          font-size:18px;
        }

        #notifBox{
          width:240px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function createWidget(){
    if(document.getElementById("notifWidget")) return;

    const header = document.querySelector(".company-header") || document.body;
    if(getComputedStyle(header).position === "static"){
      header.style.position = "relative";
    }

    const bell = document.createElement("div");
    bell.id = "notifWidget";
    bell.innerHTML = `
      <div id="notifIcon" title="الإشعارات">
        🔔 <span id="notifCount">0</span>
      </div>
      <div id="notifBox">
        <div id="notifList">
          <div class="notif-item">لا توجد إشعارات</div>
        </div>
      </div>
    `;

    const actions = document.createElement("div");
    actions.id = "notifActions";
    actions.innerHTML = `
      <button id="btnEnableNotifications" class="notif-action-btn" type="button">🔔 تفعيل الإشعارات</button>
      <button id="btnInstallApp" class="notif-action-btn" type="button">📲 تثبيت التطبيق</button>
    `;

    header.appendChild(bell);
    header.appendChild(actions);
  }

  function pageName(){
    return window.PAGE_NAME || "main";
  }

  async function loadNotifications(){
    try{
      if(!window.apiPost || !window.getSessionToken) return;

      const token = window.getSessionToken();
      if(!token) return;

      const res = await window.apiPost({
        action:"getNotifications",
        token:token,
        page:pageName()
      });

      const list = document.getElementById("notifList");
      const count = document.getElementById("notifCount");
      if(!list || !count) return;

      const items = Array.isArray(res && res.items) ? res.items : [];
      const unread = Number((res && res.unread) || items.length || 0);

      list.innerHTML = "";

      if(!items.length){
        list.innerHTML = '<div class="notif-item">لا توجد إشعارات</div>';
        count.textContent = "0";
        return;
      }

      items.forEach(function(n){
        const div = document.createElement("div");
        div.className = "notif-item";
        div.innerHTML =
          '<div>' + escapeHtml(n.message || "إشعار جديد") + '</div>' +
          '<div class="notif-time">' + escapeHtml(n.createdAt || "") + '</div>';

        div.onclick = async function(){
          try{
            await window.apiPost({
              action:"markNotificationRead",
              token:token,
              page:pageName(),
              notificationId:n.id
            });

            if(n.page){
              window.location.href = "/system/" + n.page + ".html";
            }else{
              loadNotifications();
            }
          }catch(e){}
        };

        list.appendChild(div);
      });

      count.textContent = unread > 99 ? "99+" : String(unread);

    }catch(err){
      console.error("loadNotifications error:", err);
    }
  }

  function initBell(){
    const icon = document.getElementById("notifIcon");
    const box = document.getElementById("notifBox");
    if(!icon || !box) return;

    icon.addEventListener("click", function(e){
      e.stopPropagation();
      box.style.display = box.style.display === "block" ? "none" : "block";
      if(box.style.display === "block") loadNotifications();
    });

    document.addEventListener("click", function(e){
      if(!box.contains(e.target) && !icon.contains(e.target)){
        box.style.display = "none";
      }
    });
  }

  function loadScript(src){
    return new Promise(function(resolve, reject){
      if(document.querySelector('script[src="' + src + '"]')){
        resolve();
        return;
      }

      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function initFirebase(){
    await loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js");

    if(!window.firebase.apps.length){
      window.firebase.initializeApp(FIREBASE_CONFIG);
    }

    return window.firebase.messaging();
  }

  async function enableNotifications(){
    try{
      if(!("Notification" in window)){
        window.showMsg && window.showMsg("❌ المتصفح لا يدعم الإشعارات", "err");
        return;
      }

      if(!("serviceWorker" in navigator)){
        window.showMsg && window.showMsg("❌ المتصفح لا يدعم Service Worker", "err");
        return;
      }

      const permission = await Notification.requestPermission();
      if(permission !== "granted"){
        window.showMsg && window.showMsg("⚠️ لم يتم منح إذن الإشعارات", "warn");
        return;
      }

      const registration = await navigator.serviceWorker.register(
        "/system/firebase-messaging-sw.js",
        { scope:"/system/" }
      );

      const messaging = await initFirebase();

      const pushToken = await messaging.getToken({
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if(!pushToken){
        window.showMsg && window.showMsg("❌ فشل الحصول على توكن الإشعارات", "err");
        return;
      }

      const sessionToken = window.getSessionToken ? window.getSessionToken() : "";
      if(!sessionToken){
        window.showMsg && window.showMsg("⚠️ الجلسة غير موجودة", "warn");
        return;
      }

      const res = await window.apiPost({
        action:"savePushToken",
        token:sessionToken,
        page:pageName(),
        pushToken:pushToken
      });

      if(res && res.ok){
        window.showMsg && window.showMsg("✅ تم تفعيل الإشعارات", "ok");
      }else{
        window.showMsg && window.showMsg((res && res.message) || "❌ فشل حفظ التوكن", "err");
      }

    }catch(err){
      console.error("Notification setup error:", err);
      window.showMsg && window.showMsg("❌ فشل تفعيل الإشعارات | " + (err.message || err), "err");
    }
  }

  function initPWA(){
    const btn = document.getElementById("btnInstallApp");
    if(!btn) return;

    window.addEventListener("beforeinstallprompt", function(e){
      e.preventDefault();
      deferredPrompt = e;
      btn.style.display = "inline-block";
    });

    btn.addEventListener("click", async function(){
      if(!deferredPrompt){
        window.showMsg && window.showMsg("ℹ️ خيار التثبيت غير متاح الآن", "warn");
        return;
      }

      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if(choice && choice.outcome === "accepted"){
        window.showMsg && window.showMsg("✅ تم قبول تثبيت التطبيق", "ok");
      }else{
        window.showMsg && window.showMsg("ℹ️ تم إلغاء التثبيت", "warn");
      }

      deferredPrompt = null;
      btn.style.display = "none";
    });
  }

  function escapeHtml(s){
    return String(s == null ? "" : s)
      .replace(/&/g,"&amp;")
      .replace(/</g,"&lt;")
      .replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;")
      .replace(/'/g,"&#39;");
  }

  function init(){
    addStyle();
    createWidget();
    initBell();
    initPWA();

    const btn = document.getElementById("btnEnableNotifications");
    if(btn){
      btn.addEventListener("click", enableNotifications);
    }

    setTimeout(loadNotifications, 1000);
    setInterval(loadNotifications, 30000);

    window.loadNotifications = loadNotifications;
    window.enableNotifications = enableNotifications;
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();