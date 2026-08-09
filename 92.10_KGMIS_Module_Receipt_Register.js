/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Module        : Receipt Register
 * File Name     : 92.10_KGMIS_Module_Receipt_Register.gs
 * Version       : 1.0
 * Designed & Developed by: James Joseph Alenchery
 * ============================================================
 *
 * PURPOSE
 * -------
 * Read-only Treasurer backend for the Receipt Register.
 *
 * This module:
 * - Reads KGMIS_RECEIPT_TRANSACTIONS
 * - Provides Financial Year choices
 * - Applies register filters
 * - Supports search by receipt / transaction / payer / family /
 *   KEFG ID / mobile / transaction reference
 * - Calculates read-only summary figures
 * - Calls the existing Receipt PDF Service when View Receipt is used
 *
 * IMPORTANT
 * ---------
 * This module does NOT:
 * - create receipt transactions
 * - edit receipt transactions
 * - cancel receipt transactions
 * - delete receipt transactions
 * - generate receipt numbers
 * - directly update KGMIS_RECEIPT_TRANSACTIONS
 *
 * Existing working modules remain unchanged.
 * ============================================================
 */


/**
 * ============================================================
 * 1. RECEIPT REGISTER SETUP
 * ============================================================
 *
 * @param {string} sessionToken
 * @return {Object}
 */
function KGMIS_ReceiptRegister_GetSetup(
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


  const financialYears =
    KGMIS_ReceiptRegister_GetFinancialYears_();


  /*
   * Ensure the current FY is available even if the Financial
   * Year sheet contains an unexpected blank row.
   */
  if (
    financialYears.indexOf(
      current.financialYear
    ) === -1
  ) {

    financialYears.push(
      current.financialYear
    );

    financialYears.sort(
      KGMIS_ReceiptRegister_CompareFinancialYearsDesc_
    );

  }


  return {

    success:
      true,


    currentFinancialYear:
      current.financialYear,


    financialYears:
      financialYears,


    paymentModes:
      [
        'CASH',
        'UPI',
        'BANK TRANSFER',
        'CHEQUE',
        'CARD',
        'ONLINE PAYMENT',
        'OTHER'
      ],


    paymentStatuses:
      [
        'SUCCESSFUL',
        'PENDING',
        'FAILED',
        'REFUNDED',
        'CANCELLED'
      ],


    message:
      'Receipt Register is ready.'

  };

}


/**
 * ============================================================
 * 2. GET RECEIPT REGISTER
 * ============================================================
 *
 * @param {string} sessionToken
 * @param {Object} filters
 * @return {Object}
 */
