/******************************************************************************
 *
 * KEFG Membership Information System (KMIS)
 *
 * Module        : Search Service
 * File          : 23_Search_Service.gs
 * Version       : 2.0
 * Status        : Development
 *
 ******************************************************************************/

/**
 * Central read/search functions for KMIS.
 */


/**
 * Searches KMIS members.
 *
 * Search fields include:
 * - KEFG_ID
 * - FAMILY_ID
 * - MEMBER_NAME
 * - SPOUSE_NAME
 * - MEMBER_MOBILE
 * - SPOUSE_MOBILE
 * - MEMBER_WHATSAPP
 * - SPOUSE_WHATSAPP
 * - MEMBER_EMAIL
 * - SPOUSE_EMAIL
 * - ALUMNI_ASSOCIATION
 * - SPOUSE_ALUMNI_ASSOCIATION
 * - BRANCH
 * - SPOUSE_BRANCH
 * - YEAR_BATCH
 * - SPOUSE_BATCH_YEAR
 * - ZONE
 */
function KMIS_SEARCH_Members(
  searchText,
  options
) {
  KMIS_RequireDirectoryAccess_();

  const query =
    KMIS_SEARCH_Normalize_(searchText);

  if (!query) {
    throw new Error(
      'Enter a name, ID, mobile number, email, Zone or alumni detail.'
    );
  }

  const safeOptions = options || {};

  const maxResults =
    Number(safeOptions.maxResults) ||
    KMIS_CONSTANTS.SYSTEM_LIMITS
      .MAX_SEARCH_RESULTS;

  const context =
    KMIS_DB_GetContext();

  const searchableHeaders = [
    'KEFG_ID',
    'FAMILY_ID',
    'MEMBER_NAME',
    'SPOUSE_NAME',
    'MEMBER_MOBILE',
    'SPOUSE_MOBILE',
    'MEMBER_WHATSAPP',
    'SPOUSE_WHATSAPP',
    'MEMBER_EMAIL',
    'SPOUSE_EMAIL',
    'ALUMNI_ASSOCIATION',
    'SPOUSE_ALUMNI_ASSOCIATION',
    'BRANCH',
    'SPOUSE_BRANCH',
    'YEAR_BATCH',
    'SPOUSE_BATCH_YEAR',
    'ZONE'
  ].filter(header =>
    Object.prototype.hasOwnProperty.call(
      context.column,
      header
    )
  );

  const results = [];

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row = context.values[rowIndex];

    const matched =
      searchableHeaders.some(header => {
        const value =
          row[context.column[header]];

        return KMIS_SEARCH_Normalize_(
          value
        ).includes(query);
      });

    if (!matched) {
      continue;
    }

    results.push(
      KMIS_DB_RowToObject(
        row,
        context.headers,
        rowIndex + 1
      )
    );

    if (results.length >= maxResults) {
      break;
    }
  }

  return results;
}


/**
 * Searches one family record per FAMILY_ID.
 *
 * The PRIMARY MEMBER record is preferred when multiple rows
 * share the same FAMILY_ID.
 */
