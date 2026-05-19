/** AUTO-SPLIT MODULE: 09_PDF_Report.gs **/

function buildWorkOrdersPdfHtml_(rows, sheetName, bgData, logoData) {
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || TZ, "yyyy-MM-dd | HH:mm");

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  let tableRows = "";
  rows.forEach(function (item, idx) {
    /* استخراج رقم التسعيرة من النص */
    var pricingRaw = String(item.pricing || "").trim();
    var priceMatch = pricingRaw.match(/[\d]+(?:\.\d+)?/);
    var priceVal   = priceMatch ? priceMatch[0] : "—";

    tableRows += ''
      + '<tr>'
      + '<td>' + (idx + 1) + '</td>'
      + '<td>' + esc(item.orderNo) + '</td>'
      + '<td>' + esc(item.date || item.orderDate) + '</td>'
      + '<td>' + esc(item.beneficiary || item.clientName) + '</td>'
      + '<td>' + esc(priceVal) + '</td>'
      + '<td>' + esc(item.lastStage) + '</td>'
      + '</tr>';
  });

  var bgStyle = bgData
    ? 'background-image:url("' + bgData + '"); background-size:cover; background-position:center; background-repeat:no-repeat;'
    : '';

  var logoHtml = logoData
    ? '<img src="' + logoData + '" style="width:70px;height:70px;object-fit:contain;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.2);" />'
    : '';

  return ''
    + '<!DOCTYPE html>'
    + '<html lang="ar" dir="rtl">'
    + '<head>'
    + '  <meta charset="UTF-8">'
    + '  <style>'
    + '    @page { size: A4 landscape; margin: 18mm 12mm 14mm 12mm; }'
    + '    body{ font-family: Arial, Tahoma, sans-serif; direction: rtl; color:#1f2937; margin:0; padding:0; background:#fff; }'
    + '    .page-bg{ position:fixed; top:0; left:0; width:100%; height:100%; opacity:0.08; z-index:-1; ' + bgStyle + ' }'
    + '    .header{ border-bottom:2px solid #223243; padding-bottom:10px; margin-bottom:14px; display:flex; align-items:center; gap:14px; }'
    + '    .header-text{ flex:1; }'
    + '    .title{ font-size:22px; font-weight:700; color:#223243; margin:0 0 6px 0; }'
    + '    .meta{ font-size:12px; color:#555; line-height:1.8; }'
    + '    .badge{ display:inline-block; background:#f5a623; color:#fff; padding:4px 10px; border-radius:8px; font-size:12px; font-weight:700; margin-left:6px; }'
    + '    table{ width:100%; border-collapse:collapse; table-layout:fixed; font-size:12px; }'
    + '    th, td{ border:1px solid #d8dee6; padding:8px 6px; text-align:center; vertical-align:middle; word-wrap:break-word; }'
    + '    th{ background:#223243; color:#fff; font-size:12px; font-weight:700; }'
    + '    tr:nth-child(even) td{ background:#f8fafc; }'
    + '    .col-idx{ width:5%; }'
    + '    .col-order{ width:14%; }'
    + '    .col-date{ width:14%; }'
    + '    .col-benef{ width:34%; }'
    + '    .col-price{ width:13%; }'
    + '    .col-stage{ width:20%; }'
    + '    .footer{ margin-top:10px; font-size:11px; color:#666; text-align:left; }'
    + '  </style>'
    + '</head>'
    + '<body>'
    + '  <div class="page-bg"></div>'
    + '  <div class="header">'
    + '    ' + logoHtml
    + '    <div class="header-text">'
    + '      <h1 class="title">تقرير أوامر العمل</h1>'
    + '      <div class="meta">'
    + '        <span class="badge">الشيت: ' + esc(sheetName) + '</span>'
    + '        <span class="badge">عدد المعاملات: ' + rows.length + '</span>'
    + '        <div>تاريخ التوليد: ' + esc(now) + '</div>'
    + '      </div>'
    + '    </div>'
    + '  </div>'
    + '  <table>'
    + '    <thead>'
    + '      <tr>'
    + '        <th class="col-idx">ت</th>'
    + '        <th class="col-order">رقم أمر العمل</th>'
    + '        <th class="col-date">التاريخ</th>'
    + '        <th class="col-benef">الجهة المستفيدة</th>'
    + '        <th class="col-price">التسعيرة</th>'
    + '        <th class="col-stage">آخر مرحلة</th>'
    + '      </tr>'
    + '    </thead>'
    + '    <tbody>'
    +          tableRows
    + '    </tbody>'
    + '  </table>'
    + '  <div class="footer">تم إنشاء هذا التقرير من نظام تتبع أوامر العمل</div>'
    + '</body>'
    + '</html>';
}


/* ===================================================================
   تصدير PDF
=================================================================== */
function exportOrdersPdf_(title, mode, rows, userName) {
  try {
    const now = new Date();
    const reportNo = "R-" + Utilities.formatDate(now, TZ, "yyyyMMdd");
    const issueDate = Utilities.formatDate(now, TZ, "yyyy/MM/dd");

    const template = HtmlService.createTemplateFromFile("reportTemplate");

    template.title     = title || "تقرير أوامر العمل";
    template.rows      = Array.isArray(rows) ? rows : [];
    template.reportNo  = reportNo;
    template.issueDate = issueDate;
    template.userName  = userName || "النظام";
    template.logoData  = getLogoAsBase64() || "";
    template.bgData    = getBackgroundAsBase64() || "";

    const pdfBlob    = template.evaluate().getBlob().getAs(MimeType.PDF).setName(reportNo + ".pdf");
    const base64Pdf  = Utilities.base64Encode(pdfBlob.getBytes());

    return {
      ok: true,
      fileName: pdfBlob.getName(),
      mimeType: "application/pdf",
      base64: base64Pdf,
      message: "✅ تم إنشاء التقرير بنجاح"
    };
  } catch (e) {
    Logger.log("Error generating PDF: " + String(e));
    return {
      ok: false,
      error: String(e),
      message: "❌ فشل إنشاء PDF: " + String(e)
    };
  }
}

