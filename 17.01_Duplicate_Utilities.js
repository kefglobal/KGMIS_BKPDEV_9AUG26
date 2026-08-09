function KEFG_Duplicate_GetMasterSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(KEFG_DUPLICATE.MASTER_SHEET);

  if (!sheet) {
    throw new Error("Master sheet not found: " + KEFG_DUPLICATE.MASTER_SHEET);
  }

  return sheet;
}

function KEFG_Duplicate_Normalize_(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function KEFG_Duplicate_GetColumn_(sheet, headerName) {
  const headers = sheet
    .getRange(KEFG_DUPLICATE.HEADER_ROW, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const target = KEFG_Duplicate_Normalize_(headerName);

  for (let i = 0; i < headers.length; i++) {
    if (KEFG_Duplicate_Normalize_(headers[i]) === target) {
      return i + 1;
    }
  }

  throw new Error('Header not found: "' + headerName + '"');
}