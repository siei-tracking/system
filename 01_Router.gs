/** AUTO-SPLIT MODULE: 01_Router.gs **/

function jsonOutput_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function doPost(e) {
  try {
    const raw = (e && e.postData && e.postData.contents)
      ? String(e.postData.contents)
      : "{}";

    const data = JSON.parse(raw || "{}");
    const action = String(data.action || "").trim();

    if (!action) {
      return jsonOutput_({ ok: false, message: "❌ لم يتم تحديد action" });
    }

    /* ── Rate Limiting للـ login فقط (منع brute force) ── */
    if (action === "login") {
      const username  = String(data.username || "").trim().toLowerCase();
      const loginPage = String(data.page || "").trim();

      /* استخراج معلومات الجهاز */
      const ua         = String(data.userAgent || "");
      const ip = String(data.clientIp || "—");
      const uaParsed   = parseUserAgent_(ua);
      const deviceInfo = { device: uaParsed.device, browser: uaParsed.browser, ip: ip };

      if (username) {
        const rateLimitKey = "RATELIMIT_LOGIN_" + username;
        const cache = CacheService.getScriptCache();
        const attempts = parseInt(cache.get(rateLimitKey) || "0");
        if (attempts >= 10) {
          writeLoginLog_(username, loginPage, false, "تجاوز عدد المحاولات (Rate Limit)", deviceInfo);
          return jsonOutput_({ ok: false, message: "❌ تم تجاوز عدد المحاولات، حاول بعد دقيقة" });
        }
        cache.put(rateLimitKey, String(attempts + 1), 60);
      } else {
        writeLoginLog_("—", loginPage, false, "username فارغ", deviceInfo);
      }
      const loginResult = loginUser_(username, data.password, data.page, deviceInfo);
      return jsonOutput_(loginResult);
    }

    if (action === "checkSession") {
      const guard = requirePageAccess_(data.token, data.page);
      if (!guard.ok) return jsonOutput_(guard);

      return jsonOutput_({
        ok: true,
        user: guard.session.name,
        username: guard.session.username,
        message: "✅ الجلسة صالحة"
      });
    }

    if (action === "clearAllSessions") {
      /* يشترط أن يكون المستخدم مسجلاً دخوله */
      const guard = requirePageAccess_(data.token, data.page || "index_Frontend");
      if (!guard.ok) return jsonOutput_(guard);
      /* تحقق أن المستخدم admin أو له صلاحية */
      if (guard.session.role !== "admin") {
        return jsonOutput_({ ok: false, message: "❌ غير مصرح لك بهذه العملية" });
      }
      return jsonOutput_(clearAllSessions_());
    }

    if (action === "runClearAllSessions") {
      const guard = requirePageAccess_(data.token, data.page || "index_Frontend");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(runClearAllSessions());
    }

    if (action === "sendTestNotification") {
      const guard = requirePageAccess_(data.token, data.page || "index_Frontend");
      if (!guard.ok) return jsonOutput_(guard);

      const targetUser = String(data.targetUser || "").trim().toLowerCase();
      const message    = String(data.message    || "test").trim();
      const orderId    = String(data.orderId    || "TEST").trim();
      const title      = "🔔 إشعار تجريبي";

      if (!targetUser) return jsonOutput_({ ok: false, message: "❌ يجب تحديد المستخدم" });

      const userObj = getUserByUsername_(targetUser);
      if (!userObj) return jsonOutput_({ ok: false, message: "❌ المستخدم غير موجود: " + targetUser });

      /* 1) أضف للشيت — يظهر في جرس الإشعارات */
      addNotification(orderId, message, targetUser, "index_Frontend");

      /* 2) إرسال FCM مباشرة لكل tokens المستخدم — يظهر في إشعارات المتصفح */
      let sent = 0;
      try {
        const tokens     = getActivePushTokens_();
        const userTokens = tokens.filter(function(t) {
          return String(t.username || "").trim().toLowerCase() === targetUser
              && t.pushToken
              && t.pushToken.indexOf("polling") !== 0;
        });

        if (userTokens.length > 0) {
          const accessToken = getFcmAccessToken_();
          userTokens.forEach(function(t) {
            try {
              sendPushToTokenWithAccessToken_(
                t.pushToken,
                title,
                message,
                { url:"https://siei-tracking.github.io/system/main.html", page:"index_Frontend" },
                accessToken
              );
              sent++;
            } catch(e) {
              Logger.log("Test push error: " + String(e));
            }
          });
        }
      } catch(e) {
        Logger.log("Test push outer error: " + String(e));
      }

      return jsonOutput_({
        ok: true,
        message: "✅ تم إرسال الإشعار إلى: " + targetUser +
                 (sent > 0 ? " — FCM: " + sent + " جهاز" : " — جرس فقط (لا يوجد token نشط)")
      });
    }

    if (action === "getNotifications") {
  const guard = guardFromData_(data, data.page || "main");
  if (!guard.ok) return jsonOutput_(guard);
  return jsonOutput_(getNotifications_(guard.session.username));
}

    if (action === "getWorkshopDetails") {
      const guard = guardFromData_(data, "workshop");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getWorkshopDetails(data.orderNo));
    }

    if (action === "getTestResultsDetails") {
      const guard = guardFromData_(data, "testresults");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getTestResultsDetails(data.orderNo));
    }

    if (action === "updateTestResultsStatus") {
      const guard = guardFromData_(data, "testresults");
      if (!guard.ok) return jsonOutput_(guard);
      const msg = updateTestResultsStatus(data.orderNo, data.userName || guard.session.name, guard.session.username);
      return jsonOutput_({ ok: String(msg||"").indexOf(OK)!==-1, result:msg, message:msg });
    }

    if (action === "getOfficialDetails") {
      const guard = guardFromData_(data, "official");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getOfficialDetails(data.orderNo));
    }

    if (action === "updateOfficialLetterStatus") {
      const guard = guardFromData_(data, "official");
      if (!guard.ok) return jsonOutput_(guard);
      const msg = updateOfficialLetterStatus(data.orderNo, data.userName || guard.session.name, guard.session.username);
      return jsonOutput_({ ok: String(msg||"").indexOf(OK)!==-1, result:msg, message:msg });
    }

    if (action === "getBarcodeDetails") {
      const guard = guardFromData_(data, "barcode");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getBarcodeDetails(data.orderNo));
    }

    if (action === "uploadBarcodeFile") {
      const guard = guardFromData_(data, "barcode");
      if (!guard.ok) {
        return jsonOutput_({
          ok: false,
          error: guard.message
        });
      }

      const result = uploadBarcodeFile(
        data.orderNo,
        data.fileName,
        data.mimeType,
        data.base64Data,
        data.userName || guard.session.name,
        data.oldFileUrl
      );

      return jsonOutput_(result);
    }

    if (action === "updateBarcodeStatus") {
      const guard = guardFromData_(data, "barcode");
      if (!guard.ok) return jsonOutput_(guard);
      const msg = updateBarcodeStatus(data.orderNo, data.userName || guard.session.name, guard.session.username);
      return jsonOutput_({ ok: String(msg||"").indexOf(OK)!==-1, result:msg, message:msg });
    }

    if (action === "getEmailDetails") {
      const guard = guardFromData_(data, "email");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getEmailDetails(data.orderNo));
    }

    if (action === "updateEmailStatus") {
      const guard = guardFromData_(data, "email");
      if (!guard.ok) return jsonOutput_(guard);
      const msg = updateEmailStatus(data.orderNo, data.userName || guard.session.name, guard.session.username);
      return jsonOutput_({ ok: String(msg||"").indexOf(OK)!==-1, result:msg, message:msg });
    }

    if (action === "getResultsDetails") {
      const guard = guardFromData_(data, "results");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getResultsDetails(data.orderNo));
    }

    if (action === "updateResultsStatus") {
      const guard = guardFromData_(data, "results");
      if (!guard.ok) return jsonOutput_(guard);
      const msg = updateResultsStatus(data.orderNo, data.userName || guard.session.name, guard.session.username);
      return jsonOutput_({ ok: String(msg||"").indexOf(OK)!==-1, result:msg, message:msg });
    }

    if (action === "getOpenOrders") {
      const guard = guardFromData_(data, "main");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getOpenOrders());
    }

    if (action === "getDelayedOrders") {
      const guard = guardFromData_(data, "main");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getDelayedOrders());
    }

    if (action === "getCompletedOrders") {
      const guard = guardFromData_(data, "main");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getCompletedOrders(data.limit || 5000));
    }

    if (action === "getCompletedOrdersByDateRange") {
      const guard = guardFromData_(data, "main");
      if (!guard.ok) return jsonOutput_(guard);

      return jsonOutput_(
        getCompletedOrdersByDateRange(
          data.fromDate,
          data.toDate,
          data.limit || 5000
        )
      );
    }

    if (action === "getMainSearchSheets") {
      const guard = guardFromData_(data, "main");
      if (!guard.ok) return jsonOutput_(guard);

      return jsonOutput_({
        ok: true,
        items: getMainSearchSheets()
      });
    }

    if (action === "searchOrderAnywhere") {
      const guard = guardFromData_(data, "main");
      if (!guard.ok) return jsonOutput_(guard);

      return jsonOutput_(searchOrderAnywhere(data.orderNo, data.sheetName));
    }

    if (action === "getArchiveSheetUrl") {
      const token = String(data.token || "").trim();
      return jsonOutput_(getArchiveSheetUrl(token));
    }

    if (action === "getAllPages") {
      const guard = requirePageAccess_(String(data.token || "").trim(), "admin");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getAllPages());
    }

    if (action === "getUsersList") {
      const token = String(data.token || "").trim();
      return jsonOutput_(getUsersList(token));
    }

    if (action === "saveUserToSheet") {
      const token = String(data.token || "").trim();
      const msg = saveUserToSheet(data.data || {}, token);
      return jsonOutput_({
        ok: String(msg || "").indexOf("✅") !== -1,
        result: msg,
        message: msg
      });
    }

    if (action === "updateUserInSheet") {
      const token = String(data.token || "").trim();
      const msg = updateUserInSheet(data.data || {}, token);
      return jsonOutput_({
        ok: String(msg || "").indexOf("✅") !== -1,
        result: msg,
        message: msg
      });
    }

    if (action === "deleteUserFromSheet") {
      const token = String(data.token || "").trim();
      const username = data.username || data.user || "";
      const msg = deleteUserFromSheet(username, token);
      return jsonOutput_({
        ok: String(msg || "").indexOf("✅") !== -1,
        result: msg,
        message: msg
      });
    }

    if (action === "updateWorkshopStatus") {
      const guard = guardFromData_(data, "workshop");
      if (!guard.ok) return jsonOutput_(guard);
      const msg = updateWorkshopStatus(data.orderNo, data.userName || guard.session.name, guard.session.username);
      return jsonOutput_({ ok: String(msg||"").indexOf(OK)!==-1, result:msg, message:msg });
    }

    if (action === "addNewOrder") {
      const guard = guardFromData_(data, "plan");
      if (!guard.ok) return jsonOutput_(guard);

      const msg = addNewOrder(
        data.orderNo,
        data.clientName,
        data.userName || guard.session.name
      );
      return jsonOutput_({
        ok: String(msg||"").indexOf(OK)!==-1,
        result: msg,
        message: msg
      });
    }

    if (action === "getLabDetails") {
      const guard = guardFromData_(data, "lab1");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getLabDetails(data.orderNo));
    }

    if (action === "getElevDetails") {
      const guard = guardFromData_(data, "elev");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getElevDetails(data.orderNo));
    }

    if (action === "updateElevStatus") {
      const guard = guardFromData_(data, "elev");
      if (!guard.ok) return jsonOutput_(guard);
      const msg = updateElevStatus(data.orderNo, data.userName || guard.session.name, guard.session.username);
      return jsonOutput_({ ok: String(msg||"").indexOf(OK)!==-1, result:msg, message:msg });
    }

    if (action === "getSelectedTestType") {
      const guard = guardFromData_(data, "lab1");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getSelectedTestType(data.orderNo));
    }

    if (action === "updateLabStatus") {
      const guard = guardFromData_(data, "lab1");
      if (!guard.ok) return jsonOutput_(guard);
      const msg = updateLabStatus(data.orderNo, data.userName || guard.session.name, guard.session.username);
      return jsonOutput_({ ok: String(msg||"").indexOf(OK)!==-1, result:msg, message:msg });
    }

    if (action === "updateLab2Status") {
      const guard = guardFromData_(data, "lab1");
      if (!guard.ok) return jsonOutput_(guard);
      const msg = updateLab2Status(data.orderNo, data.userName || guard.session.name, guard.session.username);
      return jsonOutput_({ ok: String(msg||"").indexOf(OK)!==-1, result:msg, message:msg });
    }

    if (action === "processPlanning") {
      const guard = guardFromData_(data, "plan");
      if (!guard.ok) return jsonOutput_(guard);

      const payload = data.data || {};
      if (!payload.userName) payload.userName = guard.session.name;

      const msg = processPlanning(payload);
      return jsonOutput_({
        ok: String(msg||"").indexOf(OK)!==-1,
        result: msg,
        message: msg
      });
    }

    if (action === "getFinanceDetails") {
      const guard = guardFromData_(data, "finance");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getFinanceDetails(data.orderNo));
    }

    if (action === "updatePaymentStatus") {
      const guard = guardFromData_(data, "finance");
      if (!guard.ok) return jsonOutput_(guard);
      const msg = updatePaymentStatus(data.orderNo, data.userName || guard.session.name, guard.session.username);
      return jsonOutput_({ ok: String(msg||"").indexOf(OK)!==-1, result:msg, message:msg });
    }

    if (action === "trackingDataFromTrackingOnly") {
      const result = getTrackingDataFromTrackingOnly(data.order || "");
      return jsonOutput_(result);
    }

    if (action === "exportPDF") {
      const guard = guardFromData_(data, "main");
      if (!guard.ok) return jsonOutput_(guard);

      const title = String(data.title || "تقرير المعاملات").trim();
      const mode = String(data.mode || "open").trim();
      const rows = Array.isArray(data.rows) ? data.rows : [];

      const result = exportOrdersPdf_(title, mode, rows, guard.session.name);
      return jsonOutput_(result);
    }

    if (action === "savePushToken") {
  const session = validateSessionToken_(data.token);
  if (!session) {
    return jsonOutput_({ ok:false, message:"جلسة غير صالحة" });
  }

  return jsonOutput_(savePushToken_(data.token, data.pushToken, data.deviceId));
}