function KMIS_SEARCH_Families(
  searchText,
  options
) {
  KMIS_RequireDirectoryAccess_();

  const query =
    KMIS_SEARCH_Normalize_(searchText);

  if (!query) {
    throw new Error(
      'Enter a Family ID, name, mobile number, Zone or alumni detail.'
    );
  }

  const safeOptions = options || {};

  const maxResults =
    Number(safeOptions.maxResults) ||
    KMIS_CONSTANTS.SYSTEM_LIMITS
      .MAX_SEARCH_RESULTS;

  const context =
    KMIS_DB_GetContext();

  const familyMap =
    KMIS_SEARCH_BuildFamilyMap_(
      context
    );

  const results = [];

  familyMap.forEach(family => {
    const searchableValues = [
      family.FAMILY_ID,
      family.KEFG_ID,
      family.MEMBER_NAME,
      family.SPOUSE_NAME,
      family.MEMBER_MOBILE,
      family.SPOUSE_MOBILE,
      family.MEMBER_WHATSAPP,
      family.SPOUSE_WHATSAPP,
      family.MEMBER_EMAIL,
      family.SPOUSE_EMAIL,
      family.ALUMNI_ASSOCIATION,
      family.SPOUSE_ALUMNI_ASSOCIATION,
      family.BRANCH,
      family.SPOUSE_BRANCH,
      family.YEAR_BATCH,
      family.SPOUSE_BATCH_YEAR,
      family.ZONE
    ].map(KMIS_SEARCH_Normalize_);

    if (
      searchableValues.some(
        value => value.includes(query)
      )
    ) {
      results.push(family);
    }
  });

  results.sort(
    KMIS_SEARCH_CompareFamilies_
  );

  return results.slice(
    0,
    maxResults
  );
}


/**
 * ============================================================
 * Searches families for the Family Management module.
 *
 * PURPOSE
 * -------
 * Searches individual Primary Member and Spouse rows in
 * KGMIS_MASTER_DATABASE_v1.0, but returns only one consolidated
 * result for each FAMILY_ID.
 *
 * PERFORMANCE
 * -----------
 * • Reads the Master Database only once.
 * • Searches the loaded in-memory values.
 * • Does not read KEFG_FAMILY_MEMBERS during general search.
 * • Returns only a limited number of compact family summaries.
 *
 * Supported search types:
 *
 * ALL
 * FAMILY_ID
 * KEFG_ID
 * MEMBER_NAME
 * MEMBER_MOBILE
 * MEMBER_WHATSAPP
 * MEMBER_EMAIL
 *
 * @param {string} searchText
 * @param {Object=} options
 * @return {Array<Object>}
 * ============================================================
 */
