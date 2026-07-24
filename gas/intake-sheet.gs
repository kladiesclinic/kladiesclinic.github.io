/**
 * K Ladies Clinic — intake form collector (Google Apps Script)
 *
 * Setup (one time, ~5 min, do this signed in to the clinic's Google account):
 * 1. Create a new Google Spreadsheet (e.g. "KLCS Intake Forms").
 * 2. Extensions → Apps Script → paste this whole file, replacing any code.
 * 3. Change WRITE_KEY and READ_KEY below to two different random strings.
 * 4. Deploy → New deployment → type "Web app"
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    → Deploy, authorize, and copy the Web app URL (ends in /exec).
 * 5. Send the Web app URL + both keys to Claude to wire into the site.
 *
 * Security model: WRITE_KEY is embedded in the public intake page and only
 * allows appending a row. READ_KEY is known only to staff (entered on
 * staff.html) and is required to read data back. Keep READ_KEY private.
 */

var WRITE_KEY = "CHANGE_ME_WRITE"; // used by intake.html to append rows
var READ_KEY = "CHANGE_ME_READ";   // used by staff.html to list records
var SHEET_NAME = "Intake";

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

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.key !== WRITE_KEY) return json({ error: "unauthorized" });
    var sheet = getSheet();
    sheet.appendRow(
      [new Date()].concat(FIELDS.map(function (f) { return String(data[f] || ""); }))
    );
    return json({ ok: true });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function doGet(e) {
  if (!e.parameter || e.parameter.key !== READ_KEY) {
    return json({ error: "unauthorized" });
  }
  var sheet = getSheet();
  var values = sheet.getDataRange().getValues();
  var header = values.shift() || [];
  var rows = values.map(function (row) {
    var obj = {};
    header.forEach(function (h, i) {
      obj[h] = row[i] instanceof Date ? row[i].toISOString() : String(row[i]);
    });
    return obj;
  });
  return json({ rows: rows.reverse() }); // newest first
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["timestamp"].concat(FIELDS));
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}
