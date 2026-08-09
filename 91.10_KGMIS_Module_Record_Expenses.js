/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Module        : Record Expenses
 * File Name     : 91.10_KGMIS_Module_Record_Expenses.gs
 * Version       : 1.0
 * Designed & Developed by: James Joseph Alenchery
 * ============================================================
 *
 * PURPOSE
 * -------
 * Treasurer-facing backend wrapper for Record Expenses.
 *
 * IMPORTANT ARCHITECTURE RULE
 * ---------------------------
 * This module does NOT replace or modify:
 *
 *   11_KGMIS_Payment_Service.gs
 *   12_KGMIS_Payment_Voucher_PDF_Service.gs
 *   07_KGMIS_FinancialYear_Service.gs
 *   22_Database_Service.gs
 *
 * The UI uses "Expense" terminology.
 *
 * Internally this wrapper maps Expense fields to the existing
 * Payment Service fields and calls:
 *
 *   KGMIS_CreatePaymentTransaction()
 *
 * Existing accounting architecture therefore remains unchanged.
 * ============================================================
 */


/**
 * ============================================================
 * 1. GET RECORD EXPENSES SETUP
 * ============================================================
 *
 * Returns:
 * - Current Financial Year
 * - Financial Year start/end dates
 * - Today's date
 * - Whether expense entry is currently open
 *
 * @param {string} sessionToken
 * @return {Object}
 */
function KGMIS_RecordExpenses_GetSetup(
  sessionToken
) {

  /*
   * Treasurer Portal access is required.
   */
  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );


  const financialYear =
    KGMIS_GetCurrentFinancialYear();


  if (
    !financialYear ||
    !financialYear.financialYear
  ) {

    throw new Error(
      'The current financial year could not be determined.'
    );

  }


  const paymentOpen =
    KGMIS_RecordExpenses_IsPaymentOpen_(
      financialYear
    );


  return {

    success:
      true,


    financialYear:
      financialYear.financialYear,


    startDateIso:
      KGMIS_RecordExpenses_FormatIsoDate_(
        financialYear.startDate
      ),


    endDateIso:
      KGMIS_RecordExpenses_FormatIsoDate_(
        financialYear.endDate
      ),


    todayIso:
      KGMIS_RecordExpenses_FormatIsoDate_(
        new Date()
      ),


    paymentOpen:
      paymentOpen,


    message:
      paymentOpen
        ? 'Record Expenses is ready.'
        : 'Expense transactions are currently closed.'

  };

}


/**
 * ============================================================
 * 2. SEARCH KEF GLOBAL MEMBERS
 * ============================================================
 *
 * Used only when:
 *
 *   Expense Paid To = KEF Global Member
 *
 * Searches active Master Database records by:
 *
 * - Member Name
 * - Mobile
 * - KEFG ID
 *
 * The Treasurer selects the member.
 *
 * FAMILY_ID and KEFG_ID are then stored internally and are
 * never manually typed into the expense form.
 *
 * @param {string} sessionToken
 * @param {string} searchText
 * @return {Object}
 */
