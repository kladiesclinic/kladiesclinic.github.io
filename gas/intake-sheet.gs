/**
 * K Ladies Clinic — intake form collector (Google Apps Script)
 *
 * What it does on every submission from intake.html:
 *   1. Appends one row to the spreadsheet (list view for staff).
 *   2. Generates a bilingual (Japanese + English) A4 PDF of the intake form
 *      into a Drive folder, named "YYYY-MM-DD HHmm 患者名.pdf".
 * Staff simply open the Drive folder or the sheet — Google login is the
 * security; no extra keys or dashboards needed.
 *
 * Setup (one time, ~5 min, signed in to the clinic's Google account):
 * 1. Create a new Google Spreadsheet (e.g. "KLCS問診票").
 * 2. Extensions → Apps Script → paste this whole file, replacing any code.
 * 3. Change WRITE_KEY below to a random string.
 * 4. Deploy → New deployment → type "Web app"
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    → Deploy, authorize, and copy the Web app URL (ends in /exec).
 * 5. Send the Web app URL + WRITE_KEY to Claude to wire into intake.html.
 *
 * WRITE_KEY only prevents strangers from spamming rows; it cannot read data.
 */

var WRITE_KEY = "CHANGE_ME_WRITE";
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

// Japanese labels (JSOG OC/LEP checklist ver.2020 wording) for the PDF.
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

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.key !== WRITE_KEY) return json({ error: "unauthorized" });
    var now = new Date();
    appendRow(data, now);
    createPdf(data, now);
    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) });
  }
}

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

function createPdf(data, now) {
  var stamp = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd HHmm");
  var title = stamp + " " + (data.name || "名前未記入");
  var doc = DocumentApp.create(title);
  var body = doc.getBody();
  body.setMarginTop(36).setMarginBottom(36).setMarginLeft(40).setMarginRight(40);

  var h = body.appendParagraph("OC・LEP初回処方時問診チェックシート（ver. 2020）");
  h.setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph("K Ladies Clinic Shinjuku ／ Pre-Consultation Intake Form")
    .setFontSize(9).setForegroundColor("#666666");
  body.appendParagraph("送信日時：" + Utilities.formatDate(now, "Asia/Tokyo", "yyyy年MM月dd日 HH:mm"))
    .setFontSize(9).setForegroundColor("#666666");

  var rows = FIELDS.map(function (f) {
    var v = String(data[f] || "");
    return [LABELS_JA[f] || f, translateValue(v) + (needsOriginal(v) ? "\n(" + v + ")" : "")];
  });
  var table = body.appendTable(rows);
  table.setBorderColor("#BBBBBB");
  for (var r = 0; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    row.getCell(0).setWidth(190).editAsText().setFontSize(8.5).setBold(true);
    row.getCell(1).editAsText().setFontSize(9);
    // Flag risky answers in red for the doctor
    var valText = row.getCell(1).getText();
    var field = FIELDS[r];
    var risky =
      (valText.indexOf("はい") === 0 &&
        ["abnormal_bleeding","pregnant_or_possibly","breastfeeding","smoking",
         "current_acute_symptoms","repeated_miscarriage_stillbirth",
         "hypertensive_disorder_of_pregnancy","medication_allergy",
         "recent_or_planned_surgery","family_history_thrombosis",
         "family_history_breast_cancer"].indexOf(field) !== -1) ||
      (field === "diagnosed_conditions" && valText !== "該当なし" && valText !== "");
    if (risky) row.getCell(1).editAsText().setForegroundColor("#B03A44").setBold(true);
  }

  doc.saveAndClose();
  var folder = getFolder();
  var pdf = DriveApp.getFileById(doc.getId()).getAs("application/pdf");
  folder.createFile(pdf).setName(title + ".pdf");
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
  return v; // free text stays as written
}

function needsOriginal(v) {
  // Show the English original under translated multi-item lists
  return v && v.indexOf(";") !== -1;
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
