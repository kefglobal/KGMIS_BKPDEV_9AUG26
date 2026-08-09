/******************************************************************************
 *
 * KEFG Membership Information System (KMIS)
 *
 * Module        : Database Service
 * File          : 22_Database_Service.gs
 * Version       : 2.0
 * Status        : Development
 * Designed and Developed by: James Joseph Alenchery
 ******************************************************************************/

/**
 * Central database-access layer for KMIS.
 *
 * Other application modules should use these functions instead of directly
 * reading the master database sheet.
 */

const KMIS_DB_CONFIG = Object.freeze({

  REQUIRED_MASTER_HEADERS: Object.freeze([
    'KEFG_ID',
    'FAMILY_ID',
    'RELATED_MEMBER_KEFG_ID',
    'MEMBER_CATEGORY',
    'RECORD_STATUS',
    'MEMBER_NAME',
    'FAMILY_PHOTO',
    'GENDER',
    'BLOOD_GROUP',
    'ALUMNI_ASSOCIATION',
    'BRANCH',
    'YEAR_BATCH',
    'TYPE_OF_MEMBERSHIP',
    'SUBSCRIPTION_STATUS_2026_2027',
    'SUBSCRIPTION_PAYMENT_DATE_2026_2027',
    'MEMBER_MOBILE',
    'MEMBER_WHATSAPP',
    'MEMBER_EMAIL',
    'ZONE',
    'SPOUSE_NAME',
    'SPOUSE_MOBILE',
    'SPOUSE_WHATSAPP',
    'SPOUSE_EMAIL',
    'SPOUSE_GENDER',
    'SPOUSE_ALUMNI_ASSOCIATION',
    'SPOUSE_BRANCH',
    'SPOUSE_BATCH_YEAR',
    'PROFILE_LAST_UPDATED'
  ]),

  CACHE_KEYS: Object.freeze({
    MASTER_SHEET_NAME: 'KMIS_DB_MASTER_SHEET_NAME',
    MASTER_HEADERS: 'KMIS_DB_MASTER_HEADERS'
  }),

  CACHE_SECONDS: 300
});


/**
 * Returns the active KMIS spreadsheet.
 */
function KMIS_DB_GetSpreadsheet() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  if (!spreadsheet) {
    throw new Error(
      'The KMIS spreadsheet could not be opened.'
    );
  }

  return spreadsheet;
}


/**
 * Locates and returns the KMIS master database sheet.
 *
 * It identifies the master sheet using the required Row 1 headers,
 * so the sheet name does not need to be hard-coded.
 */
function KMIS_DB_GetMasterSheet() {
  const spreadsheet = KMIS_DB_GetSpreadsheet();
  const cache = CacheService.getScriptCache();

  const cachedSheetName = cache.get(
    KMIS_DB_CONFIG.CACHE_KEYS.MASTER_SHEET_NAME
  );

  if (cachedSheetName) {
    const cachedSheet =
      spreadsheet.getSheetByName(cachedSheetName);

    if (
      cachedSheet &&
      KMIS_DB_SheetContainsRequiredHeaders_(cachedSheet)
    ) {
      return cachedSheet;
    }
  }

  const sheets = spreadsheet.getSheets();

  for (const sheet of sheets) {
    if (
      KMIS_DB_SheetContainsRequiredHeaders_(sheet)
    ) {
      cache.put(
        KMIS_DB_CONFIG.CACHE_KEYS.MASTER_SHEET_NAME,
        sheet.getName(),
        KMIS_DB_CONFIG.CACHE_SECONDS
      );

      return sheet;
    }
  }

  throw new Error(
    'The KMIS master database sheet could not be located.'
  );
}


/**
 * Returns the access-control sheet.
 */
function KMIS_DB_GetAccessSheet() {
  const sheet = KMIS_DB_GetSpreadsheet()
    .getSheetByName(
      KMIS_CONSTANTS.SHEETS.ACCESS_CONTROL
    );

  if (!sheet) {
    throw new Error(
      `Required sheet "${KMIS_CONSTANTS.SHEETS.ACCESS_CONTROL}" was not found.`
    );
  }

  return sheet;
}


/**
 * Returns the system-settings sheet.
 */
function KMIS_DB_GetSettingsSheet() {
  const sheet = KMIS_DB_GetSpreadsheet()
    .getSheetByName(
      KMIS_CONSTANTS.SHEETS.SYSTEM_SETTINGS
    );

  if (!sheet) {
    throw new Error(
      `Required sheet "${KMIS_CONSTANTS.SHEETS.SYSTEM_SETTINGS}" was not found.`
    );
  }

  return sheet;
}


/**
 * Returns the KEFG Family Members sheet.
 */
