/*
 * ============================================================
 * KGMIS Treasurer Module — Version 3.3
 * File: 90.10_KGMIS_Module_Treasurer.gs
 *
 * Authentication:
 *   Mobile-login shared KGMIS session
 *
 * Authorisation:
 *   KGMIS_OTP_RequireSessionAccess_()
 *
 * Financial year:
 *   07_KGMIS_FinancialYear_Service.gs
 *
 * Membership year / membership status:
 *   08_KGMIS_MembershipYear_Service.gs
 *
 * Important:
 *   This file does NOT read the legacy
 *   SUBSCRIPTION_STATUS_2026_2027 or
 *   SUBSCRIPTION_PAYMENT_DATE_2026_2027 master columns.
 * ============================================================
 */

const KGMIS_TREASURER_V3 = Object.freeze({
  MAX_SEARCH_RESULTS: 50,

  MASTER_HEADERS: Object.freeze({
    KEFG_ID: 'KEFG_ID',
    FAMILY_ID: 'FAMILY_ID',
    MEMBER_CATEGORY: 'MEMBER_CATEGORY',
    RECORD_STATUS: 'RECORD_STATUS',
    MEMBER_NAME: 'MEMBER_NAME',
    MEMBER_MOBILE: 'MEMBER_MOBILE',
    ALUMNI_ASSOCIATION: 'ALUMNI_ASSOCIATION',
    BRANCH: 'BRANCH',
    YEAR_BATCH: 'YEAR_BATCH',
    ZONE: 'ZONE',

    SPOUSE_NAME: 'SPOUSE_NAME',
    SPOUSE_MOBILE: 'SPOUSE_MOBILE',
    SPOUSE_ALUMNI_ASSOCIATION: 'SPOUSE_ALUMNI_ASSOCIATION',
    SPOUSE_BRANCH: 'SPOUSE_BRANCH',
    SPOUSE_BATCH_YEAR: 'SPOUSE_BATCH_YEAR'
  })
});


/*
 * ============================================================
 * PUBLIC — CONFIGURATION
 * ============================================================
 */

function KGMIS_TreasurerV3_GetConfiguration(
  sessionToken
) {

  const user =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'TREASURER',
      'VIEW'
    );

  KGMIS_TreasurerV3_EnsureFinancialYearRollover_(
    user
  );

  const financialYear =
    KGMIS_GetCurrentFinancialYear();

  const masterContext =
    KGMIS_TreasurerV3_GetMasterContext_();

  return {
    financialYear:
      financialYear.financialYear,

    membershipFee:
      Number(
        financialYear.membershipFee || 0
      ),

    paymentOpen:
      Boolean(
        financialYear.paymentOpen
      ),

    subscriptionStatusOptions: [
      'PAID',
      'PENDING'
    ],

    zones:
      KGMIS_TreasurerV3_GetUniqueZones_(
        masterContext
      ),

    currentUser: {
      email:
        String(
          user.email || ''
        ).trim(),

      userName:
        String(
          user.userName || ''
        ).trim(),

      role:
        String(
          user.role || ''
        )
          .trim()
          .toUpperCase()
    }
  };
}


/*
 * ============================================================
 * PUBLIC — FIND A FAMILY
 * ============================================================
 */

function KGMIS_TreasurerV3_SearchFamilies(
  sessionToken,
  searchText
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );

  const query =
    KGMIS_TreasurerV3_NormalizeSearch_(
      searchText
    );

  if (!query) {
    throw new Error(
      'Enter a Family ID, KEFG ID, Zone, name, mobile number or alumni detail.'
    );
  }

  const financialYear =
    KGMIS_GetCurrentFinancialYear();

  const masterContext =
    KGMIS_TreasurerV3_GetMasterContext_();

  const familyMap =
    KGMIS_TreasurerV3_BuildFamilyMap_(
      masterContext
    );

  const membershipMap =
    KGMIS_TreasurerV3_GetMembershipMap_(
      financialYear.financialYear
    );

  const results = [];

  familyMap.forEach(
    function (family) {

      const membership =
        membershipMap.get(
          family.familyId
        ) || null;

      const result =
        KGMIS_TreasurerV3_CombineFamilyAndMembership_(
          family,
          membership,
          financialYear.financialYear
        );

      const searchableValues = [
        result.familyId,
        result.kefgId,
        result.zone,

        result.memberName,
        result.memberMobile,
        result.memberAlumniAssociation,
        result.memberBranch,
        result.memberBatchYear,

        result.spouseName,
        result.spouseMobile,
        result.spouseAlumniAssociation,
        result.spouseBranch,
        result.spouseBatchYear,

        result.financialYear,
        result.membershipStatus,
        result.paymentStatus
      ].map(
        KGMIS_TreasurerV3_NormalizeSearch_
      );

      if (
        searchableValues.some(
          function (value) {
            return value.includes(
              query
            );
          }
        )
      ) {
        results.push(
          result
        );
      }
    }
  );

  results.sort(
    KGMIS_TreasurerV3_CompareFamilies_
  );

  return results.slice(
    0,
    KGMIS_TREASURER_V3
      .MAX_SEARCH_RESULTS
  );
}


/*
 * ============================================================
 * PUBLIC — MEMBERSHIP / SUBSCRIPTION REPORT
 * ============================================================
 */

