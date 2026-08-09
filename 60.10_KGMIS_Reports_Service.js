/**
 * ============================================================
 * Builds the KGMIS Report Portal.
 * File: 60.00_KGMIS_Reports_Service.gs
 * Designed and Developed by: James Joseph Alenchdry
 * ============================================================
 */

function KGMIS_REPORTS_BuildMembershipSummary_() {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();


  /*
   * ==========================================================
   * 1. DETERMINE THE ACTIVE FINANCIAL YEAR
   * ==========================================================
   */

  const financialYearSheet =
    spreadsheet.getSheetByName(
      'KGMIS_FINANCIAL_YEAR'
    );

  if (!financialYearSheet) {
    throw new Error(
      'KGMIS_FINANCIAL_YEAR sheet was not found.'
    );
  }

  const financialYearValues =
    financialYearSheet
      .getDataRange()
      .getValues();

  if (financialYearValues.length < 2) {
    throw new Error(
      'KGMIS_FINANCIAL_YEAR has no configuration rows.'
    );
  }

  const financialYearHeaders =
    financialYearValues[0].map(
      function (header) {
        return String(
          header || ''
        )
          .trim()
          .toUpperCase();
      }
    );

  const financialYearColumn = {};

  financialYearHeaders.forEach(
    function (header, index) {
      if (header) {
        financialYearColumn[header] =
          index;
      }
    }
  );

  [
    'FINANCIAL_YEAR',
    'STATUS'
  ].forEach(function (header) {

    if (
      !Object.prototype.hasOwnProperty.call(
        financialYearColumn,
        header
      )
    ) {
      throw new Error(
        'KGMIS_FINANCIAL_YEAR is missing header: ' +
        header
      );
    }

  });

  let activeFinancialYear = '';

  for (
    let rowIndex = 1;
    rowIndex < financialYearValues.length;
    rowIndex++
  ) {

    const row =
      financialYearValues[rowIndex];

    const status =
      KGMIS_REPORTS_Normalise_(
        row[
          financialYearColumn.STATUS
        ]
      );

    if (status !== 'CURRENT') {
      continue;
    }

    activeFinancialYear =
      KGMIS_REPORTS_Clean_(
        row[
          financialYearColumn.FINANCIAL_YEAR
        ]
      );

    break;
  }

  if (!activeFinancialYear) {
    throw new Error(
      'No ACTIVE financial year was found in ' +
      'KGMIS_FINANCIAL_YEAR.'
    );
  }


  /*
   * ==========================================================
   * 2. READ KGMIS_MEMBERSHIP_YEAR
   * ==========================================================
   */

  const membershipYearSheet =
    spreadsheet.getSheetByName(
      'KGMIS_MEMBERSHIP_YEAR'
    );

  if (!membershipYearSheet) {
    throw new Error(
      'KGMIS_MEMBERSHIP_YEAR sheet was not found.'
    );
  }

  const membershipYearContext =
    KMIS_DB_GetContext({
      sheet:
        membershipYearSheet
    });

  const requiredMembershipYearHeaders = [
    'FAMILY_ID',
    'FINANCIAL_YEAR',
    'MEMBERSHIP_STATUS',
    'PAYMENT_STATUS',
    'RECORD_STATUS'
  ];

  requiredMembershipYearHeaders.forEach(
    function (header) {

      if (
        !Object.prototype.hasOwnProperty.call(
          membershipYearContext.column,
          header
        )
      ) {
        throw new Error(
          'Membership Summary requires the ' +
          'KGMIS_MEMBERSHIP_YEAR header: ' +
          header
        );
      }

    }
  );

  const currentFamilyIds =
    new Set();

  const paidFamilyIds =
    new Set();

  let membershipYearRecords = 0;
  let currentMembershipRecords = 0;
  let paidMembershipRecords = 0;

  for (
    let rowIndex = 1;
    rowIndex <
      membershipYearContext.values.length;
    rowIndex++
  ) {

    const row =
      membershipYearContext.values[
        rowIndex
      ];

    const familyId =
      KGMIS_REPORTS_Clean_(
        row[
          membershipYearContext
            .column.FAMILY_ID
        ]
      );

    const financialYear =
      KGMIS_REPORTS_Clean_(
        row[
          membershipYearContext
            .column.FINANCIAL_YEAR
        ]
      );

    if (
      !familyId ||
      financialYear !== activeFinancialYear
    ) {
      continue;
    }

    const recordStatus =
      KGMIS_REPORTS_Normalise_(
        row[
          membershipYearContext
            .column.RECORD_STATUS
        ]
      );

    /*
     * Exclude archived or inactive Membership Year rows.
     * Blank RECORD_STATUS is also excluded because the
     * authoritative records should be explicitly ACTIVE.
     */
    if (recordStatus !== 'ACTIVE') {
      continue;
    }

    membershipYearRecords++;

    const membershipStatus =
      KGMIS_REPORTS_Normalise_(
        row[
          membershipYearContext
            .column.MEMBERSHIP_STATUS
        ]
      );

    const paymentStatus =
      KGMIS_REPORTS_Normalise_(
        row[
          membershipYearContext
            .column.PAYMENT_STATUS
        ]
      );

    if (
      membershipStatus === 'CURRENT'
    ) {
      currentFamilyIds.add(
        familyId
      );

      currentMembershipRecords++;
    }

    if (
      paymentStatus === 'PAID'
    ) {
      paidFamilyIds.add(
        familyId
      );

      paidMembershipRecords++;
    }

  }


  /*
   * ==========================================================
   * 3. READ MASTER DATABASE
   * ==========================================================
   */

  const masterContext =
    KMIS_DB_GetContext();

  const requiredMasterHeaders = [
    'KEFG_ID',
    'FAMILY_ID',
    'MEMBER_CATEGORY',
    'RECORD_STATUS'
  ];

  requiredMasterHeaders.forEach(
    function (header) {

      if (
        !Object.prototype.hasOwnProperty.call(
          masterContext.column,
          header
        )
      ) {
        throw new Error(
          'Membership Summary requires the ' +
          'Master Database header: ' +
          header
        );
      }

    }
  );

  const uniqueFamilies =
    new Set();

  let totalMemberRecords = 0;
  let currentMemberRecords = 0;
  let archivedMemberRecords = 0;

  let primaryMembers = 0;
  let alumniSpouseMembers = 0;
  let nonAlumniSpouses = 0;

  let currentPrimaryMembers = 0;
  let currentAlumniSpouseMembers = 0;
  let currentNonAlumniSpouses = 0;

  for (
    let rowIndex = 1;
    rowIndex < masterContext.values.length;
    rowIndex++
  ) {

    const row =
      masterContext.values[
        rowIndex
      ];

    const kefgId =
      KGMIS_REPORTS_Clean_(
        row[
          masterContext.column.KEFG_ID
        ]
      );

    const familyId =
      KGMIS_REPORTS_Clean_(
        row[
          masterContext.column.FAMILY_ID
        ]
      );

    if (
      !kefgId &&
      !familyId
    ) {
      continue;
    }

    const memberCategory =
      KGMIS_REPORTS_Normalise_(
        row[
          masterContext
            .column.MEMBER_CATEGORY
        ]
      );

    const masterRecordStatus =
      KGMIS_REPORTS_Normalise_(
        row[
          masterContext
            .column.RECORD_STATUS
        ]
      );

    totalMemberRecords++;

    if (familyId) {
      uniqueFamilies.add(
        familyId
      );
    }

    if (
      masterRecordStatus === 'ARCHIVED'
    ) {
      archivedMemberRecords++;
    }

    const isCurrentFamily =
      Boolean(
        familyId &&
        currentFamilyIds.has(
          familyId
        )
      );

    if (isCurrentFamily) {
      currentMemberRecords++;
    }

    if (
      memberCategory ===
      'PRIMARY MEMBER'
    ) {

      primaryMembers++;

      if (isCurrentFamily) {
        currentPrimaryMembers++;
      }

      continue;
    }

    if (
      memberCategory ===
      'ALUMNI SPOUSE MEMBER'
    ) {

      alumniSpouseMembers++;

      if (isCurrentFamily) {
        currentAlumniSpouseMembers++;
      }

      continue;
    }

    if (
      memberCategory ===
      'NON-ALUMNI SPOUSE'
    ) {

      nonAlumniSpouses++;

      if (isCurrentFamily) {
        currentNonAlumniSpouses++;
      }

    }

  }


  /*
   * ==========================================================
   * 4. READ FAMILY MEMBERS DATABASE
   * ==========================================================
   */

  const familyMembersContext =
    KMIS_DB_GetContext({
      sheet:
        KMIS_DB_GetFamilyMembersSheet()
    });

  const requiredFamilyMemberHeaders = [
    'PERSON_ID',
    'DEPENDANT_ID',
    'FAMILY_ID',
    'FAMILY_RELATION',
    'RECORD_STATUS'
  ];

  requiredFamilyMemberHeaders.forEach(
    function (header) {

      if (
        !Object.prototype.hasOwnProperty.call(
          familyMembersContext.column,
          header
        )
      ) {
        throw new Error(
          'Membership Summary requires the ' +
          'KEFG_FAMILY_MEMBERS header: ' +
          header
        );
      }

    }
  );

  let totalFamilyMembers = 0;
  let currentFamilyMembers = 0;
  let archivedFamilyMembers = 0;

  let children = 0;
  let otherFamilyMembers = 0;

  for (
    let rowIndex = 1;
    rowIndex <
      familyMembersContext.values.length;
    rowIndex++
  ) {

    const row =
      familyMembersContext.values[
        rowIndex
      ];

    const personId =
      KGMIS_REPORTS_Clean_(
        row[
          familyMembersContext
            .column.PERSON_ID
        ]
      );

    const dependantId =
      KGMIS_REPORTS_Clean_(
        row[
          familyMembersContext
            .column.DEPENDANT_ID
        ]
      );

    const familyId =
      KGMIS_REPORTS_Clean_(
        row[
          familyMembersContext
            .column.FAMILY_ID
        ]
      );

    if (
      !personId &&
      !dependantId &&
      !familyId
    ) {
      continue;
    }

    const relation =
      KGMIS_REPORTS_Normalise_(
        row[
          familyMembersContext
            .column.FAMILY_RELATION
        ]
      );

    const familyRecordStatus =
      KGMIS_REPORTS_Normalise_(
        row[
          familyMembersContext
            .column.RECORD_STATUS
        ]
      );

    totalFamilyMembers++;

    if (
      familyRecordStatus === 'ARCHIVED'
    ) {
      archivedFamilyMembers++;
    }

    if (
      familyId &&
      currentFamilyIds.has(familyId) &&
      familyRecordStatus !== 'ARCHIVED'
    ) {
      currentFamilyMembers++;
    }

    if (
      relation === 'SON' ||
      relation === 'DAUGHTER' ||
      relation === 'CHILD'
    ) {
      children++;
    } else {
      otherFamilyMembers++;
    }

  }


  /*
   * ==========================================================
   * 5. RETURN MEMBERSHIP SUMMARY
   * ==========================================================
   */

  return {
    success: true,

    reportId:
      'membership-summary',

    reportTitle:
      'Membership Summary',

    generatedOn:
      new Date(),

    financialYear:
      activeFinancialYear,

    masterDatabase: {
      totalFamilies:
        uniqueFamilies.size,

      /*
       * Current and paid family figures are derived from
       * KGMIS_MEMBERSHIP_YEAR for the ACTIVE financial year.
       */
      activeFamilies:
        currentFamilyIds.size,

      paidFamilies:
        paidFamilyIds.size,

      membershipYearRecords:
        membershipYearRecords,

      currentMembershipRecords:
        currentMembershipRecords,

      paidMembershipRecords:
        paidMembershipRecords,

      totalMemberRecords:
        totalMemberRecords,

      /*
       * Master records belonging to CURRENT families.
       */
      activeMemberRecords:
        currentMemberRecords,

      archivedMemberRecords:
        archivedMemberRecords,

      primaryMembers:
        primaryMembers,

      activePrimaryMembers:
        currentPrimaryMembers,

      alumniSpouseMembers:
        alumniSpouseMembers,

      activeAlumniSpouseMembers:
        currentAlumniSpouseMembers,

      nonAlumniSpouses:
        nonAlumniSpouses,

      activeNonAlumniSpouses:
        currentNonAlumniSpouses
    },

    familyMembers: {
      totalFamilyMembers:
        totalFamilyMembers,

      activeFamilyMembers:
        currentFamilyMembers,

      archivedFamilyMembers:
        archivedFamilyMembers,

      children:
        children,

      otherFamilyMembers:
        otherFamilyMembers
    },

    combined: {
      totalPeople:
        totalMemberRecords +
        totalFamilyMembers,

      activePeople:
        currentMemberRecords +
        currentFamilyMembers
    }
  };

}