if (action === "markNotificationRead") {
  const guard = guardFromData_(data, "main");
  if (!guard.ok) return jsonOutput_(guard);

  return jsonOutput_(markNotificationRead_(data.notificationId, guard.session.username));
}

    if (action === "markAllNotificationsRead") {
      const guard = guardFromData_(data, "main");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(markAllNotificationsRead_(guard.session.username));
    }

    if (action === "healthCheck") {
      const guard = guardFromData_(data, "admin");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(runHealthCheck_());
    }

    if (action === "getOrderPrice") {
      const guard = guardFromData_(data, "plan");
      if (!guard.ok) return jsonOutput_(guard);
      return jsonOutput_(getOrderPrice(data.orderNo));
    }

    if (action === "editOrderPrice") {
      const guard = guardFromData_(data, "plan");
      if (!guard.ok) return jsonOutput_(guard);

      const payload = data.data || {};
      if (!payload.userName) payload.userName = guard.session.name;

      const msg = editOrderPrice(payload);
      return jsonOutput_({
        ok: String(msg || "").indexOf(OK) !== -1,
        result: msg,
        message: msg
      });
    }

    return jsonOutput_({
      ok: false,
      message: "❌ action غير معروف: " + action
    });

  } catch (err) {
    return jsonOutput_({
      ok: false,
      message: "❌ خطأ: " + String(err)
    });
  }
}

