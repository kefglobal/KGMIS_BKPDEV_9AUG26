/******************************************************************************
 *
 * KEFG Membership Information System (KMIS)
 *
 * Module        : Treasurer Business Service
 * File          : 30_Treasurer.gs
 * Version       : 2.0
 * Status        : Development
 *
 * Purpose:
 * - Apply Treasurer-specific business rules
 * - Search subscription records
 * - Generate dashboard and reports
 * - Update subscription status and payment date
 * - Keep the UI separate from database operations
 *
 ******************************************************************************/

const KMIS_TR_CONFIG = Object.freeze({

  MODULE_NAME: 'Treasurer Module',

  SUBSCRIPTION_YEAR: '2026-2027',

  STATUS_HEADER:
    'SUBSCRIPTION_STATUS_2026_2027',

  PAYMENT_DATE_HEADER:
    'SUBSCRIPTION_PAYMENT_DATE_2026_2027',

  ALLOWED_STATUSES: Object.freeze([
    KMIS_CONSTANTS.SUBSCRIPTION_STATUS.PAID,
    KMIS_CONSTANTS.SUBSCRIPTION_STATUS.NOT_PAID,
    KMIS_CONSTANTS.SUBSCRIPTION_STATUS.PENDING,
    KMIS_CONSTANTS.SUBSCRIPTION_STATUS.EXEMPTED
  ]),

  REPORT_LIMIT:
    KMIS_CONSTANTS.SYSTEM_LIMITS.MAX_REPORT_ROWS
});


/**
 * Returns Treasurer Module configuration and current-user access.
 *
 * Intended for portal initialization.
 */
function KMIS_TR_GetConfiguration() {
  KMIS_RequireTreasurerViewAccess_();

  const access =
    KMIS_GetCurrentUserAccess();

  const families =
    KMIS_SEARCH_ListFamilies({});

  return {
    success: true,

    module: {
      name: KMIS_TR_CONFIG.MODULE_NAME,
      subscriptionYear:
        KMIS_TR_CONFIG.SUBSCRIPTION_YEAR
    },

    user: access,

    statusOptions: [
      ...KMIS_TR_CONFIG.ALLOWED_STATUSES
    ],

    zones:
      KMIS_TR_GetUniqueZones_(families),

    dashboard:
      KMIS_TR_CreateDashboardSummary_(
        families
      )
  };
}


/**
 * Searches family subscription records.
 *
 * Search supports:
 * - FAMILY_ID
 * - ZONE
 * - MEMBER_NAME
 * - SPOUSE_NAME
 * - MEMBER_MOBILE
 * - SPOUSE_MOBILE
 * - Alumni association
 * - Branch
 * - Batch/year
 */
function KMIS_TR_SearchFamilies(
  searchText,
  options
) {
  KMIS_RequireTreasurerViewAccess_();

  const safeOptions = options || {};

  const results =
    KMIS_SEARCH_Families(
      searchText,
      {
        maxResults:
          Number(safeOptions.maxResults) ||
          KMIS_CONSTANTS.SYSTEM_LIMITS
            .MAX_SEARCH_RESULTS
      }
    );

  return {
    success: true,
    count: results.length,

    rows: results.map(
      KMIS_TR_ToSubscriptionRecord_
    )
  };
}


/**
 * Returns the Treasurer subscription report.
 *
 * Supported filters:
 * {
 *   searchText,
 *   zone,
 *   status
 * }
 *
 * Dashboard summary always represents all families.
 * Filters affect only the displayed report rows.
 */
function KMIS_TR_GetSubscriptionReport(
  filters
) {
  KMIS_RequireTreasurerViewAccess_();

  const safeFilters = filters || {};

  const allFamilies =
    KMIS_SEARCH_ListFamilies({});

  const overallSummary =
    KMIS_TR_CreateDashboardSummary_(
      allFamilies
    );

  const filteredFamilies =
    allFamilies.filter(family =>
      KMIS_TR_MatchesReportFilters_(
        family,
        safeFilters
      )
    );

  filteredFamilies.sort(
    KMIS_SEARCH_CompareFamilies_
  );

  const limitedRows =
    filteredFamilies.slice(
      0,
      KMIS_TR_CONFIG.REPORT_LIMIT
    );

  return {
    success: true,

    summary: overallSummary,

    filteredCount:
      filteredFamilies.length,

    returnedCount:
      limitedRows.length,

    rows:
      limitedRows.map(
        KMIS_TR_ToSubscriptionRecord_
      )
  };
}


