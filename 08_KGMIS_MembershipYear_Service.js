/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Membership Year Service
 *
 * File:
 * 08_KGMIS_MembershipYear_Service.gs
 * ============================================================
 *
 * One ACTIVE record represents:
 *
 * One FAMILY_ID
 * +
 * One FINANCIAL_YEAR
 *
 * MEMBERSHIP_YEAR_KEY is the unique business key:
 * FAMILY_ID|FINANCIAL_YEAR
 */


/**
 * Required KGMIS_MEMBERSHIP_YEAR headers.
 */
const KGMIS_MEMBERSHIP_YEAR_HEADERS = Object.freeze({
  MEMBERSHIP_YEAR_KEY: 'MEMBERSHIP_YEAR_KEY',
  FAMILY_ID: 'FAMILY_ID',
  FINANCIAL_YEAR: 'FINANCIAL_YEAR',
  MEMBERSHIP_TYPE: 'MEMBERSHIP_TYPE',
  MEMBERSHIP_STATUS: 'MEMBERSHIP_STATUS',
  PAYMENT_STATUS: 'PAYMENT_STATUS',
  AMOUNT_DUE: 'AMOUNT_DUE',
  AMOUNT_RECEIVED: 'AMOUNT_RECEIVED',
  OUTSTANDING_DUES: 'OUTSTANDING_DUES',
  PAYMENT_COUNT: 'PAYMENT_COUNT',
  FIRST_PAYMENT_DATE: 'FIRST_PAYMENT_DATE',
  LAST_PAYMENT_DATE: 'LAST_PAYMENT_DATE',
  RENEWAL_DATE: 'RENEWAL_DATE',
  RECORD_STATUS: 'RECORD_STATUS',
  REMARKS: 'REMARKS',
  CREATED_ON: 'CREATED_ON',
  CREATED_BY: 'CREATED_BY',
  UPDATED_ON: 'UPDATED_ON',
  UPDATED_BY: 'UPDATED_BY'
});


/**
 * Allowed status values.
 */
const KGMIS_MEMBERSHIP_YEAR_STATUS = Object.freeze({
  MEMBERSHIP: Object.freeze([
    'CURRENT',
    'PENDING',
    'LIFETIME MEMBER',
    'EXEMPT',
    'ARCHIVED'
  ]),

  PAYMENT: Object.freeze([
    'PAID',
    'PARTIALLY PAID',
    'PENDING',
    'UNPAID',
    'WAIVED',
    'REFUNDED',
    'NOT APPLICABLE'
  ]),

  RECORD: Object.freeze([
    'ACTIVE',
    'SUPERSEDED',
    'CANCELLED'
  ])
});


/**
 * Returns one ACTIVE membership-year record.
 *
 * If financialYear is blank, the CURRENT year is used.
 */
function KGMIS_GetMembershipYear(
  familyId,
  financialYear
) {
  KGMIS_RequireTreasurerViewAccess_();

  const safeFamilyId =
    KGMIS_MembershipYearCleanValue_(
      familyId
    );

  if (!safeFamilyId) {
    throw new Error(
      'Family ID is required.'
    );
  }

  const yearRecord =
    financialYear
      ? KGMIS_GetFinancialYear(
          financialYear
        )
      : KGMIS_GetCurrentFinancialYear();

  const context =
    KGMIS_GetMembershipYearContext_();

  const matches =
    KGMIS_FindActiveMembershipYearRows_(
      context,
      safeFamilyId,
      yearRecord.financialYear
    );

  if (matches.length === 0) {
    return null;
  }

  if (matches.length > 1) {
    throw new Error(
      `Multiple ACTIVE membership-year records were found for ` +
      `${safeFamilyId} and ${yearRecord.financialYear}.`
    );
  }

  return KGMIS_CreateMembershipYearObject_(
    matches[0].row,
    context.column,
    matches[0].sheetRow
  );
}


/**
 * Returns an existing ACTIVE record or creates one.
 *
 * New records begin as:
 *
 * MEMBERSHIP_STATUS = PENDING
 * PAYMENT_STATUS    = UNPAID
 */
