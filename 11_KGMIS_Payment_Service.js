/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Payment Service
 *
 * File:
 * 11_KGMIS_Payment_Service.gs
 * ============================================================
 *
 * Records money paid by KEF Global and creates official
 * payment-voucher numbers where applicable.
 */

const KGMIS_PAYMENT_HEADERS = Object.freeze({
  PAYMENT_ID: 'PAYMENT_ID',
  PAYMENT_DATE: 'PAYMENT_DATE',
  FINANCIAL_YEAR: 'FINANCIAL_YEAR',
  PAYMENT_PURPOSE: 'PAYMENT_PURPOSE',
  PAYMENT_CATEGORY: 'PAYMENT_CATEGORY',
  EVENT_CODE: 'EVENT_CODE',
  EVENT_PROJECT: 'EVENT_PROJECT',
  PAYEE_NAME: 'PAYEE_NAME',
  PAYEE_TYPE: 'PAYEE_TYPE',
  VENDOR_ID: 'VENDOR_ID',
  FAMILY_ID: 'FAMILY_ID',
  KEFG_ID: 'KEFG_ID',
  AMOUNT: 'AMOUNT',
  PAYMENT_MODE: 'PAYMENT_MODE',
  TRANSACTION_REFERENCE: 'TRANSACTION_REFERENCE',
  INVOICE_NUMBER: 'INVOICE_NUMBER',
  INVOICE_DATE: 'INVOICE_DATE',
  VOUCHER_NUMBER: 'VOUCHER_NUMBER',
  VOUCHER_DATE: 'VOUCHER_DATE',
  VOUCHER_FILE_ID: 'VOUCHER_FILE_ID',
  VOUCHER_FILE_URL: 'VOUCHER_FILE_URL',
  VOUCHER_FILE_NAME: 'VOUCHER_FILE_NAME',
  VOUCHER_GENERATED_ON: 'VOUCHER_GENERATED_ON',
  APPROVED_BY: 'APPROVED_BY',
  APPROVAL_DATE: 'APPROVAL_DATE',
  BUDGET_HEAD: 'BUDGET_HEAD',
  RESTRICTED_FUND: 'RESTRICTED_FUND',
  PAYMENT_STATUS: 'PAYMENT_STATUS',
  DESCRIPTION: 'DESCRIPTION',
  SUPPORTING_DOCUMENT_ID: 'SUPPORTING_DOCUMENT_ID',
  RECORD_STATUS: 'RECORD_STATUS',
  CREATED_ON: 'CREATED_ON',
  CREATED_BY: 'CREATED_BY',
  UPDATED_ON: 'UPDATED_ON',
  UPDATED_BY: 'UPDATED_BY'
});

