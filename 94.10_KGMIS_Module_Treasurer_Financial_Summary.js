/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Module        : Treasurer Financial Summary
 * File Name     : 94.10_KGMIS_Module_Treasurer_Financial_Summary.gs
 * Version       : 1.1
 * Status        : Development
 * Designed & Developed by: James Joseph Alenchery
 * ============================================================
 *
 * PURPOSE
 * -------
 * Read-only consolidated financial reporting backend.
 *
 * IMPORTANT DESIGN RULE
 * ---------------------
 * This module does NOT create a second transaction engine.
 *
 * It reuses the already-working:
 *   KGMIS_ReceiptRegister_GetSetup()
 *   KGMIS_ReceiptRegister_GetRegister()
 *   KGMIS_PaymentRegister_GetRegister()
 *
 * Therefore the Financial Summary reads exactly the same
 * receipt and expense records already proven in the two
 * working Treasurer registers.
 *
 * ACCOUNTING RULES
 * ----------------
 * Receipts:
 *   PAYMENT_STATUS = SUCCESSFUL
 *   RECORD_STATUS  = ACTIVE
 *
 * Expenses:
 *   PAYMENT_STATUS = PAID
 *   RECORD_STATUS  = ACTIVE
 *
 * Net Position:
 *   Total Receipts - Total Expenses
 *
 * This file performs NO transaction writes.
 * ============================================================
 */


/**
 * ============================================================
 * 1. FINANCIAL SUMMARY SETUP
 * ============================================================
 *
 * @param {string} sessionToken
 * @return {Object}
 */
function KGMIS_FinancialSummary_GetSetup(
  sessionToken
) {

  /*
   * Reuse the already-working Receipt Register setup because
   * it already validates Treasurer access and returns the
   * authoritative Financial Year list.
   */
  const receiptSetup =
    KGMIS_ReceiptRegister_GetSetup(
      sessionToken
    );


  if (
    !receiptSetup ||
    receiptSetup.success !== true
  ) {

    throw new Error(
      receiptSetup &&
      receiptSetup.message
        ? receiptSetup.message
        : 'Financial Summary setup could not be loaded.'
    );

  }


  return {

    success:
      true,


    currentFinancialYear:
      receiptSetup.currentFinancialYear ||
      '',


    financialYears:
      receiptSetup.financialYears ||
      [],


    message:
      'Treasurer Financial Summary is ready.'

  };

}


/**
 * ============================================================
 * 2. GENERATE FINANCIAL SUMMARY
 * ============================================================
 *
 * @param {string} sessionToken
 * @param {Object} filters
 * @return {Object}
 */