function KGMIS_ReceiptRegister_GetRegister(
  sessionToken,
  filters
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );


  const safeFilters =
    KGMIS_ReceiptRegister_NormaliseFilters_(
      filters
    );


  const context =
    KGMIS_GetReceiptContext_();


  const memberSearchMap =
    KGMIS_ReceiptRegister_BuildMemberSearchMap_();


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
      KGMIS_ReceiptRegister_CreateRecord_(
        sourceRow,
        context.column,
        memberSearchMap
      );


    if (
      !record.transactionId &&
      !record.receiptNumber
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
      safeFilters.paymentMode &&
      record.paymentMode !==
        safeFilters.paymentMode
    ) {

      continue;

    }


    if (
      safeFilters.paymentStatus &&
      record.paymentStatus !==
        safeFilters.paymentStatus
    ) {

      continue;

    }


    if (
      safeFilters.fromDate &&
      (
        !record.receiptDateIso ||
        record.receiptDateIso <
          safeFilters.fromDate
      )
    ) {

      continue;

    }


    if (
      safeFilters.toDate &&
      (
        !record.receiptDateIso ||
        record.receiptDateIso >
          safeFilters.toDate
      )
    ) {

      continue;

    }


    if (
      safeFilters.searchText &&
      !KGMIS_ReceiptRegister_RecordMatchesSearch_(
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
   * Newest receipts first.
   * Transaction ID is the secondary sort to keep ordering stable.
   */
  rows.sort(
    function (
      first,
      second
    ) {

      const firstDate =
        first.receiptDateIso || '';

      const secondDate =
        second.receiptDateIso || '';


      if (
        firstDate !==
        secondDate
      ) {

        return secondDate.localeCompare(
          firstDate
        );

      }


      return String(
        second.transactionId || ''
      ).localeCompare(
        String(
          first.transactionId || ''
        )
      );

    }
  );


  let issuedCount = 0;

  let successfulAmount = 0;


  rows.forEach(
    function (record) {

      if (
        record.receiptNumber
      ) {

        issuedCount++;

      }


      /*
       * Accounting summary:
       * only successful, active receipts count as money received.
       */
      if (
        record.paymentStatus ===
          'SUCCESSFUL' &&
        record.recordStatus ===
          'ACTIVE'
      ) {

        successfulAmount +=
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

      receiptsIssued:
        issuedCount,


      totalAmountReceived:
        KGMIS_ReceiptRegister_RoundMoney_(
          successfulAmount
        )

    },


    recordCount:
      rows.length

  };

}


/**
 * ============================================================
 * 3. VIEW / REOPEN RECEIPT
 * ============================================================
 *
 * The existing Receipt PDF Service:
 * - returns an existing PDF when available
 * - regenerates one when the stored PDF no longer exists
 *
 * No receipt PDF logic is duplicated here.
 *
 * @param {string} sessionToken
 * @param {string} transactionIdOrReceiptNumber
 * @return {Object}
 */
function KGMIS_ReceiptRegister_ViewReceipt(
  sessionToken,
  transactionIdOrReceiptNumber
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );


  const lookupValue =
    KGMIS_ReceiptRegister_Clean_(
      transactionIdOrReceiptNumber
    );


  if (!lookupValue) {

    throw new Error(
      'Transaction ID or Receipt Number is required.'
    );

  }


  /*
   * Confirm the transaction exists before handing it to
   * the PDF service.
   */
  const context =
    KGMIS_GetReceiptContext_();


  const transaction =
    KGMIS_FindReceiptTransaction_(
      context,
      lookupValue
    );


  if (
    transaction.paymentStatus !==
      'SUCCESSFUL'
  ) {

    throw new Error(
      'A receipt PDF can be viewed or generated only for a SUCCESSFUL transaction.'
    );

  }


  if (
    transaction.recordStatus !==
      'ACTIVE'
  ) {

    throw new Error(
      'A receipt PDF cannot be viewed or generated for a cancelled or inactive transaction.'
    );

  }


  const result =
    KGMIS_GenerateReceiptPdf(
      lookupValue
    );


  if (
    !result ||
    result.success !== true
  ) {

    throw new Error(
      result &&
      result.message
        ? result.message
        : 'The receipt could not be opened.'
    );

  }


  return {

    success:
      true,


    transactionId:
      result.transactionId ||
      transaction.transactionId ||
      '',


    receiptNumber:
      result.receiptNumber ||
      transaction.receiptNumber ||
      '',


    fileId:
      result.fileId || '',


    fileName:
      result.fileName || '',


    fileUrl:
      result.fileUrl || '',


    alreadyGenerated:
      result.alreadyGenerated === true,


    message:
      result.alreadyGenerated === true
        ? 'The existing receipt PDF is ready.'
        : 'The receipt PDF was generated successfully.'

  };

}


/**
 * ============================================================
 * 4. NORMALISE FILTERS
 * ============================================================
 *
 * @param {Object} filters
 * @return {Object}
 */
function KGMIS_ReceiptRegister_NormaliseFilters_(
  filters
) {

  const input =
    filters &&
    typeof filters === 'object'
      ? filters
      : {};


  const fromDate =
    KGMIS_ReceiptRegister_Clean_(
      input.fromDate
    );


  const toDate =
    KGMIS_ReceiptRegister_Clean_(
      input.toDate
    );


  if (
    fromDate &&
    !KGMIS_ReceiptRegister_IsIsoDate_(
      fromDate
    )
  ) {

    throw new Error(
      'Invalid From Date.'
    );

  }


  if (
    toDate &&
    !KGMIS_ReceiptRegister_IsIsoDate_(
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
    fromDate > toDate
  ) {

    throw new Error(
      'From Date cannot be later than To Date.'
    );

  }


  const paymentMode =
    KGMIS_ReceiptRegister_Clean_(
      input.paymentMode
    ).toUpperCase();


  const allowedPaymentModes =
    [
      '',
      'CASH',
      'UPI',
      'BANK TRANSFER',
      'CHEQUE',
      'CARD',
      'ONLINE PAYMENT',
      'OTHER'
    ];


  if (
    allowedPaymentModes.indexOf(
      paymentMode
    ) === -1
  ) {

    throw new Error(
      'Invalid Payment Mode filter.'
    );

  }


  const paymentStatus =
    KGMIS_ReceiptRegister_Clean_(
      input.paymentStatus
    ).toUpperCase();


  const allowedStatuses =
    [
      '',
      'SUCCESSFUL',
      'PENDING',
      'FAILED',
      'REFUNDED',
      'CANCELLED'
    ];


  if (
    allowedStatuses.indexOf(
      paymentStatus
    ) === -1
  ) {

    throw new Error(
      'Invalid receipt Status filter.'
    );

  }


  return {

    financialYear:
      KGMIS_ReceiptRegister_Clean_(
        input.financialYear
      ),


    searchText:
      KGMIS_ReceiptRegister_NormaliseSearch_(
        input.searchText
      ),


    fromDate:
      fromDate,


    toDate:
      toDate,


    paymentMode:
      paymentMode,


    paymentStatus:
      paymentStatus

  };

}


/**
 * ============================================================
 * 5. CREATE ONE REGISTER RECORD
 * ============================================================
 *
 * @param {Array} row
 * @param {Object} column
 * @param {Object} memberSearchMap
 * @return {Object}
 */
function KGMIS_ReceiptRegister_CreateRecord_(
  row,
  column,
  memberSearchMap
) {

  const transactionId =
    KGMIS_ReceiptRegister_CellText_(
      row,
      column,
      'TRANSACTION_ID'
    ).toUpperCase();


  const receiptNumber =
    KGMIS_ReceiptRegister_CellText_(
      row,
      column,
      'RECEIPT_NUMBER'
    );


  const familyId =
    KGMIS_ReceiptRegister_CellText_(
      row,
      column,
      'FAMILY_ID'
    ).toUpperCase();


  const kefgId =
    KGMIS_ReceiptRegister_CellText_(
      row,
      column,
      'KEFG_ID'
    ).toUpperCase();


  const transactionDate =
    KGMIS_ReceiptRegister_CellValue_(
      row,
      column,
      'TRANSACTION_DATE'
    );


  const receiptDate =
    KGMIS_ReceiptRegister_CellValue_(
      row,
      column,
      'RECEIPT_DATE'
    );


  const effectiveDate =
    receiptDate ||
    transactionDate;


  const memberInfo =
    KGMIS_ReceiptRegister_FindMemberSearchInfo_(
      memberSearchMap,
      familyId,
      kefgId
    );


  return {

    transactionId:
      transactionId,


    transactionDateIso:
      KGMIS_ReceiptRegister_DateIso_(
        transactionDate
      ),


    transactionDateDisplay:
      KGMIS_ReceiptRegister_DateDisplay_(
        transactionDate
      ),


    financialYear:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'FINANCIAL_YEAR'
      ),


    familyId:
      familyId,


    kefgId:
      kefgId,


    paymentPurpose:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'PAYMENT_PURPOSE'
      ).toUpperCase(),


    paymentCategory:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'PAYMENT_CATEGORY'
      ).toUpperCase(),


    amount:
      Number(
        KGMIS_ReceiptRegister_CellValue_(
          row,
          column,
          'AMOUNT'
        ) || 0
      ),


    paymentMode:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'PAYMENT_MODE'
      ).toUpperCase(),


    transactionReference:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'TRANSACTION_REFERENCE'
      ),


    receiptNumber:
      receiptNumber,


    receiptDateIso:
      KGMIS_ReceiptRegister_DateIso_(
        effectiveDate
      ),


    receiptDateDisplay:
      KGMIS_ReceiptRegister_DateDisplay_(
        effectiveDate
      ),


    receiptFileId:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'RECEIPT_FILE_ID'
      ),


    receiptFileUrl:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'RECEIPT_FILE_URL'
      ),


    receiptFileName:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'RECEIPT_FILE_NAME'
      ),


    payerName:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'PAYER_NAME'
      ),


    payerRelation:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'PAYER_RELATION'
      ).toUpperCase(),


    paymentStatus:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'PAYMENT_STATUS'
      ).toUpperCase(),


    description:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'DESCRIPTION'
      ),


    eventCode:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'EVENT_CODE'
      ),


    eventProject:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'EVENT_PROJECT'
      ),


    recordStatus:
      KGMIS_ReceiptRegister_CellText_(
        row,
        column,
        'RECORD_STATUS'
      ).toUpperCase(),


    memberMobile:
      memberInfo.mobile,


    memberName:
      memberInfo.memberName

  };

}


