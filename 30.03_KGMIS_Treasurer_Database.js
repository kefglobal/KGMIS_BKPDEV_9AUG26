/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Treasurer Module — Database Layer
 *
 * File:
 * 30.02_KGMIS_Treasurer_Database.gs
 * ============================================================
 *
 * Contains:
 * - Master database context
 * - Family record grouping
 * - Family result creation
 * - Zone list generation
 * - Family sorting
 */


/**
 * ============================================================
 * Master Database Context
 * ============================================================
 *
 * Reads the configured KGMIS master database sheet and maps
 * all required Treasurer Module headers to column indexes.
 */
function KGMIS_Treasurer_GetContext_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    spreadsheet.getSheetByName(
      KGMIS_CONFIG.MASTER_SHEET
    );

  if (!sheet) {
    throw new Error(
      'KGMIS master database sheet not found: ' +
      KGMIS_CONFIG.MASTER_SHEET
    );
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    throw new Error(
      'The KGMIS master database does not contain any columns.'
    );
  }

  if (lastRow < KGMIS_CONFIG.HEADER_ROW) {
    throw new Error(
      'The KGMIS master database does not contain a header row.'
    );
  }

  const headers = sheet
    .getRange(
      KGMIS_CONFIG.HEADER_ROW,
      1,
      1,
      lastColumn
    )
    .getDisplayValues()[0]
    .map(header =>
      String(header || '').trim()
    );

  const requiredHeaders =
    Object.values(
      KGMIS_TREASURER_DATA_CONFIG.HEADERS
    );

  const missingHeaders =
    requiredHeaders.filter(
      header => !headers.includes(header)
    );

  if (missingHeaders.length > 0) {
    throw new Error(
      'The following required Treasurer Module headers ' +
      'were not found in ' +
      KGMIS_CONFIG.MASTER_SHEET +
      ':\n\n' +
      missingHeaders.join('\n')
    );
  }

  const column = {};

  Object.entries(
    KGMIS_TREASURER_DATA_CONFIG.HEADERS
  ).forEach(([key, header]) => {
    column[key] = headers.indexOf(header);
  });

  const values =
    lastRow >= KGMIS_CONFIG.HEADER_ROW
      ? sheet
          .getRange(
            KGMIS_CONFIG.HEADER_ROW,
            1,
            lastRow -
              KGMIS_CONFIG.HEADER_ROW +
              1,
            lastColumn
          )
          .getValues()
      : [];

  return {
    spreadsheet,
    sheet,
    sheetName: sheet.getName(),
    headers,
    column,
    values,
    lastRow,
    lastColumn
  };
}


/**
 * ============================================================
 * Build Family Map
 * ============================================================
 *
 * Creates one family record for each FAMILY_ID.
 *
 * If multiple database rows contain the same FAMILY_ID,
 * the PRIMARY MEMBER row is preferred.
 */