function KGMIS_RecordExpenses_SearchMembers(
  sessionToken,
  searchText
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );


  const query =
    KGMIS_RecordExpenses_NormaliseSearch_(
      searchText
    );


  if (
    !query ||
    query.length < 2
  ) {

    throw new Error(
      'Enter at least 2 characters to search for a member.'
    );

  }


  /*
   * Reuse the existing Treasurer Master Database reader.
   *
   * We do not create another database architecture here.
   */
  const context =
    KGMIS_TreasurerV3_GetMasterContext_();


  const column =
    context.column;


  const values =
    context.values;


  const results = [];


  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const row =
      values[rowIndex];


    const recordStatus =
      KGMIS_RecordExpenses_Clean_(
        row[
          column.RECORD_STATUS
        ]
      ).toUpperCase();


    if (
      recordStatus &&
      recordStatus !== 'ACTIVE'
    ) {

      continue;

    }


    const kefgId =
      KGMIS_RecordExpenses_Clean_(
        row[
          column.KEFG_ID
        ]
      ).toUpperCase();


    const familyId =
      KGMIS_RecordExpenses_Clean_(
        row[
          column.FAMILY_ID
        ]
      ).toUpperCase();


    const memberName =
      KGMIS_RecordExpenses_Clean_(
        row[
          column.MEMBER_NAME
        ]
      );


    const mobile =
      KGMIS_RecordExpenses_Clean_(
        row[
          column.MEMBER_MOBILE
        ]
      );


    const memberCategory =
      KGMIS_RecordExpenses_Clean_(
        row[
          column.MEMBER_CATEGORY
        ]
      );


    if (
      !kefgId ||
      !memberName
    ) {

      continue;

    }


    const searchable =
      [
        kefgId,
        familyId,
        memberName,
        mobile
      ]
        .map(
          KGMIS_RecordExpenses_NormaliseSearch_
        );


    const matches =
      searchable.some(
        function (value) {

          return value.includes(
            query
          );

        }
      );


    if (!matches) {

      continue;

    }


    results.push({

      kefgId:
        kefgId,


      familyId:
        familyId,


      memberName:
        memberName,


      mobile:
        mobile,


      memberCategory:
        memberCategory

    });


    /*
     * Limit results so the Treasurer screen remains quick
     * and manageable.
     */
    if (
      results.length >= 20
    ) {

      break;

    }

  }


  results.sort(
    function (
      first,
      second
    ) {

      return String(
        first.memberName || ''
      ).localeCompare(
        String(
          second.memberName || ''
        )
      );

    }
  );


  return {

    success:
      true,


    results:
      results,


    resultCount:
      results.length

  };

}


/**
 * ============================================================
 * 3. CREATE EXPENSE
 * ============================================================
 *
 * Accepts Expense terminology from the UI and converts it into
 * the existing Payment Service request.
 *
 * No PAYMENT_ID or voucher sequence is generated here.
 *
 * Those remain exclusively controlled by:
 *
 *   KGMIS_CreatePaymentTransaction()
 *
 * @param {string} sessionToken
 * @param {Object} expenseData
 * @return {Object}
 */