function KMIS_DB_GetFamilyMembersSheet() {

  const sheet =
    KMIS_DB_GetSpreadsheet()
      .getSheetByName(
        KGMIS_CONFIG.FAMILY_MEMBERS_SHEET
      );

  if (!sheet) {
    throw new Error(
      `Required sheet "${KGMIS_CONFIG.FAMILY_MEMBERS_SHEET}" was not found.`
    );
  }

  return sheet;
}


/**
 * Returns all KEFG Family Member records
 * belonging to one FAMILY_ID.
 *
 * This function performs READ operations only.
 */
function KMIS_DB_GetFamilyMembersByFamilyID(
  familyId
) {

  const safeFamilyId =
    KMIS_DB_Clean_(familyId);

  if (!safeFamilyId) {
    return [];
  }


  const sheet =
    KMIS_DB_GetFamilyMembersSheet();

  const context =
    KMIS_DB_GetContext({
      sheet: sheet
    });


  const requiredHeaders = [
    'PERSON_ID',
    'DEPENDANT_ID',
    'FAMILY_ID',
    'RELATED_KEFG_ID',
    'FULL_NAME',
    'FAMILY_RELATION',
    'GENDER',
    'BLOOD_GROUP',
    'DATE_OF_BIRTH',
    'AGE',
    'RELATION_SEQUENCE',
    'CARD_ELIGIBLE',
    'MOBILE',
    'EMAIL',
    'PHOTO_FILE_ID',
    'PHOTO_URL',
    'DEPENDENCY_STATUS',
    'ELIGIBILITY_STATUS',
    'RECORD_STATUS',
    'CREATED_ON',
    'CREATED_BY',
    'UPDATED_ON',
    'UPDATED_BY',
    'FAMILY_PROFESSION_SKILLS',
    'FAMILY_ACTIVITIES',
    'FAMILY_WILLING_TO_VOLUNTEER',
    'REMARKS'
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
      'The KEFG Family Members sheet is missing required headers: ' +
      missingHeaders.join(', ')
    );
  }


  const familyIdColumn =
    context.column.FAMILY_ID;

  const records = [];


  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {

    const row =
      context.values[rowIndex];

    const rowFamilyId =
      KMIS_DB_Clean_(
        row[familyIdColumn]
      );


    if (rowFamilyId !== safeFamilyId) {
      continue;
    }


    records.push(
      KMIS_DB_RowToObject(
        row,
        context.headers,
        rowIndex + 1
      )
    );
  }


  return records;
}

/**
 * Returns all Row 1 headers from a sheet.
 */
function KMIS_DB_GetHeaders(sheet) {
  const targetSheet =
    sheet || KMIS_DB_GetMasterSheet();

  const lastColumn =
    targetSheet.getLastColumn();

  if (lastColumn < 1) {
    throw new Error(
      `Sheet "${targetSheet.getName()}" contains no columns.`
    );
  }

  return targetSheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(header => String(header).trim());
}


/**
 * Returns a zero-based header-to-column map.
 *
 * Example:
 * column.MEMBER_NAME
 * column.FAMILY_ID
 */
function KMIS_DB_GetColumnMap(sheet) {
  const headers = KMIS_DB_GetHeaders(sheet);
  const column = {};

  headers.forEach((header, index) => {
    if (!header) {
      return;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        column,
        header
      )
    ) {
      throw new Error(
        `Duplicate database header found: ${header}`
      );
    }

    column[header] = index;
  });

  return column;
}


/**
 * Returns the complete database context.
 */
function KMIS_DB_GetContext(options) {
  const safeOptions = options || {};
  const sheet =
    safeOptions.sheet || KMIS_DB_GetMasterSheet();

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  const headers = KMIS_DB_GetHeaders(sheet);
  const column = KMIS_DB_GetColumnMap(sheet);

  const values =
    lastRow >= 1 && lastColumn >= 1
      ? sheet
          .getRange(
            1,
            1,
            lastRow,
            lastColumn
          )
          .getValues()
      : [];

  return {
    spreadsheet: KMIS_DB_GetSpreadsheet(),
    sheet,
    sheetName: sheet.getName(),
    lastRow,
    lastColumn,
    headers,
    column,
    values
  };
}


/**
 * Validates the master database schema.
 */
function KMIS_DB_ValidateMasterSchema() {
  const context = KMIS_DB_GetContext();
  const missingHeaders = [];

  KMIS_DB_CONFIG.REQUIRED_MASTER_HEADERS
    .forEach(header => {
      if (
        !Object.prototype.hasOwnProperty.call(
          context.column,
          header
        )
      ) {
        missingHeaders.push(header);
      }
    });

  const duplicateHeaders =
    KMIS_DB_FindDuplicateHeaders_(
      context.headers
    );

  return {
    success:
      missingHeaders.length === 0 &&
      duplicateHeaders.length === 0,

    sheetName: context.sheetName,

    missingHeaders,
    duplicateHeaders,

    totalHeaders:
      context.headers.length,

    totalDataRows:
      Math.max(context.lastRow - 1, 0)
  };
}


