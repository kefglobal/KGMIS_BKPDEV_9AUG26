/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Receipt Service
 *
 * File:
 * 09_KGMIS_Receipt_Service.gs
 * ============================================================
 *
 * Records money received by KEF Global.
 *
 * Examples:
 * - Membership fees
 * - Donations
 * - Event registrations
 * - Sponsorships
 * - Advertisement income
 * - Welfare contributions
 *
 * A successful MEMBERSHIP receipt also updates the matching
 * KGMIS_MEMBERSHIP_YEAR record.
 */


/**
 * Required headers in KGMIS_RECEIPT_TRANSACTIONS.
 */
const KGMIS_RECEIPT_HEADERS = Object.freeze({
  TRANSACTION_ID: 'TRANSACTION_ID',
  TRANSACTION_DATE: 'TRANSACTION_DATE',
  FINANCIAL_YEAR: 'FINANCIAL_YEAR',
  FAMILY_ID: 'FAMILY_ID',
  KEFG_ID: 'KEFG_ID',
  PAYMENT_PURPOSE: 'PAYMENT_PURPOSE',
  PAYMENT_CATEGORY: 'PAYMENT_CATEGORY',
  MEMBERSHIP_YEAR_KEY: 'MEMBERSHIP_YEAR_KEY',
  AMOUNT: 'AMOUNT',
  PAYMENT_MODE: 'PAYMENT_MODE',
  TRANSACTION_REFERENCE: 'TRANSACTION_REFERENCE',
  RECEIPT_NUMBER: 'RECEIPT_NUMBER',
  RECEIPT_DATE: 'RECEIPT_DATE',
  RECEIPT_FILE_ID: 'RECEIPT_FILE_ID',
  RECEIPT_FILE_URL: 'RECEIPT_FILE_URL',
  RECEIPT_FILE_NAME: 'RECEIPT_FILE_NAME',
  RECEIPT_GENERATED_ON: 'RECEIPT_GENERATED_ON',
  PAYER_NAME: 'PAYER_NAME',
  PAYER_RELATION: 'PAYER_RELATION',
  PAYMENT_STATUS: 'PAYMENT_STATUS',
  DESCRIPTION: 'DESCRIPTION',
  EVENT_CODE: 'EVENT_CODE',
  EVENT_PROJECT: 'EVENT_PROJECT',
  RESTRICTED_FUND: 'RESTRICTED_FUND',
  RECORD_STATUS: 'RECORD_STATUS',
  CREATED_ON: 'CREATED_ON',
  CREATED_BY: 'CREATED_BY',
  UPDATED_ON: 'UPDATED_ON',
  UPDATED_BY: 'UPDATED_BY'
});


/**
 * Allowed receipt values.
 */
const KGMIS_RECEIPT_OPTIONS = Object.freeze({

  PAYMENT_PURPOSES: Object.freeze([
    'MEMBERSHIP FEE',
    'DONATION',
    'EVENT REGISTRATION',
    'SPONSORSHIP',
    'ADVERTISEMENT',
    'WELFARE CONTRIBUTION',
    'BUILDING FUND',
    'SCHOLARSHIP FUND',
    'PUBLICATION',
    'MERCHANDISE',
    'OTHER'
  ]),

  PAYMENT_CATEGORIES: Object.freeze([
    'MEMBERSHIP',
    'DONATION',
    'EVENT',
    'SPONSORSHIP',
    'ADVERTISEMENT',
    'FUND',
    'OTHER'
  ]),

  PAYMENT_MODES: Object.freeze([
    'CASH',
    'UPI',
    'BANK TRANSFER',
    'CHEQUE',
    'CARD',
    'ONLINE PAYMENT',
    'OTHER'
  ]),

  PAYER_RELATIONS: Object.freeze([
    'MEMBER',
    'SPOUSE',
    'ALUMNI SPOUSE',
    'FAMILY MEMBER',
    'DONOR',
    'SPONSOR',
    'ORGANISATION',
    'ADVERTISER',
    'NON-MEMBER',
    'OTHER'
  ]),

  PAYMENT_STATUSES: Object.freeze([
    'SUCCESSFUL',
    'PENDING',
    'FAILED',
    'REFUNDED',
    'CANCELLED'
  ]),

  RECORD_STATUSES: Object.freeze([
    'ACTIVE',
    'CANCELLED'
  ]),

  YES_NO: Object.freeze([
    'YES',
    'NO'
  ])
});


