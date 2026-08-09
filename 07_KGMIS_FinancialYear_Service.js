/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Financial Year Service
 *
 * File:
 * 07_KGMIS_FinancialYear_Service.gs
 * ============================================================
 *
 * Provides:
 * - Current financial-year configuration
 * - Financial-year table validation
 * - Financial-year lookup
 * - Payment-open validation
 */


/**
 * Required headers in KGMIS_FINANCIAL_YEAR.
 */
const KGMIS_FINANCIAL_YEAR_HEADERS = Object.freeze({
  FINANCIAL_YEAR: 'FINANCIAL_YEAR',
  START_DATE: 'START_DATE',
  END_DATE: 'END_DATE',
  MEMBERSHIP_FEE: 'MEMBERSHIP_FEE',
  MEMBERSHIP_TYPE: 'MEMBERSHIP_TYPE',
  GRACE_PERIOD_END: 'GRACE_PERIOD_END',
  STATUS: 'STATUS',
  RECEIPT_PREFIX: 'RECEIPT_PREFIX',
  LAST_RECEIPT_NO: 'LAST_RECEIPT_NO',
  PAYMENT_OPEN: 'PAYMENT_OPEN',
  REMARKS: 'REMARKS',
  CREATED_ON: 'CREATED_ON',
  UPDATED_ON: 'UPDATED_ON',
  UPDATED_BY: 'UPDATED_BY'
});


/**
 * Returns the financial-year record marked CURRENT.
 *
 * Exactly one row should normally have STATUS = CURRENT.
 */
function KGMIS_GetCurrentFinancialYear() {
  const context =
    KGMIS_GetFinancialYearContext_();

  const currentRows = [];

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row = context.values[rowIndex];

    const status =
      KGMIS_FinancialYearCleanValue_(
        row[context.column.STATUS]
      ).toUpperCase();

    if (status === 'CURRENT') {
      currentRows.push({
        row,
        sheetRow: rowIndex + 1
      });
    }
  }

  if (currentRows.length === 0) {
    throw new Error(
      'No CURRENT financial year is configured in ' +
      KGMIS_CONFIG.FINANCIAL_YEAR_SHEET +
      '.'
    );
  }

  if (currentRows.length > 1) {
    throw new Error(
      'More than one financial year is marked CURRENT. ' +
      'Only one CURRENT financial year is permitted.'
    );
  }

  return KGMIS_CreateFinancialYearRecord_(
    currentRows[0].row,
    context.column,
    currentRows[0].sheetRow
  );
}


/**
 * Returns a specific financial-year record.
 *
 * Example:
 * KGMIS_GetFinancialYear('2026-27')
 */
function KGMIS_GetFinancialYear(
  financialYear
) {
  const requestedYear =
    KGMIS_FinancialYearCleanValue_(
      financialYear
    );

  if (!requestedYear) {
    throw new Error(
      'Financial year is required.'
    );
  }

  const context =
    KGMIS_GetFinancialYearContext_();

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row = context.values[rowIndex];

    const rowFinancialYear =
      KGMIS_FinancialYearCleanValue_(
        row[context.column.FINANCIAL_YEAR]
      );

    if (rowFinancialYear === requestedYear) {
      return KGMIS_CreateFinancialYearRecord_(
        row,
        context.column,
        rowIndex + 1
      );
    }
  }

  throw new Error(
    `Financial year "${requestedYear}" was not found.`
  );
}


/**
 * Returns all configured financial years.
 */
function KGMIS_GetFinancialYears() {
  const context =
    KGMIS_GetFinancialYearContext_();

  const records = [];

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row = context.values[rowIndex];

    const financialYear =
      KGMIS_FinancialYearCleanValue_(
        row[context.column.FINANCIAL_YEAR]
      );

    if (!financialYear) {
      continue;
    }

    records.push(
      KGMIS_CreateFinancialYearRecord_(
        row,
        context.column,
        rowIndex + 1
      )
    );
  }

  return records;
}


/**
 * Confirms that payments are open for the requested year.
 *
 * If financialYear is blank, the CURRENT year is used.
 */
function KGMIS_RequirePaymentOpen_(
  financialYear
) {
  const yearRecord =
    financialYear
      ? KGMIS_GetFinancialYear(
          financialYear
        )
      : KGMIS_GetCurrentFinancialYear();

  if (!yearRecord.paymentOpen) {
    throw new Error(
      `Payments are closed for financial year ${yearRecord.financialYear}.`
    );
  }

  return yearRecord;
}


/**
 * Reads and validates KGMIS_FINANCIAL_YEAR.
 */