/**
 * Returns one raw data row as an object keyed by exact KMIS headers.
 */
function KMIS_DB_RowToObject(
  row,
  headers,
  sheetRow
) {
  const record = {};

  headers.forEach((header, index) => {
    if (header) {
      record[header] = row[index];
    }
  });

  record.__SHEET_ROW = sheetRow;

  return record;
}


/**
 * Returns every non-empty KMIS master record as an object.
 */
function KMIS_DB_GetAllRecords() {
  const context = KMIS_DB_GetContext();
  const records = [];

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row = context.values[rowIndex];

    const kefgId = KMIS_DB_Clean_(
      row[context.column.KEFG_ID]
    );

    const familyId = KMIS_DB_Clean_(
      row[context.column.FAMILY_ID]
    );

    if (!kefgId && !familyId) {
      continue;
    }

    records.push(
      KMIS_DB_RowToObject(
        row,
        context.headers,
        rowIndex + 1
      )
    );
  }

  return records;
}


/**
 * ============================================================
 * Returns the next available IDs for a new family registration.
 *
 * PURPOSE
 * -------
 * Determines the next available:
 *
 * • FAMILY_ID
 * • Primary Member KEFG_ID
 * • Spouse KEFG_ID
 *
 * This function performs READ operations only.
 * No data is written to the database.
 *
 * IMPORTANT
 * ---------
 * These IDs are preview values only.
 * The final IDs must always be regenerated while holding
 * a Script Lock immediately before saving the records.
 * ============================================================
 */
function KGMIS_DB_GetNextFamilyRegistrationIds() {

  const context =
    KMIS_DB_GetContext();

  const requiredHeaders = [
    'KEFG_ID',
    'FAMILY_ID'
  ];

  requiredHeaders.forEach(function (header) {

    if (
      !Object.prototype.hasOwnProperty.call(
        context.column,
        header
      )
    ) {
      throw new Error(
        'Required database header not found: ' +
        header
      );
    }

  });

  let highestKefgNumber =
    KGMIS_CONFIG.ID_START_NUMBER - 1;

  let highestFamilyNumber = 0;

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {

    const row =
      context.values[rowIndex];

    const kefgId =
      String(
        row[
          context.column.KEFG_ID
        ] || ''
      )
      .trim()
      .toUpperCase();

    const familyId =
      String(
        row[
          context.column.FAMILY_ID
        ] || ''
      )
      .trim()
      .toUpperCase();

    const kefgMatch =
      kefgId.match(
        /^KEFG(\d+)$/
      );

    if (kefgMatch) {

      highestKefgNumber =
        Math.max(
          highestKefgNumber,
          Number(kefgMatch[1])
        );

    }

    const familyMatch =
      familyId.match(
        /^FAM(\d+)$/
      );

    if (familyMatch) {

      highestFamilyNumber =
        Math.max(
          highestFamilyNumber,
          Number(familyMatch[1])
        );

    }

  }

  return {

    familyId:
      'FAM' +
      String(
        highestFamilyNumber + 1
      ).padStart(5, '0'),

    primaryMemberKefgId:
      KGMIS_formatMemberId_(
        highestKefgNumber + 1
      ),

    spouseKefgId:
      KGMIS_formatMemberId_(
        highestKefgNumber + 2
      )

  };

}


/**
 * ============================================================
 * Prepares the final IDs and consecutive row numbers required
 * for a new family registration.
 *
 * PURPOSE
 * -------
 * This is the first-stage database transaction test for the
 * Add New Member module.
 *
 * It:
 * 1. Acquires the KGMIS Script Lock.
 * 2. Recalculates the next available registration IDs.
 * 3. Determines the two consecutive rows that would be used.
 * 4. Returns the IDs and proposed row numbers.
 *
 * This function does NOT write any values to the database.
 *
 * @param {Object} registrationData
 * @return {Object}
 * ============================================================
 */
function KGMIS_DB_CreateFamilyPreview(
  registrationData
) {

  const data =
    registrationData &&
    typeof registrationData === 'object'
      ? registrationData
      : {};

  const includeSpouse =
    data.includeSpouse !== false;

  const lock =
    LockService.getScriptLock();

  try {

    lock.waitLock(30000);

    /*
     * Reload the database while holding the lock.
     * Do not rely on the IDs previously displayed in the UI.
     */
    const context =
      KMIS_DB_GetContext();

    const ids =
      KGMIS_DB_GetNextFamilyRegistrationIds();

    /*
     * The master database presently stores records from Row 2
     * onward. The next row after the last occupied row is used
     * for the Primary Member.
     */
    const primaryMemberRow =
      Math.max(
        context.lastRow + 1,
        KGMIS_CONFIG.FIRST_DATA_ROW
      );

    const spouseRow =
      includeSpouse
        ? primaryMemberRow + 1
        : 0;

    return {
      success: true,
      previewOnly: true,

      familyId:
        ids.familyId,

      primaryMemberKefgId:
        ids.primaryMemberKefgId,

      spouseKefgId:
        includeSpouse
          ? ids.spouseKefgId
          : '',

      primaryMemberRow:
        primaryMemberRow,

      spouseRow:
        spouseRow,

      includeSpouse:
        includeSpouse,

      message:
        includeSpouse
          ? (
              'The final IDs and consecutive Primary Member ' +
              'and Spouse row numbers were prepared successfully. ' +
              'No database values were changed.'
            )
          : (
              'The final Family ID, Primary Member KEFG ID and ' +
              'row number were prepared successfully. ' +
              'No database values were changed.'
            )
    };

  } finally {

    lock.releaseLock();

  }

}


