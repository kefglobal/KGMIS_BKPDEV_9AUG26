/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Module        : Payment Register
 * File Name     : 93.10_KGMIS_Module_Payment_Register.gs
 * Version       : 1.0
 * Designed & Developed by: James Joseph Alenchery
 * ============================================================
 *
 * PURPOSE
 * -------
 * Read-only Treasurer backend for the Payment Register.
 *
 * This module:
 * - Reads KGMIS_PAYMENT_TRANSACTIONS
 * - Provides Financial Year choices
 * - Derives filter options from existing transaction data
 * - Applies search and filter conditions
 * - Calculates summary figures
 * - Calls the existing Payment Voucher PDF Service
 *
 * IMPORTANT
 * ---------
 * This module does NOT:
 * - create expense/payment transactions
 * - edit expense/payment transactions
 * - cancel or delete transactions
 * - generate PAYMENT_ID values
 * - generate voucher numbers
 * - directly update KGMIS_PAYMENT_TRANSACTIONS
 *
 * Existing working modules remain unchanged.
 * ============================================================
 */


/**
 * ============================================================
 * 1. PAYMENT REGISTER SETUP
 * ============================================================
 *
 * @param {string} sessionToken
 * @return {Object}
 */
function KGMIS_PaymentRegister_GetSetup(
  sessionToken
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );


  const current =
    KGMIS_GetCurrentFinancialYear();


  if (
    !current ||
    !current.financialYear
  ) {

    throw new Error(
      'The current financial year could not be determined.'
    );

  }


  const context =
    KGMIS_PaymentRegister_GetContext_();


  const options =
    KGMIS_PaymentRegister_GetStoredOptions_(
      context
    );


  const financialYears =
    KGMIS_PaymentRegister_GetFinancialYears_();


  if (
    financialYears.indexOf(
      current.financialYear
    ) === -1
  ) {

    financialYears.push(
      current.financialYear
    );

    financialYears.sort(
      KGMIS_PaymentRegister_CompareFinancialYearsDesc_
    );

  }


  return {

    success:
      true,


    currentFinancialYear:
      current.financialYear,


    financialYears:
      financialYears,


    categories:
      options.categories,


    expenseModes:
      options.expenseModes,


    statuses:
      options.statuses,


    message:
      'Payment Register is ready.'

  };

}


/**
 * ============================================================
 * 2. GET PAYMENT REGISTER
 * ============================================================
 *
 * @param {string} sessionToken
 * @param {Object} filters
 * @return {Object}
 */
function KGMIS_PaymentRegister_GetRegister(
  sessionToken,
  filters
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );


  const safeFilters =
    KGMIS_PaymentRegister_NormaliseFilters_(
      filters
    );


  const context =
    KGMIS_PaymentRegister_GetContext_();


  const rows = [];


  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {

    const sourceRow =
      context.values[
        rowIndex
      ];


    const record =
      KGMIS_PaymentRegister_CreateRecord_(
        sourceRow,
        context.column
      );


    if (
      !record.expenseId &&
      !record.voucherNumber
    ) {

      continue;

    }


    if (
      safeFilters.financialYear &&
      record.financialYear !==
        safeFilters.financialYear
    ) {

      continue;

    }


    if (
      safeFilters.expenseCategory &&
      record.expenseCategory !==
        safeFilters.expenseCategory
    ) {

      continue;

    }


    if (
      safeFilters.expenseMode &&
      record.expenseMode !==
        safeFilters.expenseMode
    ) {

      continue;

    }


    if (
      safeFilters.expenseStatus &&
      record.expenseStatus !==
        safeFilters.expenseStatus
    ) {

      continue;

    }


    if (
      safeFilters.fromDate &&
      (
        !record.expenseDateIso ||
        record.expenseDateIso <
          safeFilters.fromDate
      )
    ) {

      continue;

    }


    if (
      safeFilters.toDate &&
      (
        !record.expenseDateIso ||
        record.expenseDateIso >
          safeFilters.toDate
      )
    ) {

      continue;

    }


    if (
      safeFilters.searchText &&
      !KGMIS_PaymentRegister_RecordMatchesSearch_(
        record,
        safeFilters.searchText
      )
    ) {

      continue;

    }


    rows.push(
      record
    );

  }


  /*
   * Newest expense first.
   * PAYMENT_ID is the secondary sort for stable ordering.
   */
  rows.sort(
    function (
      first,
      second
    ) {

      const firstDate =
        first.expenseDateIso || '';

      const secondDate =
        second.expenseDateIso || '';


      if (
        firstDate !==
        secondDate
      ) {

        return secondDate.localeCompare(
          firstDate
        );

      }


      return String(
        second.expenseId || ''
      ).localeCompare(
        String(
          first.expenseId || ''
        )
      );

    }
  );


  let expenseCount =
    0;

  let totalExpenses =
    0;


  rows.forEach(
    function (record) {

      expenseCount++;


      /*
       * Accounting summary:
       * Only PAID + ACTIVE records count as actual expenses.
       *
       * Pending, cancelled, rejected, failed or refunded records
       * may be displayed when filtered, but are not included in
       * Total Expenses.
       */
      if (
        record.expenseStatus ===
          'PAID' &&
        record.recordStatus ===
          'ACTIVE'
      ) {

        totalExpenses +=
          Number(
            record.amount || 0
          );

      }

    }
  );


  return {

    success:
      true,


    financialYear:
      safeFilters.financialYear,


    rows:
      rows,


    summary: {

      expensesRecorded:
        expenseCount,


      totalExpenses:
        KGMIS_PaymentRegister_RoundMoney_(
          totalExpenses
        )

    },


    recordCount:
      rows.length

  };

}


