/* ===============================
   Notifications System (Unified)
=============================== */

let deferredPrompt = null;

/* ===============================
   🔔 جلب الإشعارات
=============================== */
async function loadNotifications(){
  try{
    const token = window.getSessionToken?.();
    if(!token) return;

    const res = await window.apiPost({
      action: "getNotifications",
      token: token,
      page: window.PAGE_NAME || "main"
    });

    if(!res || !res.ok) return;

    const list = document.getElementById("notifList");
    const count = document.getElementById("notifCount");

    if(!list || !count) return;

    list.innerHTML = "";

    if(!res.items.length){
      list.innerHTML = '<div class="notif-item">لا توجد إشعارات</div>';
      count.textContent = "0";
      return;
    }

    res.items.forEach(n=>{
      const div = document.createElement("div");
      div.className = "notif-item";
      div.textContent = n.message;

      div.onclick = async ()=>{
        try{
          await window.apiPost({
            action:"markNotificationRead",
            token:token,
            notificationId:n.id,
            page: window.PAGE_NAME || "main"
          });

          if(n.page){
            window.location.href = "/system/" + n.page + ".html";
          }

        }catch(e){}
      };

      list.appendChild(div);
    });

    count.textContent = res.unread || 0;

  }catch(err){
    console.error("loadNotifications error:", err);
  }
}

/* ===============================
   🔔 Toggle Box
=============================== */
function initBell(){
  const icon = document.getElementById("notifIcon");
  const box  = document.getElementById("notifBox");

  if(!icon || !box) return;

  icon.onclick = ()=>{
    box.style.display = box.style.display === "block" ? "none" : "block";
  };

  document.addEventListener("click", function(e){
    if(!icon.contains(e.target) && !box.contains(e.target)){
      box.style.display = "none";
    }
  });
}

/* ===============================
   🔥 Firebase Notifications
=============================== */
async function enableNotifications(){
  try{
    if(!("serviceWorker" in navigator)){
      return window.showMsg("❌ المتصفح لا يدعم الإشعارات","err");
    }

    const permission = await Notification.requestPermission();

    if(permission !== "granted"){
      return window.showMsg("❌ تم رفض الإشعارات","err");
    }

    const registration = await navigator.serviceWorker.register(
      "/system/firebase-messaging-sw.js"
    );

    const messaging = firebase.messaging();

    const token = await messaging.getToken({
      vapidKey: "BCVh972jCSmGqdWe7nDcWtepOrPGq7CwKdFNjT2gJ8IsMmhE1T0CEgOk9t5g8NQOlMNCW9peG67kUzrui6pFgFU",
      serviceWorkerRegistration: registration
    });

    if(!token){
      return window.showMsg("❌ فشل الحصول على التوكن","err");
    }

    await window.apiPost({
      action:"savePushToken",
      token:window.getSessionToken(),
      pushToken:token
    });

    window.showMsg("✅ تم تفعيل الإشعارات","ok");

  }catch(err){
    console.error("Notification error:", err);
    window.showMsg("❌ فشل تفعيل الإشعارات | "+err.message,"err");
  }
}

/* ===============================
   📲 Install App (PWA)
=============================== */
function initPWA(){
  const btn = document.getElementById("btnInstallApp");
  if(!btn) return;

  window.addEventListener("beforeinstallprompt", (e)=>{
    e.preventDefault();
    deferredPrompt = e;
    btn.style.display = "inline-flex";
  });

  btn.onclick = async ()=>{
    if(!deferredPrompt) return;

    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if(choice.outcome === "accepted"){
      window.showMsg("✅ تم تثبيت التطبيق","ok");
    }

    deferredPrompt = null;
    btn.style.display = "none";
  };
}

/* ===============================
   🚀 Init
=============================== */
document.addEventListener("DOMContentLoaded", function(){

  initBell();
  initPWA();

  const btnEnable = document.getElementById("btnEnableNotifications");
  if(btnEnable){
    btnEnable.onclick = enableNotifications;
  }

  // أول تحميل
  loadNotifications();

  // تحديث كل 30 ثانية
  setInterval(loadNotifications, 30000);

});