function KGMIS_TreasurerV3_GetSubscriptionReport(
  sessionToken,
  filters
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );

  const financialYear =
    KGMIS_GetCurrentFinancialYear();

  const safeFilters = {
    searchText:
      KGMIS_TreasurerV3_NormalizeSearch_(
        filters &&
        filters.searchText
      ),

    zone:
      KGMIS_TreasurerV3_Clean_(
        filters &&
        filters.zone
      ),

    subscriptionStatus:
      KGMIS_TreasurerV3_Clean_(
        filters &&
        filters.subscriptionStatus
      ).toUpperCase()
  };

  const masterContext =
    KGMIS_TreasurerV3_GetMasterContext_();

  const familyMap =
    KGMIS_TreasurerV3_BuildFamilyMap_(
      masterContext
    );

  const membershipMap =
    KGMIS_TreasurerV3_GetMembershipMap_(
      financialYear.financialYear
    );

  const rows = [];

  familyMap.forEach(
    function (family) {

      const membership =
        membershipMap.get(
          family.familyId
        ) || null;

      const row =
        KGMIS_TreasurerV3_CombineFamilyAndMembership_(
          family,
          membership,
          financialYear.financialYear
        );

      if (
        safeFilters.zone &&
        row.zone !== safeFilters.zone
      ) {
        return;
      }

      if (
        safeFilters.subscriptionStatus &&
        row.subscriptionStatus !==
          safeFilters.subscriptionStatus
      ) {
        return;
      }

      if (safeFilters.searchText) {

        const searchableValues = [
          row.familyId,
          row.kefgId,
          row.memberName,
          row.memberMobile,
          row.memberAlumniAssociation,
          row.memberBranch,
          row.memberBatchYear,
          row.spouseName,
          row.spouseMobile,
          row.spouseAlumniAssociation,
          row.spouseBranch,
          row.spouseBatchYear,
          row.zone,
          row.subscriptionStatus,
          row.paymentStatus,
          row.financialYear
        ].map(
          KGMIS_TreasurerV3_NormalizeSearch_
        );

        if (
          !searchableValues.some(
            function (value) {
              return value.includes(
                safeFilters.searchText
              );
            }
          )
        ) {
          return;
        }
      }

      rows.push(
        row
      );
    }
  );

  rows.sort(
    KGMIS_TreasurerV3_CompareFamilies_
  );

  return {
    financialYear:
      financialYear.financialYear,

    summary:
      KGMIS_TreasurerV3_BuildSummary_(
        rows,
        safeFilters.zone
      ),

    rows:
      rows
  };
}


/*
 * ============================================================
 * MASTER DATABASE CONTEXT
 * ============================================================
 */

function KGMIS_TreasurerV3_GetMasterContext_() {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    spreadsheet.getSheetByName(
      KGMIS_CONFIG.MASTER_SHEET
    );

  if (!sheet) {
    throw new Error(
      'KGMIS master database sheet was not found: ' +
      KGMIS_CONFIG.MASTER_SHEET
    );
  }

  const lastRow =
    sheet.getLastRow();

  const lastColumn =
    sheet.getLastColumn();

  if (
    lastRow <
      KGMIS_CONFIG.HEADER_ROW ||
    lastColumn < 1
  ) {
    throw new Error(
      'The KGMIS master database is empty.'
    );
  }

  const values =
    KGMIS_TreasurerV3_ReadValuesWithRetry_(
      sheet,
      KGMIS_CONFIG.HEADER_ROW,
      1,
      lastRow -
        KGMIS_CONFIG.HEADER_ROW +
        1,
      lastColumn
    );

  const headers =
    values[0].map(
      function (value) {
        return String(
          value || ''
        ).trim();
      }
    );

  const column = {};

  Object.entries(
    KGMIS_TREASURER_V3
      .MASTER_HEADERS
  ).forEach(
    function (entry) {

      const key =
        entry[0];

      const header =
        entry[1];

      const index =
        headers.indexOf(
          header
        );

      if (index === -1) {
        throw new Error(
          'Required Treasurer header was not found in ' +
          KGMIS_CONFIG.MASTER_SHEET +
          ': ' +
          header
        );
      }

      column[key] =
        index;
    }
  );

  return {
    spreadsheet:
      spreadsheet,

    sheet:
      sheet,

    headers:
      headers,

    column:
      column,

    values:
      values
  };
}


/*
 * ============================================================
 * BUILD ONE FAMILY RECORD PER FAMILY_ID
 * ============================================================
 */

