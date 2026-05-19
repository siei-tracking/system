/** AUTO-SPLIT MODULE: 03_Workflow_Stages.gs **/

function addNewOrder(orderNo, clientName, userName) {
  const id = normalizeOrderNo_(orderNo);
  const client = String(clientName || "").trim();
  const user = String(userName || "").trim();

  if (!id || !client) return "❌ أكمل البيانات";

  /* Lock لمنع إضافة نفس الأمر مرتين في وقت واحد */
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return "❌ النظام مشغول، حاول مجدداً";
  }
  try {
    if (existsInTrackingAndCurrentYear_(id)) {
      return "❌ رقم أمر العمل موجود مسبقاً";
    }

    const sh = getSheet_();
    const now = new Date();
    const ts = stampFromDate_(now);

    sh.appendRow([
      now, id, client,
      OK + " استلام - (" + user + ") " + ts,
      "","","","","","","","","","","","","",""
    ]);

    const newRow = sh.getLastRow();
    indexPut_(id, newRow);
    globalIndexPut_(id, SHEET_NAME, newRow);

    return OK + " تم إضافة أمر العمل";
  } catch (e) {
    return "❌ خطأ: " + e.toString();
  } finally {
    lock.releaseLock();
  }
}

function processPlanning(data) {
  try {
    const sh = getSheet_();

    const id = normalizeOrderNo_((data && data.orderNo) || "");
    const user = String((data && data.userName) || "").trim();
    const price = String((data && data.price) || "").trim();
    const days = String((data && data.days) || "").trim();
    const testType = String((data && data.testType) || "").trim();
    let labPath = String((data && data.labPath) || "").trim();

    if (!id) return "❌ أدخل رقم أمر العمل";
    if (!testType) return "❌ اختر نوع الفحص";

    const row = findRowFast_(id);
    if (!row) return "❌ رقم المعاملة غير موجود. أضفها أولاً.";

    const currentPlanning = String(sh.getRange(row, 5).getValue() || "").trim();
    const currentPrice = String(sh.getRange(row, 6).getValue() || "").trim();
    const currentDays = String(sh.getRange(row, 7).getValue() || "").trim();

    const alreadyPriced =
      currentPlanning.indexOf(OK) !== -1 ||
      currentPrice.indexOf(OK) !== -1 ||
      currentDays.indexOf(OK) !== -1;

    if (alreadyPriced) {
      return "⚠️ أمر العمل مسعّر سابقًا";
    }

    const ts = stampNow_();

    if (testType !== "مختبرات") labPath = "";

    if (price) {
      sh.getRange(row, 6).setValue(OK + " " + price + " - (" + user + ") " + ts);
    }

    if (days) {
      sh.getRange(row, 7).setValue(OK + " " + days + " - (" + user + ") " + ts);
    }

    let t = "نوع الفحص: " + testType;
    if (testType === "مختبرات" && labPath) {
      t += " | توجيه: " + labPath;
    }

    sh.getRange(row, 5).setValue(OK + " " + t + " - (" + user + ") " + ts);

    return OK + " تم تثبيت البيانات";
  } catch (e) {
    return "❌ خطأ: " + e.toString();
  }
}

function isDoneCell_(v) { return String(v || "").indexOf(OK) !== -1; }

function getOrderPrice(orderNo) {
  try {
    const id = normalizeOrderNo_(orderNo || "");
    if (!id) return { ok: false, message: "❌ أدخل رقم أمر العمل" };

    const sh  = getSheet_();
    const row = findRowFast_(id);
    if (!row) return { ok: false, message: "❌ رقم المعاملة غير موجود" };

    const rawPrice = String(sh.getRange(row, 6).getValue() || "");
    const rawDays  = String(sh.getRange(row, 7).getValue() || "");

    /* استخراج الرقم فقط من الخلية (مثل "✅ 500 - (user) 12:00") */
    const extractNum = function(raw) {
      const m = raw.match(/[\d]+(?:\.\d+)?/);
      return m ? m[0] : "";
    };

    return {
      ok:    true,
      price: extractNum(rawPrice),
      days:  extractNum(rawDays),
      message: "✅ تم جلب البيانات"
    };
  } catch (e) {
    return { ok: false, message: "❌ خطأ: " + e.toString() };
  }
}