function KGMIS_GetFinancialYearContext_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheetName =
    KGMIS_CONFIG.FINANCIAL_YEAR_SHEET;

  if (!sheetName) {
    throw new Error(
      'FINANCIAL_YEAR_SHEET is missing from KGMIS_CONFIG.'
    );
  }

  const sheet =
    spreadsheet.getSheetByName(
      sheetName
    );

  if (!sheet) {
    throw new Error(
      `Required sheet "${sheetName}" was not found.`
    );
  }

  const lastRow =
    sheet.getLastRow();

  const lastColumn =
    sheet.getLastColumn();

  if (lastColumn === 0) {
    throw new Error(
      `${sheetName} does not contain any columns.`
    );
  }

  const values = sheet
    .getRange(
      1,
      1,
      Math.max(lastRow, 1),
      lastColumn
    )
    .getValues();

  const headers = values[0].map(
    value =>
      KGMIS_FinancialYearCleanValue_(
        value
      )
  );

  const requiredHeaders =
    Object.values(
      KGMIS_FINANCIAL_YEAR_HEADERS
    );

  const missingHeaders =
    requiredHeaders.filter(
      header =>
        !headers.includes(header)
    );

  if (missingHeaders.length > 0) {
    throw new Error(
      'The following required financial-year headers are missing:\n\n' +
      missingHeaders.join('\n')
    );
  }

  const column = {};

  Object.entries(
    KGMIS_FINANCIAL_YEAR_HEADERS
  ).forEach(([key, header]) => {
    column[key] =
      headers.indexOf(header);
  });

  return {
    spreadsheet,
    sheet,
    sheetName,
    values,
    headers,
    column,
    lastRow,
    lastColumn
  };
}


/**
 * Converts one financial-year row into a standard object.
 */
function KGMIS_CreateFinancialYearRecord_(
  row,
  column,
  sheetRow
) {
  const financialYear =
    KGMIS_FinancialYearCleanValue_(
      row[column.FINANCIAL_YEAR]
    );

  const status =
    KGMIS_FinancialYearCleanValue_(
      row[column.STATUS]
    ).toUpperCase();

  const paymentOpenValue =
    KGMIS_FinancialYearCleanValue_(
      row[column.PAYMENT_OPEN]
    ).toUpperCase();

  return {
    financialYear,

    startDate:
      KGMIS_FinancialYearConvertToDate_(
        row[column.START_DATE]
      ),

    endDate:
      KGMIS_FinancialYearConvertToDate_(
        row[column.END_DATE]
      ),

    membershipFee:
      KGMIS_FinancialYearToNumber_(
        row[column.MEMBERSHIP_FEE]
      ),

    membershipType:
      KGMIS_FinancialYearCleanValue_(
        row[column.MEMBERSHIP_TYPE]
      ).toUpperCase(),

    gracePeriodEnd:
      KGMIS_FinancialYearConvertToDate_(
        row[column.GRACE_PERIOD_END]
      ),

    status,

    receiptPrefix:
      KGMIS_FinancialYearCleanValue_(
        row[column.RECEIPT_PREFIX]
      ),

    lastReceiptNo:
      KGMIS_FinancialYearToInteger_(
        row[column.LAST_RECEIPT_NO]
      ),

    paymentOpen:
      paymentOpenValue === 'YES',

    remarks:
      KGMIS_FinancialYearCleanValue_(
        row[column.REMARKS]
      ),

    createdOn:
      KGMIS_FinancialYearConvertToDate_(
        row[column.CREATED_ON]
      ),

    updatedOn:
      KGMIS_FinancialYearConvertToDate_(
        row[column.UPDATED_ON]
      ),

    updatedBy:
      KGMIS_FinancialYearCleanValue_(
        row[column.UPDATED_BY]
      ),

    sheetRow
  };
}


/**
 * Converts a value to a number.
 *
 * Blank values return 0.
 */
function KGMIS_FinancialYearToNumber_(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0;
  }

  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    throw new Error(
      `Invalid numeric value in financial-year configuration: ${value}`
    );
  }

  return number;
}


/**
 * Converts a value to a non-negative integer.
 *
 * Blank values return 0.
 */
function KGMIS_FinancialYearToInteger_(
  value
) {
  const number =
    KGMIS_FinancialYearToNumber_(
      value
    );

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    throw new Error(
      `Invalid integer value in financial-year configuration: ${value}`
    );
  }

  return number;
}


/**
 * Converts supported date values to Date objects.
 */
function KGMIS_FinancialYearConvertToDate_(
  value
) {
  if (
    Object.prototype.toString.call(
      value
    ) === '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return value;
  }

  const text =
    KGMIS_FinancialYearCleanValue_(
      value
    );

  if (!text) {
    return null;
  }

  const isoMatch = text.match(
    /^(\d{4})-(\d{2})-(\d{2})$/
  );

  if (isoMatch) {
    return KGMIS_FinancialYearCreateValidDate_(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3])
    );
  }

  const dayFirstMatch = text.match(
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/
  );

  if (dayFirstMatch) {
    return KGMIS_FinancialYearCreateValidDate_(
      Number(dayFirstMatch[3]),
      Number(dayFirstMatch[2]) - 1,
      Number(dayFirstMatch[1])
    );
  }

  throw new Error(
    `Invalid date value in financial-year configuration: ${text}`
  );
}


/**
 * Creates and validates a date.
 */
function KGMIS_FinancialYearCreateValidDate_(
  year,
  monthIndex,
  day
) {
  const date =
    new Date(
      year,
      monthIndex,
      day
    );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    throw new Error(
      'Invalid date in financial-year configuration.'
    );
  }

  return date;
}


/**
 * Cleans general text values.
 */
function KGMIS_FinancialYearCleanValue_(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}


/**
 * Manual test for the CURRENT financial year.
 */
function KGMIS_TestCurrentFinancialYear() {
  const financialYear =
    KGMIS_GetCurrentFinancialYear();

  Logger.log(
    JSON.stringify(
      financialYear,
      null,
      2
    )
  );

  return financialYear;
}