/**
 * ============================================================
 * 3. VIEW / REOPEN PAYMENT VOUCHER
 * ============================================================
 *
 * Accepts either:
 * - PAYMENT_ID
 * - VOUCHER_NUMBER
 *
 * If Voucher Number is supplied, this wrapper resolves it to the
 * corresponding PAYMENT_ID before calling the existing voucher
 * PDF service.
 *
 * @param {string} sessionToken
 * @param {string} expenseIdOrVoucherNumber
 * @return {Object}
 */
function KGMIS_PaymentRegister_ViewVoucher(
  sessionToken,
  expenseIdOrVoucherNumber
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );


  const lookupValue =
    KGMIS_PaymentRegister_Clean_(
      expenseIdOrVoucherNumber
    );


  if (!lookupValue) {

    throw new Error(
      'Expense Record ID or Voucher Number is required.'
    );

  }


  const context =
    KGMIS_PaymentRegister_GetContext_();


  const transaction =
    KGMIS_PaymentRegister_FindTransaction_(
      context,
      lookupValue
    );


  if (
    transaction.expenseStatus !==
      'PAID'
  ) {

    throw new Error(
      'A voucher can be viewed or generated only for a PAID expense.'
    );

  }


  if (
    transaction.recordStatus !==
      'ACTIVE'
  ) {

    throw new Error(
      'A voucher cannot be viewed or generated for an inactive or cancelled expense.'
    );

  }


  if (!transaction.expenseId) {

    throw new Error(
      'The selected expense does not contain a valid Expense Record ID.'
    );

  }


  /*
   * Reuse the existing Payment Voucher PDF Service.
   * Do not duplicate voucher-generation logic here.
   */
  const result =
    KGMIS_GeneratePaymentVoucherPdf(
      transaction.expenseId
    );


  if (
    !result ||
    result.success !== true
  ) {

    throw new Error(
      result &&
      result.message
        ? result.message
        : 'The expense voucher could not be opened.'
    );

  }


  return {

    success:
      true,


    expenseId:
      result.paymentId ||
      transaction.expenseId ||
      '',


    voucherNumber:
      result.voucherNumber ||
      transaction.voucherNumber ||
      '',


    fileId:
      result.fileId ||
      '',


    fileName:
      result.fileName ||
      '',


    fileUrl:
      result.fileUrl ||
      '',


    alreadyGenerated:
      result.alreadyGenerated === true,


    message:
      result.alreadyGenerated === true
        ? 'The existing expense voucher is ready.'
        : 'The expense voucher was generated successfully.'

  };

}