/**
 * ============================================================
 * Creates a new KGMIS family in the Master Database.
 *
 * PURPOSE
 * -------
 * Creates:
 *
 * 1. One Primary Member record.
 * 2. One Spouse record, when Include Spouse is selected.
 * 3. One common FAMILY_ID.
 * 4. Permanent KEFG_ID values.
 * 5. Reciprocal RELATED_MEMBER_KEFG_ID links.
 *
 * The Primary Member and Spouse are written into consecutive
 * rows under the same Master Database headers.
 *
 * IMPORTANT
 * ---------
 * This function performs an actual database write.
 *
 * The function:
 *
 * • Acquires a Script Lock.
 * • Recalculates the final IDs while holding the lock.
 * • Finds the first available row or consecutive row pair.
 * • Writes the complete record or records in one operation.
 * • Returns the final IDs and sheet row numbers.
 *
 * @param {Object} registrationData
 * @return {Object}
 * ============================================================
 */
function KGMIS_DB_CreateFamily(
  registrationData
) {

  const data =
    registrationData &&
    typeof registrationData === 'object'
      ? registrationData
      : {};

  const primaryMember =
    data.primaryMember &&
    typeof data.primaryMember === 'object'
      ? data.primaryMember
      : {};

  const includeSpouse =
    data.includeSpouse !== false;

  const spouse =
    includeSpouse &&
    data.spouse &&
    typeof data.spouse === 'object'
      ? data.spouse
      : null;

  if (!primaryMember.fullName) {
    throw new Error(
      'Primary Member information is missing.'
    );
  }

  if (
    includeSpouse &&
    (
      !spouse ||
      !spouse.fullName
    )
  ) {
    throw new Error(
      'Spouse information is missing.'
    );
  }

  const lock =
    LockService.getScriptLock();

  try {

    lock.waitLock(30000);

    /*
     * Reload the database only after obtaining the lock.
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
      'TYPE_OF_MEMBERSHIP',
      'MEMBER_MOBILE',
      'MEMBER_WHATSAPP',
      'MEMBER_EMAIL',
      'REMARKS',
      'PROFILE_LAST_UPDATED'
    ];

    requiredHeaders.forEach(function (header) {

      if (
        !Object.prototype.hasOwnProperty.call(
          context.column,
          header
        )
      ) {
        throw new Error(
          'Required Master Database header not found: ' +
          header
        );
      }

    });

   /*
    * Stop accidental duplicate registration before
    * generating IDs or writing any database values.
    */
    KGMIS_DB_CheckFamilyRegistrationDuplicates_(
      context,
      primaryMember,
      spouse,
      includeSpouse
    );

    /*
     * Final IDs are recalculated while the lock is held.
     */
    const ids =
      KGMIS_DB_GetNextFamilyRegistrationIds();

    /*
     * Locate the first available row or consecutive row pair.
     */
    const rowAllocation =
      KGMIS_DB_FindAvailableFamilyRows_(
        context,
        includeSpouse
      );

    const primaryMemberRow =
      rowAllocation.primaryMemberRow;

    const spouseRow =
      rowAllocation.spouseRow;

    const now =
      new Date();

    const primaryRecord = {
      KEFG_ID:
        ids.primaryMemberKefgId,

      FAMILY_ID:
        ids.familyId,

      RELATED_MEMBER_KEFG_ID:
        includeSpouse
          ? ids.spouseKefgId
          : '',

      MEMBER_CATEGORY:
        'PRIMARY MEMBER',

      RECORD_STATUS:
        'ACTIVE',

      MEMBER_NAME:
        primaryMember.fullName,

      ALUMNI_ASSOCIATION:
        primaryMember.alumniAssociation,

      BRANCH:
        primaryMember.branch || '',

      TYPE_OF_MEMBERSHIP:
        primaryMember.membershipType,

      MEMBER_MOBILE:
        primaryMember.mobile,

      MEMBER_WHATSAPP:
        primaryMember.whatsapp,

      MEMBER_EMAIL:
        primaryMember.email || '',

      REMARKS:
        data.remarks || '',

      PROFILE_LAST_UPDATED:
        now
    };

    let spouseRecord = null;

    if (includeSpouse) {

      spouseRecord = {
        KEFG_ID:
          ids.spouseKefgId,

        FAMILY_ID:
          ids.familyId,

        RELATED_MEMBER_KEFG_ID:
          ids.primaryMemberKefgId,

        MEMBER_CATEGORY:
          spouse.alumniAssociation ===
            'NOT APPLICABLE'
              ? 'NON-ALUMNI SPOUSE'
              : 'ALUMNI SPOUSE MEMBER',

        RECORD_STATUS:
          'ACTIVE',

        MEMBER_NAME:
          spouse.fullName,

        ALUMNI_ASSOCIATION:
          spouse.alumniAssociation,

        BRANCH:
          spouse.branch || '',

        TYPE_OF_MEMBERSHIP:
          spouse.membershipType,

        MEMBER_MOBILE:
          spouse.mobile,

        MEMBER_WHATSAPP:
          spouse.whatsapp,

        MEMBER_EMAIL:
          spouse.email || '',

        REMARKS:
          data.remarks || '',

        PROFILE_LAST_UPDATED:
          now
      };

    }

    const outputRows = [
      KGMIS_DB_BuildMasterRow_(
        context.headers,
        primaryRecord
      )
    ];

    if (includeSpouse) {
      outputRows.push(
        KGMIS_DB_BuildMasterRow_(
          context.headers,
          spouseRecord
        )
      );
    }

    /*
     * Ensure that the required physical rows exist.
     */
    const lastRequiredRow =
      includeSpouse
        ? spouseRow
        : primaryMemberRow;

    if (
      context.sheet.getMaxRows() <
      lastRequiredRow
    ) {
      context.sheet.insertRowsAfter(
        context.sheet.getMaxRows(),
        lastRequiredRow -
        context.sheet.getMaxRows()
      );
    }

    /*
     * Write the Primary Member and Spouse together.
     */
    context.sheet
      .getRange(
        primaryMemberRow,
        1,
        outputRows.length,
        context.lastColumn
      )
      .setValues(
        outputRows
      );

    /*
     * Apply date formatting to PROFILE_LAST_UPDATED.
     */
    const profileUpdatedColumn =
      context.column.PROFILE_LAST_UPDATED + 1;

    context.sheet
      .getRange(
        primaryMemberRow,
        profileUpdatedColumn,
        outputRows.length,
        1
      )
      .setNumberFormat(
        'dd-MMM-yyyy HH:mm:ss'
      );

    SpreadsheetApp.flush();

    return {
      success: true,

      familyId:
        ids.familyId,

      primaryMemberKefgId:
        ids.primaryMemberKefgId,

      spouseKefgId:
        includeSpouse
          ? ids.spouseKefgId
          : '',

      primaryMemberRow:
        primaryMemberRow,

      spouseRow:
        includeSpouse
          ? spouseRow
          : 0,

      includeSpouse:
        includeSpouse,

      message:
        includeSpouse
          ? (
              'The new family was created successfully. ' +
              'The Primary Member and Spouse records were added.'
            )
          : (
              'The new family and Primary Member record were created successfully.'
            )
    };

  } finally {

    lock.releaseLock();

  }

}


