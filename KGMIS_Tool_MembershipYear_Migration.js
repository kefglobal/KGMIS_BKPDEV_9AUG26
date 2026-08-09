function KGMIS_TestRunMembershipYearMigration() {
  const SOURCE_SHEET_NAME =
    'KGMIS_MASTER_DATABASE_v1.0';

  const DESTINATION_SHEET_NAME =
    'KGMIS_MEMBERSHIP_YEAR';

  const FINANCIAL_YEAR =
    '2026-27';

  const MEMBERSHIP_FEE =
    1000;

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sourceSheet =
    spreadsheet.getSheetByName(
      SOURCE_SHEET_NAME
    );

  const destinationSheet =
    spreadsheet.getSheetByName(
      DESTINATION_SHEET_NAME
    );

  if (!sourceSheet) {
    throw new Error(
      'Source sheet not found: ' +
      SOURCE_SHEET_NAME
    );
  }

  if (!destinationSheet) {
    throw new Error(
      'Destination sheet not found: ' +
      DESTINATION_SHEET_NAME
    );
  }

  const sourceValues =
    sourceSheet.getDataRange().getValues();

  const destinationValues =
    destinationSheet.getDataRange().getValues();

  if (sourceValues.length < 2) {
    throw new Error(
      'The source sheet has no data rows.'
    );
  }

  if (destinationValues.length < 1) {
  throw new Error(
    'The destination sheet has no header row.'
  );
}

  const sourceHeaders =
    sourceValues[0].map(function (header) {
      return String(header || '')
        .trim()
        .toUpperCase();
    });

  const destinationHeaders =
    destinationValues[0].map(function (header) {
      return String(header || '')
        .trim()
        .toUpperCase();
    });

  const sourceColumn = {};
  const destinationColumn = {};

  sourceHeaders.forEach(
    function (header, index) {
      if (header) {
        sourceColumn[header] = index;
      }
    }
  );

  destinationHeaders.forEach(
    function (header, index) {
      if (header) {
        destinationColumn[header] = index;
      }
    }
  );

  const requiredSourceHeaders = [
    'FAMILY_ID',
    'SUBSCRIPTION_STATUS_2026_2027'
  ];

  const requiredDestinationHeaders = [
    'MEMBERSHIP_YEAR_KEY',
    'FAMILY_ID',
    'FINANCIAL_YEAR',
    'MEMBERSHIP_TYPE',
    'MEMBERSHIP_STATUS',
    'PAYMENT_STATUS',
    'AMOUNT_DUE',
    'AMOUNT_RECEIVED',
    'OUTSTANDING_DUES',
    'PAYMENT_COUNT',
    'FIRST_PAYMENT_DATE',
    'LAST_PAYMENT_DATE',
    'RENEWAL_DATE',
    'RECORD_STATUS',
    'UPDATED_ON',
    'UPDATED_BY'
  ];

  requiredSourceHeaders.forEach(
    function (header) {
      if (
        !Object.prototype.hasOwnProperty.call(
          sourceColumn,
          header
        )
      ) {
        throw new Error(
          'Missing source header: ' +
          header
        );
      }
    }
  );

  requiredDestinationHeaders.forEach(
    function (header) {
      if (
        !Object.prototype.hasOwnProperty.call(
          destinationColumn,
          header
        )
      ) {
        throw new Error(
          'Missing destination header: ' +
          header
        );
      }
    }
  );

  const paidFamilyIds =
    new Set();

  for (
    let rowIndex = 1;
    rowIndex < sourceValues.length;
    rowIndex++
  ) {
    const row =
      sourceValues[rowIndex];

    const familyId =
      String(
        row[
          sourceColumn.FAMILY_ID
        ] || ''
      ).trim();

    const legacyStatus =
      String(
        row[
          sourceColumn
            .SUBSCRIPTION_STATUS_2026_2027
        ] || ''
      )
        .trim()
        .toUpperCase();

    if (
      familyId &&
      legacyStatus === 'PAID'
    ) {
      paidFamilyIds.add(
        familyId
      );
    }
  }

  const today =
    new Date();

  const updatedBy =
    'Membership Year Migration';

  let rowsUpdated = 0;
  let alreadyMatching = 0;
  let paidFamiliesFound =
    paidFamilyIds.size;

  const matchedFamilyIds =
    new Set();

  for (
    let rowIndex = 1;
    rowIndex < destinationValues.length;
    rowIndex++
  ) {
    const row =
      destinationValues[rowIndex];

    const familyId =
      String(
        row[
          destinationColumn.FAMILY_ID
        ] || ''
      ).trim();

    const financialYear =
      String(
        row[
          destinationColumn.FINANCIAL_YEAR
        ] || ''
      ).trim();

    if (
      !familyId ||
      financialYear !== FINANCIAL_YEAR ||
      !paidFamilyIds.has(familyId)
    ) {
      continue;
    }

    matchedFamilyIds.add(
      familyId
    );

    const expectedValues = {
      MEMBERSHIP_YEAR_KEY:
        familyId + '|' + FINANCIAL_YEAR,

      MEMBERSHIP_TYPE:
        'FAMILY',

      MEMBERSHIP_STATUS:
        'CURRENT',

      PAYMENT_STATUS:
        'PAID',

      AMOUNT_DUE:
        MEMBERSHIP_FEE,

      AMOUNT_RECEIVED:
        MEMBERSHIP_FEE,

      OUTSTANDING_DUES:
        0,

      PAYMENT_COUNT:
        1,

      FIRST_PAYMENT_DATE:
        today,

      LAST_PAYMENT_DATE:
        today,

      RENEWAL_DATE:
        today,

      RECORD_STATUS:
        'ACTIVE',

      UPDATED_ON:
        today,

      UPDATED_BY:
        updatedBy
    };

    let rowChanged = false;

    Object.keys(
      expectedValues
    ).forEach(function (header) {
      const columnIndex =
        destinationColumn[header];

      const currentValue =
        row[columnIndex];

      const expectedValue =
        expectedValues[header];

      let isSame;

      if (
        expectedValue instanceof Date
      ) {
        isSame =
          currentValue instanceof Date &&
          currentValue.getFullYear() ===
            expectedValue.getFullYear() &&
          currentValue.getMonth() ===
            expectedValue.getMonth() &&
          currentValue.getDate() ===
            expectedValue.getDate();
      } else if (
        typeof expectedValue === 'number'
      ) {
        isSame =
          Number(currentValue || 0) ===
          expectedValue;
      } else {
        isSame =
          String(currentValue || '')
            .trim()
            .toUpperCase() ===
          String(expectedValue)
            .trim()
            .toUpperCase();
      }

      if (!isSame) {
        row[columnIndex] =
          expectedValue;

        rowChanged = true;
      }
    });

    if (rowChanged) {
      rowsUpdated++;
    } else {
      alreadyMatching++;
    }
  }

  if (rowsUpdated > 0) {
    destinationSheet
      .getRange(
        2,
        1,
        destinationValues.length - 1,
        destinationValues[0].length
      )
      .setValues(
        destinationValues.slice(1)
      );
  }

  const missingMembershipYearRecords =
    Array.from(
      paidFamilyIds
    ).filter(function (familyId) {
      return !matchedFamilyIds.has(
        familyId
      );
    });

  destinationSheet
    .getRange(
      2,
      destinationColumn
        .AMOUNT_DUE + 1,
      Math.max(
        destinationValues.length - 1,
        1
      ),
      3
    )
    .setNumberFormat(
      '#,##0.00'
    );

  destinationSheet
    .getRange(
      2,
      destinationColumn
        .FIRST_PAYMENT_DATE + 1,
      Math.max(
        destinationValues.length - 1,
        1
      ),
      3
    )
    .setNumberFormat(
      'dd-mmm-yyyy'
    );

  const result =
    'Membership Year Migration Completed\n\n' +
    'Financial Year: ' +
    FINANCIAL_YEAR +
    '\n\n' +
    'PAID families found: ' +
    paidFamiliesFound +
    '\n' +
    'Rows updated: ' +
    rowsUpdated +
    '\n' +
    'Already matching: ' +
    alreadyMatching +
    '\n' +
    'Missing Membership Year rows: ' +
    missingMembershipYearRecords.length;

  Logger.log(result);

  return {
    success: true,
    financialYear:
      FINANCIAL_YEAR,
    paidFamiliesFound:
      paidFamiliesFound,
    rowsUpdated:
      rowsUpdated,
    alreadyMatching:
      alreadyMatching,
    missingMembershipYearRecords:
      missingMembershipYearRecords
  };
}




