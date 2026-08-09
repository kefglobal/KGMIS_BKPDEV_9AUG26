function KEFG_Spouse_GetSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(KEFG_SPOUSE_CONFIG.SHEET_NAME);

  if (!sheet) {
    throw new Error("Sheet not found: " + KEFG_SPOUSE_CONFIG.SHEET_NAME);
  }

  return sheet;
}

function KEFG_Spouse_Normalize_(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function KEFG_Spouse_GetColumn_(sheet, headerName) {
  const headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const target = KEFG_Spouse_Normalize_(headerName);

  for (let i = 0; i < headers.length; i++) {
    if (KEFG_Spouse_Normalize_(headers[i]) === target) {
      return i + 1;
    }
  }

  throw new Error('Header not found: "' + headerName + '"');
}

function KEFG_Spouse_IsAllowedAlumni_(alumni) {
  return KEFG_SPOUSE_CONFIG.ALLOWED_ALUMNI.includes(
    String(alumni || "").trim().toUpperCase()
  );
}