/**
 * ============================================================
 * Checks a proposed family registration for duplicate contact
 * information before records are written to the database.
 *
 * Duplicate checks:
 *
 * • Mobile Number
 * • WhatsApp Number
 * • Email Address, when supplied
 *
 * The check compares:
 *
 * 1. Primary Member against existing database records.
 * 2. Spouse against existing database records.
 * 3. Primary Member against the proposed Spouse.
 *
 * All database records are checked, including inactive records,
 * because an existing KEFG identity must not be recreated.
 *
 * @param {Object} context
 * @param {Object} primaryMember
 * @param {?Object} spouse
 * @param {boolean} includeSpouse
 * ============================================================
 */
function KGMIS_DB_CheckFamilyRegistrationDuplicates_(
  context,
  primaryMember,
  spouse,
  includeSpouse
) {

  if (
    !context ||
    !Array.isArray(context.values) ||
    !context.column
  ) {
    throw new Error(
      'The Master Database context is invalid.'
    );
  }

  const requiredHeaders = [
    'KEFG_ID',
    'MEMBER_NAME',
    'MEMBER_MOBILE',
    'MEMBER_WHATSAPP',
    'MEMBER_EMAIL'
  ];

  requiredHeaders.forEach(function (header) {

    if (
      !Object.prototype.hasOwnProperty.call(
        context.column,
        header
      )
    ) {
      throw new Error(
        'Duplicate checking requires the database header: ' +
        header
      );
    }

  });

  const submittedPeople = [
    {
      label: 'Primary Member',
      person: primaryMember
    }
  ];

  if (includeSpouse && spouse) {
    submittedPeople.push({
      label: 'Spouse',
      person: spouse
    });
  }

  /*
   * First check whether the proposed Primary Member and
   * Spouse contain the same contact information.
   */
  if (
    includeSpouse &&
    spouse
  ) {
    KGMIS_DB_CheckSubmittedPeopleDuplicates_(
      primaryMember,
      spouse
    );
  }

  /*
   * Compare each submitted person against all existing rows.
   */
  submittedPeople.forEach(function (submittedEntry) {

    const submittedPerson =
      submittedEntry.person || {};

    const submittedMobile =
      KGMIS_DB_NormaliseContactNumber_(
        submittedPerson.mobile
      );

    const submittedWhatsapp =
      KGMIS_DB_NormaliseContactNumber_(
        submittedPerson.whatsapp
      );

    const submittedEmail =
      KGMIS_DB_NormaliseEmail_(
        submittedPerson.email
      );

    for (
      let rowIndex = 1;
      rowIndex < context.values.length;
      rowIndex++
    ) {

      const row =
        context.values[rowIndex];

      const existingKefgId =
        KMIS_DB_Clean_(
          row[
            context.column.KEFG_ID
          ]
        );

      const existingName =
        KMIS_DB_Clean_(
          row[
            context.column.MEMBER_NAME
          ]
        );

      /*
       * Ignore completely empty database rows.
       */
      if (
        !existingKefgId &&
        !existingName
      ) {
        continue;
      }

      const existingMobile =
        KGMIS_DB_NormaliseContactNumber_(
          row[
            context.column.MEMBER_MOBILE
          ]
        );

      const existingWhatsapp =
        KGMIS_DB_NormaliseContactNumber_(
          row[
            context.column.MEMBER_WHATSAPP
          ]
        );

      const existingEmail =
        KGMIS_DB_NormaliseEmail_(
          row[
            context.column.MEMBER_EMAIL
          ]
        );

      if (
        submittedMobile &&
        existingMobile &&
        submittedMobile === existingMobile
      ) {
        KGMIS_DB_ThrowRegistrationDuplicate_(
          submittedEntry.label,
          'Mobile Number',
          submittedPerson.mobile,
          existingKefgId,
          existingName,
          rowIndex + 1
        );
      }

      if (
        submittedWhatsapp &&
        existingWhatsapp &&
        submittedWhatsapp === existingWhatsapp
      ) {
        KGMIS_DB_ThrowRegistrationDuplicate_(
          submittedEntry.label,
          'WhatsApp Number',
          submittedPerson.whatsapp,
          existingKefgId,
          existingName,
          rowIndex + 1
        );
      }

      if (
        submittedEmail &&
        existingEmail &&
        submittedEmail === existingEmail
      ) {
        KGMIS_DB_ThrowRegistrationDuplicate_(
          submittedEntry.label,
          'Email Address',
          submittedPerson.email,
          existingKefgId,
          existingName,
          rowIndex + 1
        );
      }

    }

  });

}


