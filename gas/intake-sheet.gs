/**
 * K Ladies Clinic — 問診票システム (Google Apps Script)
 *
 * 患者が intake.html を送信すると：
 *   1. スプレッドシートに1行追加（保管庫）
 *   2. 日本語訳付きA4 PDFを生成し staff@klcs.jp へメール送信（件名：【問診票】患者名）
 *   3. 同じPDFをドライブの「KLCS問診票PDF」フォルダにも保存
 *
 * スタッフは「問診票ビューア」（このスクリプトが表示するWebページ）で
 * 一覧→詳細（日本語・リスク赤字）→印刷 ができます。キー入力は不要で、
 * このスプレッドシートを共有されたGoogleアカウントだけが見られます。
 *
 * ―― 初期設定（1回だけ・約7分）――
 * 1. クリニックのGoogleアカウントで新しいスプレッドシートを作成（例：KLCS問診票）
 * 2. 拡張機能 → Apps Script → このファイルを全部貼り付け
 * 3. 下の WRITE_KEY をランダムな文字列に変更
 * 4. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *      実行ユーザー：自分 ／ アクセス：全員
 *    → デプロイして承認 → URLをコピー（これが【送信受付URL】）
 * 5. もう一度 デプロイ → 新しいデプロイ → 種類「ウェブアプリ」
 *      実行ユーザー：ウェブアプリにアクセスしているユーザー
 *      アクセス：Googleアカウントを持つ全員
 *    → デプロイ → URLをコピー（これが【スタッフ用ビューアURL】）
 * 6. スタッフに見せたい場合は、スプレッドシートを各スタッフのGoogleアカウントに
 *    「閲覧者」として共有（通常のGoogle共有と同じ）
 * 7. 【送信受付URL】【スタッフ用ビューアURL】【WRITE_KEY】の3つをClaudeに共有
 */

var WRITE_KEY = "CHANGE_ME_WRITE";
var STAFF_EMAIL = "staff@klcs.jp";
var SHEET_NAME = "Intake";
var PDF_FOLDER_NAME = "KLCS問診票PDF";

var FIELDS = [
  "name", "email", "date_of_birth", "height_cm", "weight_kg", "bmi",
  "blood_pressure", "last_period_start", "last_period_days",
  "abnormal_bleeding", "pregnant_or_possibly", "breastfeeding",
  "smoking", "cigarettes_per_day", "migraine_or_blurred_vision",
  "current_acute_symptoms", "currently_in_treatment", "treatment_detail",
  "past_hospitalization_or_surgery", "hospitalization_detail",
  "diagnosed_conditions", "repeated_miscarriage_stillbirth",
  "hypertensive_disorder_of_pregnancy", "taking_medications",
  "medications_detail", "previous_oc_lep_use", "previous_pill_name",
  "medication_allergy", "allergy_detail", "recent_or_planned_surgery",
  "family_history_thrombosis", "family_history_breast_cancer", "notes"
];

var LABELS_JA = {
  name: "氏名", email: "メールアドレス", date_of_birth: "生年月日",
  height_cm: "身長（cm）", weight_kg: "体重（kg）", bmi: "BMI",
  blood_pressure: "血圧",
  last_period_start: "最終月経の開始日", last_period_days: "月経の日数",
  abnormal_bleeding: "不正性器出血",
  pregnant_or_possibly: "妊娠中または妊娠の可能性",
  breastfeeding: "授乳中",
  smoking: "喫煙", cigarettes_per_day: "1日の本数",
  migraine_or_blurred_vision: "激しい頭痛・片頭痛・目のかすみ",
  current_acute_symptoms: "現在の急性症状（ACHES）",
  currently_in_treatment: "現在治療中の疾患", treatment_detail: "病名",
  past_hospitalization_or_surgery: "入院・手術を要する大きな病気の既往",
  hospitalization_detail: "その病名",
  diagnosed_conditions: "既往・診断歴",
  repeated_miscarriage_stillbirth: "流産・死産の反復",
  hypertensive_disorder_of_pregnancy: "妊娠高血圧症候群の既往",
  taking_medications: "服用中の薬・サプリメント", medications_detail: "薬剤名",
  previous_oc_lep_use: "OC・LEPの服用歴", previous_pill_name: "服用していた薬剤名",
  medication_allergy: "薬剤アレルギー", allergy_detail: "その薬剤名",
  recent_or_planned_surgery: "2週間以内の手術／4週間以内の手術予定",
  family_history_thrombosis: "家族の血栓症歴",
  family_history_breast_cancer: "家族の乳がん歴",
  notes: "その他・自由記入"
};

