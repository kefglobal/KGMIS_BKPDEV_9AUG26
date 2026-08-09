/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Treasurer Portal — Dashboard Service
 * Developed by: JJA Global Systems
 * File: 30.08_KGMIS_Treasurer_Dashboard.gs
 * ============================================================
 *
 * Purpose:
 * - Supply live Treasurer Dashboard values
 * - Read the current financial year
 * - Count registered families
 * - Count paid and pending membership families
 * - Calculate membership receipts
 * - Calculate payments
 * - Calculate outstanding membership dues
 */


/**
 * ============================================================
 * Treasurer Dashboard Summary
 * ============================================================
 */
function KGMIS_Treasurer_GetDashboardSummary(sessionToken) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );

  const financialYearRecord =
    KGMIS_GetCurrentFinancialYear();

  const financialYear =
    KGMIS_Treasurer_DashboardClean_(
      financialYearRecord.financialYear
    );

  if (!financialYear) {
    throw new Error(
      'The current financial year could not be determined.'
    );
  }

  const totalFamilies =
    KGMIS_Treasurer_CountFamilies_();

  const outstandingSummary =
    KGMIS_Treasurer_CalculateOutstandingMembershipSummary_(
      financialYearRecord,
      financialYear
    );

  const paidFamilies =
    Math.min(
      totalFamilies,
      Number(
        outstandingSummary.paidFamilies || 0
      )
    );

  const exemptedFamilies =
    Math.min(
      Math.max(
        0,
        totalFamilies - paidFamilies
      ),
      Number(
        outstandingSummary.exemptedFamilies || 0
      )
    );

  /*
   * Every active family not classified as PAID/CURRENT or
   * EXEMPTED is treated as NOT PAID. This includes:
   * - blank statuses;
   * - families without a current-year membership row;
   * - PENDING, UNPAID and PARTIALLY PAID records.
   */
  const notPaidFamilies =
    Math.max(
      0,
      totalFamilies -
      paidFamilies -
      exemptedFamilies
    );

  return {
    success: true,

    financialYear:
      financialYear,

    financialYearLabel:
      'Current Financial Year ' + financialYear,

    totalFamilies:
      totalFamilies,

    membershipReceipts:
      KGMIS_Treasurer_CalculateMembershipReceipts_(
        financialYear
      ),

    payments:
      KGMIS_Treasurer_CalculatePayments_(
        financialYear
      ),

    outstandingMembershipDues:
      outstandingSummary.amount,

    paidMembershipFamilies:
      paidFamilies,

    notPaidMembershipFamilies:
      notPaidFamilies,

    exemptedMembershipFamilies:
      exemptedFamilies,

    /*
     * Backward-compatible field used by older portal HTML.
     */
    pendingMembershipFamilies:
      notPaidFamilies,

    outstandingDues:
      outstandingSummary.amount
  };
}


/**
 * ============================================================
 * Total Families
 * ============================================================
 */
function KGMIS_Treasurer_CountFamilies_() {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        KGMIS_CONFIG.MASTER_SHEET
      );

  if (!sheet) {
    throw new Error(
      'Master database sheet was not found.'
    );
  }

  const values =
    sheet.getDataRange().getValues();

  if (values.length < 2) {
    return 0;
  }

  const headers =
    values[0].map(
      KGMIS_Treasurer_DashboardHeader_
    );

  const familyIdIndex =
    headers.indexOf('FAMILY_ID');

  if (familyIdIndex === -1) {
    throw new Error(
      'FAMILY_ID column was not found in the master database.'
    );
  }

  const familyIds =
    new Set();

  for (
    let row = 1;
    row < values.length;
    row++
  ) {

    const familyId =
      KGMIS_Treasurer_DashboardClean_(
        values[row][familyIdIndex]
      );

    if (familyId) {
      familyIds.add(
        familyId.toUpperCase()
      );
    }
  }

  return familyIds.size;
}


/**
 * ============================================================
 * Membership Receipts
 * ============================================================
 */