/**
 * Updates subscription status and payment date.
 *
 * Business rules:
 * - Only Treasurer/Admin/Super Admin may update
 * - Blank status is interpreted as NOT PAID
 * - Payment date is mandatory for PAID
 * - Updates all KMIS rows carrying the FAMILY_ID
 */
function KMIS_TR_UpdateSubscription(
  familyId,
  status,
  paymentDateIso
) {
  const user =
    KMIS_RequireSubscriptionWriteAccess_();

  const safeFamilyId =
    KMIS_DB_Clean_(familyId);

  if (!safeFamilyId) {
    throw new Error(
      'FAMILY_ID is required.'
    );
  }

  const safeStatus =
    KMIS_TR_GetEffectiveStatus_(status);

  if (
    !KMIS_TR_CONFIG
      .ALLOWED_STATUSES
      .includes(safeStatus)
  ) {
    throw new Error(
      `Invalid subscription status: ${safeStatus}`
    );
  }

  const safePaymentDate =
    KMIS_DB_Clean_(paymentDateIso);

  if (
    safeStatus ===
      KMIS_CONSTANTS
        .SUBSCRIPTION_STATUS
        .PAID &&
    !safePaymentDate
  ) {
    throw new Error(
      'Payment date is required when the subscription status is PAID.'
    );
  }

  /*
   * Confirm the family exists before attempting the update.
   */
  const familyRecords =
    KMIS_DB_GetFamilyByFamilyID(
      safeFamilyId
    );

  if (!familyRecords.length) {
    throw new Error(
      `No KMIS family was found for ${safeFamilyId}.`
    );
  }

  const updateResult =
    KMIS_UPDATE_Subscription(
      safeFamilyId,
      safeStatus,
      safePaymentDate
    );

  return {
    success: true,

    message:
      updateResult.message,

    data: {
      familyId:
        safeFamilyId,

      status:
        safeStatus,

      paymentDate:
        safePaymentDate,

      rowsUpdated:
        updateResult.rowsUpdated,

      updatedBy:
        user.email
    }
  };
}


/**
 * Returns dashboard totals for the complete KMIS database.
 */
function KMIS_TR_GetDashboard() {
  KMIS_RequireTreasurerViewAccess_();

  const families =
    KMIS_SEARCH_ListFamilies({});

  return {
    success: true,
    summary:
      KMIS_TR_CreateDashboardSummary_(
        families
      )
  };
}


/**
 * Returns one family subscription record.
 */
function KMIS_TR_GetFamilySubscription(
  familyId
) {
  KMIS_RequireTreasurerViewAccess_();

  const safeFamilyId =
    KMIS_DB_Clean_(familyId);

  if (!safeFamilyId) {
    throw new Error(
      'FAMILY_ID is required.'
    );
  }

  const familyRecords =
    KMIS_DB_GetFamilyByFamilyID(
      safeFamilyId
    );

  if (!familyRecords.length) {
    return {
      success: false,
      message:
        `No KMIS family was found for ${safeFamilyId}.`,
      data: null
    };
  }

  const selectedRecord =
    KMIS_TR_SelectPrimaryFamilyRecord_(
      familyRecords
    );

  return {
    success: true,
    data:
      KMIS_TR_ToSubscriptionRecord_(
        selectedRecord
      )
  };
}


/**
 * Applies report filters.
 */