/**
 * Checks whether the proposed Primary Member and Spouse
 * contain the same Mobile, WhatsApp or Email information.
 *
 * @param {Object} primaryMember
 * @param {Object} spouse
 */
function KGMIS_DB_CheckSubmittedPeopleDuplicates_(
  primaryMember,
  spouse
) {

  const primaryMobile =
    KGMIS_DB_NormaliseContactNumber_(
      primaryMember.mobile
    );

  const spouseMobile =
    KGMIS_DB_NormaliseContactNumber_(
      spouse.mobile
    );

  if (
    primaryMobile &&
    spouseMobile &&
    primaryMobile === spouseMobile
  ) {
    throw new Error(
      'The Primary Member and Spouse cannot use the same Mobile Number.'
    );
  }

  const primaryWhatsapp =
    KGMIS_DB_NormaliseContactNumber_(
      primaryMember.whatsapp
    );

  const spouseWhatsapp =
    KGMIS_DB_NormaliseContactNumber_(
      spouse.whatsapp
    );

  if (
    primaryWhatsapp &&
    spouseWhatsapp &&
    primaryWhatsapp === spouseWhatsapp
  ) {
    throw new Error(
      'The Primary Member and Spouse cannot use the same WhatsApp Number.'
    );
  }

  const primaryEmail =
    KGMIS_DB_NormaliseEmail_(
      primaryMember.email
    );

  const spouseEmail =
    KGMIS_DB_NormaliseEmail_(
      spouse.email
    );

  if (
    primaryEmail &&
    spouseEmail &&
    primaryEmail === spouseEmail
  ) {
    throw new Error(
      'The Primary Member and Spouse cannot use the same Email Address.'
    );
  }

}


/**
 * Produces a consistent telephone-number value for comparison.
 *
 * Spaces, brackets, hyphens and the leading plus sign are
 * ignored during duplicate checking.
 *
 * @param {*} value
 * @return {string}
 */