var VALUE_JA = {
  "Yes": "はい", "No": "いいえ",
  "Yes, without aura": "はい（前兆なし）",
  "Yes, with aura": "はい（前兆あり：目がチカチカする等）",
  "None checked": "該当なし", "None of the above": "該当なし",
  "Deep vein thrombosis (DVT)": "深部静脈血栓",
  "Pulmonary embolism": "肺塞栓症",
  "SLE (lupus)": "SLE",
  "Antiphospholipid syndrome": "抗リン脂質抗体症候群",
  "Thrombophilia (clotting disorder)": "血栓性素因",
  "Stroke / cerebrovascular disease": "脳血管障害",
  "Coronary artery disease": "冠動脈疾患",
  "Heart valve disease": "心臓弁膜症",
  "Arrhythmia": "不整脈",
  "Kidney disease": "腎機能障害",
  "High blood pressure": "高血圧",
  "Diabetes": "糖尿病",
  "High cholesterol (dyslipidemia)": "脂質代謝異常（高脂血症）",
  "Liver disease / liver tumor": "肝機能障害・肝腫瘍",
  "Gallbladder disease": "胆嚢疾患",
  "Cervical cancer": "子宮頸がん",
  "Uterine (endometrial) cancer": "子宮体がん",
  "Breast cancer": "乳がん",
  "Porphyria": "ポルフィリン症",
  "Epilepsy": "てんかん",
  "Tetany": "テタニー",
  "Crohn's disease": "クローン病",
  "Ulcerative colitis": "潰瘍性大腸炎"
};

var RISK_FIELDS = [
  "abnormal_bleeding", "pregnant_or_possibly", "breastfeeding", "smoking",
  "current_acute_symptoms", "repeated_miscarriage_stillbirth",
  "hypertensive_disorder_of_pregnancy", "medication_allergy",
  "recent_or_planned_surgery", "family_history_thrombosis",
  "family_history_breast_cancer"
];

/* ============ 患者フォームからの送信受付（デプロイ1：全員） ============ */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.key !== WRITE_KEY) return json({ error: "unauthorized" });
    var now = new Date();
    appendRow(data, now);
    createAndSendPdf(data, now);
    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) });
  }
}

/* ============ スタッフ用ビューア（デプロイ2：Googleアカウント必須） ============ */

function doGet() {
  var rows;
  try {
    rows = readAll();
  } catch (err) {
    return HtmlService.createHtmlOutput(
      "<meta charset='utf-8'><body style='font-family:sans-serif;padding:40px;'>" +
      "<h3>アクセス権がありません</h3><p>このGoogleアカウントには問診票スプレッドシートが共有されていません。<br>" +
      "管理者にスプレッドシートの共有を依頼してください。</p></body>"
    );
  }
  var t = HtmlService.createTemplate(VIEWER_HTML);
  t.data = JSON.stringify({
    rows: rows, labels: LABELS_JA, values: VALUE_JA,
    fields: FIELDS, risk: RISK_FIELDS
  });
  return t.evaluate()
    .setTitle("問診票ビューア — K Ladies Clinic")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function readAll() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var values = sheet.getDataRange().getValues();
  var header = values.shift();
  return values.map(function (row) {
    var obj = {};
    header.forEach(function (h, i) {
      obj[h] = row[i] instanceof Date
        ? Utilities.formatDate(row[i], "Asia/Tokyo", "yyyy-MM-dd HH:mm")
        : String(row[i]);
    });
    return obj;
  }).reverse();
}

