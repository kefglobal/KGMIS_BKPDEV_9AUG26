/**
 * ============================================================
 * 34.05_KGMIS_Card_Validity.gs
 * ============================================================
 *
 * DIGITAL MEMBERSHIP CARD VALIDITY ENGINE
 *
 * Single source of truth:
 *
 * Sheet:
 * KGMIS_FINANCIAL_YEAR
 *
 * Columns:
 * FINANCIAL_YEAR
 * END_DATE
 * GRACE_PERIOD_END
 *
 * No validity date is hard-coded in the Apps Script.
 *
 * ============================================================
 */


/**
 * ============================================================
 * GET STANDARD CARD VALIDITY DATE
 * ============================================================
 *
 * Reads END_DATE from KGMIS_FINANCIAL_YEAR.
 *
 * Example:
 *
 * Financial Year : 2026-27
 * END_DATE        : 31 May 2027
 *
 * Returns:
 * Date object representing 31 May 2027
 *
 * @param {string} financialYear
 * @return {Date}
 */

function KGMIS_GetCardValidityDate_(financialYear) {

  return KGMIS_GetFinancialYearDate_(

    financialYear,

    "END_DATE"

  );

}


/**
 * ============================================================
 * GET GRACE PERIOD VALIDITY DATE
 * ============================================================
 *
 * Reads GRACE_PERIOD_END from KGMIS_FINANCIAL_YEAR.
 *
 * This can later be used by an authorised administrator
 * to extend the validity of existing cards.
 *
 * @param {string} financialYear
 * @return {Date}
 */

function KGMIS_GetCardGraceValidityDate_(financialYear) {

  return KGMIS_GetFinancialYearDate_(

    financialYear,

    "GRACE_PERIOD_END"

  );

}


/**
 * ============================================================
 * FINANCIAL YEAR DATE READER
 * ============================================================
 *
 * Internal helper.
 *
 * Finds the matching financial-year row and returns the
 * requested date column.
 *
 * @param {string} financialYear
 * @param {string} dateHeader
 * @return {Date}
 */

function KGMIS_GetFinancialYearDate_(financialYear, dateHeader) {

  const normalizedFinancialYear =
    String(financialYear || "").trim();

  if (!normalizedFinancialYear) {

    throw new Error(

      "Financial Year is required."

    );

  }

  const allowedDateHeaders = [

    "END_DATE",

    "GRACE_PERIOD_END"

  ];

  if (!allowedDateHeaders.includes(dateHeader)) {

    throw new Error(

      "Unsupported financial-year date field: " +
      dateHeader

    );

  }

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    spreadsheet.getSheetByName(
      "KGMIS_FINANCIAL_YEAR"
    );

  if (!sheet) {

    throw new Error(

      'Sheet "KGMIS_FINANCIAL_YEAR" was not found.'

    );

  }

  const lastRow =
    sheet.getLastRow();

  const lastColumn =
    sheet.getLastColumn();

  if (lastRow < 2) {

    throw new Error(

      "KGMIS_FINANCIAL_YEAR contains no data rows."

    );

  }

  const values =
    sheet
      .getRange(
        1,
        1,
        lastRow,
        lastColumn
      )
      .getValues();

  const headers =
    values[0].map(function(header) {

      return String(header || "")
        .trim()
        .toUpperCase();

    });

  const financialYearColumn =
    headers.indexOf(
      "FINANCIAL_YEAR"
    );

  const dateColumn =
    headers.indexOf(
      dateHeader
    );

  if (financialYearColumn === -1) {

    throw new Error(

      'Header "FINANCIAL_YEAR" was not found in ' +
      "KGMIS_FINANCIAL_YEAR."

    );

  }

  if (dateColumn === -1) {

    throw new Error(

      'Header "' +
      dateHeader +
      '" was not found in KGMIS_FINANCIAL_YEAR.'

    );

  }

  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const rowFinancialYear =
      String(
        values[rowIndex][financialYearColumn] || ""
      ).trim();

    if (
      rowFinancialYear ===
      normalizedFinancialYear
    ) {

      const dateValue =
        values[rowIndex][dateColumn];

      if (!dateValue) {

        throw new Error(

          dateHeader +
          " is blank for Financial Year " +
          normalizedFinancialYear +
          "."

        );

      }

      const parsedDate =
        dateValue instanceof Date
          ? new Date(dateValue.getTime())
          : new Date(dateValue);

      if (
        isNaN(
          parsedDate.getTime()
        )
      ) {

        throw new Error(

          "Invalid " +
          dateHeader +
          " for Financial Year " +
          normalizedFinancialYear +
          ": " +
          dateValue

        );

      }

      return parsedDate;

    }

  }

  throw new Error(

    "Financial Year not found in " +
    "KGMIS_FINANCIAL_YEAR: " +
    normalizedFinancialYear

  );

}


/**
 * ============================================================
 * TEST STANDARD VALIDITY DATE
 * ============================================================
 */

function KGMIS_TestCardValidity() {

  const financialYear =
    "2026-27";

  const validityDate =
    KGMIS_GetCardValidityDate_(
      financialYear
    );

  const formattedDate =
    Utilities.formatDate(

      validityDate,

      Session.getScriptTimeZone(),

      "dd MMMM yyyy"

    );

  Logger.log(
    "Financial Year: " +
    financialYear
  );

  Logger.log(
    "Valid Until: " +
    formattedDate
  );

  return validityDate;

}


/**
 * ============================================================
 * TEST GRACE PERIOD VALIDITY DATE
 * ============================================================
 */

function KGMIS_TestCardGraceValidity() {

  const financialYear =
    "2026-27";

  const graceValidityDate =
    KGMIS_GetCardGraceValidityDate_(
      financialYear
    );

  const formattedDate =
    Utilities.formatDate(

      graceValidityDate,

      Session.getScriptTimeZone(),

      "dd MMMM yyyy"

    );

  Logger.log(
    "Financial Year: " +
    financialYear
  );

  Logger.log(
    "Grace Valid Until: " +
    formattedDate
  );

  return graceValidityDate;

}