function KGMIS_FinancialSummary_GetReport(
  sessionToken,
  filters
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );


  const safeFilters =
    KGMIS_FinancialSummary_NormaliseFilters_(
      filters
    );


  /*
   * ----------------------------------------------------------
   * Read the existing proven Receipt Register
   * ----------------------------------------------------------
   *
   * We deliberately do not pass paymentMode or paymentStatus
   * filters. The Financial Summary must examine all records in
   * the selected period, then apply its fixed accounting rule.
   */
  const receiptResult =
    KGMIS_ReceiptRegister_GetRegister(
      sessionToken,
      {
        financialYear:
          safeFilters.financialYear,

        searchText:
          '',

        fromDate:
          safeFilters.fromDate,

        toDate:
          safeFilters.toDate,

        paymentMode:
          '',

        paymentStatus:
          ''
      }
    );


  if (
    !receiptResult ||
    receiptResult.success !== true
  ) {

    throw new Error(
      receiptResult &&
      receiptResult.message
        ? receiptResult.message
        : 'Receipt information could not be loaded.'
    );

  }


  /*
   * ----------------------------------------------------------
   * Read the existing proven Payment Register
   * ----------------------------------------------------------
   */
  const paymentResult =
    KGMIS_PaymentRegister_GetRegister(
      sessionToken,
      {
        financialYear:
          safeFilters.financialYear,

        searchText:
          '',

        fromDate:
          safeFilters.fromDate,

        toDate:
          safeFilters.toDate,

        expenseCategory:
          '',

        expenseMode:
          '',

        expenseStatus:
          ''
      }
    );


  if (
    !paymentResult ||
    paymentResult.success !== true
  ) {

    throw new Error(
      paymentResult &&
      paymentResult.message
        ? paymentResult.message
        : 'Expense information could not be loaded.'
    );

  }


  /*
   * ==========================================================
   * ACCOUNTING RECEIPTS
   * ==========================================================
   */

  const accountingReceipts =
    (
      receiptResult.rows ||
      []
    ).filter(
      function (row) {

        return (
          String(
            row.paymentStatus ||
            ''
          )
            .trim()
            .toUpperCase() ===
            'SUCCESSFUL' &&

          String(
            row.recordStatus ||
            ''
          )
            .trim()
            .toUpperCase() ===
            'ACTIVE'
        );

      }
    );


  /*
   * ==========================================================
   * ACCOUNTING EXPENSES
   * ==========================================================
   */

  const accountingExpenses =
    (
      paymentResult.rows ||
      []
    ).filter(
      function (row) {

        return (
          String(
            row.expenseStatus ||
            ''
          )
            .trim()
            .toUpperCase() ===
            'PAID' &&

          String(
            row.recordStatus ||
            ''
          )
            .trim()
            .toUpperCase() ===
            'ACTIVE'
        );

      }
    );


  /*
   * ==========================================================
   * TOTALS
   * ==========================================================
   */

  const totalReceipts =
    accountingReceipts.reduce(
      function (
        total,
        row
      ) {

        return total +
          Number(
            row.amount ||
            0
          );

      },
      0
    );


  const totalExpenses =
    accountingExpenses.reduce(
      function (
        total,
        row
      ) {

        return total +
          Number(
            row.amount ||
            0
          );

      },
      0
    );


  const netPosition =
    totalReceipts -
    totalExpenses;


  /*
   * ==========================================================
   * BREAKDOWNS
   * ==========================================================
   */

  const receiptsByCategory =
    KGMIS_FinancialSummary_Group_(
      accountingReceipts,
      function (row) {

        return String(
          row.paymentPurpose ||
          'UNSPECIFIED'
        )
          .trim()
          .toUpperCase() ||
          'UNSPECIFIED';

      },
      'receiptCategory'
    );


  const expensesByCategory =
    KGMIS_FinancialSummary_Group_(
      accountingExpenses,
      function (row) {

        return String(
          row.expenseCategory ||
          'UNSPECIFIED'
        )
          .trim()
          .toUpperCase() ||
          'UNSPECIFIED';

      },
      'expenseCategory'
    );


  /*
   * ==========================================================
   * NORMALISED RECEIPT DETAIL ROWS
   * ==========================================================
   *
   * The 94.00 HTML intentionally receives a small reporting
   * shape rather than the complete transaction objects.
   */

  const receipts =
    accountingReceipts.map(
      function (row) {

        return {

          dateDisplay:
            row.receiptDateDisplay ||
            row.transactionDateDisplay ||
            '',


          receiptNumber:
            row.receiptNumber ||
            '',


          transactionId:
            row.transactionId ||
            '',


          familyId:
            row.familyId ||
            '',


          kefgId:
            row.kefgId ||
            '',


          payerName:
            row.payerName ||
            '',


          purpose:
            row.paymentPurpose ||
            '',


          paymentMode:
            row.paymentMode ||
            '',


          reference:
            row.transactionReference ||
            '',


          amount:
            KGMIS_FinancialSummary_RoundMoney_(
              row.amount
            )

        };

      }
    );


  /*
   * ==========================================================
   * NORMALISED EXPENSE DETAIL ROWS
   * ==========================================================
   */

  const expenses =
    accountingExpenses.map(
      function (row) {

        return {

          dateDisplay:
            row.expenseDateDisplay ||
            '',


          voucherNumber:
            row.voucherNumber ||
            '',


          expenseId:
            row.expenseId ||
            '',


          payeeName:
            row.payeeName ||
            '',


          purpose:
            row.expensePurpose ||
            '',


          category:
            row.expenseCategory ||
            '',


          eventCode:
            row.eventCode ||
            '',


          eventProject:
            row.eventProject ||
            '',


          paymentMode:
            row.expenseMode ||
            '',


          reference:
            row.transactionReference ||
            '',


          amount:
            KGMIS_FinancialSummary_RoundMoney_(
              row.amount
            )

        };

      }
    );


  return {

    success:
      true,


    financialYear:
      safeFilters.financialYear,


    fromDate:
      safeFilters.fromDate,


    toDate:
      safeFilters.toDate,


    summary: {

      totalReceipts:
        KGMIS_FinancialSummary_RoundMoney_(
          totalReceipts
        ),


      totalExpenses:
        KGMIS_FinancialSummary_RoundMoney_(
          totalExpenses
        ),


      netPosition:
        KGMIS_FinancialSummary_RoundMoney_(
          netPosition
        ),


      receiptCount:
        accountingReceipts.length,


      expenseCount:
        accountingExpenses.length

    },


    receiptsByCategory:
      receiptsByCategory,


    expensesByCategory:
      expensesByCategory,


    receipts:
      receipts,


    expenses:
      expenses,


    message:
      'Treasurer Financial Summary generated successfully.'

  };

}


