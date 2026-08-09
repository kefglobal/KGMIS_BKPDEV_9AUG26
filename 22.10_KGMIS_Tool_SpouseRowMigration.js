/******************************************************************************
 *
 * KEFG Membership Information System
 *
 * Module : Spouse Row Data Migration
 * File   : 22.10_KGMIS_Spouse_Row_Migration.gs
 *
 * Purpose:
 * Copies legacy SPOUSE_* information stored in the Primary Member row
 * into the related spouse's separate Master Database row.
 *
 * Safety rules:
 * 1. Preview before applying.
 * 2. Never overwrite a non-blank spouse-row value.
 * 3. Verify FAMILY_ID and reciprocal RELATED_MEMBER_KEFG_ID.
 * 4. Do not delete or clear legacy SPOUSE_* values.
 *
 ******************************************************************************/

const KGMIS_SPOUSE_ROW_MIGRATION_CONFIG = Object.freeze({

  MASTER_SHEET:
    'KGMIS_MASTER_DATABASE_v1.0',

  ACTIVE_STATUS:
    'ACTIVE',

  PRIMARY_MEMBER_CATEGORIES: Object.freeze([
    'PRIMARY MEMBER',
    'MEMBER',
    'ALUMNI MEMBER'
  ]),

  SPOUSE_CATEGORIES: Object.freeze([
    'ALUMNI SPOUSE MEMBER',
    'NON-ALUMNI SPOUSE',
    'SPOUSE MEMBER',
    'SPOUSE'
  ]),

  FIELD_MAPPING: Object.freeze({

    SPOUSE_NAME:
      'MEMBER_NAME',

    SPOUSE_GENDER:
      'GENDER',

    SPOUSE_DOB_FULL:
      'MEMBER_DOB_FULL',

    SPOUSE_BIRTHDAY_DATE_AND_MONTH:
      'MEMBER_BIRTHDAY_DATE_AND_MONTH',

    SPOUSE_MOBILE:
      'MEMBER_MOBILE',

    SPOUSE_WHATSAPP:
      'MEMBER_WHATSAPP',

    SPOUSE_EMAIL:
      'MEMBER_EMAIL',

    SPOUSE_ALUMNI_ASSOCIATION:
      'ALUMNI_ASSOCIATION',

    SPOUSE_BRANCH:
      'BRANCH',

    SPOUSE_BATCH_YEAR:
      'YEAR_BATCH',

    SPOUSE_CURRENT_COUNTRY:
      'CURRENT_LOCATION_COUNTRY',

    SPOUSE_CURRENT_STATE:
      'CURRENT_LOCATION_STATE',

    SPOUSE_CURRENT_CITY_DISTRICT:
      'CURRENT_LOCATION_CITY_DISTRICT',

    SPOUSE_LATEST_ADDRESS:
      'LATEST_ADDRESS',

    SPOUSE_HOME_LOCATION_GOOGLE_MAP:
      'HOME_LOCATION_GOOGLE_MAP',

    SPOUSE_ACTIVITIES:
      'MEMBER_PRESENT_ACTIVITIES',

    SPOUSE_PRESENT_ACTIVITIES:
      'MEMBER_PRESENT_ACTIVITIES',

    SPOUSE_PROFESSION_SKILLS:
      'MEMBER_PROFESSION_SKILLS',

    SPOUSE_KEF_KEFGLOBAL_CONTRIBUTIONS:
      'KEF_KEFGLOBAL_CONTRIBUTIONS',

    SPOUSE_WILLING_TO_VOLUNTEER:
      'MEMBER_WILLING_TO_VOLUNTEER',

    SPOUSE_REMARKS:
      'REMARKS'
  })
});


/**
 * ============================================================
 * PREVIEW ONLY
 *
 * No database values are changed.
 * ============================================================
 */