/**
 * ============================================================
 * 4. PAYMENT TRANSACTION CONTEXT
 * ============================================================
 *
 * @return {Object}
 */
function KGMIS_PaymentRegister_GetContext_() {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();


  const sheet =
    spreadsheet.getSheetByName(
      'KGMIS_PAYMENT_TRANSACTIONS'
    );


  if (!sheet) {

    throw new Error(
      'Sheet "KGMIS_PAYMENT_TRANSACTIONS" was not found.'
    );

  }


  const lastRow =
    sheet.getLastRow();


  const lastColumn =
    sheet.getLastColumn();


  if (
    lastColumn < 1
  ) {

    throw new Error(
      'KGMIS_PAYMENT_TRANSACTIONS has no headers.'
    );

  }


  const values =
    lastRow >= 1
      ? sheet
          .getRange(
            1,
            1,
            lastRow,
            lastColumn
          )
          .getValues()
      : [];


  if (!values.length) {

    throw new Error(
      'KGMIS_PAYMENT_TRANSACTIONS has no data.'
    );

  }


  const headers =
    values[0].map(
      function (header) {

        return KGMIS_PaymentRegister_Clean_(
          header
        ).toUpperCase();

      }
    );


  const column =
    {};


  headers.forEach(
    function (
      header,
      index
    ) {

      if (header) {

        column[
          header
        ] =
          index;

      }

    }
  );


  const requiredHeaders =
    [
      'PAYMENT_ID',
      'PAYMENT_DATE',
      'FINANCIAL_YEAR',
      'PAYMENT_PURPOSE',
      'PAYMENT_CATEGORY',
      'PAYEE_NAME',
      'AMOUNT',
      'PAYMENT_MODE',
      'TRANSACTION_REFERENCE',
      'VOUCHER_NUMBER',
      'PAYMENT_STATUS',
      'RECORD_STATUS'
    ];


  requiredHeaders.forEach(
    function (header) {

      if (
        !Object.prototype
          .hasOwnProperty.call(
            column,
            header
          )
      ) {

        throw new Error(
          'Missing KGMIS_PAYMENT_TRANSACTIONS header: ' +
          header
        );

      }

    }
  );


  return {

    sheet:
      sheet,


    values:
      values,


    column:
      column

  };

}


/**
 * ============================================================
 * 5. CREATE ONE REGISTER RECORD
 * ============================================================
 *
 * @param {Array} row
 * @param {Object} column
 * @return {Object}
 */
function KGMIS_PaymentRegister_CreateRecord_(
  row,
  column
) {

  const paymentDate =
    KGMIS_PaymentRegister_CellValue_(
      row,
      column,
      'PAYMENT_DATE'
    );


  return {

    expenseId:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'PAYMENT_ID'
      ).toUpperCase(),


    expenseDateIso:
      KGMIS_PaymentRegister_DateIso_(
        paymentDate
      ),


    expenseDateDisplay:
      KGMIS_PaymentRegister_DateDisplay_(
        paymentDate
      ),


    financialYear:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'FINANCIAL_YEAR'
      ),


    expensePurpose:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'PAYMENT_PURPOSE'
      ).toUpperCase(),


    expenseCategory:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'PAYMENT_CATEGORY'
      ).toUpperCase(),


    eventCode:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'EVENT_CODE'
      ),


    eventProject:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'EVENT_PROJECT'
      ),


    payeeName:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'PAYEE_NAME'
      ),


    payeeType:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'PAYEE_TYPE'
      ).toUpperCase(),


    vendorId:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'VENDOR_ID'
      ),


    familyId:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'FAMILY_ID'
      ).toUpperCase(),


    kefgId:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'KEFG_ID'
      ).toUpperCase(),


    amount:
      Number(
        KGMIS_PaymentRegister_CellValue_(
          row,
          column,
          'AMOUNT'
        ) || 0
      ),


    expenseMode:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'PAYMENT_MODE'
      ).toUpperCase(),


    transactionReference:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'TRANSACTION_REFERENCE'
      ),


    invoiceNumber:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'INVOICE_NUMBER'
      ),


    invoiceDateDisplay:
      KGMIS_PaymentRegister_DateDisplay_(
        KGMIS_PaymentRegister_CellValue_(
          row,
          column,
          'INVOICE_DATE'
        )
      ),


    voucherNumber:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'VOUCHER_NUMBER'
      ),


    voucherDateDisplay:
      KGMIS_PaymentRegister_DateDisplay_(
        KGMIS_PaymentRegister_CellValue_(
          row,
          column,
          'VOUCHER_DATE'
        )
      ),


    voucherFileId:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'VOUCHER_FILE_ID'
      ),


    voucherFileUrl:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'VOUCHER_FILE_URL'
      ),


    voucherFileName:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'VOUCHER_FILE_NAME'
      ),


    approvedBy:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'APPROVED_BY'
      ),


    budgetHead:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'BUDGET_HEAD'
      ),


    restrictedFund:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'RESTRICTED_FUND'
      ).toUpperCase(),


    expenseStatus:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'PAYMENT_STATUS'
      ).toUpperCase(),


    description:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'DESCRIPTION'
      ),


    recordStatus:
      KGMIS_PaymentRegister_CellText_(
        row,
        column,
        'RECORD_STATUS'
      ).toUpperCase()

  };

}