function KGMIS_RecordExpenses_Create(
  sessionToken,
  expenseData
) {

  const authorisedUser =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'TREASURER',
      'VIEW'
    );


  const data =
    expenseData &&
    typeof expenseData === 'object'
      ? expenseData
      : {};


  /*
   * ----------------------------------------------------------
   * Confirm current Financial Year again on the server.
   *
   * Never trust a browser-supplied FY.
   * ----------------------------------------------------------
   */
  const financialYear =
    KGMIS_GetCurrentFinancialYear();


  if (
    !financialYear ||
    !financialYear.financialYear
  ) {

    throw new Error(
      'The current financial year could not be determined.'
    );

  }


  if (
    !KGMIS_RecordExpenses_IsPaymentOpen_(
      financialYear
    )
  ) {

    throw new Error(
      'Expenses cannot be recorded because transactions are closed for financial year ' +
      financialYear.financialYear +
      '.'
    );

  }


  /*
   * ----------------------------------------------------------
   * Normalise UI terminology.
   * ----------------------------------------------------------
   */
  const paidToType =
    KGMIS_RecordExpenses_Clean_(
      data.paidToType
    ).toUpperCase();


  if (
    paidToType !== 'EXTERNAL' &&
    paidToType !== 'MEMBER'
  ) {

    throw new Error(
      'Expense Paid To must be External Party or KEF Global Member.'
    );

  }


  let payeeName =
    KGMIS_RecordExpenses_Clean_(
      data.payeeName
    );


  let payeeType =
    KGMIS_RecordExpenses_Clean_(
      data.payeeType
    ).toUpperCase();


  let vendorId =
    KGMIS_RecordExpenses_Clean_(
      data.vendorId
    );


  let familyId = '';

  let kefgId = '';


  /*
   * ----------------------------------------------------------
   * MEMBER EXPENSE
   *
   * Do not trust browser-supplied member identity.
   * Re-read the selected KEFG_ID from the Master Database.
   * ----------------------------------------------------------
   */
  if (
    paidToType === 'MEMBER'
  ) {

    kefgId =
      KGMIS_RecordExpenses_Clean_(
        data.kefgId
      ).toUpperCase();


    if (!kefgId) {

      throw new Error(
        'Please search and select the KEF Global member.'
      );

    }


    const member =
      KGMIS_RecordExpenses_GetMemberByKefgId_(
        kefgId
      );


    payeeName =
      member.memberName;


    payeeType =
      'MEMBER';


    familyId =
      member.familyId;


    kefgId =
      member.kefgId;


    /*
     * Vendor ID is never carried into a member reimbursement.
     */
    vendorId =
      '';

  }


  /*
   * ----------------------------------------------------------
   * EXTERNAL PARTY EXPENSE
   *
   * FAMILY_ID and KEFG_ID must remain blank.
   * ----------------------------------------------------------
   */
  if (
    paidToType === 'EXTERNAL'
  ) {

    familyId =
      '';

    kefgId =
      '';

  }


  if (!payeeName) {

    throw new Error(
      'Payee Name is required.'
    );

  }


  if (!payeeType) {

    throw new Error(
      'Payee Type is required.'
    );

  }


  /*
   * ----------------------------------------------------------
   * Map Expense UI fields into the EXISTING Payment Service.
   *
   * Do not change KGMIS_CreatePaymentTransaction().
   * ----------------------------------------------------------
   */
  const paymentRequest = {

    financialYear:
      financialYear.financialYear,


    paymentDate:
      KGMIS_RecordExpenses_Clean_(
        data.expenseDate
      ),


    paymentPurpose:
      KGMIS_RecordExpenses_Clean_(
        data.expensePurpose
      ).toUpperCase(),


    paymentCategory:
      KGMIS_RecordExpenses_Clean_(
        data.expenseCategory
      ).toUpperCase(),


    eventCode:
      KGMIS_RecordExpenses_Clean_(
        data.eventCode
      ).toUpperCase(),


    eventProject:
      KGMIS_RecordExpenses_Clean_(
        data.eventProject
      ),


    payeeName:
      payeeName,


    payeeType:
      payeeType,


    vendorId:
      vendorId,


    familyId:
      familyId,


    kefgId:
      kefgId,


    amount:
      Number(
        data.amount
      ),


    paymentMode:
      KGMIS_RecordExpenses_Clean_(
        data.expenseMode
      ).toUpperCase(),


    transactionReference:
      KGMIS_RecordExpenses_Clean_(
        data.transactionReference
      ),


    invoiceNumber:
      KGMIS_RecordExpenses_Clean_(
        data.invoiceNumber
      ),


    invoiceDate:
      KGMIS_RecordExpenses_Clean_(
        data.invoiceDate
      ),


    /*
     * Record Expenses v1.0 records money already paid.
     */
    paymentStatus:
      'PAID',


    /*
     * The logged-in Treasurer/Admin is the approving officer
     * for this first production version.
     */
    approvedBy:
      KGMIS_RecordExpenses_GetAuthorisedUserName_(
        authorisedUser
      ),


    approvalDate:
      KGMIS_RecordExpenses_Clean_(
        data.expenseDate
      ),


    budgetHead:
      KGMIS_RecordExpenses_Clean_(
        data.budgetHead
      ),


    restrictedFund:
      KGMIS_RecordExpenses_Clean_(
        data.restrictedFund ||
        'NO'
      ).toUpperCase(),


    description:
      KGMIS_RecordExpenses_Clean_(
        data.description
      ),


    supportingDocumentId:
      KGMIS_RecordExpenses_Clean_(
        data.supportingDocumentId
      )

  };


  /*
   * ----------------------------------------------------------
   * One authoritative transaction engine.
   * ----------------------------------------------------------
   */
  const result =
    KGMIS_CreatePaymentTransaction(
      paymentRequest
    );


  if (
    !result ||
    result.success !== true
  ) {

    throw new Error(
      result &&
      result.message
        ? result.message
        : 'The expense could not be recorded.'
    );

  }


  /*
   * ----------------------------------------------------------
   * Translate backend terminology back to Expense terminology.
   * ----------------------------------------------------------
   */
  return {

    success:
      true,


    expenseId:
      result.paymentId || '',


    expenseDate:
      result.paymentDate || '',


    financialYear:
      result.financialYear || '',


    expensePurpose:
      result.paymentPurpose || '',


    expenseCategory:
      result.paymentCategory || '',


    payeeName:
      result.payeeName || payeeName,


    payeeType:
      result.payeeType || payeeType,


    paidToType:
      paidToType,


    familyId:
      familyId,


    kefgId:
      kefgId,


    amount:
      Number(
        result.amount || 0
      ),


    expenseMode:
      result.paymentMode || '',


    transactionReference:
      result.transactionReference || '',


    expenseStatus:
      result.paymentStatus || 'PAID',


    voucherNumber:
      result.voucherNumber || '',


    voucherDate:
      result.voucherDate || '',


    recordStatus:
      result.recordStatus || 'ACTIVE',


    message:
      result.voucherNumber
        ? (
            'Expense ' +
            result.paymentId +
            ' was recorded successfully with voucher ' +
            result.voucherNumber +
            '.'
          )
        : (
            'Expense ' +
            result.paymentId +
            ' was recorded successfully.'
          )

  };

}