function KGMIS_Treasurer_CalculateMembershipReceipts_(
  financialYear
) {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        KGMIS_CONFIG
          .RECEIPT_TRANSACTIONS_SHEET
      );

  if (!sheet) {
    throw new Error(
      'Receipt transactions sheet was not found.'
    );
  }

  const values =
    sheet.getDataRange().getValues();

  if (values.length < 2) {
    return 0;
  }

  const headers =
    values[0].map(
      KGMIS_Treasurer_DashboardHeader_
    );

  const yearIndex =
    headers.indexOf('FINANCIAL_YEAR');

  const purposeIndex =
    headers.indexOf('PAYMENT_PURPOSE');

  const amountIndex =
    headers.indexOf('AMOUNT');

  const statusIndex =
    headers.indexOf('PAYMENT_STATUS');

  const recordStatusIndex =
    headers.indexOf('RECORD_STATUS');

  if (
    yearIndex === -1 ||
    purposeIndex === -1 ||
    amountIndex === -1
  ) {
    throw new Error(
      'Required receipt columns were not found.'
    );
  }

  let total = 0;

  for (
    let row = 1;
    row < values.length;
    row++
  ) {

    const rowYear =
      KGMIS_Treasurer_DashboardClean_(
        values[row][yearIndex]
      );

    const purpose =
      KGMIS_Treasurer_DashboardUpper_(
        values[row][purposeIndex]
      );

    const paymentStatus =
      statusIndex === -1
        ? ''
        : KGMIS_Treasurer_DashboardUpper_(
            values[row][statusIndex]
          );

    const recordStatus =
      recordStatusIndex === -1
        ? ''
        : KGMIS_Treasurer_DashboardUpper_(
            values[row][recordStatusIndex]
          );

    const isMembership =
      purpose === 'MEMBERSHIP FEE' ||
      purpose === 'MEMBERSHIP SUBSCRIPTION';

    const isValidPayment =
      !paymentStatus ||
      paymentStatus === 'SUCCESSFUL' ||
      paymentStatus === 'PAID' ||
      paymentStatus === 'COMPLETED';

    const isActiveRecord =
      !recordStatus ||
      recordStatus === 'ACTIVE';

    if (
      rowYear === financialYear &&
      isMembership &&
      isValidPayment &&
      isActiveRecord
    ) {
      total +=
        Number(
          values[row][amountIndex]
        ) || 0;
    }
  }

  return total;
}


/**
 * ============================================================
 * Total Payments
 * ============================================================
 */
function KGMIS_Treasurer_CalculatePayments_(
  financialYear
) {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        KGMIS_CONFIG
          .PAYMENT_TRANSACTIONS_SHEET
      );

  if (!sheet) {
    throw new Error(
      'Payment transactions sheet was not found.'
    );
  }

  const values =
    sheet.getDataRange().getValues();

  if (values.length < 2) {
    return 0;
  }

  const headers =
    values[0].map(
      KGMIS_Treasurer_DashboardHeader_
    );

  const yearIndex =
    headers.indexOf('FINANCIAL_YEAR');

  const amountIndex =
    headers.indexOf('AMOUNT');

  const paymentStatusIndex =
    headers.indexOf('PAYMENT_STATUS');

  const recordStatusIndex =
    headers.indexOf('RECORD_STATUS');

  if (
    yearIndex === -1 ||
    amountIndex === -1
  ) {
    throw new Error(
      'Required payment columns were not found.'
    );
  }

  let total = 0;

  for (
    let row = 1;
    row < values.length;
    row++
  ) {

    const rowYear =
      KGMIS_Treasurer_DashboardClean_(
        values[row][yearIndex]
      );

    const paymentStatus =
      paymentStatusIndex === -1
        ? ''
        : KGMIS_Treasurer_DashboardUpper_(
            values[row][paymentStatusIndex]
          );

    const recordStatus =
      recordStatusIndex === -1
        ? ''
        : KGMIS_Treasurer_DashboardUpper_(
            values[row][recordStatusIndex]
          );

    const isPaid =
      !paymentStatus ||
      paymentStatus === 'PAID' ||
      paymentStatus === 'COMPLETED' ||
      paymentStatus === 'SUCCESSFUL';

    const isActive =
      !recordStatus ||
      recordStatus === 'ACTIVE';

    if (
      rowYear === financialYear &&
      isPaid &&
      isActive
    ) {
      total +=
        Number(
          values[row][amountIndex]
        ) || 0;
    }
  }

  return total;
}


/**
 * ============================================================
 * Outstanding Membership Dues
 * ============================================================
 *
 * Primary method:
 * Uses OUTSTANDING_AMOUNT from KGMIS_MEMBERSHIP_YEAR.
 *
 * Fallback:
 * Counts unpaid families and multiplies by the membership fee
 * recorded in the current financial-year configuration.
 */
