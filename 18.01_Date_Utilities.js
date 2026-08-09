function KEFG_Date_GetSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(KEFG_DATE.MASTER_SHEET);

  if (!sheet) {
    throw new Error("Sheet not found: " + KEFG_DATE.MASTER_SHEET);
  }

  return sheet;
}

function KEFG_Date_Normalize_(value) {
  return String(value || "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function KEFG_Date_GetColumn_(sheet, headerName) {
  const headers = sheet
    .getRange(KEFG_DATE.HEADER_ROW, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];

  const target = KEFG_Date_Normalize_(headerName).toLowerCase();

  for (let i = 0; i < headers.length; i++) {
    if (KEFG_Date_Normalize_(headers[i]).toLowerCase() === target) {
      return i + 1;
    }
  }

  throw new Error('Header not found: "' + headerName + '"');
}

function KEFG_Date_MonthNumber_(monthText) {
  const m = String(monthText || "").trim().toLowerCase().slice(0, 3);

  const months = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };

  return months[m] || null;
}

function KEFG_Date_Format_(date, format) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    format
  );
}