function KGMIS_SEARCH_FamilyManagementFamilies(
  searchText,
  options
) {

  KGMIS_RequireDatabaseAdminAccess_();

  const query =
    KMIS_SEARCH_Normalize_(
      searchText
    );

  if (!query) {
    throw new Error(
      'Enter a Family ID, KEFG ID, name, mobile number, WhatsApp number or email address.'
    );
  }

  if (query.length < 2) {
    throw new Error(
      'Enter at least two characters to search.'
    );
  }

  const safeOptions =
    options &&
    typeof options === 'object'
      ? options
      : {};

  const searchType =
    String(
      safeOptions.searchType || 'ALL'
    )
      .trim()
      .toUpperCase();

  const allowedSearchTypes = [
    'ALL',
    'FAMILY_ID',
    'KEFG_ID',
    'MEMBER_NAME',
    'MEMBER_MOBILE',
    'MEMBER_WHATSAPP',
    'MEMBER_EMAIL'
  ];

  if (
    allowedSearchTypes.indexOf(
      searchType
    ) === -1
  ) {
    throw new Error(
      'Invalid Family Management search type.'
    );
  }

  const configuredMaximum =
    Number(
      safeOptions.maxResults
    );

  const maxResults =
    Number.isFinite(
      configuredMaximum
    ) &&
    configuredMaximum > 0
      ? Math.min(
          Math.floor(configuredMaximum),
          50
        )
      : 20;

  /*
   * Load the complete Master Database once.
   */
  const context =
    KMIS_DB_GetContext();

  const requiredHeaders = [
    'KEFG_ID',
    'FAMILY_ID',
    'RELATED_MEMBER_KEFG_ID',
    'MEMBER_CATEGORY',
    'RECORD_STATUS',
    'MEMBER_NAME',
    'ALUMNI_ASSOCIATION',
    'BRANCH',
    'YEAR_BATCH',
    'TYPE_OF_MEMBERSHIP',
    'MEMBER_MOBILE',
    'MEMBER_WHATSAPP',
    'MEMBER_EMAIL',
    'ZONE'
  ];

  const missingHeaders =
    requiredHeaders.filter(
      function (header) {

        return !Object.prototype
          .hasOwnProperty.call(
            context.column,
            header
          );

      }
    );

  if (missingHeaders.length) {
    throw new Error(
      'Family Management search cannot continue because the Master Database is missing: ' +
      missingHeaders.join(', ')
    );
  }

  const searchHeadersByType = {
    ALL: [
      'FAMILY_ID',
      'KEFG_ID',
      'MEMBER_NAME',
      'MEMBER_MOBILE',
      'MEMBER_WHATSAPP',
      'MEMBER_EMAIL'
    ],

    FAMILY_ID: [
      'FAMILY_ID'
    ],

    KEFG_ID: [
      'KEFG_ID'
    ],

    MEMBER_NAME: [
      'MEMBER_NAME'
    ],

    MEMBER_MOBILE: [
      'MEMBER_MOBILE'
    ],

    MEMBER_WHATSAPP: [
      'MEMBER_WHATSAPP'
    ],

    MEMBER_EMAIL: [
      'MEMBER_EMAIL'
    ]
  };

  const searchableHeaders =
    searchHeadersByType[
      searchType
    ];

  /*
   * One map entry is maintained for each FAMILY_ID.
   *
   * Every Primary Member and Spouse row is examined, allowing
   * the search to match either person's current member fields.
   */
  const familyMap =
    new Map();

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {

    const row =
      context.values[rowIndex];

    const familyId =
      KMIS_DB_Clean_(
        row[
          context.column.FAMILY_ID
        ]
      );

    if (!familyId) {
      continue;
    }

    const record =
      KMIS_DB_RowToObject(
        row,
        context.headers,
        rowIndex + 1
      );

    let familyEntry =
      familyMap.get(
        familyId
      );

    if (!familyEntry) {

      familyEntry = {
        familyId:
          familyId,

        primaryMember:
          null,

        spouse:
          null,

        otherMemberRecords:
          [],

        matched:
          false,

        matchedField:
          '',

        matchedValue:
          '',

        recordCount:
          0
      };

      familyMap.set(
        familyId,
        familyEntry
      );

    }

    familyEntry.recordCount++;

    const memberCategory =
      KMIS_SEARCH_Normalize_(
        record.MEMBER_CATEGORY
      );

    if (
      memberCategory ===
      'primary member'
    ) {

      familyEntry.primaryMember =
        record;

    } else if (
      memberCategory.includes(
        'spouse'
      )
    ) {

      familyEntry.spouse =
        record;

    } else {

      familyEntry
        .otherMemberRecords
        .push(
          record
        );

    }

    /*
     * Once a family has matched, its remaining rows still need
     * to be collected, but no further field comparison is needed.
     */
    if (familyEntry.matched) {
      continue;
    }

    for (
      let headerIndex = 0;
      headerIndex <
        searchableHeaders.length;
      headerIndex++
    ) {

      const header =
        searchableHeaders[
          headerIndex
        ];

      const rawValue =
        record[header];

      const normalizedValue =
        KMIS_SEARCH_Normalize_(
          rawValue
        );

      if (
        normalizedValue &&
        normalizedValue.includes(
          query
        )
      ) {

        familyEntry.matched =
          true;

        familyEntry.matchedField =
          header;

        familyEntry.matchedValue =
          KMIS_DB_Clean_(
            rawValue
          );

        break;

      }

    }

  }

  const results = [];

  familyMap.forEach(
    function (familyEntry) {

      if (!familyEntry.matched) {
        return;
      }

      /*
       * Prefer the official Primary Member row.
       * A fallback keeps older or incomplete families searchable.
       */
      const primaryMember =
        familyEntry.primaryMember ||
        familyEntry.spouse ||
        familyEntry.otherMemberRecords[0] ||
        null;

      /*
       * Prefer an official spouse row.
       */
      const spouse =
        familyEntry.spouse ||
        null;

      results.push({
        familyId:
          familyEntry.familyId,

        primaryMember:
          KGMIS_SEARCH_BuildFamilyPersonSummary_(
            primaryMember
          ),

        spouse:
          KGMIS_SEARCH_BuildFamilyPersonSummary_(
            spouse
          ),

        familyRecordStatus:
          primaryMember
            ? KMIS_DB_Clean_(
                primaryMember.RECORD_STATUS
              )
            : '',

        zone:
          primaryMember
            ? KMIS_DB_Clean_(
                primaryMember.ZONE
              )
            : '',

        recordCount:
          familyEntry.recordCount,

        matchedField:
          familyEntry.matchedField,

        matchedValue:
          familyEntry.matchedValue
      });

    }
  );

  results.sort(
    function (a, b) {

      return KMIS_DB_Clean_(
        a.familyId
      ).localeCompare(
        KMIS_DB_Clean_(
          b.familyId
        ),
        undefined,
        {
          numeric: true,
          sensitivity: 'base'
        }
      );

    }
  );

  return results.slice(
    0,
    maxResults
  );

}