function KGMIS_DB_NormaliseContactNumber_(
  value
) {

  return String(
    value === null ||
    value === undefined
      ? ''
      : value
  ).replace(/\D/g, '');

}


/**
 * Produces a consistent email value for comparison.
 *
 * @param {*} value
 * @return {string}
 */
function KGMIS_DB_NormaliseEmail_(
  value
) {

  return String(
    value === null ||
    value === undefined
      ? ''
      : value
  )
    .trim()
    .toLowerCase();

}


/**
 * Throws a clear duplicate-registration error.
 *
 * @param {string} submittedLabel
 * @param {string} fieldLabel
 * @param {*} submittedValue
 * @param {string} existingKefgId
 * @param {string} existingName
 * @param {number} sheetRow
 */
function KGMIS_DB_ThrowRegistrationDuplicate_(
  submittedLabel,
  fieldLabel,
  submittedValue,
  existingKefgId,
  existingName,
  sheetRow
) {

  const existingIdentity = [
    existingKefgId || 'KEFG ID not available',
    existingName || 'Name not available'
  ].join(' – ');

  throw new Error(
    submittedLabel +
    ': The ' +
    fieldLabel +
    ' "' +
    String(submittedValue || '').trim() +
    '" is already used by ' +
    existingIdentity +
    ' in Master Database row ' +
    sheetRow +
    '. The new family was not created.'
  );

}


/**
 * Finds the first available Primary Member row or consecutive
 * Primary Member and Spouse row pair.
 *
 * A row is treated as available only when both KEFG_ID and
 * MEMBER_NAME are blank.
 *
 * @param {Object} context
 * @param {boolean} includeSpouse
 * @return {Object}
 */
function KGMIS_DB_FindAvailableFamilyRows_(
  context,
  includeSpouse
) {

  const firstDataRow =
    KGMIS_CONFIG.FIRST_DATA_ROW;

  function rowIsAvailable_(
    sheetRow
  ) {

    /*
     * Rows beyond the currently loaded values are available.
     */
    if (
      sheetRow >
      context.lastRow
    ) {
      return true;
    }

    const valueIndex =
      sheetRow - 1;

    const row =
      context.values[valueIndex];

    if (!row) {
      return true;
    }

  /*
  * A row is available only when every database cell
  * in that row is empty.
  *
  * This prevents the registration process from overwriting
  * partially completed or system-maintained records.
  */
  
  return row.every(function (cellValue) {

    return KMIS_DB_Clean_(
      cellValue
    ) === '';

  });

  }

  const finalSearchRow =
    Math.max(
      context.lastRow + 2,
      firstDataRow
    );

  for (
    let sheetRow = firstDataRow;
    sheetRow <= finalSearchRow;
    sheetRow++
  ) {

    if (
      !rowIsAvailable_(
        sheetRow
      )
    ) {
      continue;
    }

    if (
      includeSpouse &&
      !rowIsAvailable_(
        sheetRow + 1
      )
    ) {
      continue;
    }

    return {
      primaryMemberRow:
        sheetRow,

      spouseRow:
        includeSpouse
          ? sheetRow + 1
          : 0
    };

  }

  throw new Error(
    'A suitable row location could not be found in the Master Database.'
  );

}


/**
 * Builds one complete Master Database row using the current
 * sheet-header order.
 *
 * Fields not supplied by the registration are left blank.
 *
 * @param {Array<string>} headers
 * @param {Object} record
 * @return {Array<*>}
 */
function KGMIS_DB_BuildMasterRow_(
  headers,
  record
) {

  const safeHeaders =
    Array.isArray(headers)
      ? headers
      : [];

  const safeRecord =
    record &&
    typeof record === 'object'
      ? record
      : {};

  return safeHeaders.map(
    function (header) {

      return Object.prototype
        .hasOwnProperty.call(
          safeRecord,
          header
        )
          ? safeRecord[header]
          : '';

    }
  );

}


/**
 * Finds a single row by KEFG_ID.
 *
 * Returns zero when no row is found.
 */
function KMIS_DB_FindRowByKEFGID(
  kefgId,
  context
) {
  const safeId = KMIS_DB_Clean_(kefgId);

  if (!safeId) {
    return 0;
  }

  const db =
    context || KMIS_DB_GetContext();

  const idColumn = db.column.KEFG_ID;

  for (
    let rowIndex = 1;
    rowIndex < db.values.length;
    rowIndex++
  ) {
    if (
      KMIS_DB_Clean_(
        db.values[rowIndex][idColumn]
      ) === safeId
    ) {
      return rowIndex + 1;
    }
  }

  return 0;
}


/**
 * Finds all rows sharing the same FAMILY_ID.
 */
