/**
 * KEF Global Membership Information System (KGMIS)
 * File name: 01_KGMIS_Utilities.gs
 * Common Utility Functions
 */


/**
 * Returns the KGMIS master database sheet.
 */
function KGMIS_getMainSheet_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet = spreadsheet.getSheetByName(
    KGMIS_CONFIG.MASTER_SHEET
  );

  if (!sheet) {
    throw new Error(
      'Main sheet not found: ' +
      KGMIS_CONFIG.MASTER_SHEET
    );
  }

  return sheet;
}


/**
 * Normalises general text for comparisons and searches.
 */
function KGMIS_normalize_(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}


/**
 * Finds a column number using its Row 1 header.
 *
 * Returns the actual Google Sheets column number,
 * starting from 1.
 */
function KGMIS_getColumnByHeader_(
  sheet,
  headerName
) {
  if (!sheet) {
    throw new Error(
      'A valid sheet is required.'
    );
  }

  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    throw new Error(
      `The sheet "${sheet.getName()}" does not contain any columns.`
    );
  }

  const headers = sheet
    .getRange(
      KGMIS_CONFIG.HEADER_ROW,
      1,
      1,
      lastColumn
    )
    .getDisplayValues()[0];

  const target =
    KGMIS_normalizeHeader_(headerName);

  for (let index = 0; index < headers.length; index++) {
    if (
      KGMIS_normalizeHeader_(headers[index]) ===
      target
    ) {
      return index + 1;
    }
  }

  throw new Error(
    `Header "${headerName}" was not found in sheet "${sheet.getName()}".`
  );
}


/**
 * Normalises header names for reliable matching.
 */
function KGMIS_normalizeHeader_(value) {
  return String(value ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}


/**
 * Formats a permanent KEFG membership ID.
 *
 * Examples:
 * 1001 -> KEFG1001
 * 1002 -> KEFG1002
 */
function KGMIS_formatMemberId_(number) {
  const numericId = Number(number);

  if (
    !Number.isInteger(numericId) ||
    numericId < KGMIS_CONFIG.ID_START_NUMBER
  ) {
    throw new Error(
      `Invalid membership ID number: ${number}`
    );
  }

  return (
    KGMIS_CONFIG.ID_PREFIX +
    String(numericId).padStart(
      KGMIS_CONFIG.ID_DIGITS,
      '0'
    )
  );
}