/**
 * ============================================================
 * CREATE RECEIPT TRANSACTION
 * ============================================================
 *
 * Request object example:
 *
 * {
 *   financialYear: '2026-27',
 *   transactionDate: '2026-07-12',
 *   familyId: 'FAM00035',
 *   kefgId: 'KEFG1035',
 *   paymentPurpose: 'MEMBERSHIP FEE',
 *   paymentCategory: 'MEMBERSHIP',
 *   amount: 1000,
 *   paymentMode: 'UPI',
 *   transactionReference: 'UPI123456',
 *   payerName: 'Member Name',
 *   payerRelation: 'MEMBER',
 *   paymentStatus: 'SUCCESSFUL',
 *   description: '',
 *   eventCode: '',
 *   eventProject: '',
 *   restrictedFund: 'NO'
 * }
 */
function KGMIS_CreateReceiptTransaction(
  request
) {
  const authorisedUser =
    KGMIS_RequireSubscriptionWriteAccess_();

  const data =
    KGMIS_NormalizeReceiptRequest_(
      request
    );

  /*
   * Confirm financial year and payment-open status.
   */
  const yearRecord =
    KGMIS_RequirePaymentOpen_(
      data.financialYear
    );

  data.financialYear =
    yearRecord.financialYear;

  /*
   * Membership receipts require a valid family and
   * membership-year record.
   *
   * This is done before obtaining the receipt lock because the
   * Membership Year Service uses its own script lock.
   */
  let membershipYearRecord = null;

  if (
    KGMIS_IsMembershipReceipt_(data)
  ) {
    if (!data.familyId) {
      throw new Error(
        'Family ID is required for a membership-fee receipt.'
      );
    }

    membershipYearRecord =
      KGMIS_GetOrCreateMembershipYear(
        data.familyId,
        data.financialYear
      );

    data.membershipYearKey =
      membershipYearRecord.membershipYearKey;

    if (
      data.paymentStatus === 'SUCCESSFUL' &&
      data.amount >
        membershipYearRecord.outstandingDues
    ) {
      throw new Error(
        'The membership payment exceeds the outstanding dues. ' +
        `Outstanding amount: ${membershipYearRecord.outstandingDues}.`
      );
    }
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    /*
     * Re-read the contexts after obtaining the lock.
     */
    const receiptContext =
      KGMIS_GetReceiptContext_();

    const financialYearContext =
      KGMIS_GetFinancialYearContext_();

    const lockedYearRecord =
      KGMIS_GetFinancialYear(
        data.financialYear
      );

    if (!lockedYearRecord.paymentOpen) {
      throw new Error(
        `Payments are closed for financial year ${data.financialYear}.`
      );
    }

    const now = new Date();

    const transactionId =
      KGMIS_GetNextReceiptTransactionId_(
        receiptContext
      );

    const receiptSequence =
      lockedYearRecord.lastReceiptNo + 1;

    const receiptNumber =
      KGMIS_FormatReceiptNumber_(
        lockedYearRecord.receiptPrefix,
        receiptSequence
      );

    /*
     * Avoid duplicate transaction references where one has
     * been supplied.
     */
    if (data.transactionReference) {
      KGMIS_ValidateUniqueTransactionReference_(
        receiptContext,
        data.transactionReference
      );
    }

    const newRow =
      new Array(
        receiptContext.headers.length
      ).fill('');

    newRow[
      receiptContext.column.TRANSACTION_ID
    ] = transactionId;

    newRow[
      receiptContext.column.TRANSACTION_DATE
    ] = data.transactionDate;

    newRow[
      receiptContext.column.FINANCIAL_YEAR
    ] = data.financialYear;

    newRow[
      receiptContext.column.FAMILY_ID
    ] = data.familyId;

    newRow[
      receiptContext.column.KEFG_ID
    ] = data.kefgId;

    newRow[
      receiptContext.column.PAYMENT_PURPOSE
    ] = data.paymentPurpose;

    newRow[
      receiptContext.column.PAYMENT_CATEGORY
    ] = data.paymentCategory;

    newRow[
      receiptContext.column.MEMBERSHIP_YEAR_KEY
    ] = data.membershipYearKey;

    newRow[
      receiptContext.column.AMOUNT
    ] = data.amount;

    newRow[
      receiptContext.column.PAYMENT_MODE
    ] = data.paymentMode;

    newRow[
      receiptContext.column.TRANSACTION_REFERENCE
    ] = data.transactionReference;

    newRow[
      receiptContext.column.RECEIPT_NUMBER
    ] = receiptNumber;

    newRow[
      receiptContext.column.RECEIPT_DATE
    ] = now;

    newRow[
      receiptContext.column.PAYER_NAME
    ] = data.payerName;

    newRow[
      receiptContext.column.PAYER_RELATION
    ] = data.payerRelation;

    newRow[
      receiptContext.column.PAYMENT_STATUS
    ] = data.paymentStatus;

    newRow[
      receiptContext.column.DESCRIPTION
    ] = data.description;

    newRow[
      receiptContext.column.EVENT_CODE
    ] = data.eventCode;

    newRow[
      receiptContext.column.EVENT_PROJECT
    ] = data.eventProject;

    newRow[
      receiptContext.column.RESTRICTED_FUND
    ] = data.restrictedFund;

    newRow[
      receiptContext.column.RECORD_STATUS
    ] = 'ACTIVE';

    newRow[
      receiptContext.column.CREATED_ON
    ] = now;

    newRow[
      receiptContext.column.CREATED_BY
    ] = authorisedUser.email;

    newRow[
      receiptContext.column.UPDATED_ON
    ] = now;

    newRow[
      receiptContext.column.UPDATED_BY
    ] = authorisedUser.email;

    receiptContext.sheet.appendRow(
      newRow
    );

    const newSheetRow =
      receiptContext.sheet.getLastRow();

    KGMIS_FormatReceiptRow_(
      receiptContext.sheet,
      receiptContext.column,
      newSheetRow
    );

    /*
     * Update LAST_RECEIPT_NO in KGMIS_FINANCIAL_YEAR.
     */
    financialYearContext.sheet
      .getRange(
        lockedYearRecord.sheetRow,
        financialYearContext.column
          .LAST_RECEIPT_NO + 1
      )
      .setValue(receiptSequence);

    financialYearContext.sheet
      .getRange(
        lockedYearRecord.sheetRow,
        financialYearContext.column
          .UPDATED_ON + 1
      )
      .setValue(now);

    financialYearContext.sheet
      .getRange(
        lockedYearRecord.sheetRow,
        financialYearContext.column
          .UPDATED_BY + 1
      )
      .setValue(
        authorisedUser.email
      );

    /*
     * Only successful membership receipts update the
     * annual membership ledger.
     */
    let updatedMembershipYear = null;

    if (
      membershipYearRecord &&
      data.paymentStatus === 'SUCCESSFUL'
    ) {
      updatedMembershipYear =
        KGMIS_ApplyMembershipReceipt_(
          data.familyId,
          data.financialYear,
          data.amount,
          data.transactionDate,
          authorisedUser
        );
    }

    SpreadsheetApp.flush();

    return {
      success: true,

      transactionId,

      receiptNumber,

      financialYear:
        data.financialYear,

      transactionDate:
        KGMIS_FormatReceiptDateForOutput_(
          data.transactionDate
        ),

      familyId:
        data.familyId,

      kefgId:
        data.kefgId,

      paymentPurpose:
        data.paymentPurpose,

      paymentCategory:
        data.paymentCategory,

      amount:
        data.amount,

      paymentMode:
        data.paymentMode,

      paymentStatus:
        data.paymentStatus,

      payerName:
        data.payerName,

      eventCode:
        data.eventCode,

      eventProject:
        data.eventProject,

      membershipYear:
        updatedMembershipYear,

      createdBy: {
        email:
          authorisedUser.email,

        userName:
          authorisedUser.userName,

        role:
          authorisedUser.role
      },

      message:
        `Receipt ${receiptNumber} was created successfully.`
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * ============================================================
 * UPDATE MEMBERSHIP YEAR FROM RECEIPT
 * ============================================================
 */
function KGMIS_ApplyMembershipReceipt_(
  familyId,
  financialYear,
  amount,
  transactionDate,
  authorisedUser
) {
  const context =
    KGMIS_GetMembershipYearContext_();

  const matches =
    KGMIS_FindActiveMembershipYearRows_(
      context,
      familyId,
      financialYear
    );

  if (matches.length !== 1) {
    throw new Error(
      `Exactly one ACTIVE membership-year record is required for ` +
      `${familyId} and ${financialYear}.`
    );
  }

  const existing =
    KGMIS_CreateMembershipYearObject_(
      matches[0].row,
      context.column,
      matches[0].sheetRow
    );

  const sheetRow =
    existing.sheetRow;

  const previousAmountReceived =
    Number(
      existing.amountReceived || 0
    );

  const newAmountReceived =
    previousAmountReceived +
    Number(amount);

  const amountDue =
    Number(
      existing.amountDue || 0
    );

  const outstandingDues =
    Math.max(
      0,
      amountDue -
      newAmountReceived
    );

  const paymentCount =
    Number(
      existing.paymentCount || 0
    ) + 1;

  let paymentStatus =
    'UNPAID';

  let membershipStatus =
    existing.membershipStatus ||
    'PENDING';

  if (
    amountDue === 0
  ) {
    paymentStatus =
      'NOT APPLICABLE';

  } else if (
    newAmountReceived >= amountDue
  ) {
    paymentStatus =
      'PAID';

    membershipStatus =
      'CURRENT';

  } else if (
    newAmountReceived > 0
  ) {
    paymentStatus =
      'PARTIALLY PAID';

    membershipStatus =
      'PENDING';
  }

  context.sheet
    .getRange(
      sheetRow,
      context.column.AMOUNT_RECEIVED + 1
    )
    .setValue(
      newAmountReceived
    );

  context.sheet
    .getRange(
      sheetRow,
      context.column.OUTSTANDING_DUES + 1
    )
    .setValue(
      outstandingDues
    );

  context.sheet
    .getRange(
      sheetRow,
      context.column.PAYMENT_COUNT + 1
    )
    .setValue(
      paymentCount
    );

  context.sheet
    .getRange(
      sheetRow,
      context.column.PAYMENT_STATUS + 1
    )
    .setValue(
      paymentStatus
    );

  context.sheet
    .getRange(
      sheetRow,
      context.column.MEMBERSHIP_STATUS + 1
    )
    .setValue(
      membershipStatus
    );

  /*
   * Record the first payment date only once.
   */
  if (!existing.firstPaymentDate) {
    context.sheet
      .getRange(
        sheetRow,
        context.column.FIRST_PAYMENT_DATE + 1
      )
      .setValue(
        transactionDate
      );
  }

  context.sheet
    .getRange(
      sheetRow,
      context.column.LAST_PAYMENT_DATE + 1
    )
    .setValue(
      transactionDate
    );

  /*
   * Renewal date is recorded when the membership becomes
   * CURRENT for the first time.
   */
  if (
    membershipStatus === 'CURRENT' &&
    !existing.renewalDate
  ) {
    context.sheet
      .getRange(
        sheetRow,
        context.column.RENEWAL_DATE + 1
      )
      .setValue(
        transactionDate
      );
  }

  context.sheet
    .getRange(
      sheetRow,
      context.column.UPDATED_ON + 1
    )
    .setValue(
      new Date()
    );

  context.sheet
    .getRange(
      sheetRow,
      context.column.UPDATED_BY + 1
    )
    .setValue(
      authorisedUser.email
    );

  KGMIS_FormatMembershipYearRow_(
    context.sheet,
    context.column,
    sheetRow
  );

  SpreadsheetApp.flush();

  return KGMIS_GetMembershipYear(
    familyId,
    financialYear
  );
}


/**
 * ============================================================
 * RECEIPT SHEET CONTEXT
 * ============================================================
 */
function KGMIS_GetReceiptContext_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheetName =
    KGMIS_CONFIG
      .RECEIPT_TRANSACTIONS_SHEET;

  if (!sheetName) {
    throw new Error(
      'RECEIPT_TRANSACTIONS_SHEET is missing from KGMIS_CONFIG.'
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

  const values =
    sheet
      .getRange(
        1,
        1,
        Math.max(lastRow, 1),
        lastColumn
      )
      .getValues();

  const headers =
    values[0].map(
      value =>
        KGMIS_ReceiptCleanValue_(
          value
        )
    );

  const requiredHeaders =
    Object.values(
      KGMIS_RECEIPT_HEADERS
    );

  const missingHeaders =
    requiredHeaders.filter(
      header =>
        !headers.includes(header)
    );

  if (
    missingHeaders.length > 0
  ) {
    throw new Error(
      'The following required receipt headers are missing:\n\n' +
      missingHeaders.join('\n')
    );
  }

  const column = {};

  Object.entries(
    KGMIS_RECEIPT_HEADERS
  ).forEach(
    ([key, header]) => {
      column[key] =
        headers.indexOf(header);
    }
  );

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
 * ============================================================
 * NORMALISE AND VALIDATE RECEIPT REQUEST
 * ============================================================
 */
function KGMIS_NormalizeReceiptRequest_(
  request
) {
  const input =
    request || {};

  const currentFinancialYear =
    KGMIS_GetCurrentFinancialYear();

  const data = {
    financialYear:
      KGMIS_ReceiptCleanValue_(
        input.financialYear ||
        currentFinancialYear
          .financialYear
      ),

    transactionDate:
      KGMIS_ReceiptParseDate_(
        input.transactionDate ||
        new Date()
      ),

    familyId:
      KGMIS_ReceiptCleanValue_(
        input.familyId
      ),

    kefgId:
      KGMIS_ReceiptCleanValue_(
        input.kefgId
      ),

    paymentPurpose:
      KGMIS_ReceiptUpperValue_(
        input.paymentPurpose
      ),

    paymentCategory:
      KGMIS_ReceiptUpperValue_(
        input.paymentCategory
      ),

    membershipYearKey:
      '',

    amount:
      Number(input.amount),

    paymentMode:
      KGMIS_ReceiptUpperValue_(
        input.paymentMode
      ),

    transactionReference:
      KGMIS_ReceiptCleanValue_(
        input.transactionReference
      ),

    payerName:
      KGMIS_ReceiptCleanValue_(
        input.payerName
      ),

    payerRelation:
      KGMIS_ReceiptUpperValue_(
        input.payerRelation || 'OTHER'
      ),

    paymentStatus:
      KGMIS_ReceiptUpperValue_(
        input.paymentStatus ||
        'SUCCESSFUL'
      ),

    description:
      KGMIS_ReceiptCleanValue_(
        input.description
      ),

    eventCode:
      KGMIS_ReceiptUpperValue_(
        input.eventCode
      ),

    eventProject:
      KGMIS_ReceiptCleanValue_(
        input.eventProject
      ),

    restrictedFund:
      KGMIS_ReceiptUpperValue_(
        input.restrictedFund || 'NO'
      )
  };

  if (!data.paymentPurpose) {
    throw new Error(
      'Payment purpose is required.'
    );
  }

  if (
    !KGMIS_RECEIPT_OPTIONS
      .PAYMENT_PURPOSES
      .includes(data.paymentPurpose)
  ) {
    throw new Error(
      `Invalid payment purpose: ${data.paymentPurpose}`
    );
  }

  if (!data.paymentCategory) {
    throw new Error(
      'Payment category is required.'
    );
  }

  if (
    !KGMIS_RECEIPT_OPTIONS
      .PAYMENT_CATEGORIES
      .includes(data.paymentCategory)
  ) {
    throw new Error(
      `Invalid payment category: ${data.paymentCategory}`
    );
  }

  if (
    !Number.isFinite(data.amount) ||
    data.amount <= 0
  ) {
    throw new Error(
      'Receipt amount must be greater than zero.'
    );
  }

  if (!data.paymentMode) {
    throw new Error(
      'Payment mode is required.'
    );
  }

  if (
    !KGMIS_RECEIPT_OPTIONS
      .PAYMENT_MODES
      .includes(data.paymentMode)
  ) {
    throw new Error(
      `Invalid payment mode: ${data.paymentMode}`
    );
  }

  if (!data.payerName) {
    throw new Error(
      'Payer name is required.'
    );
  }

  if (
    !KGMIS_RECEIPT_OPTIONS
      .PAYER_RELATIONS
      .includes(data.payerRelation)
  ) {
    throw new Error(
      `Invalid payer relation: ${data.payerRelation}`
    );
  }

  if (
    !KGMIS_RECEIPT_OPTIONS
      .PAYMENT_STATUSES
      .includes(data.paymentStatus)
  ) {
    throw new Error(
      `Invalid payment status: ${data.paymentStatus}`
    );
  }

  if (
    !KGMIS_RECEIPT_OPTIONS
      .YES_NO
      .includes(data.restrictedFund)
  ) {
    throw new Error(
      'Restricted fund must be YES or NO.'
    );
  }

  if (
    data.paymentCategory === 'EVENT' &&
    !data.eventCode
  ) {
    throw new Error(
      'Event code is required for an event receipt.'
    );
  }

  return data;
}


/**
 * Determines whether the transaction is a membership receipt.
 */
function KGMIS_IsMembershipReceipt_(
  data
) {
  return (
    data.paymentCategory ===
      'MEMBERSHIP' ||
    data.paymentPurpose ===
      'MEMBERSHIP FEE'
  );
}


/**
 * ============================================================
 * TRANSACTION ID
 * ============================================================
 *
 * Generates:
 *
 * RCT000001
 * RCT000002
 */
function KGMIS_GetNextReceiptTransactionId_(
  context
) {
  let highestNumber = 0;

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const transactionId =
      KGMIS_ReceiptUpperValue_(
        context.values[rowIndex][
          context.column.TRANSACTION_ID
        ]
      );

    const match =
      transactionId.match(
        /^RCT(\d+)$/
      );

    if (match) {
      highestNumber =
        Math.max(
          highestNumber,
          Number(match[1])
        );
    }
  }

  return (
    'RCT' +
    String(
      highestNumber + 1
    ).padStart(
      6,
      '0'
    )
  );
}


/**
 * Formats the official receipt number.
 */
function KGMIS_FormatReceiptNumber_(
  prefix,
  sequence
) {
  const safePrefix =
    KGMIS_ReceiptCleanValue_(
      prefix
    );

  if (!safePrefix) {
    throw new Error(
      'Receipt prefix is not configured for the financial year.'
    );
  }

  return (
    safePrefix +
    String(sequence).padStart(
      6,
      '0'
    )
  );
}


/**
 * Checks for duplicate transaction references.
 */
function KGMIS_ValidateUniqueTransactionReference_(
  context,
  transactionReference
) {
  const target =
    KGMIS_ReceiptUpperValue_(
      transactionReference
    );

  const duplicate =
    context.values
      .slice(1)
      .some(row => {
        const existingReference =
          KGMIS_ReceiptUpperValue_(
            row[
              context.column
                .TRANSACTION_REFERENCE
            ]
          );

        const recordStatus =
          KGMIS_ReceiptUpperValue_(
            row[
              context.column
                .RECORD_STATUS
            ]
          );

        return (
          existingReference === target &&
          recordStatus !== 'CANCELLED'
        );
      });

  if (duplicate) {
    throw new Error(
      `Transaction reference "${transactionReference}" already exists.`
    );
  }
}


/**
 * Formats a newly created receipt row.
 */
function KGMIS_FormatReceiptRow_(
  sheet,
  column,
  sheetRow
) {
  [
    column.TRANSACTION_DATE,
    column.RECEIPT_DATE
  ].forEach(
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

  [
    column.CREATED_ON,
    column.UPDATED_ON
  ].forEach(
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

  sheet
    .getRange(
      sheetRow,
      column.AMOUNT + 1
    )
    .setNumberFormat(
      '#,##0.00'
    );
}


/**
 * Parses supported date values.
 */
function KGMIS_ReceiptParseDate_(
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
    KGMIS_ReceiptCleanValue_(
      value
    );

  if (!text) {
    throw new Error(
      'Transaction date is required.'
    );
  }

  const isoMatch =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (isoMatch) {
    return KGMIS_ReceiptCreateValidDate_(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3])
    );
  }

  const dayFirstMatch =
    text.match(
      /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/
    );

  if (dayFirstMatch) {
    return KGMIS_ReceiptCreateValidDate_(
      Number(dayFirstMatch[3]),
      Number(dayFirstMatch[2]) - 1,
      Number(dayFirstMatch[1])
    );
  }

  throw new Error(
    `Invalid transaction date: ${text}`
  );
}


/**
 * Creates and validates a date.
 */
function KGMIS_ReceiptCreateValidDate_(
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
      'Invalid transaction date.'
    );
  }

  return date;
}


/**
 * Formats a Date value for function output.
 */
function KGMIS_FormatReceiptDateForOutput_(
  date
) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}


/**
 * Cleans a value.
 */
function KGMIS_ReceiptCleanValue_(
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
 * Cleans and uppercases a value.
 */
function KGMIS_ReceiptUpperValue_(
  value
) {
  return KGMIS_ReceiptCleanValue_(
    value
  ).toUpperCase();
}


/**
 * ============================================================
 * SAFE SETUP TEST
 * ============================================================
 *
 * This does not create a financial transaction.
 */
function KGMIS_TestReceiptServiceSetup() {
  const context =
    KGMIS_GetReceiptContext_();

  const financialYear =
    KGMIS_GetCurrentFinancialYear();

  const result = {
    receiptSheet:
      context.sheetName,

    receiptHeadersValid:
      true,

    currentFinancialYear:
      financialYear.financialYear,

    receiptPrefix:
      financialYear.receiptPrefix,

    lastReceiptNo:
      financialYear.lastReceiptNo,

    paymentOpen:
      financialYear.paymentOpen
  };

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}

/**
 * ============================================================
 * Manual Test
 *
 * Creates one membership receipt.
 *
 * Run only once for testing.
 * ============================================================
 */
function KGMIS_TestCreateMembershipReceipt() {

  const receipt =
    KGMIS_CreateReceiptTransaction({

      financialYear: "2026-27",

      transactionDate: "2026-07-12",

      familyId: "FAM00035",

      kefgId: "",

      paymentPurpose: "MEMBERSHIP FEE",

      paymentCategory: "MEMBERSHIP",

      amount: 1000,

      paymentMode: "UPI",

      transactionReference:
        "TEST-UPI-0001",

      payerName:
        "James Joseph Alenchery",

      payerRelation:
        "MEMBER",

      paymentStatus:
        "SUCCESSFUL",

      description:
        "Test membership receipt",

      eventCode: "",

      eventProject: "",

      restrictedFund: "NO"

    });

  Logger.log(
    JSON.stringify(
      receipt,
      null,
      2
    )
  );

  return receipt;

}