var VIEWER_HTML =
'<!DOCTYPE html><html lang="ja"><head><meta charset="utf-8">' +
'<style>' +
'*{margin:0;padding:0;box-sizing:border-box}' +
'body{font-family:"Noto Sans JP","Hiragino Sans",sans-serif;background:#FBF7F4;color:#2B2124;padding:24px 16px}' +
'.wrap{max-width:760px;margin:0 auto}' +
'h1{font-size:20px;margin-bottom:4px}' +
'.sub{font-size:12px;color:#A8968F;margin-bottom:20px}' +
'.row{display:flex;justify-content:space-between;align-items:center;background:#FFF;border:1px solid #E9DDD6;' +
'border-radius:12px;padding:16px 18px;margin-bottom:10px;cursor:pointer;font-size:16px;font-weight:700}' +
'.row small{display:block;font-weight:400;font-size:12px;color:#7A6A66;margin-top:2px}' +
'.row .arrow{color:#F25C5B}' +
'#detail{display:none}' +
'.bar{display:flex;gap:10px;margin-bottom:16px}' +
'.bar button{font-size:14px;font-weight:700;padding:10px 20px;border-radius:999px;cursor:pointer;font-family:inherit}' +
'.b-print{background:#2B2124;color:#FFF;border:none}' +
'.b-back{background:#FFF;color:#2B2124;border:1px solid #E9DDD6}' +
'.sheet{background:#FFF;border:1px solid #E9DDD6;border-radius:12px;padding:20px}' +
'.ph{display:none}' +
'h2{font-size:18px;margin-bottom:2px}' +
'.meta{font-size:12px;color:#7A6A66;margin-bottom:14px}' +
'.pair{display:grid;grid-template-columns:210px 1fr;gap:10px;padding:7px 0;border-bottom:1px solid #F3EAE4;font-size:14px}' +
'.pair .l{color:#7A6A66;font-size:12.5px}' +
'.pair .v small{display:block;color:#A8968F;font-size:11px}' +
'.flag{color:#B03A44;font-weight:700}' +
'@media print{' +
'body{background:#FFF;padding:0}.list,.bar{display:none!important}#detail{display:block!important}' +
'.sheet{border:none;padding:0}.ph{display:block;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:10px;font-size:13px;font-weight:700}' +
'.pair{padding:3px 0;font-size:11px;break-inside:avoid}.pair .l{font-size:9px}' +
'@page{size:A4;margin:14mm 12mm}}' +
'</style></head><body><div class="wrap">' +
'<div class="list" id="list"><h1>問診票ビューア</h1><div class="sub">新しい順 — 名前をタップすると開きます</div><div id="rows"></div></div>' +
'<div id="detail"><div class="bar"><button class="b-back" onclick="back()">&larr; 一覧へ</button>' +
'<button class="b-print" onclick="window.print()">印刷 / PDF保存</button></div>' +
'<div class="sheet"><div class="ph">OC・LEP初回処方時問診チェックシート（ver. 2020）— K Ladies Clinic Shinjuku</div>' +
'<h2 id="d-name"></h2><div class="meta" id="d-meta"></div><div id="d-body"></div></div></div>' +
'</div><script>' +
'var DATA = <?!= data ?>;' +
'function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML}' +
'function tr(v){if(!v)return"";if(DATA.values[v])return DATA.values[v];' +
'if(v.indexOf(";")!==-1){return v.split(";").map(function(p){p=p.trim();return DATA.values[p]||p}).join("、")}return v}' +
'var rowsEl=document.getElementById("rows");' +
'if(!DATA.rows.length){rowsEl.innerHTML="<div class=sub>まだ問診票はありません。</div>"}' +
'DATA.rows.forEach(function(rec,i){var d=document.createElement("div");d.className="row";' +
'd.innerHTML="<span>"+esc(rec.name||"名前未記入")+"<small>"+esc(rec.timestamp||"")+"　生年月日 "+esc(rec.date_of_birth||"-")+"</small></span><span class=arrow>&rarr;</span>";' +
'd.onclick=function(){show(i)};rowsEl.appendChild(d)});' +
'function show(i){var rec=DATA.rows[i];' +
'document.getElementById("d-name").textContent=rec.name||"名前未記入";' +
'document.getElementById("d-meta").textContent="送信 "+(rec.timestamp||"")+"　生年月日 "+(rec.date_of_birth||"-")+"　"+(rec.email||"");' +
'var b=document.getElementById("d-body");b.innerHTML="";' +
'DATA.fields.forEach(function(f){if(f==="name")return;var v=rec[f]||"";var ja=tr(v);' +
'var risky=(DATA.risk.indexOf(f)!==-1&&v.indexOf("Yes")===0)||(f==="diagnosed_conditions"&&v&&v!=="None checked"&&v!=="None of the above");' +
'var p=document.createElement("div");p.className="pair";' +
'p.innerHTML="<div class=l>"+esc(DATA.labels[f]||f)+"</div><div class=\\"v"+(risky?" flag":"")+"\\">"+esc(ja||"―")+' +
'(ja&&ja!==v&&v?"<small>"+esc(v)+"</small>":"")+"</div>";b.appendChild(p)});' +
'document.getElementById("list").style.display="none";document.getElementById("detail").style.display="block";window.scrollTo(0,0)}' +
'function back(){document.getElementById("detail").style.display="none";document.getElementById("list").style.display="block"}' +
'</script></body></html>';