/**
 * ============================================================
 * 6. FIND ONE TRANSACTION
 * ============================================================
 *
 * Accepts PAYMENT_ID or VOUCHER_NUMBER.
 *
 * @param {Object} context
 * @param {string} lookupValue
 * @return {Object}
 */
function KGMIS_PaymentRegister_FindTransaction_(
  context,
  lookupValue
) {

  const lookup =
    KGMIS_PaymentRegister_Clean_(
      lookupValue
    ).toUpperCase();


  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {

    const record =
      KGMIS_PaymentRegister_CreateRecord_(
        context.values[
          rowIndex
        ],
        context.column
      );


    if (
      record.expenseId.toUpperCase() ===
        lookup ||
      record.voucherNumber.toUpperCase() ===
        lookup
    ) {

      return record;

    }

  }


  throw new Error(
    'The selected expense transaction could not be found.'
  );

}


/**
 * ============================================================
 * 7. SEARCH MATCH
 * ============================================================
 *
 * @param {Object} record
 * @param {string} normalisedQuery
 * @return {boolean}
 */
function KGMIS_PaymentRegister_RecordMatchesSearch_(
  record,
  normalisedQuery
) {

  const values =
    [
      record.expenseId,
      record.voucherNumber,
      record.payeeName,
      record.payeeType,
      record.vendorId,
      record.familyId,
      record.kefgId,
      record.expensePurpose,
      record.expenseCategory,
      record.eventCode,
      record.eventProject,
      record.transactionReference,
      record.invoiceNumber,
      record.budgetHead,
      record.description
    ];


  return values.some(
    function (value) {

      return KGMIS_PaymentRegister_NormaliseSearch_(
        value
      ).includes(
        normalisedQuery
      );

    }
  );

}


/**
 * ============================================================
 * 8. STORED FILTER OPTIONS
 * ============================================================
 *
 * Uses actual transaction values rather than inventing a second
 * source of truth for Category / Mode / Status.
 *
 * @param {Object} context
 * @return {Object}
 */