function KGMIS_TreasurerV3_BuildFamilyMap_(
  context
) {

  const map =
    new Map();

  const column =
    context.column;

  for (
    let index = 1;
    index < context.values.length;
    index++
  ) {

    const row =
      context.values[index];

    const familyId =
      KGMIS_TreasurerV3_Clean_(
        row[
          column.FAMILY_ID
        ]
      ).toUpperCase();

    if (!familyId) {
      continue;
    }

    const recordStatus =
      KGMIS_TreasurerV3_Clean_(
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

    const candidate =
      KGMIS_TreasurerV3_CreateFamily_(
        row,
        column
      );

    if (!map.has(familyId)) {
      map.set(
        familyId,
        candidate
      );
      continue;
    }

    const current =
      map.get(
        familyId
      );

    const candidatePrimary =
      KGMIS_TreasurerV3_IsPrimary_(
        candidate.memberCategory
      );

    const currentPrimary =
      KGMIS_TreasurerV3_IsPrimary_(
        current.memberCategory
      );

    if (
      candidatePrimary &&
      !currentPrimary
    ) {
      map.set(
        familyId,
        candidate
      );
    }
  }

  return map;
}


function KGMIS_TreasurerV3_CreateFamily_(
  row,
  column
) {

  return {
    kefgId:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.KEFG_ID
        ]
      ).toUpperCase(),

    familyId:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.FAMILY_ID
        ]
      ).toUpperCase(),

    memberCategory:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.MEMBER_CATEGORY
        ]
      ),

    memberName:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.MEMBER_NAME
        ]
      ),

    memberMobile:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.MEMBER_MOBILE
        ]
      ),

    memberAlumniAssociation:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.ALUMNI_ASSOCIATION
        ]
      ),

    memberBranch:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.BRANCH
        ]
      ),

    memberBatchYear:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.YEAR_BATCH
        ]
      ),

    spouseName:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.SPOUSE_NAME
        ]
      ),

    spouseMobile:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.SPOUSE_MOBILE
        ]
      ),

    spouseAlumniAssociation:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.SPOUSE_ALUMNI_ASSOCIATION
        ]
      ),

    spouseBranch:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.SPOUSE_BRANCH
        ]
      ),

    spouseBatchYear:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.SPOUSE_BATCH_YEAR
        ]
      ),

    zone:
      KGMIS_TreasurerV3_Clean_(
        row[
          column.ZONE
        ]
      )
  };
}


/*
 * ============================================================
 * MEMBERSHIP YEAR MAP
 *
 * Reads KGMIS_MEMBERSHIP_YEAR through the existing
 * Membership Year Service context and object builder.
 *
 * No legacy master-database subscription columns are read.
 * ============================================================
 */

function KGMIS_TreasurerV3_GetMembershipMap_(
  financialYear
) {

  const context =
    KGMIS_GetMembershipYearContext_();

  const map =
    new Map();

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {

    const row =
      context.values[
        rowIndex
      ];

    const rowFinancialYear =
      KGMIS_MembershipYearCleanValue_(
        row[
          context.column.FINANCIAL_YEAR
        ]
      );

    const recordStatus =
      KGMIS_MembershipYearCleanValue_(
        row[
          context.column.RECORD_STATUS
        ]
      ).toUpperCase();

    if (
      rowFinancialYear !==
        financialYear ||
      recordStatus !== 'ACTIVE'
    ) {
      continue;
    }

    const membership =
      KGMIS_CreateMembershipYearObject_(
        row,
        context.column,
        rowIndex + 1
      );

    const familyId =
      KGMIS_TreasurerV3_Clean_(
        membership.familyId
      ).toUpperCase();

    if (!familyId) {
      continue;
    }

    if (map.has(familyId)) {
      throw new Error(
        'Multiple ACTIVE membership-year records were found for ' +
        familyId +
        ' and ' +
        financialYear +
        '.'
      );
    }

    map.set(
      familyId,
      membership
    );
  }

  return map;
}


/*
 * ============================================================
 * COMBINE FAMILY + MEMBERSHIP YEAR
 * ============================================================
 */

function KGMIS_TreasurerV3_CombineFamilyAndMembership_(
  family,
  membership,
  financialYear
) {

  const membershipStatus =
    membership
      ? KGMIS_TreasurerV3_Clean_(
          membership.membershipStatus
        ).toUpperCase()
      : '';

  const paymentStatus =
    membership
      ? KGMIS_TreasurerV3_Clean_(
          membership.paymentStatus
        ).toUpperCase()
      : '';

  const subscriptionStatus =
    paymentStatus === 'PAID'
      ? 'PAID'
      : 'PENDING';

  const lastPaymentDate =
    membership &&
    membership.lastPaymentDate
      ? membership.lastPaymentDate
      : null;

  return {
    kefgId:
      family.kefgId,

    familyId:
      family.familyId,

    memberName:
      family.memberName,

    memberMobile:
      family.memberMobile,

    memberAlumniAssociation:
      family.memberAlumniAssociation,

    memberBranch:
      family.memberBranch,

    memberBatchYear:
      family.memberBatchYear,

    spouseName:
      family.spouseName,

    spouseMobile:
      family.spouseMobile,

    spouseAlumniAssociation:
      family.spouseAlumniAssociation,

    spouseBranch:
      family.spouseBranch,

    spouseBatchYear:
      family.spouseBatchYear,

    zone:
      family.zone,

    financialYear:
      financialYear,

    membershipStatus:
      membershipStatus,

    paymentStatus:
      paymentStatus,

    subscriptionStatus:
      subscriptionStatus,

    membershipType:
      membership
        ? KGMIS_TreasurerV3_Clean_(
            membership.membershipType
          ).toUpperCase()
        : '',

    amountDue:
      membership
        ? Number(
            membership.amountDue || 0
          )
        : 0,

    amountReceived:
      membership
        ? Number(
            membership.amountReceived || 0
          )
        : 0,

    outstandingDues:
      membership
        ? Number(
            membership.outstandingDues || 0
          )
        : 0,

    paymentCount:
      membership
        ? Number(
            membership.paymentCount || 0
          )
        : 0,

    lastPaymentDateIso:
      KGMIS_TreasurerV3_DateIso_(
        lastPaymentDate
      ),

    lastPaymentDateDisplay:
      KGMIS_TreasurerV3_DateDisplay_(
        lastPaymentDate
      ),

    hasMembershipYearRecord:
      Boolean(
        membership
      )
  };
}