function KGMIS_GetOrCreateMembershipYear(
  familyId,
  financialYear
) {
  const authorisedUser =
    KGMIS_RequireSubscriptionWriteAccess_();

  const safeFamilyId =
    KGMIS_MembershipYearCleanValue_(
      familyId
    );

  if (!safeFamilyId) {
    throw new Error(
      'Family ID is required.'
    );
  }

  KGMIS_ValidateFamilyIdExists_(
    safeFamilyId
  );

  const yearRecord =
    financialYear
      ? KGMIS_GetFinancialYear(
          financialYear
        )
      : KGMIS_GetCurrentFinancialYear();

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    const context =
      KGMIS_GetMembershipYearContext_();

    const matches =
      KGMIS_FindActiveMembershipYearRows_(
        context,
        safeFamilyId,
        yearRecord.financialYear
      );

    if (matches.length > 1) {
      throw new Error(
        `Multiple ACTIVE membership-year records were found for ` +
        `${safeFamilyId} and ${yearRecord.financialYear}.`
      );
    }

    if (matches.length === 1) {
      return KGMIS_CreateMembershipYearObject_(
        matches[0].row,
        context.column,
        matches[0].sheetRow
      );
    }

    const now = new Date();

    const membershipYearKey =
      KGMIS_CreateMembershipYearKey_(
        safeFamilyId,
        yearRecord.financialYear
      );

    const amountDue =
      Number(
        yearRecord.membershipFee || 0
      );

    const amountReceived = 0;

    const outstandingDues =
      Math.max(
        0,
        amountDue - amountReceived
      );

    const newRow =
      new Array(
        context.headers.length
      ).fill('');

    newRow[
      context.column.MEMBERSHIP_YEAR_KEY
    ] = membershipYearKey;

    newRow[
      context.column.FAMILY_ID
    ] = safeFamilyId;

    newRow[
      context.column.FINANCIAL_YEAR
    ] = yearRecord.financialYear;

    newRow[
      context.column.MEMBERSHIP_TYPE
    ] = yearRecord.membershipType;

    newRow[
      context.column.MEMBERSHIP_STATUS
    ] = 'PENDING';

    newRow[
      context.column.PAYMENT_STATUS
    ] = 'UNPAID';

    newRow[
      context.column.AMOUNT_DUE
    ] = amountDue;

    newRow[
      context.column.AMOUNT_RECEIVED
    ] = amountReceived;

    newRow[
      context.column.OUTSTANDING_DUES
    ] = outstandingDues;

    newRow[
      context.column.PAYMENT_COUNT
    ] = 0;

    newRow[
      context.column.RECORD_STATUS
    ] = 'ACTIVE';

    newRow[
      context.column.CREATED_ON
    ] = now;

    newRow[
      context.column.CREATED_BY
    ] = authorisedUser.email;

    newRow[
      context.column.UPDATED_ON
    ] = now;

    newRow[
      context.column.UPDATED_BY
    ] = authorisedUser.email;

    context.sheet.appendRow(newRow);

    const newSheetRow =
      context.sheet.getLastRow();

    KGMIS_FormatMembershipYearRow_(
      context.sheet,
      context.column,
      newSheetRow
    );

    SpreadsheetApp.flush();

    const refreshedContext =
      KGMIS_GetMembershipYearContext_();

    return KGMIS_CreateMembershipYearObject_(
      refreshedContext.values[
        newSheetRow - 1
      ],
      refreshedContext.column,
      newSheetRow
    );

  } finally {
    lock.releaseLock();
  }
}


/**
 * Updates membership and payment statuses.
 *
 * Financial amounts will later be updated by the
 * Payment Transaction Service.
 */