/**
 * ============================================================
 * 6. SEARCH MATCH
 * ============================================================
 *
 * @param {Object} record
 * @param {string} normalisedQuery
 * @return {boolean}
 */
function KGMIS_ReceiptRegister_RecordMatchesSearch_(
  record,
  normalisedQuery
) {

  const values =
    [
      record.receiptNumber,
      record.transactionId,
      record.familyId,
      record.kefgId,
      record.payerName,
      record.payerRelation,
      record.memberName,
      record.memberMobile,
      record.paymentPurpose,
      record.paymentCategory,
      record.paymentMode,
      record.transactionReference,
      record.description,
      record.eventCode,
      record.eventProject
    ];


  return values.some(
    function (value) {

      return KGMIS_ReceiptRegister_NormaliseSearch_(
        value
      ).includes(
        normalisedQuery
      );

    }
  );

}


/**
 * ============================================================
 * 7. FINANCIAL YEAR LIST
 * ============================================================
 *
 * Reads only the FINANCIAL_YEAR column.
 *
 * @return {Array<string>}
 */
function KGMIS_ReceiptRegister_GetFinancialYears_() {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();


  const sheet =
    spreadsheet.getSheetByName(
      KGMIS_CONFIG.FINANCIAL_YEAR_SHEET
    );


  if (!sheet) {

    throw new Error(
      'Financial Year sheet "' +
      KGMIS_CONFIG.FINANCIAL_YEAR_SHEET +
      '" was not found.'
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

          return KGMIS_ReceiptRegister_Clean_(
            header
          ).toUpperCase();

        }
      );


  const financialYearColumn =
    headers.indexOf(
      'FINANCIAL_YEAR'
    );


  if (
    financialYearColumn === -1
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
        KGMIS_ReceiptRegister_Clean_(
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
      KGMIS_ReceiptRegister_CompareFinancialYearsDesc_
    );

}


/**
 * ============================================================
 * 8. MEMBER SEARCH MAP
 * ============================================================
 *
 * Receipt transactions do not store mobile numbers.
 *
 * To support the approved Receipt Register search by mobile,
 * this helper reads only:
 *
 * KEFG_ID
 * FAMILY_ID
 * MEMBER_NAME
 * MEMBER_MOBILE
 * RECORD_STATUS
 *
 * from the Master Database.
 *
 * It does not alter any Master Database record.
 *
 * @return {Object}
 */
function KGMIS_ReceiptRegister_BuildMemberSearchMap_() {

  const output = {

    byKefgId:
      new Map(),


    byFamilyId:
      new Map()

  };


  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();


  const sheet =
    spreadsheet.getSheetByName(
      KGMIS_CONFIG.MASTER_SHEET
    );


  if (!sheet) {

    return output;

  }


  const lastRow =
    sheet.getLastRow();


  const lastColumn =
    sheet.getLastColumn();


  if (
    lastRow < 2 ||
    lastColumn < 1
  ) {

    return output;

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

          return KGMIS_ReceiptRegister_Clean_(
            header
          ).toUpperCase();

        }
      );


  const index = {

    KEFG_ID:
      headers.indexOf(
        'KEFG_ID'
      ),


    FAMILY_ID:
      headers.indexOf(
        'FAMILY_ID'
      ),


    MEMBER_NAME:
      headers.indexOf(
        'MEMBER_NAME'
      ),


    MEMBER_MOBILE:
      headers.indexOf(
        'MEMBER_MOBILE'
      ),


    RECORD_STATUS:
      headers.indexOf(
        'RECORD_STATUS'
      )

  };


  if (
    index.KEFG_ID === -1 ||
    index.FAMILY_ID === -1 ||
    index.MEMBER_NAME === -1 ||
    index.MEMBER_MOBILE === -1
  ) {

    return output;

  }


  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        lastColumn
      )
      .getDisplayValues();


  values.forEach(
    function (row) {

      const recordStatus =
        index.RECORD_STATUS === -1
          ? 'ACTIVE'
          : KGMIS_ReceiptRegister_Clean_(
              row[
                index.RECORD_STATUS
              ]
            ).toUpperCase();


      if (
        recordStatus &&
        recordStatus !== 'ACTIVE'
      ) {

        return;

      }


      const kefgId =
        KGMIS_ReceiptRegister_Clean_(
          row[
            index.KEFG_ID
          ]
        ).toUpperCase();


      const familyId =
        KGMIS_ReceiptRegister_Clean_(
          row[
            index.FAMILY_ID
          ]
        ).toUpperCase();


      const memberName =
        KGMIS_ReceiptRegister_Clean_(
          row[
            index.MEMBER_NAME
          ]
        );


      const mobile =
        KGMIS_ReceiptRegister_Clean_(
          row[
            index.MEMBER_MOBILE
          ]
        );


      const info = {

        kefgId:
          kefgId,


        familyId:
          familyId,


        memberName:
          memberName,


        mobile:
          mobile

      };


      if (kefgId) {

        output.byKefgId.set(
          kefgId,
          info
        );

      }


      /*
       * Keep the first active family member as a family-level
       * search fallback. A KEFG_ID match always takes priority.
       */
      if (
        familyId &&
        !output.byFamilyId.has(
          familyId
        )
      ) {

        output.byFamilyId.set(
          familyId,
          info
        );

      }

    }
  );


  return output;

}