/*
 * ============================================================
 * SUMMARY
 * ============================================================
 */

function KGMIS_TreasurerV3_BuildSummary_(
  rows,
  selectedZone
) {

  const summary = {
    total: rows.length,
    paid: 0,
    pending: 0,
    lifetimeMember: 0,
    exempt: 0,
    zone:
      KGMIS_TreasurerV3_Clean_(
        selectedZone
      ) || 'ALL ZONES'
  };

  rows.forEach(
    function (row) {

      if (
        row.subscriptionStatus ===
        'PAID'
      ) {
        summary.paid++;
      }

      if (
        row.membershipStatus ===
        'LIFETIME MEMBER'
      ) {
        summary.lifetimeMember++;
      }

      if (
        row.membershipStatus ===
        'EXEMPT'
      ) {
        summary.exempt++;
      }
    }
  );

  summary.pending =
    Math.max(
      0,
      summary.total -
      summary.paid
    );

  return summary;
}


/*
 * ============================================================
 * UNIQUE ZONES
 * ============================================================
 */

function KGMIS_TreasurerV3_GetUniqueZones_(
  context
) {

  const zones =
    new Set();

  const column =
    context.column;

  for (
    let index = 1;
    index < context.values.length;
    index++
  ) {

    const zone =
      KGMIS_TreasurerV3_Clean_(
        context.values[index][
          column.ZONE
        ]
      );

    if (zone) {
      zones.add(zone);
    }
  }

  return Array.from(zones)
    .sort(
      function (a, b) {
        return a.localeCompare(
          b,
          undefined,
          {
            numeric: true,
            sensitivity: 'base'
          }
        );
      }
    );
}


/*
 * ============================================================
 * HELPERS
 * ============================================================
 */

function KGMIS_TreasurerV3_IsPrimary_(
  memberCategory
) {

  return (
    KGMIS_TreasurerV3_NormalizeSearch_(
      memberCategory
    ) ===
    'primary member'
  );
}


function KGMIS_TreasurerV3_CompareFamilies_(
  left,
  right
) {

  return String(
    left.familyId || ''
  ).localeCompare(
    String(
      right.familyId || ''
    ),
    undefined,
    {
      numeric: true,
      sensitivity: 'base'
    }
  );
}


function KGMIS_TreasurerV3_Clean_(
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


function KGMIS_TreasurerV3_NormalizeSearch_(
  value
) {

  return KGMIS_TreasurerV3_Clean_(
    value
  ).toLowerCase();
}


function KGMIS_TreasurerV3_DateIso_(
  value
) {

  if (
    !value ||
    Object.prototype
      .toString.call(value) !==
        '[object Date]' ||
    isNaN(
      value.getTime()
    )
  ) {
    return '';
  }

  return Utilities.formatDate(
    value,
    Session.getScriptTimeZone(),
    'yyyy-MM-dd'
  );
}


function KGMIS_TreasurerV3_DateDisplay_(
  value
) {

  if (
    !value ||
    Object.prototype
      .toString.call(value) !==
        '[object Date]' ||
    isNaN(
      value.getTime()
    )
  ) {
    return '';
  }

  return Utilities.formatDate(
    value,
    Session.getScriptTimeZone(),
    'dd-MMM-yyyy'
  );
}


/*
 * ============================================================
 * SPREADSHEET READ RETRY
 *
 * Same defensive approach used for the mobile-login registry.
 * ============================================================
 */

function KGMIS_TreasurerV3_ReadValuesWithRetry_(
  sheet,
  startRow,
  startColumn,
  numberOfRows,
  numberOfColumns
) {

  const maximumAttempts = 3;

  let lastError =
    null;

  for (
    let attempt = 1;
    attempt <= maximumAttempts;
    attempt++
  ) {

    try {

      return sheet
        .getRange(
          startRow,
          startColumn,
          numberOfRows,
          numberOfColumns
        )
        .getValues();

    } catch (error) {

      lastError =
        error;

      if (
        attempt <
        maximumAttempts
      ) {
        Utilities.sleep(
          attempt * 400
        );
      }
    }
  }

  throw lastError;
}



/*
 * ============================================================
 * FINANCIAL YEAR SETUP — VERSION 3.2
 * ============================================================
 *
 * Lifecycle:
 *   UPCOMING -> CURRENT -> CLOSED / ARCHIVED
 *
 * The automatic rollover is enforced whenever Treasurer
 * configuration / Financial Year Setup is read. Therefore the
 * first KGMIS access on or after the new START_DATE promotes the
 * due UPCOMING year to CURRENT and closes the previous CURRENT
 * year. No manual 01-Jun rollover is required.
 * ============================================================
 */

function KGMIS_TreasurerV3_GetFinancialYearSetup(
  sessionToken,
  selectedFinancialYear
) {

  const user =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'TREASURER',
      'VIEW'
    );

  KGMIS_TreasurerV3_EnsureFinancialYearRollover_(
    user
  );

  return KGMIS_TreasurerV3_BuildFinancialYearSetup_(
    user,
    selectedFinancialYear
  );
}