/**
 * ============================================================
 * 4. GENERATE / VIEW EXPENSE VOUCHER
 * ============================================================
 *
 * The user-facing module calls it an Expense Voucher.
 *
 * The existing accounting engine continues using the official
 * Payment Voucher PDF Service.
 *
 * @param {string} sessionToken
 * @param {string} expenseId
 * @return {Object}
 */
function KGMIS_RecordExpenses_GenerateVoucher(
  sessionToken,
  expenseId
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );


  const safeExpenseId =
    KGMIS_RecordExpenses_Clean_(
      expenseId
    ).toUpperCase();


  if (!safeExpenseId) {

    throw new Error(
      'Expense Record ID is required.'
    );

  }


  if (
    !/^PAY\d{6}$/.test(
      safeExpenseId
    )
  ) {

    throw new Error(
      'Invalid Expense Record ID.'
    );

  }


  /*
   * Reuse the existing Payment Voucher PDF Service.
   */
  const result =
    KGMIS_GeneratePaymentVoucherPdf(
      safeExpenseId
    );


  if (
    !result ||
    result.success !== true
  ) {

    throw new Error(
      result &&
      result.message
        ? result.message
        : 'The expense voucher could not be generated.'
    );

  }


  return {

    success:
      true,


    expenseId:
      result.paymentId ||
      safeExpenseId,


    voucherNumber:
      result.voucherNumber || '',


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
        ? 'The expense voucher had already been generated.'
        : 'The expense voucher was generated successfully.'

  };

}


/**
 * ============================================================
 * 5. READ ONE SELECTED MEMBER FROM MASTER DATABASE
 * ============================================================
 *
 * This is intentionally server-side.
 *
 * The browser supplies only the selected KEFG_ID. The authoritative
 * member name and FAMILY_ID are read again from the Master Database.
 *
 * @param {string} kefgId
 * @return {Object}
 */