/**
 * ============================================================
 * 9. FIND MEMBER SEARCH INFO
 * ============================================================
 *
 * @param {Object} memberSearchMap
 * @param {string} familyId
 * @param {string} kefgId
 * @return {Object}
 */
function KGMIS_ReceiptRegister_FindMemberSearchInfo_(
  memberSearchMap,
  familyId,
  kefgId
) {

  if (
    kefgId &&
    memberSearchMap.byKefgId.has(
      kefgId
    )
  ) {

    return memberSearchMap
      .byKefgId
      .get(
        kefgId
      );

  }


  if (
    familyId &&
    memberSearchMap.byFamilyId.has(
      familyId
    )
  ) {

    return memberSearchMap
      .byFamilyId
      .get(
        familyId
      );

  }


  return {

    memberName:
      '',


    mobile:
      ''

  };

}


/**
 * ============================================================
 * 10. SAFE RECEIPT CELL ACCESS
 * ============================================================
 */
function KGMIS_ReceiptRegister_CellValue_(
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


function KGMIS_ReceiptRegister_CellText_(
  row,
  column,
  header
) {

  return KGMIS_ReceiptRegister_Clean_(
    KGMIS_ReceiptRegister_CellValue_(
      row,
      column,
      header
    )
  );

}


/**
 * ============================================================
 * 11. DATE HELPERS
 * ============================================================
 */
function KGMIS_ReceiptRegister_DateIso_(
  value
) {

  const date =
    KGMIS_ReceiptRegister_ToDate_(
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


function KGMIS_ReceiptRegister_DateDisplay_(
  value
) {

  const date =
    KGMIS_ReceiptRegister_ToDate_(
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


function KGMIS_ReceiptRegister_ToDate_(
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
    KGMIS_ReceiptRegister_Clean_(
      value
    );


  if (!text) {

    return null;

  }


  /*
   * yyyy-MM-dd
   */
  let match =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );


  if (match) {

    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );

  }


  /*
   * dd-MMM-yyyy
   */
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
        Number(match[3]),
        month,
        Number(match[1])
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
 * 12. GENERIC HELPERS
 * ============================================================
 */
function KGMIS_ReceiptRegister_Clean_(
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


function KGMIS_ReceiptRegister_NormaliseSearch_(
  value
) {

  return KGMIS_ReceiptRegister_Clean_(
    value
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ''
    );

}


function KGMIS_ReceiptRegister_IsIsoDate_(
  value
) {

  return /^\d{4}-\d{2}-\d{2}$/.test(
    KGMIS_ReceiptRegister_Clean_(
      value
    )
  );

}


function KGMIS_ReceiptRegister_RoundMoney_(
  value
) {

  return Math.round(
    (
      Number(value || 0) +
      Number.EPSILON
    ) *
    100
  ) / 100;

}


function KGMIS_ReceiptRegister_CompareFinancialYearsDesc_(
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