function editOrderPrice(data) {
  try {
    const sh   = getSheet_();
    const id   = normalizeOrderNo_((data && data.orderNo) || "");
    const user = String((data && data.userName) || "").trim();
    const price = String((data && data.price)   || "").trim();
    const days  = String((data && data.days)    || "").trim();

    if (!id)    return "❌ أدخل رقم أمر العمل";
    if (!price) return "❌ أدخل التسعيرة";

    const row = findRowFast_(id);
    if (!row) return "❌ رقم المعاملة غير موجود";

    const ts = stampNow_();

    sh.getRange(row, 6).setValue(OK + " " + price + " - (تعديل:" + user + ") " + ts);

    if (days) {
      sh.getRange(row, 7).setValue(OK + " " + days + " - (تعديل:" + user + ") " + ts);
    }

    return OK + " تم تعديل التسعيرة بنجاح";
  } catch (e) {
    return "❌ خطأ: " + e.toString();
  }
}

function getOrderFlowState_(row, rowValues) {
  if (!rowValues) rowValues = getRowValues_(row, 18);
  const planningText = String(getCellValue_(rowValues, 5) || "");
  const parsed = parsePlanning_(planningText);

  return {
    testType: parsed.testType,
    labPath: parsed.labPath,

    inspection: isDoneCell_(getCellValue_(rowValues, 4)),
    planning: isDoneCell_(getCellValue_(rowValues, 5)),
    pricing: isDoneCell_(getCellValue_(rowValues, 6)),
    payment: isDoneCell_(getCellValue_(rowValues, 8)),

    lab1: isDoneCell_(getCellValue_(rowValues, 9)),
    elev: isDoneCell_(getCellValue_(rowValues, 10)),
    workshop: isDoneCell_(getCellValue_(rowValues, 11)),
    lab2: isDoneCell_(getCellValue_(rowValues, 12)),

    testResults: isDoneCell_(getCellValue_(rowValues, 13)),
    official: isDoneCell_(getCellValue_(rowValues, 14)),
    barcode: isDoneCell_(getCellValue_(rowValues, 15)),
    email: isDoneCell_(getCellValue_(rowValues, 16)),
    final: isDoneCell_(getCellValue_(rowValues, 17))
  };
}