/**
 * ============================================================
 * 3. NORMALISE / VALIDATE FILTERS
 * ============================================================
 *
 * @param {Object} filters
 * @return {Object}
 */
function KGMIS_FinancialSummary_NormaliseFilters_(
  filters
) {

  const input =
    filters &&
    typeof filters ===
      'object'
      ? filters
      : {};


  const financialYear =
    String(
      input.financialYear ||
      ''
    ).trim();


  const fromDate =
    String(
      input.fromDate ||
      ''
    ).trim();


  const toDate =
    String(
      input.toDate ||
      ''
    ).trim();


  if (!financialYear) {

    throw new Error(
      'Financial Year is required.'
    );

  }


  if (
    fromDate &&
    !KGMIS_FinancialSummary_IsIsoDate_(
      fromDate
    )
  ) {

    throw new Error(
      'Invalid From Date.'
    );

  }


  if (
    toDate &&
    !KGMIS_FinancialSummary_IsIsoDate_(
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
      financialYear,


    fromDate:
      fromDate,


    toDate:
      toDate

  };

}


/**
 * ============================================================
 * 4. GROUP TRANSACTIONS
 * ============================================================
 *
 * @param {Array<Object>} rows
 * @param {Function} keyFunction
 * @param {string} outputKey
 * @return {Array<Object>}
 */
function KGMIS_FinancialSummary_Group_(
  rows,
  keyFunction,
  outputKey
) {

  const grouped =
    {};


  (
    Array.isArray(rows)
      ? rows
      : []
  ).forEach(
    function (row) {

      const key =
        String(
          keyFunction(
            row
          ) ||
          'UNSPECIFIED'
        ).trim() ||
        'UNSPECIFIED';


      if (!grouped[key]) {

        grouped[key] = {

          transactionCount:
            0,

          amount:
            0

        };

      }


      grouped[key].transactionCount++;


      grouped[key].amount +=
        Number(
          row.amount ||
          0
        );

    }
  );


  return Object.keys(
    grouped
  )
    .map(
      function (key) {

        const result = {

          transactionCount:
            grouped[key]
              .transactionCount,

          amount:
            KGMIS_FinancialSummary_RoundMoney_(
              grouped[key]
                .amount
            )

        };


        result[
          outputKey
        ] =
          key;


        return result;

      }
    )
    .sort(
      function (
        first,
        second
      ) {

        /*
         * Largest amount first.
         * Alphabetical key is the stable secondary sort.
         */
        if (
          second.amount !==
          first.amount
        ) {

          return (
            second.amount -
            first.amount
          );

        }


        return String(
          first[
            outputKey
          ] ||
          ''
        ).localeCompare(
          String(
            second[
              outputKey
            ] ||
            ''
          )
        );

      }
    );

}


/**
 * ============================================================
 * 5. ISO DATE VALIDATION
 * ============================================================
 *
 * @param {*} value
 * @return {boolean}
 */
function KGMIS_FinancialSummary_IsIsoDate_(
  value
) {

  const text =
    String(
      value ||
      ''
    ).trim();


  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      text
    )
  ) {

    return false;

  }


  const parts =
    text.split('-');


  const year =
    Number(
      parts[0]
    );


  const month =
    Number(
      parts[1]
    );


  const day =
    Number(
      parts[2]
    );


  const date =
    new Date(
      year,
      month - 1,
      day
    );


  return (
    date.getFullYear() ===
      year &&
    date.getMonth() ===
      month - 1 &&
    date.getDate() ===
      day
  );

}


/**
 * ============================================================
 * 6. MONEY ROUNDING
 * ============================================================
 *
 * @param {*} value
 * @return {number}
 */
function KGMIS_FinancialSummary_RoundMoney_(
  value
) {

  return Math.round(
    (
      Number(
        value ||
        0
      ) +
      Number.EPSILON
    ) *
    100
  ) /
  100;

}