function KGMIS_Treasurer_BuildFamilyMap_(
  context
) {
  if (
    !context ||
    !Array.isArray(context.values) ||
    !context.column
  ) {
    throw new Error(
      'A valid Treasurer database context is required.'
    );
  }

  const familyMap = new Map();

  const values = context.values;
  const column = context.column;

  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {
    const row = values[rowIndex];

    const familyId =
      KGMIS_Treasurer_CleanValue_(
        row[column.FAMILY_ID]
      );

    if (!familyId) {
      continue;
    }

    const candidate =
      KGMIS_Treasurer_CreateFamilyResult_(
        row,
        column
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
      KGMIS_Treasurer_NormalizeSearchValue_(
        candidate.memberCategory
      ) === 'primary member';

    const existingIsPrimary =
      KGMIS_Treasurer_NormalizeSearchValue_(
        existing.memberCategory
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
 * ============================================================
 * Create Family Result
 * ============================================================
 *
 * Converts one master-database row into the family object
 * returned to the Treasurer Portal.
 */
function KGMIS_Treasurer_CreateFamilyResult_(
  row,
  column
) {
  if (!row || !column) {
    throw new Error(
      'A database row and column map are required.'
    );
  }

  const paymentDateValue =
    row[column.PAYMENT_DATE];

  return {
    familyId:
      KGMIS_Treasurer_CleanValue_(
        row[column.FAMILY_ID]
      ),

    zone:
      KGMIS_Treasurer_CleanValue_(
        row[column.ZONE]
      ),

    memberName:
      KGMIS_Treasurer_CleanValue_(
        row[column.MEMBER_NAME]
      ),

    memberMobile:
      KGMIS_Treasurer_CleanValue_(
        row[column.MEMBER_MOBILE]
      ),

    memberAlumniAssociation:
      KGMIS_Treasurer_CleanValue_(
        row[column.ALUMNI_ASSOCIATION]
      ),

    memberBranch:
      KGMIS_Treasurer_CleanValue_(
        row[column.BRANCH]
      ),

    memberBatchYear:
      KGMIS_Treasurer_CleanValue_(
        row[column.YEAR_BATCH]
      ),

    spouseName:
      KGMIS_Treasurer_CleanValue_(
        row[column.SPOUSE_NAME]
      ),

    spouseMobile:
      KGMIS_Treasurer_CleanValue_(
        row[column.SPOUSE_MOBILE]
      ),

    spouseAlumniAssociation:
      KGMIS_Treasurer_CleanValue_(
        row[
          column.SPOUSE_ALUMNI_ASSOCIATION
        ]
      ),

    spouseBranch:
      KGMIS_Treasurer_CleanValue_(
        row[column.SPOUSE_BRANCH]
      ),

    spouseBatchYear:
      KGMIS_Treasurer_CleanValue_(
        row[column.SPOUSE_BATCH_YEAR]
      ),

    subscriptionStatus:
      KGMIS_Treasurer_GetEffectiveSubscriptionStatus_(
        row[column.SUBSCRIPTION_STATUS]
      ),

    paymentDateIso:
      KGMIS_Treasurer_FormatDateForHtml_(
        paymentDateValue
      ),

    paymentDateDisplay:
      KGMIS_Treasurer_FormatDateForDisplay_(
        paymentDateValue
      ),

    memberCategory:
      KGMIS_Treasurer_CleanValue_(
        row[column.MEMBER_CATEGORY]
      ),

    recordStatus:
      KGMIS_Treasurer_CleanValue_(
        row[column.RECORD_STATUS]
      )
  };
}


/**
 * ============================================================
 * Unique Zone List
 * ============================================================
 *
 * Returns a sorted list of nonblank zones for portal filters.
 */
function KGMIS_Treasurer_GetUniqueZones_(
  context
) {
  if (
    !context ||
    !Array.isArray(context.values) ||
    !context.column
  ) {
    throw new Error(
      'A valid Treasurer database context is required.'
    );
  }

  const zoneSet = new Set();

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const zone =
      KGMIS_Treasurer_CleanValue_(
        context.values[rowIndex][
          context.column.ZONE
        ]
      );

    if (zone) {
      zoneSet.add(zone);
    }
  }

  return Array.from(zoneSet).sort(
    (firstZone, secondZone) =>
      firstZone.localeCompare(
        secondZone,
        undefined,
        {
          numeric: true,
          sensitivity: 'base'
        }
      )
  );
}


/**
 * ============================================================
 * Family Sorting
 * ============================================================
 *
 * Sorts first by Zone and then by Family ID.
 */
function KGMIS_Treasurer_CompareFamilies_(
  firstFamily,
  secondFamily
) {
  const zoneComparison =
    KGMIS_Treasurer_CleanValue_(
      firstFamily && firstFamily.zone
    ).localeCompare(
      KGMIS_Treasurer_CleanValue_(
        secondFamily &&
          secondFamily.zone
      ),
      undefined,
      {
        numeric: true,
        sensitivity: 'base'
      }
    );

  if (zoneComparison !== 0) {
    return zoneComparison;
  }

  return KGMIS_Treasurer_CleanValue_(
    firstFamily &&
      firstFamily.familyId
  ).localeCompare(
    KGMIS_Treasurer_CleanValue_(
      secondFamily &&
        secondFamily.familyId
    ),
    undefined,
    {
      numeric: true,
      sensitivity: 'base'
    }
  );
}