function getCachedAppUrl_() {
  const CACHE_KEY = "APP_URL_CACHE_V1";
  const cache = CacheService.getScriptCache();
  let url = cache.get(CACHE_KEY);
  if (!url) {
    url = String(ScriptApp.getService().getUrl()).replace(/"/g, "").trim();
    cache.put(CACHE_KEY, url, 21600); /* 6 ساعات */
  }
  return url;
}

/* ===================================================================
   doGet
=================================================================== */
function doGet(e) {
  /* ✅ معالجة طلبات API عبر GET (لتجنب CORS) */
  const action = (e && e.parameter && e.parameter.action)
    ? String(e.parameter.action).trim() : "";

  if (action === "savePushToken") {
    const token     = (e && e.parameter && e.parameter.token)     ? String(e.parameter.token).trim()     : "";
    const pushToken = (e && e.parameter && e.parameter.pushToken) ? String(e.parameter.pushToken).trim() : "";
    const deviceId  = (e && e.parameter && e.parameter.deviceId)  ? String(e.parameter.deviceId).trim()  : "unknown";
    return jsonOutput_(savePushToken_(token, pushToken, deviceId));
  }

  let page = "index";

  if (e && e.parameter && e.parameter.p) {
    page = String(e.parameter.p).replace(/"/g, "").trim().toLowerCase();
  }

  const token = (e && e.parameter && e.parameter.token)
    ? String(e.parameter.token).trim()
    : "";

  const session = validateSessionToken_(token);
  /* ScriptApp.getService().getUrl() بطيء — نخزنه في Cache */
  const appUrl = getCachedAppUrl_();

  if (!session) {
    if (page === "index") {
      const tmp = HtmlService.createTemplateFromFile("index");
      tmp.userName = "زائر";
      tmp.userRole = "guest";
      tmp.authToken = "";
      tmp.appUrl = appUrl;
      tmp.orderNo = (e && e.parameter && e.parameter.order)
        ? String(e.parameter.order).trim() : "";
      return tmp.evaluate()
        .setTitle("نظام الشركة العامة للفحص والتأهيل الهندسي")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag("viewport", "width=device-width, initial-scale=1");
    }
    const tmpLogin = HtmlService.createTemplateFromFile("login");
    tmpLogin.requestedPage = page;
    tmpLogin.appUrl = appUrl;
    tmpLogin.errorMsg = "";
    return tmpLogin.evaluate()
      .setTitle("تسجيل الدخول")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  /* فحص الصلاحية من الجلسة مباشرة — بدون قراءة users شيت */
  if (!userCanAccessPageByUserObj_(session, page)) {
    const tmpLogin = HtmlService.createTemplateFromFile("login");
    tmpLogin.requestedPage = page;
    tmpLogin.appUrl = appUrl;
    tmpLogin.errorMsg = "❌ غير مصرح لك بالدخول إلى هذه الصفحة";
    return tmpLogin.evaluate()
      .setTitle("تسجيل الدخول")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
  }

  try {
    const tmp = HtmlService.createTemplateFromFile(page);

    tmp.userName = session.name;
    tmp.userRole = "user";
    tmp.authToken = token;
    tmp.appUrl = appUrl;
    tmp.orderNo = (e && e.parameter && e.parameter.order)
      ? String(e.parameter.order).trim()
      : "";

    return tmp.evaluate()
      .setTitle("نظام الشركة العامة للفحص والتأهيل الهندسي")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag("viewport", "width=device-width, initial-scale=1");

  } catch (err) {
    /* صفحة غير موجودة — إعادة التوجيه للـ index */
    try {
      const tmp = HtmlService.createTemplateFromFile("index");
      tmp.userName = session.name;
      tmp.userRole = "user";
      tmp.authToken = token;
      tmp.appUrl = appUrl; /* استخدام appUrl المخزّنة مسبقاً */
      tmp.orderNo = "";
      return tmp.evaluate()
        .setTitle("نظام الشركة العامة للفحص والتأهيل الهندسي")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag("viewport", "width=device-width, initial-scale=1");
    } catch (e2) {
      return HtmlService.createHtmlOutput(
        "<h2>⚠️ الصفحة غير موجودة</h2><p>" + page + "</p>"
      )
        .setTitle("خطأ")
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
  }
}