function KGMIS_PreviewSpouseRowMigration() {

  const result =
    KGMIS_RunSpouseRowMigration_(
      false
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
 * ============================================================
 * APPLY MIGRATION
 *
 * Copies legacy SPOUSE_* values into blank fields in the
 * related spouse row.
 * ============================================================
 */
function KGMIS_ApplySpouseRowMigration() {

  const confirmation =
    Browser.msgBox(
      'KGMIS Spouse Migration',
      'This will copy legacy SPOUSE_* data into blank fields in linked spouse rows. Existing spouse-row values will not be overwritten. Continue?',
      Browser.Buttons.YES_NO
    );

  if (
    confirmation !== 'yes'
  ) {

    return {
      success: false,
      cancelled: true,
      message:
        'Spouse-row migration was cancelled.'
    };
  }

  const result =
    KGMIS_RunSpouseRowMigration_(
      true
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
 * ============================================================
 * Migration engine
 * ============================================================
 */
function KGMIS_RunSpouseRowMigration_(
  applyChanges
) {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    spreadsheet.getSheetByName(
      KGMIS_SPOUSE_ROW_MIGRATION_CONFIG
        .MASTER_SHEET
    );

  if (!sheet) {

    throw new Error(
      'The sheet "' +
      KGMIS_SPOUSE_ROW_MIGRATION_CONFIG
        .MASTER_SHEET +
      '" was not found.'
    );
  }

  const lastRow =
    sheet.getLastRow();

  const lastColumn =
    sheet.getLastColumn();

  if (
    lastRow < 2 ||
    lastColumn < 1
  ) {

    throw new Error(
      'The Master Database does not contain any data rows.'
    );
  }

  const range =
    sheet.getRange(
      1,
      1,
      lastRow,
      lastColumn
    );

  const values =
    range.getValues();

  const displayValues =
    range.getDisplayValues();

  const headers =
    displayValues[0]
      .map(function (header) {

        return KGMIS_SpouseMigration_NormaliseHeader_(
          header
        );

      });

  const column =
    KGMIS_SpouseMigration_CreateColumnMap_(
      headers
    );

  const requiredHeaders = [
    'KEFG_ID',
    'FAMILY_ID',
    'RELATED_MEMBER_KEFG_ID',
    'MEMBER_CATEGORY',
    'RECORD_STATUS'
  ];

  KGMIS_SpouseMigration_RequireHeaders_(
    column,
    requiredHeaders
  );

  const availableMappings =
    KGMIS_SpouseMigration_GetAvailableMappings_(
      column
    );

  if (!availableMappings.length) {

    throw new Error(
      'No usable legacy SPOUSE_* source headers were found.'
    );
  }

  const rowByKefgId = {};

  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const kefgId =
      KGMIS_SpouseMigration_Clean_(
        values[rowIndex][
          column.KEFG_ID
        ]
      ).toUpperCase();

    if (!kefgId) {
      continue;
    }

    if (
      Object.prototype
        .hasOwnProperty.call(
          rowByKefgId,
          kefgId
        )
    ) {

      throw new Error(
        'Duplicate KEFG_ID found in the Master Database: ' +
        kefgId
      );
    }

    rowByKefgId[kefgId] =
      rowIndex;
  }

  const report = {

    success:
      true,

    mode:
      applyChanges
        ? 'APPLY'
        : 'PREVIEW',

    sheetName:
      sheet.getName(),

    rowsChecked:
      0,

    primaryRowsWithRelatedId:
      0,

    linkedSpouseRowsFound:
      0,

    reciprocalRelationshipsConfirmed:
      0,

    fieldsEligibleForCopy:
      0,

    fieldsCopied:
      0,

    existingTargetValuesSkipped:
      0,

    blankSourceValuesSkipped:
      0,

    missingRelatedRows:
      [],

    familyIdMismatches:
      [],

    reciprocalRelationshipMismatches:
      [],

    proposedChanges:
      [],

    unavailableMappings:
      KGMIS_SpouseMigration_GetUnavailableMappings_(
        column
      )
  };

  const changedRows = {};

  for (
    let primaryIndex = 1;
    primaryIndex < values.length;
    primaryIndex++
  ) {

    report.rowsChecked++;

    const primaryRow =
      values[primaryIndex];

    const primaryKefgId =
      KGMIS_SpouseMigration_Clean_(
        primaryRow[
          column.KEFG_ID
        ]
      ).toUpperCase();

    const familyId =
      KGMIS_SpouseMigration_Clean_(
        primaryRow[
          column.FAMILY_ID
        ]
      ).toUpperCase();

    const relatedKefgId =
      KGMIS_SpouseMigration_Clean_(
        primaryRow[
          column.RELATED_MEMBER_KEFG_ID
        ]
      ).toUpperCase();

    const memberCategory =
      KGMIS_SpouseMigration_NormaliseText_(
        primaryRow[
          column.MEMBER_CATEGORY
        ]
      );

    const recordStatus =
      KGMIS_SpouseMigration_NormaliseText_(
        primaryRow[
          column.RECORD_STATUS
        ]
      );

    if (
      !primaryKefgId ||
      !familyId ||
      !relatedKefgId
    ) {
      continue;
    }

    if (
      recordStatus &&
      recordStatus !==
        KGMIS_SPOUSE_ROW_MIGRATION_CONFIG
          .ACTIVE_STATUS
    ) {
      continue;
    }

    if (
      KGMIS_SpouseMigration_IsSpouseCategory_(
        memberCategory
      )
    ) {
      continue;
    }

    report.primaryRowsWithRelatedId++;

    if (
      !Object.prototype
        .hasOwnProperty.call(
          rowByKefgId,
          relatedKefgId
        )
    ) {

      report.missingRelatedRows.push({

        primaryRow:
          primaryIndex + 1,

        primaryKefgId:
          primaryKefgId,

        familyId:
          familyId,

        relatedKefgId:
          relatedKefgId
      });

      continue;
    }

    const spouseIndex =
      rowByKefgId[
        relatedKefgId
      ];

    const spouseRow =
      values[
        spouseIndex
      ];

    const spouseFamilyId =
      KGMIS_SpouseMigration_Clean_(
        spouseRow[
          column.FAMILY_ID
        ]
      ).toUpperCase();

    const spouseRelatedKefgId =
      KGMIS_SpouseMigration_Clean_(
        spouseRow[
          column.RELATED_MEMBER_KEFG_ID
        ]
      ).toUpperCase();

    if (
      spouseFamilyId !== familyId
    ) {

      report.familyIdMismatches.push({

        primaryRow:
          primaryIndex + 1,

        spouseRow:
          spouseIndex + 1,

        primaryKefgId:
          primaryKefgId,

        spouseKefgId:
          relatedKefgId,

        primaryFamilyId:
          familyId,

        spouseFamilyId:
          spouseFamilyId
      });

      continue;
    }

    report.linkedSpouseRowsFound++;

    if (
      spouseRelatedKefgId !==
      primaryKefgId
    ) {

      report
        .reciprocalRelationshipMismatches
        .push({

          primaryRow:
            primaryIndex + 1,

          spouseRow:
            spouseIndex + 1,

          primaryKefgId:
            primaryKefgId,

          spouseKefgId:
            relatedKefgId,

          spouseRelatedKefgId:
            spouseRelatedKefgId
        });

      continue;
    }

    report
      .reciprocalRelationshipsConfirmed++;

    availableMappings.forEach(
      function (mapping) {

        const sourceValue =
          primaryRow[
            mapping.sourceColumn
          ];

        const targetValue =
          spouseRow[
            mapping.targetColumn
          ];

        const cleanSourceValue =
          KGMIS_SpouseMigration_Clean_(
            sourceValue
          );

        const cleanTargetValue =
          KGMIS_SpouseMigration_Clean_(
            targetValue
          );

        if (
          !cleanSourceValue ||
        [
          '_',
          '-',
          '--',
          'N/A',
          'NA',
        ].includes(
          cleanSourceValue.toUpperCase()
        )
      ) {

        report.blankSourceValuesSkipped++;

        return;
      }

        if (cleanTargetValue) {

          report
            .existingTargetValuesSkipped++;

          return;
        }

        report.fieldsEligibleForCopy++;

        report.proposedChanges.push({

          primaryRow:
            primaryIndex + 1,

          spouseRow:
            spouseIndex + 1,

          familyId:
            familyId,

          primaryKefgId:
            primaryKefgId,

          spouseKefgId:
            relatedKefgId,

          sourceHeader:
            mapping.sourceHeader,

          targetHeader:
            mapping.targetHeader,

          value:
            sourceValue
        });

        if (!applyChanges) {
          return;
        }

        spouseRow[
          mapping.targetColumn
        ] =
          sourceValue;

        if (
          !Object.prototype
            .hasOwnProperty.call(
              changedRows,
              spouseIndex
            )
        ) {

          changedRows[
            spouseIndex
          ] = {};
        }

        changedRows[
          spouseIndex
        ][
          mapping.targetColumn
        ] =
          sourceValue;

        report.fieldsCopied++;

      }
    );
  }

  if (applyChanges) {

    const lock =
      LockService.getScriptLock();

    try {

      lock.waitLock(
        30000
      );

      Object.keys(
        changedRows
      ).forEach(function (
        spouseIndexText
      ) {

        const spouseIndex =
          Number(
            spouseIndexText
          );

        const changedColumns =
          changedRows[
            spouseIndex
          ];

        Object.keys(
          changedColumns
        ).forEach(function (
          columnIndexText
        ) {

          const columnIndex =
            Number(
              columnIndexText
            );

          sheet
            .getRange(
              spouseIndex + 1,
              columnIndex + 1
            )
            .setValue(
              changedColumns[
                columnIndex
              ]
            );

        });

      });

    } finally {

      lock.releaseLock();

    }
  }

  report.changedSpouseRows =
    Object.keys(
      changedRows
    ).length;

  report.message =
    applyChanges
      ? (
          report.fieldsCopied +
          ' spouse field value(s) were copied to ' +
          report.changedSpouseRows +
          ' spouse row(s).'
        )
      : (
          report.fieldsEligibleForCopy +
          ' spouse field value(s) are eligible for migration.'
        );

  return report;
}


/**
 * Returns legacy-to-standard mappings whose source and target
 * headers both exist in the Master Database.
 */
function KGMIS_SpouseMigration_GetAvailableMappings_(
  column
) {

  const mappings = [];

  Object.keys(
    KGMIS_SPOUSE_ROW_MIGRATION_CONFIG
      .FIELD_MAPPING
  ).forEach(function (
    sourceHeader
  ) {

    const targetHeader =
      KGMIS_SPOUSE_ROW_MIGRATION_CONFIG
        .FIELD_MAPPING[
          sourceHeader
        ];

    if (
      !Object.prototype
        .hasOwnProperty.call(
          column,
          sourceHeader
        )
    ) {
      return;
    }

    if (
      !Object.prototype
        .hasOwnProperty.call(
          column,
          targetHeader
        )
    ) {
      return;
    }

    mappings.push({

      sourceHeader:
        sourceHeader,

      targetHeader:
        targetHeader,

      sourceColumn:
        column[
          sourceHeader
        ],

      targetColumn:
        column[
          targetHeader
        ]
    });

  });

  return mappings;
}


/**
 * Returns mappings that could not be used because the source
 * or target header does not exist.
 */
function KGMIS_SpouseMigration_GetUnavailableMappings_(
  column
) {

  const unavailable = [];

  Object.keys(
    KGMIS_SPOUSE_ROW_MIGRATION_CONFIG
      .FIELD_MAPPING
  ).forEach(function (
    sourceHeader
  ) {

    const targetHeader =
      KGMIS_SPOUSE_ROW_MIGRATION_CONFIG
        .FIELD_MAPPING[
          sourceHeader
        ];

    const sourceExists =
      Object.prototype
        .hasOwnProperty.call(
          column,
          sourceHeader
        );

    const targetExists =
      Object.prototype
        .hasOwnProperty.call(
          column,
          targetHeader
        );

    if (
      sourceExists &&
      targetExists
    ) {
      return;
    }

    unavailable.push({

      sourceHeader:
        sourceHeader,

      targetHeader:
        targetHeader,

      sourceExists:
        sourceExists,

      targetExists:
        targetExists
    });

  });

  return unavailable;
}


/**
 * Returns true when the row itself is a spouse row.
 */
function KGMIS_SpouseMigration_IsSpouseCategory_(
  memberCategory
) {

  const normalised =
    KGMIS_SpouseMigration_NormaliseText_(
      memberCategory
    );

  return (
    normalised.indexOf(
      'SPOUSE'
    ) !== -1
  );
}


/**
 * Creates a zero-based header map.
 */
function KGMIS_SpouseMigration_CreateColumnMap_(
  headers
) {

  const column = {};

  headers.forEach(function (
    header,
    index
  ) {

    if (!header) {
      return;
    }

    if (
      Object.prototype
        .hasOwnProperty.call(
          column,
          header
        )
    ) {

      throw new Error(
        'Duplicate Master Database header found: ' +
        header
      );
    }

    column[
      header
    ] =
      index;

  });

  return column;
}


/**
 * Verifies required headers.
 */
function KGMIS_SpouseMigration_RequireHeaders_(
  column,
  requiredHeaders
) {

  const missingHeaders =
    requiredHeaders.filter(
      function (header) {

        return !Object.prototype
          .hasOwnProperty.call(
            column,
            header
          );

      }
    );

  if (
    missingHeaders.length
  ) {

    throw new Error(
      'The Master Database is missing required headers: ' +
      missingHeaders.join(', ')
    );
  }
}


/**
 * Normalises a sheet header.
 */
function KGMIS_SpouseMigration_NormaliseHeader_(
  value
) {

  return KGMIS_SpouseMigration_Clean_(
    value
  )
    .toUpperCase()
    .replace(
      /[^A-Z0-9]+/g,
      '_'
    )
    .replace(
      /^_+|_+$/g,
      ''
    );
}


/**
 * Normalises text for comparison.
 */
function KGMIS_SpouseMigration_NormaliseText_(
  value
) {

  return KGMIS_SpouseMigration_Clean_(
    value
  )
    .toUpperCase()
    .replace(
      /[_-]+/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    );
}


/**
 * Returns trimmed text.
 */
function KGMIS_SpouseMigration_Clean_(
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