function KGMIS_UpdateMembershipYearStatus(
  familyId,
  financialYear,
  membershipStatus,
  paymentStatus,
  remarks
) {
  const authorisedUser =
    KGMIS_RequireSubscriptionWriteAccess_();

  const safeMembershipStatus =
    KGMIS_MembershipYearCleanValue_(
      membershipStatus
    ).toUpperCase();

  const safePaymentStatus =
    KGMIS_MembershipYearCleanValue_(
      paymentStatus
    ).toUpperCase();

  if (
    !KGMIS_MEMBERSHIP_YEAR_STATUS
      .MEMBERSHIP
      .includes(safeMembershipStatus)
  ) {
    throw new Error(
      `Invalid membership status: ${membershipStatus}`
    );
  }

  if (
    !KGMIS_MEMBERSHIP_YEAR_STATUS
      .PAYMENT
      .includes(safePaymentStatus)
  ) {
    throw new Error(
      `Invalid payment status: ${paymentStatus}`
    );
  }

  const existing =
    KGMIS_GetOrCreateMembershipYear(
      familyId,
      financialYear
    );

  const context =
    KGMIS_GetMembershipYearContext_();

  const rowNumber =
    existing.sheetRow;

  context.sheet
    .getRange(
      rowNumber,
      context.column.MEMBERSHIP_STATUS + 1
    )
    .setValue(safeMembershipStatus);

  context.sheet
    .getRange(
      rowNumber,
      context.column.PAYMENT_STATUS + 1
    )
    .setValue(safePaymentStatus);

  context.sheet
    .getRange(
      rowNumber,
      context.column.REMARKS + 1
    )
    .setValue(
      KGMIS_MembershipYearCleanValue_(
        remarks
      )
    );

  context.sheet
    .getRange(
      rowNumber,
      context.column.UPDATED_ON + 1
    )
    .setValue(new Date());

  context.sheet
    .getRange(
      rowNumber,
      context.column.UPDATED_BY + 1
    )
    .setValue(
      authorisedUser.email
    );

  /*
   * Renewal date is recorded when membership
   * first becomes CURRENT.
   */
  if (
    safeMembershipStatus === 'CURRENT' &&
    !existing.renewalDate
  ) {
    context.sheet
      .getRange(
        rowNumber,
        context.column.RENEWAL_DATE + 1
      )
      .setValue(new Date());
  }

  SpreadsheetApp.flush();

  return KGMIS_GetMembershipYear(
    familyId,
    financialYear
  );
}


/**
 * Reads and validates KGMIS_MEMBERSHIP_YEAR.
 */