const KGMIS_PAYMENT_OPTIONS = Object.freeze({
  PAYMENT_PURPOSES: Object.freeze([
    'HALL BOOKING',
    'FOOD AND CATERING',
    'CHARITY PAYMENT',
    'WELFARE ASSISTANCE',
    'PRINTING',
    'OFFICE EXPENSE',
    'TRAVEL',
    'ACCOMMODATION',
    'DECORATION',
    'AUDIO VISUAL',
    'TRANSPORT',
    'BANK CHARGES',
    'PROFESSIONAL FEES',
    'EQUIPMENT HIRE',
    'REFUND',
    'VENDOR PAYMENT',
    'OTHER'
  ]),
  PAYMENT_CATEGORIES: Object.freeze([
    'EVENT',
    'CHARITY',
    'WELFARE',
    'ADMINISTRATION',
    'OFFICE',
    'TRAVEL',
    'PUBLICATION',
    'BANK',
    'VENDOR PAYMENT',
    'REFUND',
    'OTHER'
  ]),
  PAYEE_TYPES: Object.freeze([
    'VENDOR',
    'MEMBER',
    'NON-MEMBER',
    'HALL OWNER',
    'CATERER',
    'HOTEL',
    'PRINTER',
    'SERVICE PROVIDER',
    'BANK',
    'GOVERNMENT',
    'CHARITABLE BENEFICIARY',
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
  PAYMENT_STATUSES: Object.freeze([
    'DRAFT',
    'PENDING APPROVAL',
    'APPROVED',
    'PARTIALLY PAID',
    'PAID',
    'CANCELLED',
    'REFUNDED'
  ]),
  YES_NO: Object.freeze([
    'YES',
    'NO'
  ])
});

const KGMIS_PAYMENT_VOUCHER_STATUSES = Object.freeze([
  'APPROVED',
  'PARTIALLY PAID',
  'PAID',
  'REFUNDED'
]);


/**
 * Creates a payment transaction.
 */
function KGMIS_CreatePaymentTransaction(request) {
  const authorisedUser =
    KGMIS_RequireSubscriptionWriteAccess_();

  const data =
    KGMIS_NormalizePaymentRequest_(request);

  const yearRecord =
    data.financialYear
      ? KGMIS_GetFinancialYear(data.financialYear)
      : KGMIS_GetCurrentFinancialYear();

  data.financialYear =
    yearRecord.financialYear;

  KGMIS_ValidatePaymentDateWithinYear_(
    data.paymentDate,
    yearRecord
  );

  if (yearRecord.status === 'CLOSED') {
    throw new Error(
      `Financial year ${yearRecord.financialYear} is closed.`
    );
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {
    const paymentContext =
      KGMIS_GetPaymentContext_();

    const financialYearContext =
      KGMIS_GetFinancialYearContext_();

    if (data.transactionReference) {
      KGMIS_ValidateUniquePaymentReference_(
        paymentContext,
        data.transactionReference
      );
    }

    const now =
      new Date();

    const paymentId =
      KGMIS_GetNextPaymentId_(paymentContext);

    let voucherNumber = '';
    let voucherDate = null;
    let nextVoucherSequence = null;

    if (
      KGMIS_PAYMENT_VOUCHER_STATUSES
        .includes(data.paymentStatus)
    ) {
      const voucherConfig =
        KGMIS_GetPaymentVoucherConfig_(
          financialYearContext,
          yearRecord.sheetRow
        );

      nextVoucherSequence =
        voucherConfig.lastVoucherNo + 1;

      voucherNumber =
        KGMIS_FormatPaymentVoucherNumber_(
          voucherConfig.voucherPrefix,
          nextVoucherSequence
        );

      voucherDate =
        data.paymentDate;
    }

    const newRow =
      new Array(paymentContext.headers.length)
        .fill('');

    newRow[paymentContext.column.PAYMENT_ID] =
      paymentId;
    newRow[paymentContext.column.PAYMENT_DATE] =
      data.paymentDate;
    newRow[paymentContext.column.FINANCIAL_YEAR] =
      data.financialYear;
    newRow[paymentContext.column.PAYMENT_PURPOSE] =
      data.paymentPurpose;
    newRow[paymentContext.column.PAYMENT_CATEGORY] =
      data.paymentCategory;
    newRow[paymentContext.column.EVENT_CODE] =
      data.eventCode;
    newRow[paymentContext.column.EVENT_PROJECT] =
      data.eventProject;
    newRow[paymentContext.column.PAYEE_NAME] =
      data.payeeName;
    newRow[paymentContext.column.PAYEE_TYPE] =
      data.payeeType;
    newRow[paymentContext.column.VENDOR_ID] =
      data.vendorId;
    newRow[paymentContext.column.FAMILY_ID] =
      data.familyId;
    newRow[paymentContext.column.KEFG_ID] =
      data.kefgId;
    newRow[paymentContext.column.AMOUNT] =
      data.amount;
    newRow[paymentContext.column.PAYMENT_MODE] =
      data.paymentMode;
    newRow[paymentContext.column.TRANSACTION_REFERENCE] =
      data.transactionReference;
    newRow[paymentContext.column.INVOICE_NUMBER] =
      data.invoiceNumber;
    newRow[paymentContext.column.INVOICE_DATE] =
      data.invoiceDate;
    newRow[paymentContext.column.VOUCHER_NUMBER] =
      voucherNumber;
    newRow[paymentContext.column.VOUCHER_DATE] =
      voucherDate;
    newRow[paymentContext.column.APPROVED_BY] =
      data.approvedBy;
    newRow[paymentContext.column.APPROVAL_DATE] =
      data.approvalDate;
    newRow[paymentContext.column.BUDGET_HEAD] =
      data.budgetHead;
    newRow[paymentContext.column.RESTRICTED_FUND] =
      data.restrictedFund;
    newRow[paymentContext.column.PAYMENT_STATUS] =
      data.paymentStatus;
    newRow[paymentContext.column.DESCRIPTION] =
      data.description;
    newRow[paymentContext.column.SUPPORTING_DOCUMENT_ID] =
      data.supportingDocumentId;
    newRow[paymentContext.column.RECORD_STATUS] =
      'ACTIVE';
    newRow[paymentContext.column.CREATED_ON] =
      now;
    newRow[paymentContext.column.CREATED_BY] =
      authorisedUser.email;
    newRow[paymentContext.column.UPDATED_ON] =
      now;
    newRow[paymentContext.column.UPDATED_BY] =
      authorisedUser.email;

    paymentContext.sheet.appendRow(newRow);

    const newSheetRow =
      paymentContext.sheet.getLastRow();

    KGMIS_FormatPaymentRow_(
      paymentContext.sheet,
      paymentContext.column,
      newSheetRow
    );

    if (nextVoucherSequence !== null) {
      KGMIS_UpdatePaymentVoucherSequence_(
        financialYearContext,
        yearRecord.sheetRow,
        nextVoucherSequence,
        authorisedUser
      );
    }

    SpreadsheetApp.flush();

    return {
      success: true,
      paymentId,
      paymentDate:
        KGMIS_FormatPaymentDateForOutput_(
          data.paymentDate
        ),
      financialYear:
        data.financialYear,
      paymentPurpose:
        data.paymentPurpose,
      paymentCategory:
        data.paymentCategory,
      eventCode:
        data.eventCode,
      eventProject:
        data.eventProject,
      payeeName:
        data.payeeName,
      payeeType:
        data.payeeType,
      amount:
        data.amount,
      paymentMode:
        data.paymentMode,
      paymentStatus:
        data.paymentStatus,
      transactionReference:
        data.transactionReference,
      voucherNumber,
      voucherDate:
        voucherDate
          ? KGMIS_FormatPaymentDateForOutput_(
              voucherDate
            )
          : '',
      recordStatus:
        'ACTIVE',
      createdBy: {
        email:
          authorisedUser.email,
        userName:
          authorisedUser.userName,
        role:
          authorisedUser.role
      },
      message:
        voucherNumber
          ? `Payment ${paymentId} was recorded with voucher ${voucherNumber}.`
          : `Payment ${paymentId} was recorded successfully.`
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Reads and validates KGMIS_PAYMENT_TRANSACTIONS.
 */
function KGMIS_GetPaymentContext_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheetName =
    KGMIS_CONFIG.PAYMENT_TRANSACTIONS_SHEET;

  if (!sheetName) {
    throw new Error(
      'PAYMENT_TRANSACTIONS_SHEET is missing from KGMIS_CONFIG.'
    );
  }

  const sheet =
    spreadsheet.getSheetByName(sheetName);

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
        KGMIS_PaymentCleanValue_(value)
    );

  const missingHeaders =
    Object.values(KGMIS_PAYMENT_HEADERS)
      .filter(
        header =>
          !headers.includes(header)
      );

  if (missingHeaders.length > 0) {
    throw new Error(
      'The following required payment headers are missing:\n\n' +
      missingHeaders.join('\n')
    );
  }

  const column = {};

  Object.entries(KGMIS_PAYMENT_HEADERS)
    .forEach(([key, header]) => {
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
 * Normalizes and validates a payment request.
 */
function KGMIS_NormalizePaymentRequest_(request) {
  const input =
    request || {};

  const currentFinancialYear =
    KGMIS_GetCurrentFinancialYear();

  const data = {
    financialYear:
      KGMIS_PaymentCleanValue_(
        input.financialYear ||
        currentFinancialYear.financialYear
      ),

    paymentDate:
      KGMIS_PaymentParseDate_(
        input.paymentDate ||
        new Date()
      ),

    paymentPurpose:
      KGMIS_PaymentUpperValue_(
        input.paymentPurpose
      ),

    paymentCategory:
      KGMIS_PaymentUpperValue_(
        input.paymentCategory
      ),

    eventCode:
      KGMIS_PaymentUpperValue_(
        input.eventCode
      ),

    eventProject:
      KGMIS_PaymentCleanValue_(
        input.eventProject
      ),

    payeeName:
      KGMIS_PaymentCleanValue_(
        input.payeeName
      ),

    payeeType:
      KGMIS_PaymentUpperValue_(
        input.payeeType
      ),

    vendorId:
      KGMIS_PaymentCleanValue_(
        input.vendorId
      ),

    familyId:
      KGMIS_PaymentCleanValue_(
        input.familyId
      ),

    kefgId:
      KGMIS_PaymentCleanValue_(
        input.kefgId
      ),

    amount:
      Number(input.amount),

    paymentMode:
      KGMIS_PaymentUpperValue_(
        input.paymentMode
      ),

    transactionReference:
      KGMIS_PaymentCleanValue_(
        input.transactionReference
      ),

    invoiceNumber:
      KGMIS_PaymentCleanValue_(
        input.invoiceNumber
      ),

    invoiceDate:
      input.invoiceDate
        ? KGMIS_PaymentParseDate_(
            input.invoiceDate
          )
        : null,

    approvedBy:
      KGMIS_PaymentCleanValue_(
        input.approvedBy
      ),

    approvalDate:
      input.approvalDate
        ? KGMIS_PaymentParseDate_(
            input.approvalDate
          )
        : null,

    budgetHead:
      KGMIS_PaymentCleanValue_(
        input.budgetHead
      ),

    restrictedFund:
      KGMIS_PaymentUpperValue_(
        input.restrictedFund || 'NO'
      ),

    paymentStatus:
      KGMIS_PaymentUpperValue_(
        input.paymentStatus || 'PAID'
      ),

    description:
      KGMIS_PaymentCleanValue_(
        input.description
      ),

    supportingDocumentId:
      KGMIS_PaymentCleanValue_(
        input.supportingDocumentId
      )
  };

  if (
    !KGMIS_PAYMENT_OPTIONS.PAYMENT_PURPOSES
      .includes(data.paymentPurpose)
  ) {
    throw new Error(
      `Invalid payment purpose: ${data.paymentPurpose}`
    );
  }

  if (
    !KGMIS_PAYMENT_OPTIONS.PAYMENT_CATEGORIES
      .includes(data.paymentCategory)
  ) {
    throw new Error(
      `Invalid payment category: ${data.paymentCategory}`
    );
  }

  if (!data.payeeName) {
    throw new Error(
      'Payee name is required.'
    );
  }

  if (
    !KGMIS_PAYMENT_OPTIONS.PAYEE_TYPES
      .includes(data.payeeType)
  ) {
    throw new Error(
      `Invalid payee type: ${data.payeeType}`
    );
  }

  if (
    !Number.isFinite(data.amount) ||
    data.amount <= 0
  ) {
    throw new Error(
      'Payment amount must be greater than zero.'
    );
  }

  if (
    !KGMIS_PAYMENT_OPTIONS.PAYMENT_MODES
      .includes(data.paymentMode)
  ) {
    throw new Error(
      `Invalid payment mode: ${data.paymentMode}`
    );
  }

  if (
    !KGMIS_PAYMENT_OPTIONS.PAYMENT_STATUSES
      .includes(data.paymentStatus)
  ) {
    throw new Error(
      `Invalid payment status: ${data.paymentStatus}`
    );
  }

  if (
    !KGMIS_PAYMENT_OPTIONS.YES_NO
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
      'Event code is required for an event payment.'
    );
  }

  if (
    data.eventCode &&
    !data.eventProject
  ) {
    throw new Error(
      'Event/project name is required when an event code is entered.'
    );
  }

  return data;
}


/**
 * Reads payment-voucher settings from KGMIS_FINANCIAL_YEAR.
 */
function KGMIS_GetPaymentVoucherConfig_(
  financialYearContext,
  sheetRow
) {
  const prefixColumn =
    financialYearContext.headers
      .indexOf(
        'PAYMENT_VOUCHER_PREFIX'
      );

  const sequenceColumn =
    financialYearContext.headers
      .indexOf(
        'LAST_PAYMENT_VOUCHER_NO'
      );

  const missing = [];

  if (prefixColumn === -1) {
    missing.push(
      'PAYMENT_VOUCHER_PREFIX'
    );
  }

  if (sequenceColumn === -1) {
    missing.push(
      'LAST_PAYMENT_VOUCHER_NO'
    );
  }

  if (missing.length) {
    throw new Error(
      'The following financial-year headers are required for payment vouchers:\n\n' +
      missing.join('\n')
    );
  }

  const row =
    financialYearContext.values[
      sheetRow - 1
    ];

  const voucherPrefix =
    KGMIS_PaymentCleanValue_(
      row[prefixColumn]
    );

  const lastVoucherNo =
    KGMIS_PaymentToNonNegativeInteger_(
      row[sequenceColumn]
    );

  if (!voucherPrefix) {
    throw new Error(
      'Payment-voucher prefix is not configured for the financial year.'
    );
  }

  return {
    prefixColumn,
    sequenceColumn,
    voucherPrefix,
    lastVoucherNo
  };
}


/**
 * Updates LAST_PAYMENT_VOUCHER_NO.
 */
function KGMIS_UpdatePaymentVoucherSequence_(
  financialYearContext,
  sheetRow,
  nextVoucherSequence,
  authorisedUser
) {
  const voucherConfig =
    KGMIS_GetPaymentVoucherConfig_(
      financialYearContext,
      sheetRow
    );

  financialYearContext.sheet
    .getRange(
      sheetRow,
      voucherConfig.sequenceColumn + 1
    )
    .setValue(nextVoucherSequence);

  financialYearContext.sheet
    .getRange(
      sheetRow,
      financialYearContext.column.UPDATED_ON + 1
    )
    .setValue(new Date());

  financialYearContext.sheet
    .getRange(
      sheetRow,
      financialYearContext.column.UPDATED_BY + 1
    )
    .setValue(authorisedUser.email);
}

/**
 * Generates PAY000001, PAY000002, etc.
 */
function KGMIS_GetNextPaymentId_(context) {
  let highestNumber = 0;

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const paymentId =
      KGMIS_PaymentUpperValue_(
        context.values[rowIndex][
          context.column.PAYMENT_ID
        ]
      );

    const match =
      paymentId.match(/^PAY(\d+)$/);

    if (match) {
      highestNumber =
        Math.max(
          highestNumber,
          Number(match[1])
        );
    }
  }

  return (
    'PAY' +
    String(highestNumber + 1)
      .padStart(6, '0')
  );
}


/**
 * Formats an official payment-voucher number.
 */
function KGMIS_FormatPaymentVoucherNumber_(
  prefix,
  sequence
) {
  const safePrefix =
    KGMIS_PaymentCleanValue_(prefix);

  if (!safePrefix) {
    throw new Error(
      'Payment-voucher prefix is required.'
    );
  }

  return (
    safePrefix +
    String(sequence)
      .padStart(6, '0')
  );
}


/**
 * Prevents duplicate active transaction references.
 */
function KGMIS_ValidateUniquePaymentReference_(
  context,
  transactionReference
) {
  const target =
    KGMIS_PaymentUpperValue_(
      transactionReference
    );

  const duplicate =
    context.values
      .slice(1)
      .some(row => {
        const existingReference =
          KGMIS_PaymentUpperValue_(
            row[
              context.column.TRANSACTION_REFERENCE
            ]
          );

        const recordStatus =
          KGMIS_PaymentUpperValue_(
            row[
              context.column.RECORD_STATUS
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
 * Confirms that a payment date is within the selected year.
 */
function KGMIS_ValidatePaymentDateWithinYear_(
  paymentDate,
  yearRecord
) {
  if (
    !yearRecord.startDate ||
    !yearRecord.endDate
  ) {
    throw new Error(
      `Start and end dates are not configured for financial year ${yearRecord.financialYear}.`
    );
  }

  const dateOnly =
    KGMIS_PaymentDateOnly_(paymentDate);

  const startDate =
    KGMIS_PaymentDateOnly_(
      yearRecord.startDate
    );

  const endDate =
    KGMIS_PaymentDateOnly_(
      yearRecord.endDate
    );

  if (
    dateOnly < startDate ||
    dateOnly > endDate
  ) {
    throw new Error(
      `Payment date must fall between ` +
      `${KGMIS_FormatPaymentDateForOutput_(startDate)} and ` +
      `${KGMIS_FormatPaymentDateForOutput_(endDate)}.`
    );
  }
}


/**
 * Formats date, timestamp, and amount columns.
 */
function KGMIS_FormatPaymentRow_(
  sheet,
  column,
  sheetRow
) {
  [
    column.PAYMENT_DATE,
    column.INVOICE_DATE,
    column.VOUCHER_DATE,
    column.APPROVAL_DATE
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
    column.VOUCHER_GENERATED_ON,
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
    .setNumberFormat('#,##0.00');
}


/**
 * Parses a Date or supported date string.
 */
function KGMIS_PaymentParseDate_(value) {
  if (
    Object.prototype.toString.call(
      value
    ) === '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return value;
  }

  const text =
    KGMIS_PaymentCleanValue_(value);

  if (!text) {
    throw new Error(
      'Payment date is required.'
    );
  }

  const isoMatch =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (isoMatch) {
    return KGMIS_PaymentCreateValidDate_(
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
    return KGMIS_PaymentCreateValidDate_(
      Number(dayFirstMatch[3]),
      Number(dayFirstMatch[2]) - 1,
      Number(dayFirstMatch[1])
    );
  }

  throw new Error(
    `Invalid date value: ${text}`
  );
}


function KGMIS_PaymentCreateValidDate_(
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
      'Invalid date value.'
    );
  }

  return date;
}


function KGMIS_PaymentDateOnly_(value) {
  const date =
    KGMIS_PaymentParseDate_(value);

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}


function KGMIS_FormatPaymentDateForOutput_(date) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}


function KGMIS_PaymentToNonNegativeInteger_(value) {
  if (
    value === '' ||
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 0
  ) {
    throw new Error(
      `Invalid payment-voucher sequence value: ${value}`
    );
  }

  return number;
}


function KGMIS_PaymentCleanValue_(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}


function KGMIS_PaymentUpperValue_(value) {
  return KGMIS_PaymentCleanValue_(
    value
  ).toUpperCase();
}


/**
 * Safe setup test. Does not create a payment transaction.
 */
function KGMIS_TestPaymentServiceSetup() {
  const paymentContext =
    KGMIS_GetPaymentContext_();

  const yearRecord =
    KGMIS_GetCurrentFinancialYear();

  const financialYearContext =
    KGMIS_GetFinancialYearContext_();

  const voucherConfig =
    KGMIS_GetPaymentVoucherConfig_(
      financialYearContext,
      yearRecord.sheetRow
    );

  const result = {
    paymentSheet:
      paymentContext.sheetName,
    paymentHeadersValid:
      true,
    currentFinancialYear:
      yearRecord.financialYear,
    financialYearStatus:
      yearRecord.status,
    paymentVoucherPrefix:
      voucherConfig.voucherPrefix,
    lastPaymentVoucherNo:
      voucherConfig.lastVoucherNo
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
 * Manual Test - Payment Engine
 * ============================================================
 *
 * Creates one payment transaction.
 *
 * Run only once.
 */
function KGMIS_TestCreatePaymentTransaction() {

  const result =
    KGMIS_CreatePaymentTransaction({

      financialYear: "2026-27",

      paymentDate: "2026-07-12",

      paymentPurpose: "HALL BOOKING",

      paymentCategory: "EVENT",

      eventCode: "ONAM-2026",

      eventProject: "KEF Global Onam 2026",

      payeeName: "SYSTEM TEST - ABC Convention Centre",

      payeeType: "HALL OWNER",

      vendorId: "",

      familyId: "",

      kefgId: "",

      amount: 25000,

      paymentMode: "BANK TRANSFER",

      transactionReference:
        "TEST-HALL-" + new Date().getTime(),

      invoiceNumber:
        "TEST-INV-001",

      invoiceDate:
        "2026-07-12",

      approvedBy:
        "James Joseph Alenchery",

      approvalDate:
        "2026-07-12",

      budgetHead:
        "ONAM 2026",

      restrictedFund:
        "NO",

      paymentStatus:
        "PAID",

      description:
        "SYSTEM TEST: Initial Payment Engine validation.",

      supportingDocumentId: ""

    });

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