function canAdvanceToColumn_(row, targetCol, rowValues) {
  if (!rowValues) rowValues = getRowValues_(row, 18);

  const inspection = String(getCellValue_(rowValues, 4) || "");
  const planning = String(getCellValue_(rowValues, 5) || "");
  const pricing = String(getCellValue_(rowValues, 6) || "");
  const payment = String(getCellValue_(rowValues, 8) || "");

  const lab1 = String(getCellValue_(rowValues, 9) || "");
  const elev = String(getCellValue_(rowValues, 10) || "");
  const workshop = String(getCellValue_(rowValues, 11) || "");
  const lab2 = String(getCellValue_(rowValues, 12) || "");
  const results = String(getCellValue_(rowValues, 13) || "");
  const official = String(getCellValue_(rowValues, 14) || "");
  const barcode = String(getCellValue_(rowValues, 15) || "");
  const email = String(getCellValue_(rowValues, 16) || "");

  /* parsePlanning_ مرة واحدة فقط */
  const parsed = planning ? parsePlanning_(planning) : { testType: "", labPath: "" };

  function done(v) {
    return String(v || "").indexOf(OK) !== -1;
  }

  if (!done(inspection)) return "❌ يجب تسجيل استلام المعاملة أولاً";

  if (targetCol === 9 && !done(pricing)) {
    return "❌ يجب تثبيت التسعيرة أولاً";
  }

  if (targetCol >= 10 && !done(pricing)) {
    return "❌ يجب تثبيت التسعيرة أولاً";
  }

  if (targetCol === 11 && !done(lab1)) {
    return "❌ يجب إكمال المختبرات أولاً";
  }

  if (targetCol === 12 && !done(workshop)) {
    return "❌ يجب إكمال الورشة أولاً";
  }

  if (targetCol === 13) {
    if (parsed.testType === "مصاعد") {
      if (!done(elev)) return "❌ يجب إكمال فحص المصاعد أولاً";
    } else if (parsed.testType === "مختبرات" && parsed.labPath === "مختبرات فقط") {
      if (!done(lab1)) return "❌ يجب إكمال المختبرات أولاً";
    } else if (parsed.testType === "مختبرات" && parsed.labPath === "ورشة") {
      if (!done(lab2)) return "❌ يجب إكمال المختبرات بعد الورشة أولاً";
    } else {
      return "❌ تعذر تحديد نوع الفحص من التخطيط";
    }
  }

  if (targetCol === 14 && !done(results)) return "❌ يجب استلام نتائج الفحص أولاً";
  if (targetCol === 15 && !done(official)) return "❌ يجب إصدار الكتاب الرسمي أولاً";
  if (targetCol === 16 && !done(barcode)) return "❌ يجب تثبيت الباركود أولاً";

  if (targetCol === 17) {
    if (!done(payment)) return "❌ يجب التسديد أولاً";
    if (!done(results)) return "❌ يجب استلام نتائج الفحص أولاً";
    if (!done(official)) return "❌ يجب إصدار الكتاب الرسمي أولاً";
    if (!done(barcode)) return "❌ يجب تثبيت الباركود أولاً";
  }

  return "";
}

function writeReceive_(orderID, userName, col) {
  const id = normalizeOrderNo_(orderID);
  const user = String(userName || "").trim();
  if (!id) return "❌ أدخل رقم أمر العمل";

  /* Lock لمنع الكتابة المتزامنة على نفس الأمر */
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return "❌ النظام مشغول، حاول مجدداً";
  }
  try {
    const sh = getSheet_();
    const row = findRowFast_(id);
    if (!row) return "❌ رقم المعاملة غير موجود";

    const rowValues = getRowValues_(row, 18, sh);
    const current = String(rowValues[col - 1] || "");
    if (current.includes(OK)) return "⚠️ هذه المرحلة موثقة مسبقاً";

    const blockMsg = canAdvanceToColumn_(row, col, rowValues);
    if (blockMsg) return blockMsg;

    sh.getRange(row, col).setValue(OK + " استلام - (" + user + ") " + stampNow_());
    return OK;
  } finally {
    lock.releaseLock();
  }
}

function writeOkOnly_(orderID, userName, col) {
  const id = normalizeOrderNo_(orderID);
  const user = String(userName || "").trim();
  if (!id) return "❌ أدخل رقم أمر العمل";

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return "❌ النظام مشغول، حاول مجدداً";
  }
  try {
    const sh = getSheet_();
    const row = findRowFast_(id);
    if (!row) return "❌ رقم المعاملة غير موجود";

    const rowValues = getRowValues_(row, 18, sh);
    const current = String(rowValues[col - 1] || "");
    if (current.includes(OK)) return "⚠️ هذه المرحلة موثقة مسبقاً";

    const blockMsg = canAdvanceToColumn_(row, col, rowValues);
    if (blockMsg) return blockMsg;

    sh.getRange(row, col).setValue(OK + " (" + user + ") " + stampNow_());
    return OK + " تم التحديث";
  } finally {
    lock.releaseLock();
  }
}

