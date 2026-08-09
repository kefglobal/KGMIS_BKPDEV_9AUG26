function KEFG_Apply_Date_Cleanup_FULL_ONLY() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const sheet = ss.getSheetByName(KEFG_DATE.MASTER_SHEET);
  const preview = ss.getSheetByName(KEFG_DATE.PREVIEW_SHEET);

  if (!sheet) throw new Error("Sheet not found: " + KEFG_DATE.MASTER_SHEET);
  if (!preview) throw new Error("Preview sheet not found: " + KEFG_DATE.PREVIEW_SHEET);

  const firstRow = KEFG_DATE.FIRST_DATA_ROW;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const tempIdCol = KEFG_Date_GetColumn_(sheet, "TEMP_ID");

  const dataRange = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, lastCol);
  const data = dataRange.getValues();

  const idToIndex = {};

  for (let i = 0; i < data.length; i++) {
    const id = String(data[i][tempIdCol - 1] || "").trim();
    if (id) idToIndex[id] = i;
  }

  const previewData = preview.getDataRange().getValues();
  const headers = previewData[0];

  const p = {
    action: headers.indexOf("ACTION"),
    tempId: headers.indexOf("TEMP_ID"),
    fullField: headers.indexOf("FULL_FIELD"),
    newFullValue: headers.indexOf("NEW FULL VALUE"),
    status: headers.indexOf("STATUS")
  };

  let applied = 0;
  let skipped = 0;
  let notFound = 0;

  const colCache = {};

  function getCol(headerName) {
    if (!colCache[headerName]) {
      colCache[headerName] = KEFG_Date_GetColumn_(sheet, headerName);
    }
    return colCache[headerName];
  }

  for (let i = 1; i < previewData.length; i++) {
    const row = previewData[i];

    const action = String(row[p.action] || "").trim().toUpperCase();
    const status = String(row[p.status] || "").trim().toUpperCase();

    if (action !== "APPLY" || status !== "READY") {
      skipped++;
      continue;
    }

    const tempId = String(row[p.tempId] || "").trim();
    const rowIndex = idToIndex[tempId];

    if (rowIndex === undefined) {
      notFound++;
      continue;
    }

    const fullField = String(row[p.fullField] || "").trim();
    const fullCol = getCol(fullField);

    data[rowIndex][fullCol - 1] = row[p.newFullValue];
    applied++;
  }

  dataRange.setValues(data);

  SpreadsheetApp.getUi().alert(
    "Full date cleanup applied.\n\n" +
    "Full-date values updated: " + applied + "\n" +
    "Skipped preview rows: " + skipped + "\n" +
    "TEMP_ID not found: " + notFound + "\n\n" +
    "Display columns were not changed."
  );
}