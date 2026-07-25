var SHEET_ID = "16-SK3rOLqQNOSvjFEAwf3OF_Y9RZKZXqZSRNQpNteyk";
var KEY = "klcs-679691f64730f082ed8b";
var TO = "staff@klcs.jp";
var FOLDER = "KLCS問診票PDF";
var F = ["name","email","date_of_birth","height_cm","weight_kg","bmi","blood_pressure","last_period_start","last_period_days","abnormal_bleeding","pregnant_or_possibly","breastfeeding","smoking","cigarettes_per_day","migraine_or_blurred_vision","current_acute_symptoms","currently_in_treatment","treatment_detail","past_hospitalization_or_surgery","hospitalization_detail","diagnosed_conditions","repeated_miscarriage_stillbirth","hypertensive_disorder_of_pregnancy","taking_medications","medications_detail","previous_oc_lep_use","previous_pill_name","medication_allergy","allergy_detail","recent_or_planned_surgery","family_history_thrombosis","family_history_breast_cancer","notes"];
var L = ["氏名","メールアドレス","生年月日","身長(cm)","体重(kg)","BMI","血圧","最終月経の開始日","月経の日数","不正性器出血","妊娠中または妊娠の可能性","授乳中","喫煙","1日の本数","激しい頭痛・片頭痛・目のかすみ","現在の急性症状(ACHES)","現在治療中の疾患","病名","入院・手術を要する大きな病気の既往","その病名","既往・診断歴","流産・死産の反復","妊娠高血圧症候群の既往","服用中の薬・サプリメント","薬剤名","OC・LEPの服用歴","服用していた薬剤名","薬剤アレルギー","その薬剤名","2週間以内の手術/4週間以内の手術予定","家族の血栓症歴","家族の乳がん歴","その他・自由記入"];
var RISK = [9,10,11,12,15,21,22,27,29,30,31];
var V = {"Yes":"はい","No":"いいえ","Yes, without aura":"はい(前兆なし)","Yes, with aura":"はい(前兆あり)","None checked":"該当なし","None of the above":"該当なし","Deep vein thrombosis (DVT)":"深部静脈血栓","Pulmonary embolism":"肺塞栓症","SLE (lupus)":"SLE","Antiphospholipid syndrome":"抗リン脂質抗体症候群","Thrombophilia (clotting disorder)":"血栓性素因","Stroke / cerebrovascular disease":"脳血管障害","Coronary artery disease":"冠動脈疾患","Heart valve disease":"心臓弁膜症","Arrhythmia":"不整脈","Kidney disease":"腎機能障害","High blood pressure":"高血圧","Diabetes":"糖尿病","High cholesterol (dyslipidemia)":"脂質代謝異常","Liver disease / liver tumor":"肝機能障害・肝腫瘍","Gallbladder disease":"胆嚢疾患","Cervical cancer":"子宮頸がん","Uterine (endometrial) cancer":"子宮体がん","Breast cancer":"乳がん","Porphyria":"ポルフィリン症","Epilepsy":"てんかん","Tetany":"テタニー","Crohn's disease":"クローン病","Ulcerative colitis":"潰瘍性大腸炎"};

function tr(v) {
  if (!v) return "―";
  if (V[v]) return V[v];
  if (v.indexOf(";") > -1) return v.split(";").map(function(p){ p = p.trim(); return V[p] || p; }).join("、");
  return v;
}

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.key !== KEY) return out({ error: "unauthorized" });
    var now = new Date();
    save(d, now);
    pdf(d, now);
    return out({ ok: true });
  } catch (err) {
    return out({ error: String(err) });
  }
}

function save(d, now) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sh = ss.getSheetByName("Intake") || ss.insertSheet("Intake");
  if (sh.getLastRow() === 0) { sh.appendRow(["日時"].concat(L)); sh.setFrozenRows(1); }
  sh.appendRow([now].concat(F.map(function(f){ return tr(String(d[f] || "")); })));
}

function pdf(d, now) {
  var stamp = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd HHmm");
  var title = stamp + " " + (d.name || "名前未記入");
  var doc = DocumentApp.create(title);
  var b = doc.getBody();
  b.setMarginTop(36).setMarginBottom(36).setMarginLeft(40).setMarginRight(40);
  b.appendParagraph("OC・LEP初回処方時問診チェックシート (ver.2020)").setHeading(DocumentApp.ParagraphHeading.HEADING2);
  b.appendParagraph("K Ladies Clinic Shinjuku　送信日時 " + Utilities.formatDate(now, "Asia/Tokyo", "yyyy年MM月dd日 HH:mm")).setFontSize(9).setForegroundColor("#666666");
  var rows = F.map(function(f, i) {
    var v = String(d[f] || "");
    var ja = tr(v);
    return [L[i], ja + (v.indexOf(";") > -1 ? "\n(" + v + ")" : "")];
  });
  var t = b.appendTable(rows);
  t.setBorderColor("#BBBBBB");
  for (var i = 0; i < t.getNumRows(); i++) {
    var r = t.getRow(i);
    r.getCell(0).setWidth(190).editAsText().setFontSize(8.5).setBold(true);
    r.getCell(1).editAsText().setFontSize(9);
    var txt = r.getCell(1).getText();
    var risky = (RISK.indexOf(i) > -1 && txt.indexOf("はい") === 0) || (i === 20 && txt !== "該当なし" && txt !== "―");
    if (risky) r.getCell(1).editAsText().setForegroundColor("#B03A44").setBold(true);
  }
  doc.saveAndClose();
  var file = DriveApp.getFileById(doc.getId());
  var att = file.getAs("application/pdf").setName(title + ".pdf");
  MailApp.sendEmail({
    to: TO,
    subject: "【問診票】" + (d.name || "名前未記入") + " (" + stamp + ")",
    body: "英語問診票が届きました。日本語訳付きA4 PDFを添付します。そのまま印刷して医師にお渡しください。\n\n氏名: " + (d.name || "-") + "\nメール: " + (d.email || "-") + "\n生年月日: " + (d.date_of_birth || "-") + "\n\n※PDFはドライブの「" + FOLDER + "」フォルダにも保存されています。",
    attachments: [att]
  });
  var it = DriveApp.getFoldersByName(FOLDER);
  (it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER)).createFile(att);
  file.setTrashed(true);
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