function KMIS_DB_FindRowsByFamilyID(
  familyId,
  context
) {
  const safeFamilyId =
    KMIS_DB_Clean_(familyId);

  if (!safeFamilyId) {
    return [];
  }

  const db =
    context || KMIS_DB_GetContext();

  const familyColumn =
    db.column.FAMILY_ID;

  const rows = [];

  for (
    let rowIndex = 1;
    rowIndex < db.values.length;
    rowIndex++
  ) {
    if (
      KMIS_DB_Clean_(
        db.values[rowIndex][familyColumn]
      ) === safeFamilyId
    ) {
      rows.push(rowIndex + 1);
    }
  }

  return rows;
}


/**
 * Reads one complete record from a sheet row.
 */
function KMIS_DB_GetRecordBySheetRow(
  sheetRow,
  context
) {
  const db =
    context || KMIS_DB_GetContext();

  if (
    !Number.isInteger(sheetRow) ||
    sheetRow < 2 ||
    sheetRow > db.lastRow
  ) {
    throw new Error(
      `Invalid KMIS sheet row: ${sheetRow}`
    );
  }

  const row =
    db.sheet
      .getRange(
        sheetRow,
        1,
        1,
        db.lastColumn
      )
      .getValues()[0];

  return KMIS_DB_RowToObject(
    row,
    db.headers,
    sheetRow
  );
}


/**
 * Returns one member by KEFG_ID.
 */
function KMIS_DB_GetMemberByKEFGID(kefgId) {
  const context = KMIS_DB_GetContext();

  const sheetRow =
    KMIS_DB_FindRowByKEFGID(
      kefgId,
      context
    );

  if (!sheetRow) {
    return null;
  }

  return KMIS_DB_GetRecordBySheetRow(
    sheetRow,
    context
  );
}

/**
 * KGMIS-standard member lookup wrapper.
 */
function KGMIS_DB_GetMemberByKEFGID(
  kefgId
) {

  return KMIS_DB_GetMemberByKEFGID(
    kefgId
  );

}

/**
 * Returns all records belonging to a family.
 */
function KMIS_DB_GetFamilyByFamilyID(
  familyId
) {
  const context = KMIS_DB_GetContext();

  const rows =
    KMIS_DB_FindRowsByFamilyID(
      familyId,
      context
    );

  return rows.map(sheetRow =>
    KMIS_DB_GetRecordBySheetRow(
      sheetRow,
      context
    )
  );
}


/**
 * Clears cached database metadata.
 */
function KMIS_DB_ClearCache() {
  const cache =
    CacheService.getScriptCache();

  cache.remove(
    KMIS_DB_CONFIG.CACHE_KEYS.MASTER_SHEET_NAME
  );

  cache.remove(
    KMIS_DB_CONFIG.CACHE_KEYS.MASTER_HEADERS
  );

  return {
    success: true,
    message:
      'KMIS database cache cleared successfully.'
  };
}


/**
 * Checks whether a sheet contains all required master headers.
 */
function KMIS_DB_SheetContainsRequiredHeaders_(
  sheet
) {
  if (
    sheet.getLastRow() < 1 ||
    sheet.getLastColumn() < 1
  ) {
    return false;
  }

  const headers = sheet
    .getRange(
      1,
      1,
      1,
      sheet.getLastColumn()
    )
    .getDisplayValues()[0]
    .map(header => String(header).trim());

  return KMIS_DB_CONFIG.REQUIRED_MASTER_HEADERS
    .every(header => headers.includes(header));
}


/**
 * Finds duplicated non-empty headers.
 */
function KMIS_DB_FindDuplicateHeaders_(
  headers
) {
  const seen = new Set();
  const duplicates = new Set();

  headers.forEach(header => {
    if (!header) {
      return;
    }

    if (seen.has(header)) {
      duplicates.add(header);
    }

    seen.add(header);
  });

  return Array.from(duplicates);
}


function KMIS_DB_Clean_(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(value).trim();
}


/**
 * Manual Stage 1 database test.
 */
function KMIS_DB_TestFoundation() {
  KMIS_RequireDatabaseAdminAccess_();

  const validation =
    KMIS_DB_ValidateMasterSchema();

  Logger.log(
    JSON.stringify(validation, null, 2)
  );

  if (!validation.success) {
    throw new Error(
      'KMIS database validation failed.'
    );
  }

  const context = KMIS_DB_GetContext();

  const result = {
    success: true,
    sheetName: context.sheetName,
    headerCount: context.headers.length,
    dataRowCount:
      Math.max(context.lastRow - 1, 0),

    sampleHeaders:
      context.headers.slice(0, 10)
  };

  Logger.log(
    JSON.stringify(result, null, 2)
  );

  return result;
}

/**
 * Safe test:
 * Reads Family Members belonging to FAM00035.
 *
 * No sheet values are changed.
 */
function KMIS_DB_TestFamilyMembersByFamilyID() {

  const result =
    KMIS_DB_GetFamilyMembersByFamilyID(
      'FAM00035'
    );

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return {
    success: true,
    familyId: 'FAM00035',
    recordCount: result.length,
    records: result
  };
}