function buildStageMessage_(stageName, orderID, userName, lateDays) {
  const o = String(orderID || "").trim();
  const u = String(userName || "").trim();
  const d = String(lateDays || "").trim();

  switch (stageName) {

    case "barcode":
      return "🧾 تم رفع الباركود من قِبل \"" + u + "\" لأمر العمل المرقم " + o;

    case "official":
      return "📄 تم اكمال الكتاب الرسمي من قِبل \"" + u + "\" لأمر العمل المرقم " + o;

    case "email":
      return "📧 تم ارسال الايميل من قِبل \"" + u + "\" لأمر العمل المرقم " + o;

    case "results":
      return "🧾 تم تسليم النتائج من قِبل \"" + u + "\" لأمر العمل المرقم " + o;

    case "lab1":
      return "🧪 تم استلام المختبرات من قِبل \"" + u + "\" لأمر العمل المرقم " + o;

    case "workshop":
      return "🏭 تم استلام الورشة من قِبل \"" + u + "\" لأمر العمل المرقم " + o;

    case "lab2":
      return "🧪 تم استلام المختبرات من قِبل \"" + u + "\" لأمر العمل المرقم " + o;

    case "testresults":
      return "📊 تم استلام النتائج من قِبل \"" + u + "\" لأمر العمل المرقم " + o;

    case "finance":
      return "💰 تم استلام مبلغ أمر العمل " + o + " من قِبل \"" + u + "\"";

    case "late":
      return "⚠️ أمر العمل المرقم " + o + " متأخر " + d + " يوم";

    default:
      return "✅ تحديث لأمر العمل " + o;
  }
}

function getStageNotifyPages_(stageName, orderType) {
  const type = String(orderType || "").trim();

  switch (stageName) {

    case "barcode":
      return ["testresults"];

    case "official":
      return ["results"];

    case "email":
      return ["testresults"];

    case "lab1":
      return ["testresults"];

    case "workshop":
      return ["lab1"];

    case "lab2":
      return ["workshop"];

    case "testresults":
      if (type === "مصاعد") {
        return ["elev"];
      }

      if (type === "مختبرات + ورشة") {
        return ["lab1"];
      }

      if (type === "مختبرات فقط") {
        return ["lab1"];
      }

      return ["lab1"];

    case "finance":
      return ["plan", "testresults", "results"];

    case "late":
      return ["main", "testresults"];

    default:
      return [];
  }
}

/* ===================================================================
   جدول مراحل التحديث
   [col, page, emoji, writeFunc]
   writeFunc: "ok" = writeOkOnly_, "receive" = writeReceive_
=================================================================== */
var STAGE_MAP_ = {
  updatePaymentStatus:       [8,  "finance",     "💰", "ok"],
  updateLabStatus:           [9,  "lab1",        "🧪", "receive"],
  updateElevStatus:          [10, "elev",        "🛗", "receive"],
  updateWorkshopStatus:      [11, "workshop",    "🏭", "receive"],
  updateLab2Status:          [12, "lab2",        "🧪", "receive"],
  updateTestResultsStatus:   [13, "testresults", "📊", "receive"],
  updateOfficialLetterStatus:[14, "official",    "📄", "receive"],
  updateBarcodeStatus:       [15, "barcode",     "🧾", "receive"],
  updateEmailStatus:         [16, "email",       "📧", "receive"]
};