function KGMIS_PaymentRegister_GetStoredOptions_(
  context
) {

  const categories =
    new Set();


  const expenseModes =
    new Set();


  const statuses =
    new Set();


  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {

    const row =
      context.values[
        rowIndex
      ];


    const category =
      KGMIS_PaymentRegister_CellText_(
        row,
        context.column,
        'PAYMENT_CATEGORY'
      ).toUpperCase();


    const mode =
      KGMIS_PaymentRegister_CellText_(
        row,
        context.column,
        'PAYMENT_MODE'
      ).toUpperCase();


    const status =
      KGMIS_PaymentRegister_CellText_(
        row,
        context.column,
        'PAYMENT_STATUS'
      ).toUpperCase();


    if (category) {

      categories.add(
        category
      );

    }


    if (mode) {

      expenseModes.add(
        mode
      );

    }


    if (status) {

      statuses.add(
        status
      );

    }

  }


  /*
   * Ensure the standard current transaction values remain
   * available even before the first transaction of a type exists.
   */
  [
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
  ].forEach(
    function (value) {

      categories.add(
        value
      );

    }
  );


  [
    'CASH',
    'UPI',
    'BANK TRANSFER',
    'CHEQUE',
    'CARD',
    'ONLINE PAYMENT',
    'OTHER'
  ].forEach(
    function (value) {

      expenseModes.add(
        value
      );

    }
  );


  /*
   * PAID is the normal status for Record Expenses.
   * Preserve any other statuses already stored in the sheet.
   */
  statuses.add(
    'PAID'
  );


  return {

    categories:
      Array
        .from(
          categories
        )
        .sort(),


    expenseModes:
      Array
        .from(
          expenseModes
        )
        .sort(),


    statuses:
      Array
        .from(
          statuses
        )
        .sort()

  };

}


/**
 * ============================================================
 * 9. NORMALISE FILTERS
 * ============================================================
 *
 * @param {Object} filters
 * @return {Object}
 */
function KGMIS_PaymentRegister_NormaliseFilters_(
  filters
) {

  const input =
    filters &&
    typeof filters ===
      'object'
      ? filters
      : {};


  const fromDate =
    KGMIS_PaymentRegister_Clean_(
      input.fromDate
    );


  const toDate =
    KGMIS_PaymentRegister_Clean_(
      input.toDate
    );


  if (
    fromDate &&
    !KGMIS_PaymentRegister_IsIsoDate_(
      fromDate
    )
  ) {

    throw new Error(
      'Invalid From Date.'
    );

  }


  if (
    toDate &&
    !KGMIS_PaymentRegister_IsIsoDate_(
      toDate
    )
  ) {

    throw new Error(
      'Invalid To Date.'
    );

  }


  if (
    fromDate &&
    toDate &&
    fromDate >
      toDate
  ) {

    throw new Error(
      'From Date cannot be later than To Date.'
    );

  }


  return {

    financialYear:
      KGMIS_PaymentRegister_Clean_(
        input.financialYear
      ),


    searchText:
      KGMIS_PaymentRegister_NormaliseSearch_(
        input.searchText
      ),


    fromDate:
      fromDate,


    toDate:
      toDate,


    expenseCategory:
      KGMIS_PaymentRegister_Clean_(
        input.expenseCategory
      ).toUpperCase(),


    expenseMode:
      KGMIS_PaymentRegister_Clean_(
        input.expenseMode
      ).toUpperCase(),


    expenseStatus:
      KGMIS_PaymentRegister_Clean_(
        input.expenseStatus
      ).toUpperCase()

  };

}


/**
 * ============================================================
 * 10. FINANCIAL YEAR LIST
 * ============================================================
 *
 * @return {Array<string>}
 */
function KGMIS_PaymentRegister_GetFinancialYears_() {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();


  const sheet =
    spreadsheet.getSheetByName(
      'KGMIS_FINANCIAL_YEAR'
    );


  if (!sheet) {

    throw new Error(
      'Sheet "KGMIS_FINANCIAL_YEAR" was not found.'
    );

  }


  const lastColumn =
    sheet.getLastColumn();


  const lastRow =
    sheet.getLastRow();


  if (
    lastColumn < 1 ||
    lastRow < 1
  ) {

    return [];

  }


  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0]
      .map(
        function (header) {

          return KGMIS_PaymentRegister_Clean_(
            header
          ).toUpperCase();

        }
      );


  const financialYearColumn =
    headers.indexOf(
      'FINANCIAL_YEAR'
    );


  if (
    financialYearColumn ===
      -1
  ) {

    throw new Error(
      'FINANCIAL_YEAR header was not found in KGMIS_FINANCIAL_YEAR.'
    );

  }


  if (
    lastRow < 2
  ) {

    return [];

  }


  const values =
    sheet
      .getRange(
        2,
        financialYearColumn + 1,
        lastRow - 1,
        1
      )
      .getDisplayValues();


  const uniqueYears =
    new Set();


  values.forEach(
    function (row) {

      const year =
        KGMIS_PaymentRegister_Clean_(
          row[0]
        );


      if (year) {

        uniqueYears.add(
          year
        );

      }

    }
  );


  return Array
    .from(
      uniqueYears
    )
    .sort(
      KGMIS_PaymentRegister_CompareFinancialYearsDesc_
    );

}


