function KEFG_Apply_Date_Cleanup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheet = ss.getSheetByName(KEFG_DATE.MASTER_SHEET);
  const preview = ss.getSheetByName(KEFG_DATE.PREVIEW_SHEET);

  if (!sheet) throw new Error("Sheet not found: " + KEFG_DATE.MASTER_SHEET);
  if (!preview) throw new Error("Preview sheet not found: " + KEFG_DATE.PREVIEW_SHEET);

  const previewData = preview.getDataRange().getValues();
  if (previewData.length < 2) {
    SpreadsheetApp.getUi().alert("No preview rows found.");
    return;
  }

  const pHeaders = previewData[0];

  const p = {
    action: pHeaders.indexOf("ACTION"),
    tempId: pHeaders.indexOf("TEMP_ID"),
    field: pHeaders.indexOf("FIELD"),
    fullField: pHeaders.indexOf("FULL_FIELD"),
    newValue: pHeaders.indexOf("NEW VALUE"),
    newFullValue: pHeaders.indexOf("NEW FULL VALUE"),
    status: pHeaders.indexOf("STATUS")
  };

  const tempIdCol = KEFG_Date_GetColumn_(sheet, "TEMP_ID");

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const firstRow = KEFG_DATE.FIRST_DATA_ROW;

  const dataRange = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, lastCol);
  const data = dataRange.getValues();

  const tempIdToIndex = {};

  for (let i = 0; i < data.length; i++) {
    const id = String(data[i][tempIdCol - 1] || "").trim();
    if (id) tempIdToIndex[id] = i;
  }

  let applied = 0;
  let skipped = 0;
  let notFound = 0;

  for (let i = 1; i < previewData.length; i++) {
    const row = previewData[i];

    const action = String(row[p.action] || "").trim().toUpperCase();
    const status = String(row[p.status] || "").trim().toUpperCase();

    if (action !== "APPLY" || status !== "READY") {
      skipped++;
      continue;
    }

    const tempId = String(row[p.tempId] || "").trim();
    const rowIndex = tempIdToIndex[tempId];

    if (rowIndex === undefined) {
      notFound++;
      continue;
    }

    const displayField = String(row[p.field] || "").trim();
    const fullField = String(row[p.fullField] || "").trim();

    const displayCol = KEFG_Date_GetColumn_(sheet, displayField);
    const fullCol = KEFG_Date_GetColumn_(sheet, fullField);

    data[rowIndex][displayCol - 1] = row[p.newValue];
    data[rowIndex][fullCol - 1] = row[p.newFullValue];

    applied++;
  }

  dataRange.setValues(data);

  SpreadsheetApp.getUi().alert(
    "Date cleanup applied.\n\n" +
    "Applied changes: " + applied + "\n" +
    "Skipped rows: " + skipped + "\n" +
    "TEMP_ID not found: " + notFound + "\n\n" +
    "Updated sheet: " + KEFG_DATE.MASTER_SHEET
  );
}