function KGMIS_RunMembershipYearMigration() {
  const SOURCE_SHEET_NAME =
    'KGMIS_MASTER_DATABASE_v1.0';

  const DESTINATION_SHEET_NAME =
    'KGMIS_MEMBERSHIP_YEAR';

  const FINANCIAL_YEAR =
    '2026-27';

  const MEMBERSHIP_FEE =
    1000;

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sourceSheet =
    spreadsheet.getSheetByName(
      SOURCE_SHEET_NAME
    );

  const destinationSheet =
    spreadsheet.getSheetByName(
      DESTINATION_SHEET_NAME
    );

  if (!sourceSheet) {
    throw new Error(
      'Source sheet not found: ' +
      SOURCE_SHEET_NAME
    );
  }

  if (!destinationSheet) {
    throw new Error(
      'Destination sheet not found: ' +
      DESTINATION_SHEET_NAME
    );
  }

  const sourceValues =
    sourceSheet.getDataRange().getValues();

  const destinationValues =
    destinationSheet.getDataRange().getValues();

  if (sourceValues.length < 2) {
    throw new Error(
      'The source sheet has no data rows.'
    );
  }

  if (destinationValues.length < 1) {
    throw new Error(
      'The destination sheet has no header row.'
    );
  }

  const sourceHeaders =
    sourceValues[0].map(function (header) {
      return String(header || '')
        .trim()
        .toUpperCase();
    });

  const destinationHeaders =
    destinationValues[0].map(function (header) {
      return String(header || '')
        .trim()
        .toUpperCase();
    });

  const sourceColumn = {};
  const destinationColumn = {};

  sourceHeaders.forEach(
    function (header, index) {
      if (header) {
        sourceColumn[header] = index;
      }
    }
  );

  destinationHeaders.forEach(
    function (header, index) {
      if (header) {
        destinationColumn[header] = index;
      }
    }
  );

  const requiredSourceHeaders = [
    'FAMILY_ID',
    'SUBSCRIPTION_STATUS_2026_2027'
  ];

  const requiredDestinationHeaders = [
    'MEMBERSHIP_YEAR_KEY',
    'FAMILY_ID',
    'FINANCIAL_YEAR',
    'MEMBERSHIP_TYPE',
    'MEMBERSHIP_STATUS',
    'PAYMENT_STATUS',
    'AMOUNT_DUE',
    'AMOUNT_RECEIVED',
    'OUTSTANDING_DUES',
    'PAYMENT_COUNT',
    'FIRST_PAYMENT_DATE',
    'LAST_PAYMENT_DATE',
    'RENEWAL_DATE',
    'RECORD_STATUS',
    'REMARKS',
    'CREATED_ON',
    'CREATED_BY',
    'UPDATED_ON',
    'UPDATED_BY'
  ];

  requiredSourceHeaders.forEach(
    function (header) {
      if (
        !Object.prototype.hasOwnProperty.call(
          sourceColumn,
          header
        )
      ) {
        throw new Error(
          'Missing source header: ' +
          header
        );
      }
    }
  );

  requiredDestinationHeaders.forEach(
    function (header) {
      if (
        !Object.prototype.hasOwnProperty.call(
          destinationColumn,
          header
        )
      ) {
        throw new Error(
          'Missing destination header: ' +
          header
        );
      }
    }
  );

  const paidFamilyIds =
    new Set();

  for (
    let rowIndex = 1;
    rowIndex < sourceValues.length;
    rowIndex++
  ) {
    const row =
      sourceValues[rowIndex];

    const familyId =
      String(
        row[
          sourceColumn.FAMILY_ID
        ] || ''
      ).trim();

    const legacyStatus =
      String(
        row[
          sourceColumn
            .SUBSCRIPTION_STATUS_2026_2027
        ] || ''
      )
        .trim()
        .toUpperCase();

    if (
      familyId &&
      legacyStatus === 'PAID'
    ) {
      paidFamilyIds.add(
        familyId
      );
    }
  }

  const existingKeys =
    new Set();

  for (
    let rowIndex = 1;
    rowIndex < destinationValues.length;
    rowIndex++
  ) {
    const key =
      String(
        destinationValues[rowIndex][
          destinationColumn.MEMBERSHIP_YEAR_KEY
        ] || ''
      ).trim();

    if (key) {
      existingKeys.add(
        key
      );
    }
  }

  const today =
    new Date();

  const createdBy =
    'Membership Year Migration';

  const rowsToAppend = [];

  paidFamilyIds.forEach(
    function (familyId) {
      const membershipYearKey =
        familyId + '|' + FINANCIAL_YEAR;

      if (
        existingKeys.has(
          membershipYearKey
        )
      ) {
        return;
      }

      const newRow =
        new Array(
          destinationHeaders.length
        ).fill('');

      newRow[
        destinationColumn.MEMBERSHIP_YEAR_KEY
      ] =
        membershipYearKey;

      newRow[
        destinationColumn.FAMILY_ID
      ] =
        familyId;

      newRow[
        destinationColumn.FINANCIAL_YEAR
      ] =
        FINANCIAL_YEAR;

      newRow[
        destinationColumn.MEMBERSHIP_TYPE
      ] =
        'FAMILY';

      newRow[
        destinationColumn.MEMBERSHIP_STATUS
      ] =
        'CURRENT';

      newRow[
        destinationColumn.PAYMENT_STATUS
      ] =
        'PAID';

      newRow[
        destinationColumn.AMOUNT_DUE
      ] =
        MEMBERSHIP_FEE;

      newRow[
        destinationColumn.AMOUNT_RECEIVED
      ] =
        MEMBERSHIP_FEE;

      newRow[
        destinationColumn.OUTSTANDING_DUES
      ] =
        0;

      newRow[
        destinationColumn.PAYMENT_COUNT
      ] =
        1;

      newRow[
        destinationColumn.FIRST_PAYMENT_DATE
      ] =
        today;

      newRow[
        destinationColumn.LAST_PAYMENT_DATE
      ] =
        today;

      newRow[
        destinationColumn.RENEWAL_DATE
      ] =
        today;

      newRow[
        destinationColumn.RECORD_STATUS
      ] =
        'ACTIVE';

      newRow[
        destinationColumn.REMARKS
      ] =
        'Migrated from legacy subscription status';

      newRow[
        destinationColumn.CREATED_ON
      ] =
        today;

      newRow[
        destinationColumn.CREATED_BY
      ] =
        createdBy;

      newRow[
        destinationColumn.UPDATED_ON
      ] =
        today;

      newRow[
        destinationColumn.UPDATED_BY
      ] =
        createdBy;

      rowsToAppend.push(
        newRow
      );

      existingKeys.add(
        membershipYearKey
      );
    }
  );

  if (rowsToAppend.length > 0) {
    const startRow =
      destinationSheet.getLastRow() + 1;

    destinationSheet
      .getRange(
        startRow,
        1,
        rowsToAppend.length,
        destinationHeaders.length
      )
      .setValues(
        rowsToAppend
      );

    destinationSheet
      .getRange(
        startRow,
        destinationColumn.AMOUNT_DUE + 1,
        rowsToAppend.length,
        3
      )
      .setNumberFormat(
        '#,##0.00'
      );

    destinationSheet
      .getRange(
        startRow,
        destinationColumn.FIRST_PAYMENT_DATE + 1,
        rowsToAppend.length,
        3
      )
      .setNumberFormat(
        'dd-mmm-yyyy'
      );

    destinationSheet
      .getRange(
        startRow,
        destinationColumn.CREATED_ON + 1,
        rowsToAppend.length,
        1
      )
      .setNumberFormat(
        'dd-mmm-yyyy hh:mm'
      );

    destinationSheet
      .getRange(
        startRow,
        destinationColumn.UPDATED_ON + 1,
        rowsToAppend.length,
        1
      )
      .setNumberFormat(
        'dd-mmm-yyyy hh:mm'
      );
  }

  const skippedExisting =
    paidFamilyIds.size -
    rowsToAppend.length;

  const result =
    'Membership Year Migration Completed\n\n' +
    'Financial Year: ' +
    FINANCIAL_YEAR +
    '\n\n' +
    'PAID families found: ' +
    paidFamilyIds.size +
    '\n' +
    'Rows created: ' +
    rowsToAppend.length +
    '\n' +
    'Existing rows skipped: ' +
    skippedExisting;

  Logger.log(result);

  return {
    success: true,
    financialYear:
      FINANCIAL_YEAR,
    paidFamiliesFound:
      paidFamilyIds.size,
    rowsCreated:
      rowsToAppend.length,
    existingRowsSkipped:
      skippedExisting
  };
}