function KGMIS_Treasurer_CalculateOutstandingMembershipSummary_(
  financialYearRecord,
  financialYear
) {

  const sheet =
    SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName(
        KGMIS_CONFIG.MEMBERSHIP_YEAR_SHEET
      );

  if (!sheet) {
    return {
      amount: 0,
      paidFamilies: 0,
      pendingFamilies: 0,
      exemptedFamilies: 0
    };
  }

  const values =
    sheet.getDataRange().getValues();

  if (values.length < 2) {
    return {
      amount: 0,
      paidFamilies: 0,
      pendingFamilies: 0,
      exemptedFamilies: 0
    };
  }

  const headers =
    values[0].map(
      KGMIS_Treasurer_DashboardHeader_
    );

  const yearIndex =
    headers.indexOf('FINANCIAL_YEAR');

  const outstandingIndex =
    headers.indexOf('OUTSTANDING_AMOUNT');

  const statusIndex =
    KGMIS_Treasurer_FindHeaderIndex_(
      headers,
      [
        'SUBSCRIPTION_STATUS',
        'MEMBERSHIP_STATUS',
        'PAYMENT_STATUS'
      ]
    );

  const familyIdIndex =
    headers.indexOf('FAMILY_ID');

  const membershipFee =
    Number(
      financialYearRecord.membershipFee || 0
    );

  let amount = 0;

  const paidFamilyIds =
    new Set();

  const pendingFamilyIds =
    new Set();

  const exemptedFamilyIds =
    new Set();

  let paidRowsWithoutFamilyId = 0;
  let pendingRowsWithoutFamilyId = 0;
  let exemptedRowsWithoutFamilyId = 0;

  for (
    let row = 1;
    row < values.length;
    row++
  ) {

    const rowYear =
      yearIndex === -1
        ? financialYear
        : KGMIS_Treasurer_DashboardClean_(
            values[row][yearIndex]
          );

    if (rowYear !== financialYear) {
      continue;
    }

    const status =
      statusIndex === -1
        ? ''
        : KGMIS_Treasurer_DashboardUpper_(
            values[row][statusIndex]
          );

    const isPaid =
      status === 'PAID' ||
      status === 'CURRENT';

    const isExempted =
      status === 'EXEMPTED' ||
      status === 'EXEMPT';

    const isSettled =
      isPaid ||
      isExempted;

    let rowOutstanding = 0;

    if (outstandingIndex !== -1) {
      rowOutstanding =
        Number(
          values[row][outstandingIndex]
        ) || 0;
    } else if (!isSettled) {
      rowOutstanding = membershipFee;
    }

    amount += rowOutstanding;

    const familyId =
      familyIdIndex === -1
        ? ''
        : KGMIS_Treasurer_DashboardUpper_(
            values[row][familyIdIndex]
          );

    if (isPaid) {
      if (familyId) {
        paidFamilyIds.add(
          familyId
        );
      } else {
        paidRowsWithoutFamilyId++;
      }

    } else if (isExempted) {
      if (familyId) {
        exemptedFamilyIds.add(
          familyId
        );
      } else {
        exemptedRowsWithoutFamilyId++;
      }

    } else {
      if (familyId) {
        pendingFamilyIds.add(
          familyId
        );
      } else {
        pendingRowsWithoutFamilyId++;
      }
    }
  }

  return {
    amount:
      amount,

    paidFamilies:
      paidFamilyIds.size +
      paidRowsWithoutFamilyId,

    pendingFamilies:
      pendingFamilyIds.size +
      pendingRowsWithoutFamilyId,

    exemptedFamilies:
      exemptedFamilyIds.size +
      exemptedRowsWithoutFamilyId
  };
}


/**
 * Backward-compatible wrapper.
 */
function KGMIS_Treasurer_CalculateOutstandingDues_(
  financialYearRecord,
  financialYear
) {

  return KGMIS_Treasurer_CalculateOutstandingMembershipSummary_(
    financialYearRecord,
    financialYear
  ).amount;
}


/**
 * ============================================================
 * Dashboard Utilities
 * ============================================================
 */
function KGMIS_Treasurer_FindHeaderIndex_(
  headers,
  possibleHeaders
) {

  for (
    let index = 0;
    index < possibleHeaders.length;
    index++
  ) {

    const foundIndex =
      headers.indexOf(
        possibleHeaders[index]
      );

    if (foundIndex !== -1) {
      return foundIndex;
    }
  }

  return -1;
}


function KGMIS_Treasurer_DashboardHeader_(
  value
) {

  return String(
    value || ''
  )
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
}


function KGMIS_Treasurer_DashboardClean_(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(
    value
  ).trim();
}


function KGMIS_Treasurer_DashboardUpper_(
  value
) {

  return KGMIS_Treasurer_DashboardClean_(
    value
  ).toUpperCase();
}


/**
 * Safe test.
 */
function KGMIS_TestTreasurerDashboardSummary(
  sessionToken
) {

  const result =
    KGMIS_Treasurer_GetDashboardSummary(
      sessionToken
    );

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}