function KGMIS_GetMembershipYearContext_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheetName =
    KGMIS_CONFIG.MEMBERSHIP_YEAR_SHEET;

  if (!sheetName) {
    throw new Error(
      'MEMBERSHIP_YEAR_SHEET is missing from KGMIS_CONFIG.'
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
      KGMIS_MembershipYearCleanValue_(
        value
      )
  );

  const requiredHeaders =
    Object.values(
      KGMIS_MEMBERSHIP_YEAR_HEADERS
    );

  const missingHeaders =
    requiredHeaders.filter(
      header =>
        !headers.includes(header)
    );

  if (missingHeaders.length > 0) {
    throw new Error(
      'The following required membership-year headers are missing:\n\n' +
      missingHeaders.join('\n')
    );
  }

  const column = {};

  Object.entries(
    KGMIS_MEMBERSHIP_YEAR_HEADERS
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
 * Finds ACTIVE rows matching family and financial year.
 */
function KGMIS_FindActiveMembershipYearRows_(
  context,
  familyId,
  financialYear
) {
  const matches = [];

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row =
      context.values[rowIndex];

    const rowFamilyId =
      KGMIS_MembershipYearCleanValue_(
        row[context.column.FAMILY_ID]
      );

    const rowFinancialYear =
      KGMIS_MembershipYearCleanValue_(
        row[context.column.FINANCIAL_YEAR]
      );

    const recordStatus =
      KGMIS_MembershipYearCleanValue_(
        row[context.column.RECORD_STATUS]
      ).toUpperCase();

    if (
      rowFamilyId === familyId &&
      rowFinancialYear === financialYear &&
      recordStatus === 'ACTIVE'
    ) {
      matches.push({
        row,
        sheetRow: rowIndex + 1
      });
    }
  }

  return matches;
}


/**
 * Converts one row to a standard object.
 */
function KGMIS_CreateMembershipYearObject_(
  row,
  column,
  sheetRow
) {
  return {
    membershipYearKey:
      KGMIS_MembershipYearCleanValue_(
        row[column.MEMBERSHIP_YEAR_KEY]
      ),

    familyId:
      KGMIS_MembershipYearCleanValue_(
        row[column.FAMILY_ID]
      ),

    financialYear:
      KGMIS_MembershipYearCleanValue_(
        row[column.FINANCIAL_YEAR]
      ),

    membershipType:
      KGMIS_MembershipYearCleanValue_(
        row[column.MEMBERSHIP_TYPE]
      ),

    membershipStatus:
      KGMIS_MembershipYearCleanValue_(
        row[column.MEMBERSHIP_STATUS]
      ),

    paymentStatus:
      KGMIS_MembershipYearCleanValue_(
        row[column.PAYMENT_STATUS]
      ),

    amountDue:
      Number(
        row[column.AMOUNT_DUE] || 0
      ),

    amountReceived:
      Number(
        row[column.AMOUNT_RECEIVED] || 0
      ),

    outstandingDues:
      Number(
        row[column.OUTSTANDING_DUES] || 0
      ),

    paymentCount:
      Number(
        row[column.PAYMENT_COUNT] || 0
      ),

    firstPaymentDate:
      KGMIS_MembershipYearDate_(
        row[column.FIRST_PAYMENT_DATE]
      ),

    lastPaymentDate:
      KGMIS_MembershipYearDate_(
        row[column.LAST_PAYMENT_DATE]
      ),

    renewalDate:
      KGMIS_MembershipYearDate_(
        row[column.RENEWAL_DATE]
      ),

    recordStatus:
      KGMIS_MembershipYearCleanValue_(
        row[column.RECORD_STATUS]
      ),

    remarks:
      KGMIS_MembershipYearCleanValue_(
        row[column.REMARKS]
      ),

    createdOn:
      KGMIS_MembershipYearDate_(
        row[column.CREATED_ON]
      ),

    createdBy:
      KGMIS_MembershipYearCleanValue_(
        row[column.CREATED_BY]
      ),

    updatedOn:
      KGMIS_MembershipYearDate_(
        row[column.UPDATED_ON]
      ),

    updatedBy:
      KGMIS_MembershipYearCleanValue_(
        row[column.UPDATED_BY]
      ),

    sheetRow
  };
}


/**
 * Creates the unique family-year key.
 */
function KGMIS_CreateMembershipYearKey_(
  familyId,
  financialYear
) {
  return (
    KGMIS_MembershipYearCleanValue_(
      familyId
    ) +
    '|' +
    KGMIS_MembershipYearCleanValue_(
      financialYear
    )
  );
}


/**
 * Confirms that FAMILY_ID exists in the master database.
 */
function KGMIS_ValidateFamilyIdExists_(
  familyId
) {
  const sheet =
    KGMIS_getMainSheet_();

  const familyIdColumn =
    KGMIS_getColumnByHeader_(
      sheet,
      'FAMILY_ID'
    );

  const lastRow =
    sheet.getLastRow();

  if (
    lastRow <
    KGMIS_CONFIG.FIRST_DATA_ROW
  ) {
    throw new Error(
      'The KGMIS master database contains no records.'
    );
  }

  const values = sheet
    .getRange(
      KGMIS_CONFIG.FIRST_DATA_ROW,
      familyIdColumn,
      lastRow -
        KGMIS_CONFIG.FIRST_DATA_ROW +
        1,
      1
    )
    .getDisplayValues();

  const found =
    values.some(row =>
      KGMIS_MembershipYearCleanValue_(
        row[0]
      ) === familyId
    );

  if (!found) {
    throw new Error(
      `Family ID "${familyId}" was not found in the master database.`
    );
  }
}


/**
 * Formats date and currency-related cells.
 */
function KGMIS_FormatMembershipYearRow_(
  sheet,
  column,
  sheetRow
) {
  const paymentDateColumns = [
    column.FIRST_PAYMENT_DATE,
    column.LAST_PAYMENT_DATE,
    column.RENEWAL_DATE
  ];

  paymentDateColumns.forEach(
    zeroBasedColumn => {
      sheet
        .getRange(
          sheetRow,
          zeroBasedColumn + 1
        )
        .setNumberFormat(
          'dd-MMM-yyyy'
        );
    }
  );

  const auditDateColumns = [
    column.CREATED_ON,
    column.UPDATED_ON
  ];

  auditDateColumns.forEach(
    zeroBasedColumn => {
      sheet
        .getRange(
          sheetRow,
          zeroBasedColumn + 1
        )
        .setNumberFormat(
          'dd-MMM-yyyy HH:mm:ss'
        );
    }
  );

  const amountColumns = [
    column.AMOUNT_DUE,
    column.AMOUNT_RECEIVED,
    column.OUTSTANDING_DUES
  ];

  amountColumns.forEach(
    zeroBasedColumn => {
      sheet
        .getRange(
          sheetRow,
          zeroBasedColumn + 1
        )
        .setNumberFormat(
          '#,##0.00'
        );
    }
  );
}


/**
 * Converts valid values to Date objects.
 */
function KGMIS_MembershipYearDate_(
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

  return null;
}


/**
 * Cleans text values.
 */
function KGMIS_MembershipYearCleanValue_(
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
 * Manual test.
 *
 * Replace FAM00035 with an actual FAMILY_ID if necessary.
 */
function KGMIS_TestMembershipYearService() {
  const record =
    KGMIS_GetOrCreateMembershipYear(
      'FAM00035',
      '2026-27'
    );

  Logger.log(
    JSON.stringify(
      record,
      null,
      2
    )
  );

  return record;
}