function KGMIS_TreasurerV3_UpdateFinancialYearSettings(
  sessionToken,
  payload
) {

  const user =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'TREASURER',
      'VIEW'
    );

  KGMIS_TreasurerV3_RequireFinancialYearEditor_(
    user
  );

  KGMIS_TreasurerV3_EnsureFinancialYearRollover_(
    user
  );

  const financialYear =
    KGMIS_TreasurerV3_Clean_(
      payload &&
      payload.financialYear
    );

  if (!financialYear) {
    throw new Error(
      'Select a Financial Year before saving settings.'
    );
  }

  const records =
    KGMIS_TreasurerV3_GetFinancialYearRecords_();

  const selected =
    records.find(
      function (record) {
        return record.financialYear === financialYear;
      }
    );

  if (!selected) {
    throw new Error(
      'Financial year ' +
      financialYear +
      ' was not found.'
    );
  }

  if (
    ![
      'CURRENT',
      'UPCOMING'
    ].includes(
      selected.status
    )
  ) {
    throw new Error(
      financialYear +
      ' is ' +
      (selected.status || 'historical') +
      ' and is view-only.'
    );
  }

  const feeText =
    KGMIS_TreasurerV3_Clean_(
      payload &&
      payload.membershipFee
    );

  const fee =
    Number(
      feeText
    );

  if (
    !feeText ||
    !Number.isFinite(fee) ||
    fee < 0
  ) {
    throw new Error(
      'Enter a valid Membership Fee.'
    );
  }

  const graceText =
    KGMIS_TreasurerV3_Clean_(
      payload &&
      payload.gracePeriodEnd
    );

  let graceDate = '';

  if (graceText) {
    graceDate =
      new Date(
        graceText + 'T00:00:00'
      );

    if (
      isNaN(
        graceDate.getTime()
      )
    ) {
      throw new Error(
        'Grace Period End is invalid.'
      );
    }
  }

  const cardVersion =
    KGMIS_TreasurerV3_Clean_(
      payload &&
      payload.cardVersion
    );

  if (!cardVersion) {
    throw new Error(
      'Digital ID Version is required.'
    );
  }

  if (cardVersion.length > 20) {
    throw new Error(
      'Digital ID Version must not exceed 20 characters.'
    );
  }

  const paymentOpen =
    KGMIS_TreasurerV3_NormalizePaymentOpen_(
      payload &&
      payload.paymentOpen
    );

  const context =
    KGMIS_GetFinancialYearContext_();

  const cardVersionColumn =
    context.headers.indexOf(
      'CARD_VERSION'
    );

  if (cardVersionColumn === -1) {
    throw new Error(
      'CARD_VERSION column was not found in the Financial Year sheet.'
    );
  }

  const now =
    new Date();

  const email =
    KGMIS_TreasurerV3_Clean_(
      user.email
    );

  context.sheet
    .getRange(
      selected.sheetRow,
      context.column.MEMBERSHIP_FEE + 1
    )
    .setValue(fee);

  /*
   * KGMIS policy:
   * KEF Global has one membership type only — FAMILY.
   * This value is system-controlled and is never accepted
   * from the client.
   */
  context.sheet
    .getRange(
      selected.sheetRow,
      context.column.MEMBERSHIP_TYPE + 1
    )
    .setValue('FAMILY');

  context.sheet
    .getRange(
      selected.sheetRow,
      context.column.GRACE_PERIOD_END + 1
    )
    .setValue(graceDate);

  context.sheet
    .getRange(
      selected.sheetRow,
      cardVersionColumn + 1
    )
    .setValue(cardVersion);

  context.sheet
    .getRange(
      selected.sheetRow,
      context.column.PAYMENT_OPEN + 1
    )
    .setValue(paymentOpen);

  context.sheet
    .getRange(
      selected.sheetRow,
      context.column.UPDATED_ON + 1
    )
    .setValue(now);

  context.sheet
    .getRange(
      selected.sheetRow,
      context.column.UPDATED_BY + 1
    )
    .setValue(email);

  SpreadsheetApp.flush();

  return KGMIS_TreasurerV3_BuildFinancialYearSetup_(
    user,
    financialYear
  );
}