function getBackgroundAsBase64() {
  const CACHE_KEY = "BG_BASE64_V3";
  const cache = CacheService.getScriptCache();

  /* 1 — Cache أولاً (مباشر أو مقطّع) */
  const cached = getBgFromCache_(CACHE_KEY);
  if (cached) return cached;

  var bytes = null;

  /* 2 — GitHub Pages (public URL) */
  try {
    const response = UrlFetchApp.fetch(
      "https://siei-tracking.github.io/system/cover.jpeg",
      { muteHttpExceptions: true }
    );
    if (response.getResponseCode() === 200) bytes = response.getContent();
  } catch(e) { Logger.log("GitHub Pages: " + e); }

  /* 3 — Google Drive (fallback) */
  if (!bytes) {
    try {
      bytes = DriveApp.getFileById("1BfKDPd1xqljzwPwtbkcVLxx3HyVc0ltI").getBlob().getBytes();
    } catch(e) { Logger.log("Drive: " + e); }
  }

  if (!bytes) return "";

  const result = "data:image/jpeg;base64," + Utilities.base64Encode(bytes);

  /* الصورة أكبر من 100KB — نخزنها مقطّعة في Cache */
  if (result.length <= 100000) {
    cache.put(CACHE_KEY, result, 21600);
  } else {
    /* تقطيع على مفاتيح متعددة */
    const chunkSize = 90000;
    const chunks = Math.ceil(result.length / chunkSize);
    const pairs = {};
    pairs[CACHE_KEY + "_n"] = String(chunks);
    for (var i = 0; i < chunks; i++) {
      pairs[CACHE_KEY + "_" + i] = result.substring(i * chunkSize, (i + 1) * chunkSize);
    }
    try { cache.putAll(pairs, 21600); } catch(e) { Logger.log("Cache putAll: " + e); }
  }

  return result;
}

function getBgFromCache_(CACHE_KEY) {
  const cache = CacheService.getScriptCache();
  /* محاولة قراءة مباشرة */
  const direct = cache.get(CACHE_KEY);
  if (direct) return direct;
  /* محاولة قراءة مقطّعة */
  const countStr = cache.get(CACHE_KEY + "_n");
  if (!countStr) return null;
  const count = parseInt(countStr);
  const keys = [CACHE_KEY + "_n"];
  for (var i = 0; i < count; i++) keys.push(CACHE_KEY + "_" + i);
  const all = cache.getAll(keys);
  var result = "";
  for (var j = 0; j < count; j++) {
    if (!all[CACHE_KEY + "_" + j]) return null;
    result += all[CACHE_KEY + "_" + j];
  }
  return result;
}


function FIX_updateBackgroundFileId(newFileId) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("BG_FILE_ID", String(newFileId || "").trim());
  CacheService.getScriptCache().remove("BG_BASE64_CACHE");
  Logger.log("✅ تم تحديث Background fileId: " + newFileId);
}

function DEBUG_backgroundImage() {
  Logger.log("=== بدء تشخيص الخلفية ===");
  const fileId = "1BfKDPd1xqljzwPwtbkcVLxx3HyVc0ltI";

  try {
    var file = DriveApp.getFileById(fileId);
    Logger.log("✅ DriveApp: وجد الملف — " + file.getName() + " | " + file.getMimeType());
    var bytes = file.getBlob().getBytes();
    Logger.log("✅ Blob size: " + bytes.length + " bytes");
  } catch (e) {
    Logger.log("❌ DriveApp فشل: " + String(e));
  }

  try {
    var token = ScriptApp.getOAuthToken();
    Logger.log("✅ OAuth token: " + (token ? "موجود" : "مفقود"));
    var url = "https://drive.google.com/uc?export=download&id=" + fileId;
    var res = UrlFetchApp.fetch(url, {
      headers: { "Authorization": "Bearer " + token },
      muteHttpExceptions: true
    });
    Logger.log("UrlFetch HTTP: " + res.getResponseCode() + " | size: " + res.getContent().length);
  } catch (e) {
    Logger.log("❌ UrlFetch فشل: " + String(e));
  }

  CacheService.getScriptCache().remove("BG_BASE64_CACHE");
  var bg = getBackgroundAsBase64();
  Logger.log("getBackgroundAsBase64: " + (bg ? "✅ " + bg.length + " chars" : "❌ فارغة"));
  Logger.log("=== انتهى التشخيص ===");
}

function TEST_reportTemplateDebug() {
  try {
    const template = HtmlService.createTemplateFromFile("reportTemplate");

    template.rows = [
      {
        orderNo: "12345",
        orderDate: "2026/04/20",
        clientName: "جهة تجريبية",
        lastStage: "استلام النتائج",
        pricing: "✅ 5000 - (مدير النظام) 2026-04-20 | 10:00"
      }
    ];
    template.reportNo = "R-20260420";
    template.issueDate = "2026/04/20";
    template.userName = "مدير النظام";
    template.logoData = getLogoAsBase64() || "";
    template.bgData = getBackgroundAsBase64() || "";

    const html = template.evaluate().getContent();
    Logger.log(html.substring(0, 1000));

    const blob = template.evaluate().getBlob().getAs(MimeType.PDF).setName("test-report.pdf");
    Logger.log("PDF generated in memory only: " + blob.getName());
  } catch (e) {
    Logger.log("TEST_reportTemplateDebug ERROR: " + String(e));
    throw e;
  }
}