/**
 * Returns a trimmed string.
 *
 * @param {*} value
 * @return {string}
 */
function KGMIS_REPORTS_Clean_(
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
 * Returns a trimmed uppercase value for comparisons.
 *
 * @param {*} value
 * @return {string}
 */
function KGMIS_REPORTS_Normalise_(
  value
) {

  return KGMIS_REPORTS_Clean_(
    value
  ).toUpperCase();

}

/**
 * ============================================================
 * Public Reports Service entry point.
 *
 * The Reports Portal must call this function instead of
 * calling individual report-building functions directly.
 *
 * @param {string} sessionToken
 * @param {string} reportId
 * @param {Object} parameters
 * @return {Object}
 * ============================================================
 */
function KGMIS_REPORTS_RunReport(
  sessionToken,
  reportId,
  parameters
) {

  const safeSessionToken =
    String(
      sessionToken || ''
    ).trim();

  const safeReportId =
    String(
      reportId || ''
    )
      .trim()
      .toLowerCase();

  const safeParameters =
    parameters &&
    typeof parameters === 'object'
      ? parameters
      : {};


/*
 * Validate the actual OTP login session and confirm
 * that the session user has Reports VIEW access.
 */
const authorisedUser =
  KGMIS_OTP_RequireSessionAccess_(
    safeSessionToken,
    'REPORTS',
    'VIEW'
  );


  if (!safeReportId) {
    throw new Error(
      'A Report ID is required.'
    );
  }


  let reportResult;


  switch (safeReportId) {

    case 'membership-summary':

      reportResult =
        KGMIS_REPORTS_BuildMembershipSummary_(
          safeParameters
        );

      break;

  case 'subscription-summary':

  reportResult =
    KGMIS_REPORTS_BuildSubscriptionSummary_(
      safeParameters
    );

  break;

    default:

      throw new Error(
        'Unknown or unsupported Report ID: ' +
        safeReportId
      );

  }


  if (
    !reportResult ||
    reportResult.success !== true
  ) {
    throw new Error(
      'The requested report did not return a valid result.'
    );
  }


  const generatedOn =
    reportResult.generatedOn instanceof Date &&
    !isNaN(
      reportResult.generatedOn.getTime()
    )
      ? reportResult.generatedOn
      : new Date();


  /*
   * Return one consistent report envelope.
   */
  const response = {
    success: true,

    reportId:
      safeReportId,

    reportTitle:
      reportResult.reportTitle ||
      'KGMIS Report',

    generatedOn:
      generatedOn.toISOString(),

    generatedBy: {
      email:
        authorisedUser.email || '',

      userName:
        authorisedUser.userName || '',

      role:
        authorisedUser.role || ''
    },

    parameters:
      safeParameters,

    reportData: {
      masterDatabase:
        reportResult.masterDatabase || {},

    familyMembers:
      reportResult.familyMembers || {},

    combined:
      reportResult.combined || {},

    subscriptionSummary:
      reportResult.subscriptionSummary || {}
    }
  };


  /*
   * Record the successful report execution in the existing
   * Security Audit Log when that sheet is available.
   */
  KGMIS_LogSecurityEvent_({
    email:
      authorisedUser.email,

    userName:
      authorisedUser.userName,

    role:
      authorisedUser.role,

    module:
      'REPORTS',

    action:
      'RUN_REPORT',

    result:
      'SUCCESS',

    details:
      'Generated report: ' +
      safeReportId
  });


  return response;
}


function KGMIS_REPORTS_BuildSubscriptionSummary_() {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();


  /*
   * ==========================================================
   * 1. DETERMINE THE CURRENT FINANCIAL YEAR
   * ==========================================================
   */

  const financialYearSheet =
    spreadsheet.getSheetByName(
      'KGMIS_FINANCIAL_YEAR'
    );

  if (!financialYearSheet) {
    throw new Error(
      'KGMIS_FINANCIAL_YEAR sheet was not found.'
    );
  }

  const financialYearValues =
    financialYearSheet
      .getDataRange()
      .getValues();

  if (financialYearValues.length < 2) {
    throw new Error(
      'KGMIS_FINANCIAL_YEAR has no configuration rows.'
    );
  }

  const financialYearHeaders =
    financialYearValues[0].map(
      function (header) {
        return String(header || '')
          .trim()
          .toUpperCase();
      }
    );

  const financialYearColumn = {};

  financialYearHeaders.forEach(
    function (header, index) {
      if (header) {
        financialYearColumn[header] =
          index;
      }
    }
  );

  [
    'FINANCIAL_YEAR',
    'MEMBERSHIP_FEE',
    'STATUS'
  ].forEach(function (header) {

    if (
      !Object.prototype.hasOwnProperty.call(
        financialYearColumn,
        header
      )
    ) {
      throw new Error(
        'KGMIS_FINANCIAL_YEAR is missing header: ' +
        header
      );
    }

  });

  let currentFinancialYear = '';
  let configuredMembershipFee = 0;

  for (
    let rowIndex = 1;
    rowIndex < financialYearValues.length;
    rowIndex++
  ) {

    const row =
      financialYearValues[rowIndex];

    const status =
      KGMIS_REPORTS_Normalise_(
        row[
          financialYearColumn.STATUS
        ]
      );

    if (status !== 'CURRENT') {
      continue;
    }

    currentFinancialYear =
      KGMIS_REPORTS_Clean_(
        row[
          financialYearColumn.FINANCIAL_YEAR
        ]
      );

    configuredMembershipFee =
      Number(
        row[
          financialYearColumn.MEMBERSHIP_FEE
        ] || 0
      );

    break;
  }

  if (!currentFinancialYear) {
    throw new Error(
      'No CURRENT financial year was found in ' +
      'KGMIS_FINANCIAL_YEAR.'
    );
  }


  /*
   * ==========================================================
   * 2. READ MASTER DATABASE
   * ==========================================================
   *
   * Total Families:
   * Unique non-blank FAMILY_ID values.
   *
   * Paid Previous Year:
   * Unique FAMILY_ID values where
   * SUBSCRIPTION_STATUS_2025_2026 = PAID.
   * ==========================================================
   */

  const masterContext =
    KMIS_DB_GetContext();

  const requiredMasterHeaders = [
    'FAMILY_ID',
    'SUBSCRIPTION_STATUS_2025_2026'
  ];

  requiredMasterHeaders.forEach(
    function (header) {

      if (
        !Object.prototype.hasOwnProperty.call(
          masterContext.column,
          header
        )
      ) {
        throw new Error(
          'Subscription Summary requires the ' +
          'Master Database header: ' +
          header
        );
      }

    }
  );

  const allFamilyIds =
    new Set();

  const previousYearPaidFamilyIds =
    new Set();

  for (
    let rowIndex = 1;
    rowIndex < masterContext.values.length;
    rowIndex++
  ) {

    const row =
      masterContext.values[rowIndex];

    const familyId =
      KGMIS_REPORTS_Clean_(
        row[
          masterContext.column.FAMILY_ID
        ]
      );

    if (!familyId) {
      continue;
    }

    allFamilyIds.add(
      familyId
    );

    const previousYearStatus =
      KGMIS_REPORTS_Normalise_(
        row[
          masterContext
            .column
            .SUBSCRIPTION_STATUS_2025_2026
        ]
      );

    if (previousYearStatus === 'PAID') {
      previousYearPaidFamilyIds.add(
        familyId
      );
    }

  }


  /*
   * ==========================================================
   * 3. READ CURRENT-YEAR SUBSCRIPTION RECORDS
   * ==========================================================
   */

  const membershipYearSheet =
    spreadsheet.getSheetByName(
      'KGMIS_MEMBERSHIP_YEAR'
    );

  if (!membershipYearSheet) {
    throw new Error(
      'KGMIS_MEMBERSHIP_YEAR sheet was not found.'
    );
  }

  const membershipYearContext =
    KMIS_DB_GetContext({
      sheet:
        membershipYearSheet
    });

  const requiredMembershipYearHeaders = [
    'FAMILY_ID',
    'FINANCIAL_YEAR',
    'PAYMENT_STATUS',
    'AMOUNT_RECEIVED',
    'PAYMENT_COUNT',
    'RECORD_STATUS'
  ];

  requiredMembershipYearHeaders.forEach(
    function (header) {

      if (
        !Object.prototype.hasOwnProperty.call(
          membershipYearContext.column,
          header
        )
      ) {
        throw new Error(
          'Subscription Summary requires the ' +
          'KGMIS_MEMBERSHIP_YEAR header: ' +
          header
        );
      }

    }
  );

  const currentYearPaidFamilyIds =
    new Set();

  let currentYearRecordCount = 0;
  let totalAmountReceived = 0;
  let totalPaymentCount = 0;

  for (
    let rowIndex = 1;
    rowIndex <
      membershipYearContext.values.length;
    rowIndex++
  ) {

    const row =
      membershipYearContext.values[
        rowIndex
      ];

    const familyId =
      KGMIS_REPORTS_Clean_(
        row[
          membershipYearContext
            .column.FAMILY_ID
        ]
      );

    const financialYear =
      KGMIS_REPORTS_Clean_(
        row[
          membershipYearContext
            .column.FINANCIAL_YEAR
        ]
      );

    if (
      !familyId ||
      financialYear !== currentFinancialYear
    ) {
      continue;
    }

    const recordStatus =
      KGMIS_REPORTS_Normalise_(
        row[
          membershipYearContext
            .column.RECORD_STATUS
        ]
      );

    if (recordStatus !== 'ACTIVE') {
      continue;
    }

    currentYearRecordCount++;

    const paymentStatus =
      KGMIS_REPORTS_Normalise_(
        row[
          membershipYearContext
            .column.PAYMENT_STATUS
        ]
      );

    if (paymentStatus !== 'PAID') {
      continue;
    }

    currentYearPaidFamilyIds.add(
      familyId
    );

    const amountReceived =
      Number(
        row[
          membershipYearContext
            .column.AMOUNT_RECEIVED
        ] || 0
      );

    const paymentCount =
      Number(
        row[
          membershipYearContext
            .column.PAYMENT_COUNT
        ] || 0
      );

    if (Number.isFinite(amountReceived)) {
      totalAmountReceived +=
        amountReceived;
    }

    if (Number.isFinite(paymentCount)) {
      totalPaymentCount +=
        paymentCount;
    }

  }


  /*
   * ==========================================================
   * 4. CALCULATE SUMMARY VALUES
   * ==========================================================
   */

  const totalFamilies =
    allFamilyIds.size;

  const paidThisYear =
    currentYearPaidFamilyIds.size;

  const paidPreviousYear =
    previousYearPaidFamilyIds.size;

  const pendingMembership =
    Math.max(
      0,
      totalFamilies -
      paidThisYear
    );

  const subscriptionProgress =
    totalFamilies > 0
      ? (
          paidThisYear /
          totalFamilies
        ) * 100
      : 0;

  const renewalRate =
    paidPreviousYear > 0
      ? (
          paidThisYear /
          paidPreviousYear
        ) * 100
      : 0;

  const yearOnYearChange =
    paidThisYear -
    paidPreviousYear;

  const yearOnYearChangePercent =
    paidPreviousYear > 0
      ? (
          yearOnYearChange /
          paidPreviousYear
        ) * 100
      : 0;

  const roundedSubscriptionProgress =
    Math.round(
      subscriptionProgress * 100
    ) / 100;

  const roundedRenewalRate =
    Math.round(
      renewalRate * 100
    ) / 100;

  const roundedYearOnYearChangePercent =
    Math.round(
      yearOnYearChangePercent * 100
    ) / 100;


  /*
   * ==========================================================
   * 5. RETURN SUBSCRIPTION SUMMARY
   * ==========================================================
   */

  return {
    success: true,

    reportId:
      'subscription-summary',

    reportTitle:
      'Subscription Summary',

    generatedOn:
      new Date(),

    subscriptionSummary: {
      financialYear:
        currentFinancialYear,

      previousFinancialYear:
        '2025-26',

      membershipFee:
        configuredMembershipFee,

      totalFamilies:
        totalFamilies,

      paidThisYear:
        paidThisYear,

      paidPreviousYear:
        paidPreviousYear,

      pendingMembership:
        pendingMembership,

      subscriptionReceived:
        totalAmountReceived,

      subscriptionProgress:
        roundedSubscriptionProgress,

      renewalRate:
        roundedRenewalRate,

      yearOnYearChange:
        yearOnYearChange,

      yearOnYearChangePercent:
        roundedYearOnYearChangePercent,

      currentYearRecordCount:
        currentYearRecordCount,

      totalPaymentCount:
        totalPaymentCount
    }
  };

}