function KGMIS_TreasurerV3_CreateNextFinancialYear(
  sessionToken
) {

  const user =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'TREASURER',
      'VIEW'
    );

  KGMIS_TreasurerV3_RequireFinancialYearEditor_(
    user
  );

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {

    KGMIS_TreasurerV3_EnsureFinancialYearRollover_(
      user
    );

    const setup =
      KGMIS_TreasurerV3_BuildFinancialYearSetup_(
        user,
        ''
      );

    if (!setup.canCreateNextYear) {
      throw new Error(
        setup.createMessage ||
        'The next financial year cannot be created now.'
      );
    }

    const current =
      setup.current;

    if (!current || !current.financialYear) {
      throw new Error(
        'A CURRENT financial year was not found.'
      );
    }

    const records =
      KGMIS_TreasurerV3_GetFinancialYearRecords_();

    const currentRecord =
      records.find(
        function (record) {
          return record.financialYear === current.financialYear;
        }
      );

    if (!currentRecord) {
      throw new Error(
        'The CURRENT financial-year record could not be read.'
      );
    }

    const context =
      KGMIS_GetFinancialYearContext_();

    const headers =
      context.headers;

    const nextStart =
      KGMIS_TreasurerV3_AddDays_(
        currentRecord.endDate,
        1
      );

    const nextEnd =
      new Date(
        nextStart.getFullYear() + 1,
        nextStart.getMonth(),
        nextStart.getDate() - 1
      );

    const nextYear =
      KGMIS_TreasurerV3_FormatFinancialYear_(
        nextStart,
        nextEnd
      );

    const existing =
      records.some(
        function (record) {
          return record.financialYear === nextYear;
        }
      );

    if (existing) {
      throw new Error(
        'Financial year ' +
        nextYear +
        ' already exists.'
      );
    }

    const now =
      new Date();

    const email =
      KGMIS_TreasurerV3_Clean_(
        user.email
      );

    const rowValues =
      new Array(
        headers.length
      ).fill('');

    const put =
      function (header, value) {
        const index =
          headers.indexOf(header);

        if (index !== -1) {
          rowValues[index] =
            value;
        }
      };

    put(
      'FINANCIAL_YEAR',
      nextYear
    );

    put(
      'START_DATE',
      nextStart
    );

    put(
      'END_DATE',
      nextEnd
    );

    put(
      'MEMBERSHIP_FEE',
      currentRecord.membershipFee
    );

    put(
      'MEMBERSHIP_TYPE',
      'FAMILY'
    );

    put(
      'GRACE_PERIOD_END',
      ''
    );

    put(
      'STATUS',
      'UPCOMING'
    );

    put(
      'RECEIPT_PREFIX',
      'KEFG/' +
      nextYear +
      '/'
    );

    put(
      'LAST_RECEIPT_NO',
      0
    );

    put(
      'PAYMENT_OPEN',
      'YES'
    );

    put(
      'REMARKS',
      'Upcoming financial year created on ' +
      Utilities.formatDate(
        now,
        Session.getScriptTimeZone(),
        'dd-MMM-yyyy'
      ) +
      '. It will become CURRENT automatically on ' +
      KGMIS_TreasurerV3_DateDisplay_(
        nextStart
      ) +
      '.'
    );

    put(
      'CREATED_ON',
      now
    );

    put(
      'UPDATED_ON',
      now
    );

    put(
      'UPDATED_BY',
      email
    );

    put(
      'PAYMENT_VOUCHER_PREFIX',
      'KEFG-PV/' +
      nextYear +
      '/'
    );

    put(
      'LAST_PAYMENT_VOUCHER_NO',
      0
    );

    put(
      'CARD_VERSION',
      currentRecord.cardVersion ||
      '1.0'
    );

    context.sheet.appendRow(
      rowValues
    );

    SpreadsheetApp.flush();

    return {
      success: true,
      financialYear:
        nextYear,
      status:
        'UPCOMING',
      activationDate:
        KGMIS_TreasurerV3_DateDisplay_(
          nextStart
        ),
      message:
        'Financial year ' +
        nextYear +
        ' created as UPCOMING. The current financial year remains open until ' +
        KGMIS_TreasurerV3_DateDisplay_(
          nextStart
        ) +
        '.'
    };

  } finally {
    lock.releaseLock();
  }
}


function KGMIS_TreasurerV3_BuildFinancialYearSetup_(
  user,
  selectedFinancialYear
) {

  const records =
    KGMIS_TreasurerV3_GetFinancialYearRecords_();

  if (!records.length) {
    throw new Error(
      'No Financial Year records were found.'
    );
  }

  const current =
    records.find(
      function (record) {
        return record.status === 'CURRENT';
      }
    ) || null;

  const requested =
    KGMIS_TreasurerV3_Clean_(
      selectedFinancialYear
    );

  let selected =
    requested
      ? records.find(
          function (record) {
            return record.financialYear === requested;
          }
        )
      : null;

  if (!selected) {
    selected =
      current ||
      records
        .slice()
        .sort(
          KGMIS_TreasurerV3_CompareFinancialYearRecordsDesc_
        )[0];
  }

  const orderedYears =
    records
      .slice()
      .sort(
        KGMIS_TreasurerV3_CompareFinancialYearRecordsDesc_
      );

  const canEditRole =
    KGMIS_TreasurerV3_CanEditFinancialYear_(
      user
    );

  const canEditSelected =
    canEditRole &&
    [
      'CURRENT',
      'UPCOMING'
    ].includes(
      selected.status
    );

  let nextYear = '';
  let nextStart = null;
  let exists = false;
  let existingNext = null;

  if (
    current &&
    current.endDate instanceof Date &&
    !isNaN(
      current.endDate.getTime()
    )
  ) {
    nextStart =
      KGMIS_TreasurerV3_AddDays_(
        current.endDate,
        1
      );

    const nextEnd =
      new Date(
        nextStart.getFullYear() + 1,
        nextStart.getMonth(),
        nextStart.getDate() - 1
      );

    nextYear =
      KGMIS_TreasurerV3_FormatFinancialYear_(
        nextStart,
        nextEnd
      );

    existingNext =
      records.find(
        function (record) {
          return record.financialYear === nextYear;
        }
      ) || null;

    exists =
      Boolean(
        existingNext
      );
  }

  const canCreate =
    Boolean(
      canEditRole &&
      current &&
      nextYear &&
      !exists
    );

  let createMessage = '';

  if (!current) {
    createMessage =
      'A CURRENT financial year is required before the next year can be created.';

  } else if (exists) {
    createMessage =
      nextYear +
      ' already exists with status ' +
      (existingNext.status || '—') +
      '. Select it from the Financial Year list to view or edit it.';

  } else if (!canEditRole) {
    createMessage =
      'You have view-only access to financial-year settings.';

  } else {
    createMessage =
      nextYear +
      ' can be created now as UPCOMING. It will become CURRENT automatically on ' +
      KGMIS_TreasurerV3_DateDisplay_(
        nextStart
      ) +
      '.';
  }

  return {
    current:
      current
        ? KGMIS_TreasurerV3_PublicFinancialYearRecord_(
            current
          )
        : null,

    selected:
      KGMIS_TreasurerV3_PublicFinancialYearRecord_(
        selected
      ),

    financialYears:
      orderedYears.map(
        function (record) {
          return {
            financialYear:
              record.financialYear,
            status:
              record.status
          };
        }
      ),

    selectedFinancialYear:
      selected.financialYear,

    nextFinancialYear:
      nextYear,

    canCreateNextYear:
      canCreate,

    canEditSettings:
      canEditSelected,

    statusMessage:
      'Selected financial year: ' +
      selected.financialYear +
      ' (' +
      (selected.status || '—') +
      ')' +
      (
        canEditSelected
          ? ' — settings are editable.'
          : ' — view-only.'
      ),

    createMessage:
      createMessage
  };
}