/* ============ 保存・PDF生成・メール ============ */

function appendRow(data, now) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["timestamp"].concat(FIELDS));
    sheet.setFrozenRows(1);
  }
  sheet.appendRow(
    [now].concat(FIELDS.map(function (f) { return String(data[f] || ""); }))
  );
}

function createAndSendPdf(data, now) {
  var stamp = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd HHmm");
  var title = stamp + " " + (data.name || "名前未記入");
  var doc = DocumentApp.create(title);
  var body = doc.getBody();
  body.setMarginTop(36).setMarginBottom(36).setMarginLeft(40).setMarginRight(40);

  body.appendParagraph("OC・LEP初回処方時問診チェックシート（ver. 2020）")
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph("K Ladies Clinic Shinjuku ／ Pre-Consultation Intake Form")
    .setFontSize(9).setForegroundColor("#666666");
  body.appendParagraph("送信日時：" + Utilities.formatDate(now, "Asia/Tokyo", "yyyy年MM月dd日 HH:mm"))
    .setFontSize(9).setForegroundColor("#666666");

  var rows = FIELDS.map(function (f) {
    var v = String(data[f] || "");
    var ja = translateValue(v);
    return [LABELS_JA[f] || f, ja + (v && v.indexOf(";") !== -1 ? "\n(" + v + ")" : "")];
  });
  var table = body.appendTable(rows);
  table.setBorderColor("#BBBBBB");
  for (var r = 0; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    row.getCell(0).setWidth(190).editAsText().setFontSize(8.5).setBold(true);
    row.getCell(1).editAsText().setFontSize(9);
    var field = FIELDS[r];
    var valText = row.getCell(1).getText();
    var risky =
      (valText.indexOf("はい") === 0 && RISK_FIELDS.indexOf(field) !== -1) ||
      (field === "diagnosed_conditions" && valText !== "該当なし" && valText !== "―");
    if (risky) row.getCell(1).editAsText().setForegroundColor("#B03A44").setBold(true);
  }

  doc.saveAndClose();
  var pdf = DriveApp.getFileById(doc.getId()).getAs("application/pdf").setName(title + ".pdf");

  MailApp.sendEmail({
    to: STAFF_EMAIL,
    subject: "【問診票】" + (data.name || "名前未記入") + "（" + stamp + "）",
    body:
      "新しい英語問診票が送信されました。日本語訳付きのA4 PDFを添付します。\n" +
      "そのまま印刷して医師にお渡しください。\n\n" +
      "氏名: " + (data.name || "-") + "\n" +
      "メール: " + (data.email || "-") + "\n" +
      "生年月日: " + (data.date_of_birth || "-") + "\n\n" +
      "※問診票ビューア（スタッフページの「問診票を見る」）でも閲覧できます。",
    attachments: [pdf],
  });

  getFolder().createFile(pdf);
  DriveApp.getFileById(doc.getId()).setTrashed(true);
}

function translateValue(v) {
  if (!v) return "―";
  if (VALUE_JA[v]) return VALUE_JA[v];
  if (v.indexOf(";") !== -1) {
    return v.split(";").map(function (part) {
      var p = part.trim();
      return VALUE_JA[p] || p;
    }).join("、");
  }
  return v;
}

function getFolder() {
  var it = DriveApp.getFoldersByName(PDF_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(PDF_FOLDER_NAME);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