function updateStageStatus_(stageName, orderID, userName, username) {
  const cfg = STAGE_MAP_[stageName];
  if (!cfg) return "❌ مرحلة غير معروفة: " + stageName;

  const col = cfg[0];
  const page = cfg[1];
  const fn = cfg[3];

  const msg = fn === "ok"
    ? writeOkOnly_(orderID, userName, col)
    : writeReceive_(orderID, userName, col);

  /* ── إرسال الإشعارات في try/catch منفصل حتى لا يؤثر على الرد ── */
  if (String(msg || "").indexOf(OK) !== -1) {
    try {
      const stageKey = page;
      const notifMsg = buildStageMessage_(stageKey, orderID, userName);

      const typeObj   = getSelectedTestType(orderID);
      const orderType = (typeObj && typeObj.testType) ? typeObj.testType : "";

      const pages = getStageNotifyPages_(stageKey, orderType);

      /* منع التكرار لمدة 30 ثانية */
      const cache    = CacheService.getScriptCache();
      const dedupKey = "NOTIF_" + orderID + "_" + stageKey;

      if (!cache.get(dedupKey)) {
        cache.put(dedupKey, "1", 30);
        pages.forEach(function(p) {
          notifyByStage_(orderID, p, notifMsg, username);
        });
      }
    } catch (notifErr) {
      Logger.log("⚠️ خطأ في الإشعارات (لا يؤثر على الحفظ): " + String(notifErr));
    }
  }

  return msg;
}

function updatePaymentStatus(o, u, un)        { return updateStageStatus_("updatePaymentStatus", o, u, un); }

function updateLabStatus(o, u, un)            { return updateStageStatus_("updateLabStatus", o, u, un); }

function updateElevStatus(o, u, un)           { return updateStageStatus_("updateElevStatus", o, u, un); }

function updateWorkshopStatus(o, u, un)       { return updateStageStatus_("updateWorkshopStatus", o, u, un); }

function updateLab2Status(o, u, un)           { return updateStageStatus_("updateLab2Status", o, u, un); }

function updateTestResultsStatus(o, u, un)    { return updateStageStatus_("updateTestResultsStatus", o, u, un); }

function updateOfficialLetterStatus(o, u, un) { return updateStageStatus_("updateOfficialLetterStatus", o, u, un); }

function updateBarcodeStatus(o, u, un)        { return updateStageStatus_("updateBarcodeStatus", o, u, un); }

function updateEmailStatus(o, u, un)          { return updateStageStatus_("updateEmailStatus", o, u, un); }

function updateResultsStatus(orderID, userName, username) {
  try {
    const msg = writeReceive_(orderID, userName, 17);
    if (String(msg || "").indexOf(OK) === -1) return msg;

    const id = normalizeOrderNo_(orderID);
    const sh = getSheet_();
    const lastCol = Math.max(sh.getLastColumn(), 18);

    /* استخدام findRowFast_ مرة واحدة فقط */
    const row = findRowFast_(id);
    if (!row) return msg;

    const rowValues = sh.getRange(row, 1, 1, lastCol).getValues()[0];

    const createdAt = (rowValues[0] instanceof Date) ? rowValues[0] : new Date(rowValues[0]);
    if (!(createdAt instanceof Date) || isNaN(createdAt.getTime())) {
      return msg + " | ⚠️ تعذر تحديد سنة الأرشفة";
    }

    const yearSheetName = String(createdAt.getFullYear());
    const shYear = getYearArchiveSheet_(yearSheetName);

    /* استخدام الفهرس العالمي بدل searchOrderInSheet_ (TextFinder) */
    let targetRow = null;
    const globalHit = globalFindFast_(id);
    if (globalHit && String(globalHit.sheetName).trim() === yearSheetName) {
      targetRow = globalHit.row;
    } else {
      targetRow = shYear.getLastRow() + 1;
    }

    shYear.getRange(targetRow, 1, 1, lastCol).setValues([rowValues]);

    globalIndexPut_(id, yearSheetName, targetRow);

    try {
      const notifMsg = buildStageMessage_("results", id, userName);
      const pages    = getStageNotifyPages_("results", "");
      pages.forEach(function(p) {
        notifyByStage_(id, p, notifMsg, username);
      });
    } catch (notifErr) {
      Logger.log("Notify error: " + String(notifErr));
    }

    return msg + " | تم نسخ المعاملة مباشرة إلى شيت " + yearSheetName;

  } catch (e) {
    return "❌ خطأ: " + String(e);
  }
}