/**
 * ============================================================
 * 11. SAFE CELL ACCESS
 * ============================================================
 */
function KGMIS_PaymentRegister_CellValue_(
  row,
  column,
  header
) {

  const index =
    column[
      header
    ];


  if (
    index === undefined ||
    index === null ||
    index < 0
  ) {

    return '';

  }


  return row[
    index
  ];

}


function KGMIS_PaymentRegister_CellText_(
  row,
  column,
  header
) {

  return KGMIS_PaymentRegister_Clean_(
    KGMIS_PaymentRegister_CellValue_(
      row,
      column,
      header
    )
  );

}


/**
 * ============================================================
 * 12. DATE HELPERS
 * ============================================================
 */
function KGMIS_PaymentRegister_DateIso_(
  value
) {

  const date =
    KGMIS_PaymentRegister_ToDate_(
      value
    );


  if (!date) {

    return '';

  }


  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone() ||
      'Asia/Kolkata',
    'yyyy-MM-dd'
  );

}


function KGMIS_PaymentRegister_DateDisplay_(
  value
) {

  const date =
    KGMIS_PaymentRegister_ToDate_(
      value
    );


  if (!date) {

    return '';

  }


  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone() ||
      'Asia/Kolkata',
    'dd-MMM-yyyy'
  );

}


function KGMIS_PaymentRegister_ToDate_(
  value
) {

  if (!value) {

    return null;

  }


  if (
    Object.prototype.toString.call(
      value
    ) === '[object Date]'
  ) {

    return isNaN(
      value.getTime()
    )
      ? null
      : value;

  }


  const text =
    KGMIS_PaymentRegister_Clean_(
      value
    );


  if (!text) {

    return null;

  }


  let match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );


  if (match) {

    return new Date(
      Number(
        match[1]
      ),
      Number(
        match[2]
      ) - 1,
      Number(
        match[3]
      )
    );

  }


  match =
    text.match(
      /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/
    );


  if (match) {

    const monthMap = {
      JAN: 0,
      FEB: 1,
      MAR: 2,
      APR: 3,
      MAY: 4,
      JUN: 5,
      JUL: 6,
      AUG: 7,
      SEP: 8,
      OCT: 9,
      NOV: 10,
      DEC: 11
    };


    const month =
      monthMap[
        match[2].toUpperCase()
      ];


    if (
      month !== undefined
    ) {

      return new Date(
        Number(
          match[3]
        ),
        month,
        Number(
          match[1]
        )
      );

    }

  }


  const parsed =
    new Date(
      text
    );


  return isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;

}


/**
 * ============================================================
 * 13. GENERIC HELPERS
 * ============================================================
 */
function KGMIS_PaymentRegister_Clean_(
  value
) {

  return String(
    value === null ||
    value === undefined
      ? ''
      : value
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    );

}


function KGMIS_PaymentRegister_NormaliseSearch_(
  value
) {

  return KGMIS_PaymentRegister_Clean_(
    value
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ''
    );

}


function KGMIS_PaymentRegister_IsIsoDate_(
  value
) {

  return /^\d{4}-\d{2}-\d{2}$/.test(
    KGMIS_PaymentRegister_Clean_(
      value
    )
  );

}


function KGMIS_PaymentRegister_RoundMoney_(
  value
) {

  return Math.round(
    (
      Number(
        value || 0
      ) +
      Number.EPSILON
    ) *
    100
  ) / 100;

}


function KGMIS_PaymentRegister_CompareFinancialYearsDesc_(
  first,
  second
) {

  const firstStart =
    Number(
      String(
        first || ''
      ).slice(
        0,
        4
      )
    ) || 0;


  const secondStart =
    Number(
      String(
        second || ''
      ).slice(
        0,
        4
      )
    ) || 0;


  return secondStart -
    firstStart;

}