function KMIS_TR_MatchesReportFilters_(
  family,
  filters
) {
  const zoneFilter =
    KMIS_TR_Normalize_(
      filters.zone
    );

  const statusFilter =
    KMIS_TR_Normalize_(
      filters.status
    );

  const searchFilter =
    KMIS_TR_Normalize_(
      filters.searchText
    );

  if (
    zoneFilter &&
    KMIS_TR_Normalize_(
      family.ZONE
    ) !== zoneFilter
  ) {
    return false;
  }

  const effectiveStatus =
    KMIS_TR_GetEffectiveStatus_(
      family[
        KMIS_TR_CONFIG.STATUS_HEADER
      ]
    );

  if (
    statusFilter &&
    KMIS_TR_Normalize_(
      effectiveStatus
    ) !== statusFilter
  ) {
    return false;
  }

  if (searchFilter) {
    const searchableValues = [
      family.FAMILY_ID,
      family.ZONE,

      family.MEMBER_NAME,
      family.MEMBER_MOBILE,
      family.ALUMNI_ASSOCIATION,
      family.BRANCH,
      family.YEAR_BATCH,

      family.SPOUSE_NAME,
      family.SPOUSE_MOBILE,
      family.SPOUSE_ALUMNI_ASSOCIATION,
      family.SPOUSE_BRANCH,
      family.SPOUSE_BATCH_YEAR
    ].map(KMIS_TR_Normalize_);

    const matched =
      searchableValues.some(
        value =>
          value.includes(searchFilter)
      );

    if (!matched) {
      return false;
    }
  }

  return true;
}


/**
 * Creates complete dashboard totals.
 *
 * Blank status is counted as NOT PAID.
 */
function KMIS_TR_CreateDashboardSummary_(
  families
) {
  const summary = {
    totalFamilies:
      families.length,

    paid: 0,

    notPaid: 0,

    pending: 0,

    exempted: 0
  };

  families.forEach(family => {
    const status =
      KMIS_TR_GetEffectiveStatus_(
        family[
          KMIS_TR_CONFIG.STATUS_HEADER
        ]
      );

    switch (status) {
      case KMIS_CONSTANTS
        .SUBSCRIPTION_STATUS
        .PAID:

        summary.paid++;
        break;


      case KMIS_CONSTANTS
        .SUBSCRIPTION_STATUS
        .PENDING:

        summary.pending++;
        break;


      case KMIS_CONSTANTS
        .SUBSCRIPTION_STATUS
        .EXEMPTED:

        summary.exempted++;
        break;


      case KMIS_CONSTANTS
        .SUBSCRIPTION_STATUS
        .NOT_PAID:

      default:
        summary.notPaid++;
    }
  });

  return summary;
}


/**
 * Converts a KMIS family record to the standard Treasurer response format.
 */
function KMIS_TR_ToSubscriptionRecord_(
  family
) {
  const status =
    KMIS_TR_GetEffectiveStatus_(
      family[
        KMIS_TR_CONFIG.STATUS_HEADER
      ]
    );

  const paymentDate =
    family[
      KMIS_TR_CONFIG.PAYMENT_DATE_HEADER
    ];

  return {
    familyId:
      KMIS_DB_Clean_(
        family.FAMILY_ID
      ),

    zone:
      KMIS_DB_Clean_(
        family.ZONE
      ),

    memberName:
      KMIS_DB_Clean_(
        family.MEMBER_NAME
      ),

    memberMobile:
      KMIS_DB_Clean_(
        family.MEMBER_MOBILE
      ),

    memberAlumniAssociation:
      KMIS_DB_Clean_(
        family.ALUMNI_ASSOCIATION
      ),

    memberBranch:
      KMIS_DB_Clean_(
        family.BRANCH
      ),

    memberBatchYear:
      KMIS_DB_Clean_(
        family.YEAR_BATCH
      ),

    spouseName:
      KMIS_DB_Clean_(
        family.SPOUSE_NAME
      ),

    spouseMobile:
      KMIS_DB_Clean_(
        family.SPOUSE_MOBILE
      ),

    spouseAlumniAssociation:
      KMIS_DB_Clean_(
        family
          .SPOUSE_ALUMNI_ASSOCIATION
      ),

    spouseBranch:
      KMIS_DB_Clean_(
        family.SPOUSE_BRANCH
      ),

    spouseBatchYear:
      KMIS_DB_Clean_(
        family.SPOUSE_BATCH_YEAR
      ),

    subscriptionStatus:
      status,

    paymentDateIso:
      KMIS_TR_FormatDate_(
        paymentDate,
        KMIS_CONSTANTS
          .DATE_FORMATS
          .HTML_DATE
      ),

    paymentDateDisplay:
      KMIS_TR_FormatDate_(
        paymentDate,
        KMIS_CONSTANTS
          .DATE_FORMATS
          .SHEET_DATE
      ),

    recordStatus:
      KMIS_DB_Clean_(
        family.RECORD_STATUS
      ),

    memberCategory:
      KMIS_DB_Clean_(
        family.MEMBER_CATEGORY
      )
  };
}