function KGMIS_RecordExpenses_GetMemberByKefgId_(
  kefgId
) {

  const targetKefgId =
    KGMIS_RecordExpenses_Clean_(
      kefgId
    ).toUpperCase();


  if (!targetKefgId) {

    throw new Error(
      'KEFG ID is required.'
    );

  }


  const context =
    KGMIS_TreasurerV3_GetMasterContext_();


  const values =
    context.values;


  const column =
    context.column;


  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const row =
      values[rowIndex];


    const rowKefgId =
      KGMIS_RecordExpenses_Clean_(
        row[
          column.KEFG_ID
        ]
      ).toUpperCase();


    if (
      rowKefgId !== targetKefgId
    ) {

      continue;

    }


    const recordStatus =
      KGMIS_RecordExpenses_Clean_(
        row[
          column.RECORD_STATUS
        ]
      ).toUpperCase();


    if (
      recordStatus &&
      recordStatus !== 'ACTIVE'
    ) {

      throw new Error(
        'The selected member record is not ACTIVE.'
      );

    }


    const memberName =
      KGMIS_RecordExpenses_Clean_(
        row[
          column.MEMBER_NAME
        ]
      );


    const familyId =
      KGMIS_RecordExpenses_Clean_(
        row[
          column.FAMILY_ID
        ]
      ).toUpperCase();


    if (!memberName) {

      throw new Error(
        'The selected member does not have a valid Member Name.'
      );

    }


    if (!familyId) {

      throw new Error(
        'The selected member does not have a valid Family ID.'
      );

    }


    return {

      kefgId:
        rowKefgId,


      familyId:
        familyId,


      memberName:
        memberName,


      mobile:
        KGMIS_RecordExpenses_Clean_(
          row[
            column.MEMBER_MOBILE
          ]
        )

    };

  }


  throw new Error(
    'The selected KEF Global member could not be found.'
  );

}


/**
 * ============================================================
 * 6. PAYMENT-OPEN INTERPRETER
 * ============================================================
 *
 * KGMIS Financial Year data may expose PAYMENT_OPEN as either
 * a boolean-style value or its stored YES/CLOSED text.
 *
 * @param {Object} financialYear
 * @return {boolean}
 */
function KGMIS_RecordExpenses_IsPaymentOpen_(
  financialYear
) {

  if (
    !financialYear ||
    typeof financialYear !== 'object'
  ) {

    return false;

  }


  /*
   * Prefer an explicit boolean if the Financial Year Service
   * supplies one.
   */
  if (
    financialYear.paymentOpen === true
  ) {

    return true;

  }


  if (
    financialYear.paymentOpen === false
  ) {

    return false;

  }


  const value =
    KGMIS_RecordExpenses_Clean_(
      financialYear.paymentOpen
    ).toUpperCase();


  return (
    value === 'YES' ||
    value === 'OPEN'
  );

}


/**
 * ============================================================
 * 7. AUTHORISED USER DISPLAY NAME
 * ============================================================
 */
function KGMIS_RecordExpenses_GetAuthorisedUserName_(
  user
) {

  if (
    user &&
    user.userName
  ) {

    return KGMIS_RecordExpenses_Clean_(
      user.userName
    );

  }


  if (
    user &&
    user.email
  ) {

    return KGMIS_RecordExpenses_Clean_(
      user.email
    );

  }


  return (
    Session
      .getActiveUser()
      .getEmail() ||
    'KGMIS TREASURER'
  );

}


/**
 * ============================================================
 * 8. ISO DATE FORMATTER
 * ============================================================
 */
function KGMIS_RecordExpenses_FormatIsoDate_(
  value
) {

  if (!value) {

    return '';

  }


  let date =
    value;


  if (
    Object.prototype.toString.call(
      date
    ) !== '[object Date]'
  ) {

    date =
      new Date(
        value
      );

  }


  if (
    isNaN(
      date.getTime()
    )
  ) {

    return '';

  }


  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone() ||
      'Asia/Kolkata',
    'yyyy-MM-dd'
  );

}


/**
 * ============================================================
 * 9. CLEAN VALUE
 * ============================================================
 */
function KGMIS_RecordExpenses_Clean_(
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


/**
 * ============================================================
 * 10. NORMALISE SEARCH
 * ============================================================
 */
function KGMIS_RecordExpenses_NormaliseSearch_(
  value
) {

  return KGMIS_RecordExpenses_Clean_(
    value
  )
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      ''
    );

}