function KGMIS_TreasurerV3_GetFinancialYearRecords_() {

  const context =
    KGMIS_GetFinancialYearContext_();

  const headers =
    context.headers;

  const indexOf =
    function (header) {
      return headers.indexOf(header);
    };

  const get =
    function (row, header) {
      const index =
        indexOf(header);

      return index === -1
        ? ''
        : row[index];
    };

  const records = [];

  for (
    let index = 1;
    index < context.values.length;
    index++
  ) {

    const row =
      context.values[index];

    const financialYear =
      KGMIS_TreasurerV3_Clean_(
        get(
          row,
          'FINANCIAL_YEAR'
        )
      );

    if (!financialYear) {
      continue;
    }

    const startDate =
      KGMIS_TreasurerV3_ToDate_(
        get(
          row,
          'START_DATE'
        )
      );

    const endDate =
      KGMIS_TreasurerV3_ToDate_(
        get(
          row,
          'END_DATE'
        )
      );

    const gracePeriodEnd =
      KGMIS_TreasurerV3_ToDate_(
        get(
          row,
          'GRACE_PERIOD_END'
        )
      );

    const updatedOn =
      KGMIS_TreasurerV3_ToDate_(
        get(
          row,
          'UPDATED_ON'
        )
      );

    records.push({
      sheetRow:
        index + 1,

      financialYear:
        financialYear,

      startDate:
        startDate,

      endDate:
        endDate,

      membershipFee:
        Number(
          get(
            row,
            'MEMBERSHIP_FEE'
          ) || 0
        ),

      membershipType:
        'FAMILY',

      gracePeriodEnd:
        gracePeriodEnd,

      status:
        KGMIS_TreasurerV3_Clean_(
          get(
            row,
            'STATUS'
          )
        ).toUpperCase(),

      receiptPrefix:
        KGMIS_TreasurerV3_Clean_(
          get(
            row,
            'RECEIPT_PREFIX'
          )
        ),

      lastReceiptNo:
        Number(
          get(
            row,
            'LAST_RECEIPT_NO'
          ) || 0
        ),

      paymentOpen:
        KGMIS_TreasurerV3_IsPaymentOpen_(
          get(
            row,
            'PAYMENT_OPEN'
          )
        ),

      paymentVoucherPrefix:
        KGMIS_TreasurerV3_Clean_(
          get(
            row,
            'PAYMENT_VOUCHER_PREFIX'
          )
        ),

      lastPaymentVoucherNo:
        Number(
          get(
            row,
            'LAST_PAYMENT_VOUCHER_NO'
          ) || 0
        ),

      cardVersion:
        KGMIS_TreasurerV3_Clean_(
          get(
            row,
            'CARD_VERSION'
          )
        ),

      updatedOn:
        updatedOn,

      updatedBy:
        KGMIS_TreasurerV3_Clean_(
          get(
            row,
            'UPDATED_BY'
          )
        )
    });
  }

  return records;
}


function KGMIS_TreasurerV3_PublicFinancialYearRecord_(
  record
) {

  return {
    financialYear:
      record.financialYear,

    startDateDisplay:
      KGMIS_TreasurerV3_DateDisplay_(
        record.startDate
      ),

    endDateDisplay:
      KGMIS_TreasurerV3_DateDisplay_(
        record.endDate
      ),

    membershipFee:
      record.membershipFee,

    membershipType:
      'FAMILY',

    gracePeriodEndIso:
      KGMIS_TreasurerV3_DateIso_(
        record.gracePeriodEnd
      ),

    status:
      record.status,

    receiptPrefix:
      record.receiptPrefix,

    lastReceiptNo:
      record.lastReceiptNo,

    paymentOpen:
      record.paymentOpen,

    paymentVoucherPrefix:
      record.paymentVoucherPrefix,

    lastPaymentVoucherNo:
      record.lastPaymentVoucherNo,

    cardVersion:
      record.cardVersion,

    updatedOnDisplay:
      KGMIS_TreasurerV3_DateDisplay_(
        record.updatedOn
      ),

    updatedBy:
      record.updatedBy
  };
}