/**
 * Builds a compact person summary for Family Management
 * search results.
 *
 * The complete member rows will be loaded only after the
 * administrator selects one FAMILY_ID.
 *
 * @param {?Object} record
 * @return {?Object}
 */
function KGMIS_SEARCH_BuildFamilyPersonSummary_(
  record
) {

  if (
    !record ||
    typeof record !== 'object'
  ) {
    return null;
  }

  return {
    kefgId:
      KMIS_DB_Clean_(
        record.KEFG_ID
      ),

    relatedMemberKefgId:
      KMIS_DB_Clean_(
        record.RELATED_MEMBER_KEFG_ID
      ),

    memberCategory:
      KMIS_DB_Clean_(
        record.MEMBER_CATEGORY
      ),

    recordStatus:
      KMIS_DB_Clean_(
        record.RECORD_STATUS
      ),

    memberName:
      KMIS_DB_Clean_(
        record.MEMBER_NAME
      ),

    alumniAssociation:
      KMIS_DB_Clean_(
        record.ALUMNI_ASSOCIATION
      ),

    branch:
      KMIS_DB_Clean_(
        record.BRANCH
      ),

    yearBatch:
      KMIS_DB_Clean_(
        record.YEAR_BATCH
      ),

    membershipType:
      KMIS_DB_Clean_(
        record.TYPE_OF_MEMBERSHIP
      ),

    mobile:
      KMIS_DB_Clean_(
        record.MEMBER_MOBILE
      ),

    whatsapp:
      KMIS_DB_Clean_(
        record.MEMBER_WHATSAPP
      ),

    email:
      KMIS_DB_Clean_(
        record.MEMBER_EMAIL
      ),

    zone:
      KMIS_DB_Clean_(
        record.ZONE
      ),

    sheetRow:
      Number(
        record.__SHEET_ROW
      ) || 0
  };

}


/**
 * Lists one record per family with optional filters.
 *
 * Supported filters:
 * {
 *   zone,
 *   recordStatus,
 *   memberCategory,
 *   subscriptionStatus
 * }
 */