/**
 * Selects the Primary Member record where available.
 */
function KMIS_TR_SelectPrimaryFamilyRecord_(
  records
) {
  const primaryRecord =
    records.find(record =>
      KMIS_TR_Normalize_(
        record.MEMBER_CATEGORY
      ) === 'primary member'
    );

  return primaryRecord || records[0];
}


/**
 * Blank status means NOT PAID.
 */
function KMIS_TR_GetEffectiveStatus_(
  status
) {
  const cleaned =
    KMIS_DB_Clean_(status)
      .toUpperCase();

  return (
    cleaned ||
    KMIS_CONSTANTS
      .SUBSCRIPTION_STATUS
      .NOT_PAID
  );
}


/**
 * Returns sorted unique Zone values.
 */
function KMIS_TR_GetUniqueZones_(
  families
) {
  const zones = new Set();

  families.forEach(family => {
    const zone =
      KMIS_DB_Clean_(
        family.ZONE
      );

    if (zone) {
      zones.add(zone);
    }
  });

  return Array.from(zones)
    .sort(
      (a, b) =>
        a.localeCompare(
          b,
          undefined,
          {
            numeric: true,
            sensitivity: 'base'
          }
        )
    );
}


/**
 * Formats a date value safely.
 */
function KMIS_TR_FormatDate_(
  value,
  format
) {
  if (!value) {
    return '';
  }

  let date = null;

  if (
    Object.prototype.toString.call(
      value
    ) === '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    date = value;
  } else {
    const text =
      KMIS_DB_Clean_(value);

    const isoMatch =
      text.match(
        /^(\d{4})-(\d{2})-(\d{2})/
      );

    if (isoMatch) {
      date = new Date(
        Number(isoMatch[1]),
        Number(isoMatch[2]) - 1,
        Number(isoMatch[3])
      );
    }

    const dayFirstMatch =
      text.match(
        /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/
      );

    if (
      !date &&
      dayFirstMatch
    ) {
      date = new Date(
        Number(dayFirstMatch[3]),
        Number(dayFirstMatch[2]) - 1,
        Number(dayFirstMatch[1])
      );
    }
  }

  if (
    !date ||
    isNaN(date.getTime())
  ) {
    return '';
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    format
  );
}


function KMIS_TR_Normalize_(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}


/**
 * Safe test:
 * Generates the complete Treasurer dashboard without changing data.
 */
function KMIS_TR_TestDashboard() {
  const result =
    KMIS_TR_GetDashboard();

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
 * Safe test:
 * Searches a family without changing data.
 */
function KMIS_TR_TestSearch() {
  const result =
    KMIS_TR_SearchFamilies(
      'FAM00001',
      {
        maxResults: 10
      }
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


/**
 * Safe test:
 * Generates a PAID report without changing data.
 *
 * Total dashboard families should remain the complete family total.
 * filteredCount should show only PAID families.
 */
function KMIS_TR_TestPaidReport() {
  const result =
    KMIS_TR_GetSubscriptionReport({
      status:
        KMIS_CONSTANTS
          .SUBSCRIPTION_STATUS
          .PAID
    });

  Logger.log(
    JSON.stringify(
      {
        summary:
          result.summary,

        filteredCount:
          result.filteredCount,

        returnedCount:
          result.returnedCount
      },
      null,
      2
    )
  );

  return result;
}