function KGMIS_TreasurerV3_EnsureFinancialYearRollover_(
  user
) {

  const lock =
    LockService.getScriptLock();

  const hasLock =
    lock.tryLock(5000);

  if (!hasLock) {
    return;
  }

  try {

    const records =
      KGMIS_TreasurerV3_GetFinancialYearRecords_();

    const today =
      new Date();

    today.setHours(
      0,
      0,
      0,
      0
    );

    const dueUpcoming =
      records
        .filter(
          function (record) {
            if (
              record.status !== 'UPCOMING' ||
              !(record.startDate instanceof Date) ||
              isNaN(
                record.startDate.getTime()
              )
            ) {
              return false;
            }

            const start =
              new Date(
                record.startDate.getTime()
              );

            start.setHours(
              0,
              0,
              0,
              0
            );

            return start.getTime() <= today.getTime();
          }
        )
        .sort(
          function (a, b) {
            return a.startDate - b.startDate;
          }
        );

    if (!dueUpcoming.length) {
      return;
    }

    const target =
      dueUpcoming[
        dueUpcoming.length - 1
      ];

    const context =
      KGMIS_GetFinancialYearContext_();

    const now =
      new Date();

    const updatedBy =
      KGMIS_TreasurerV3_Clean_(
        user &&
        user.email
      ) ||
      'SYSTEM';

    records.forEach(
      function (record) {

        if (
          record.sheetRow === target.sheetRow
        ) {
          return;
        }

        if (
          record.status === 'CURRENT' ||
          (
            record.status === 'UPCOMING' &&
            record.startDate instanceof Date &&
            record.startDate.getTime() <
              target.startDate.getTime()
          )
        ) {
          context.sheet
            .getRange(
              record.sheetRow,
              context.column.STATUS + 1
            )
            .setValue('CLOSED');

          context.sheet
            .getRange(
              record.sheetRow,
              context.column.PAYMENT_OPEN + 1
            )
            .setValue('CLOSED');

          context.sheet
            .getRange(
              record.sheetRow,
              context.column.UPDATED_ON + 1
            )
            .setValue(now);

          context.sheet
            .getRange(
              record.sheetRow,
              context.column.UPDATED_BY + 1
            )
            .setValue(updatedBy);
        }
      }
    );

    context.sheet
      .getRange(
        target.sheetRow,
        context.column.STATUS + 1
      )
      .setValue('CURRENT');

    context.sheet
      .getRange(
        target.sheetRow,
        context.column.UPDATED_ON + 1
      )
      .setValue(now);

    context.sheet
      .getRange(
        target.sheetRow,
        context.column.UPDATED_BY + 1
      )
      .setValue(updatedBy);

    SpreadsheetApp.flush();

  } finally {
    lock.releaseLock();
  }
}


function KGMIS_TreasurerV3_IsPaymentOpen_(
  value
) {

  const text =
    KGMIS_TreasurerV3_Clean_(
      value
    ).toUpperCase();

  return [
    'YES',
    'OPEN',
    'TRUE',
    '1'
  ].includes(text);
}


function KGMIS_TreasurerV3_NormalizePaymentOpen_(
  value
) {

  const text =
    KGMIS_TreasurerV3_Clean_(
      value
    ).toUpperCase();

  if (
    [
      'YES',
      'OPEN',
      'TRUE',
      '1'
    ].includes(text)
  ) {
    return 'YES';
  }

  if (
    [
      'NO',
      'CLOSED',
      'FALSE',
      '0'
    ].includes(text)
  ) {
    return 'CLOSED';
  }

  throw new Error(
    'Payment Open must be YES or CLOSED.'
  );
}


function KGMIS_TreasurerV3_ToDate_(
  value
) {

  if (
    value instanceof Date &&
    !isNaN(
      value.getTime()
    )
  ) {
    return new Date(
      value.getTime()
    );
  }

  const text =
    KGMIS_TreasurerV3_Clean_(
      value
    );

  if (!text) {
    return null;
  }

  const date =
    new Date(text);

  return isNaN(
    date.getTime()
  )
    ? null
    : date;
}


function KGMIS_TreasurerV3_CompareFinancialYearRecordsDesc_(
  left,
  right
) {

  const leftTime =
    left.startDate instanceof Date
      ? left.startDate.getTime()
      : 0;

  const rightTime =
    right.startDate instanceof Date
      ? right.startDate.getTime()
      : 0;

  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return String(
    right.financialYear || ''
  ).localeCompare(
    String(
      left.financialYear || ''
    )
  );
}


function KGMIS_TreasurerV3_CanEditFinancialYear_(
  user
) {

  const role =
    KGMIS_TreasurerV3_Clean_(
      user &&
      user.role
    ).toUpperCase();

  return [
    'TREASURER',
    'ADMIN',
    'SUPER_ADMIN'
  ].includes(role);
}


function KGMIS_TreasurerV3_RequireFinancialYearEditor_(
  user
) {

  if (
    !KGMIS_TreasurerV3_CanEditFinancialYear_(
      user
    )
  ) {
    throw new Error(
      'Only the Treasurer, Admin or Super Admin can update financial-year settings.'
    );
  }
}


function KGMIS_TreasurerV3_AddDays_(
  dateValue,
  days
) {

  const date =
    new Date(
      dateValue.getTime()
    );

  date.setDate(
    date.getDate() +
    days
  );

  return date;
}


function KGMIS_TreasurerV3_FormatFinancialYear_(
  startDate,
  endDate
) {

  return (
    String(
      startDate.getFullYear()
    ) +
    '-' +
    String(
      endDate.getFullYear()
    ).slice(-2)
  );
}