function KMIS_SEARCH_ListFamilies(filters) {
  KMIS_RequireDirectoryAccess_();

  const safeFilters = filters || {};
  const context =
    KMIS_DB_GetContext();

  const familyMap =
    KMIS_SEARCH_BuildFamilyMap_(
      context
    );

  const rows = [];

  familyMap.forEach(family => {
    if (
      safeFilters.zone &&
      KMIS_SEARCH_Normalize_(family.ZONE) !==
        KMIS_SEARCH_Normalize_(
          safeFilters.zone
        )
    ) {
      return;
    }

    if (
      safeFilters.recordStatus &&
      KMIS_SEARCH_Normalize_(
        family.RECORD_STATUS
      ) !==
        KMIS_SEARCH_Normalize_(
          safeFilters.recordStatus
        )
    ) {
      return;
    }

    if (
      safeFilters.memberCategory &&
      KMIS_SEARCH_Normalize_(
        family.MEMBER_CATEGORY
      ) !==
        KMIS_SEARCH_Normalize_(
          safeFilters.memberCategory
        )
    ) {
      return;
    }

    if (
      safeFilters.subscriptionStatus
    ) {
      const effectiveStatus =
        KMIS_SEARCH_GetEffectiveSubscriptionStatus_(
          family
            .SUBSCRIPTION_STATUS_2026_2027
        );

      if (
        KMIS_SEARCH_Normalize_(
          effectiveStatus
        ) !==
          KMIS_SEARCH_Normalize_(
            safeFilters.subscriptionStatus
          )
      ) {
        return;
      }
    }

    rows.push(family);
  });

  rows.sort(
    KMIS_SEARCH_CompareFamilies_
  );

  return rows;
}


/**
 * Builds one record per FAMILY_ID.
 */
function KMIS_SEARCH_BuildFamilyMap_(
  context
) {
  const familyMap = new Map();

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row = context.values[rowIndex];

    const familyId =
      KMIS_DB_Clean_(
        row[context.column.FAMILY_ID]
      );

    if (!familyId) {
      continue;
    }

    const candidate =
      KMIS_DB_RowToObject(
        row,
        context.headers,
        rowIndex + 1
      );

    if (!familyMap.has(familyId)) {
      familyMap.set(
        familyId,
        candidate
      );

      continue;
    }

    const existing =
      familyMap.get(familyId);

    const candidateIsPrimary =
      KMIS_SEARCH_Normalize_(
        candidate.MEMBER_CATEGORY
      ) === 'primary member';

    const existingIsPrimary =
      KMIS_SEARCH_Normalize_(
        existing.MEMBER_CATEGORY
      ) === 'primary member';

    if (
      candidateIsPrimary &&
      !existingIsPrimary
    ) {
      familyMap.set(
        familyId,
        candidate
      );
    }
  }

  return familyMap;
}


/**
 * Blank subscription values are treated as NOT PAID for reporting.
 */
function KMIS_SEARCH_GetEffectiveSubscriptionStatus_(
  status
) {
  return (
    KMIS_DB_Clean_(status).toUpperCase() ||
    KMIS_CONSTANTS.SUBSCRIPTION_STATUS
      .NOT_PAID
  );
}


function KMIS_SEARCH_CompareFamilies_(
  a,
  b
) {
  const zoneComparison =
    KMIS_DB_Clean_(a.ZONE).localeCompare(
      KMIS_DB_Clean_(b.ZONE),
      undefined,
      {
        numeric: true,
        sensitivity: 'base'
      }
    );

  if (zoneComparison !== 0) {
    return zoneComparison;
  }

  return KMIS_DB_Clean_(
    a.FAMILY_ID
  ).localeCompare(
    KMIS_DB_Clean_(b.FAMILY_ID),
    undefined,
    {
      numeric: true,
      sensitivity: 'base'
    }
  );
}


function KMIS_SEARCH_Normalize_(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}


/**
 * Manual search test.
 *
 * Change the search text before running.
 */
function KMIS_SEARCH_Test() {
  KMIS_RequireDatabaseAdminAccess_();

  const results =
    KMIS_SEARCH_Families(
      'FAM00001',
      {
        maxResults: 10
      }
    );

  Logger.log(
    JSON.stringify(results, null, 2)
  );

  return results;
}

/**
 * Search Test for Family Management Module
 *
 */

function KGMIS_SEARCH_TestFamilyManagement() {

  const results =
    KGMIS_SEARCH_FamilyManagementFamilies(
      'FAM00035',
      {
        searchType: 'FAMILY_ID',
        maxResults: 10
      }
    );

  Logger.log(
    JSON.stringify(
      results,
      null,
      2
    )
  );

  return results;
}