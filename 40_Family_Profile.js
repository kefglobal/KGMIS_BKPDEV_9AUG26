/******************************************************************************
 *
 * KEFG Membership Information System (KMIS)
 *
 * Module        : Family Profile Business Service
 * File          : 40_Family_Profile.gs
 * Version       : 2.0
 * Status        : Development
 *
 * Purpose:
 * - Build one structured KEFG Family Profile per FAMILY_ID
 * - Select the correct Primary Member record
 * - Combine member, spouse and family information
 * - Apply the principle:
 *   "Never ask a member for information that KMIS already knows."
 * - Keep internal KMIS identifiers hidden from member-facing output
 * - Prepare data for the future Family Profile form and prefill service
 *
 * This stage performs READ operations only.
 *
 ******************************************************************************/


const KMIS_FP_CONFIG = Object.freeze({

  MODULE_NAME:
    'KEFG Family Profile',

  MODULE_VERSION:
    '2.0',

  SUBSCRIPTION_STATUS_HEADER:
    'SUBSCRIPTION_STATUS_2026_2027',

  PAYMENT_DATE_HEADER:
    'SUBSCRIPTION_PAYMENT_DATE_2026_2027',

  MEMBER_FIELDS: Object.freeze([
    'MEMBER_NAME',
    'GENDER',
    'BLOOD_GROUP',
    'ALUMNI_ASSOCIATION',
    'BRANCH',
    'YEAR_BATCH',
    'MEMBER_MOBILE',
    'MEMBER_WHATSAPP',
    'MEMBER_EMAIL',
    'WHATSAPP_GROUP_MEMBER',
    'CURRENT_LOCATION_COUNTRY',
    'CURRENT_LOCATION_STATE',
    'CURRENT_LOCATION_CITY_DISTRICT',
    'LATEST_ADDRESS',
    'HOME_LOCATION_GOOGLE_MAP',
    'MEMBER_PRESENT_ACTIVITIES',
    'MEMBER_PROFESSION_SKILLS',
    'KEF_KEFGLOBAL_CONTRIBUTIONS',
    'MEMBER_WILLING_TO_VOLUNTEER',
    'MEMBER_DOB_FULL'
  ]),

  SPOUSE_FIELDS: Object.freeze([
    'SPOUSE_NAME',
    'SPOUSE_MOBILE',
    'SPOUSE_WHATSAPP',
    'SPOUSE_EMAIL',
    'SPOUSE_GENDER',
    'SPOUSE_ALUMNI_ASSOCIATION',
    'SPOUSE_BRANCH',
    'SPOUSE_BATCH_YEAR',
    'SPOUSE_CURRENT_CITY_DISTRICT',
    'SPOUSE_ACTIVITIES',
    'SPOUSE_PROFESSION_SKILLS',
    'SPOUSE_KEF_KEFGLOBAL_CONTRIBUTIONS',
    'SPOUSE_WILLING_TO_VOLUNTEER',
    'SPOUSE_DOB_FULL'
  ]),

  FAMILY_FIELDS: Object.freeze([
    'FAMILY_PHOTO',
    'CHILD_1_NAME_AND_PROFESSION',
    'CHILD_2_NAME_AND_PROFESSION',
    'CHILD_3_NAME_AND_PROFESSION',
    'WEDDING_DATE_FULL',
    'PREFERRED_FAMILY_CONTACT',
    'DATA_CONSENT',
    'WILLING_TO_JOIN',
    'REMARKS'
  ]),

  DISPLAY_ONLY_FIELDS: Object.freeze([
    'SUBSCRIPTION_STATUS_2026_2027'
  ]),

  DERIVED_FIELDS: Object.freeze([
    'MEMBER_BIRTHDAY_DATE_AND_MONTH',
    'SPOUSE_BIRTHDAY_DATE_AND_MONTH',
    'WEDDING_DATE'
  ]),

  INTERNAL_FIELDS: Object.freeze([
    'KEFG_ID',
    'FAMILY_ID',
    'RELATED_MEMBER_KEFG_ID',
    'MEMBER_CATEGORY',
    'RECORD_STATUS',
    'TYPE_OF_MEMBERSHIP',
    'SUBSCRIPTION_STATUS_2025_2026',
    'SUBSCRIPTION_STATUS_2024_2025',
    'ZONE',
    'LEGACY_SUBSCRIPTION_REMARKS',
    'PROFILE_LAST_UPDATED'
  ])
});


/**
 * Returns Family Profile module configuration.
 *
 * Intended for future Admin and Family Profile interfaces.
 */
function KMIS_FP_GetConfiguration() {
  KMIS_RequireDatabaseAdminAccess_();

  return {
    success: true,

    module: {
      name:
        KMIS_FP_CONFIG.MODULE_NAME,

      version:
        KMIS_FP_CONFIG.MODULE_VERSION
    },

    fields: {
      member:
        [...KMIS_FP_CONFIG.MEMBER_FIELDS],

      spouse:
        [...KMIS_FP_CONFIG.SPOUSE_FIELDS],

      family:
        [...KMIS_FP_CONFIG.FAMILY_FIELDS],

      displayOnly:
        [...KMIS_FP_CONFIG.DISPLAY_ONLY_FIELDS],

      derived:
        [...KMIS_FP_CONFIG.DERIVED_FIELDS],

      internal:
        [...KMIS_FP_CONFIG.INTERNAL_FIELDS]
    },

    principles: {
      prefillKnownInformation: true,
      preserveExistingValues: true,
      hideInternalIdentifiers: true,
      subscriptionTreasurerControlled: true
    }
  };
}


/**
 * Returns a complete structured family profile.
 *
 * This function is for authorised administrators while developing
 * and testing the Family Profile Module.
 *
 * Internal identifiers are returned separately under "internal".
 * They should never be passed directly to the member-facing form.
 */
function KMIS_FP_GetFamilyProfile(
  familyId,
  skipAdminCheck
) {

  if (skipAdminCheck !== true) {
    KGMIS_RequireDatabaseAdminAccess_();
  }

  const safeFamilyId =
    KMIS_DB_Clean_(familyId);

  if (!safeFamilyId) {
    throw new Error(
      'FAMILY_ID is required.'
    );
  }

  const records =
    KMIS_DB_GetFamilyByFamilyID(
      safeFamilyId
    );

  if (!records.length) {
    return {
      success: false,

      message:
        `No KMIS family was found for ${safeFamilyId}.`,

      data: null
    };
  }

  return {
    success: true,

    data:
      KMIS_FP_BuildFamilyProfile_(
        records
      )
  };
}


/**
 * Phase 1:
 * Validates incoming Family Profile data and locates
 * the current Primary Member and spouse records.
 *
 * This version performs no database updates.
 */

/**
 * Validates and saves approved Family Profile changes.
 *
 * Only fields whose values have actually changed are written.
 * Internal identifiers are never updated.
 */
function KMIS_FP_SaveFamilyProfile(
  data
) {
  KGMIS_RequireDatabaseAdminAccess_();

  if (
    !data ||
    typeof data !== 'object'
  ) {
    return {
      success: false,
      rowsUpdated: 0,
      fieldsUpdated: 0,
      message:
        'Invalid Family Profile data.'
    };
  }


  const familyId =
    KMIS_DB_Clean_(
      data.familyId
    );

  const primaryData =
    data.primary || {};

  const spouseData =
    data.spouse || {};

  const primaryIdentifiers =
    primaryData.identifiers || {};

  const spouseIdentifiers =
    spouseData.identifiers || {};

  const primaryFields =
    primaryData.fields || {};

  const spouseFields =
    spouseData.fields || {};


  const primaryKefgId =
    KMIS_DB_Clean_(
      primaryIdentifiers.KEFG_ID
    );

  const spouseKefgId =
    KMIS_DB_Clean_(
      spouseIdentifiers.KEFG_ID
    );


  if (!familyId) {
    return {
      success: false,
      rowsUpdated: 0,
      fieldsUpdated: 0,
      message:
        'FAMILY_ID is required.'
    };
  }


  if (!primaryKefgId) {
    return {
      success: false,
      rowsUpdated: 0,
      fieldsUpdated: 0,
      message:
        'Primary Member KEFG_ID is required.'
    };
  }


  const submittedPrimaryFamilyId =
    KMIS_DB_Clean_(
      primaryIdentifiers.FAMILY_ID
    );

  if (
    submittedPrimaryFamilyId &&
    submittedPrimaryFamilyId !== familyId
  ) {
    return {
      success: false,
      rowsUpdated: 0,
      fieldsUpdated: 0,
      message:
        'Primary Member FAMILY_ID does not match the selected family.'
    };
  }


  const submittedSpouseFamilyId =
    KMIS_DB_Clean_(
      spouseIdentifiers.FAMILY_ID
    );

  if (
    submittedSpouseFamilyId &&
    submittedSpouseFamilyId !== familyId
  ) {
    return {
      success: false,
      rowsUpdated: 0,
      fieldsUpdated: 0,
      message:
        'Spouse FAMILY_ID does not match the selected family.'
    };
  }


  const records =
    KMIS_DB_GetFamilyByFamilyID(
      familyId
    );

  if (!records.length) {
    return {
      success: false,
      rowsUpdated: 0,
      fieldsUpdated: 0,
      message:
        `No family was found for ${familyId}.`
    };
  }


  const primaryRecord =
    records.find(function (record) {
      return (
        KMIS_DB_Clean_(
          record.KEFG_ID
        ) === primaryKefgId
      );
    });

  if (!primaryRecord) {
    return {
      success: false,
      rowsUpdated: 0,
      fieldsUpdated: 0,
      message:
        'The Primary Member record could not be located.'
    };
  }


  const primarySheetRow =
    Number(
      primaryRecord.__SHEET_ROW || 0
    );

  if (!primarySheetRow) {
    return {
      success: false,
      rowsUpdated: 0,
      fieldsUpdated: 0,
      message:
        'The Primary Member sheet row could not be identified.'
    };
  }


  let spouseRecord = null;
  let spouseSheetRow = 0;

  if (spouseKefgId) {
    spouseRecord =
      records.find(function (record) {
        return (
          KMIS_DB_Clean_(
            record.KEFG_ID
          ) === spouseKefgId
        );
      });

    if (!spouseRecord) {
      return {
        success: false,
        rowsUpdated: 0,
        fieldsUpdated: 0,
        message:
          'The spouse record could not be located.'
      };
    }

    spouseSheetRow =
      Number(
        spouseRecord.__SHEET_ROW || 0
      );

    if (!spouseSheetRow) {
      return {
        success: false,
        rowsUpdated: 0,
        fieldsUpdated: 0,
        message:
          'The spouse sheet row could not be identified.'
      };
    }
  }


  const approvedPrimaryFields = [
    'MEMBER_CATEGORY',
    'RECORD_STATUS',
    'MEMBER_NAME',
    'PHOTO',
    'FAMILY_PHOTO',
    'GENDER',
    'BLOOD_GROUP',
    'ALUMNI_ASSOCIATION',
    'BRANCH',
    'YEAR_BATCH',
    'TYPE_OF_MEMBERSHIP',
    'MEMBER_MOBILE',
    'MEMBER_WHATSAPP',
    'MEMBER_EMAIL',
    'WHATSAPP_GROUP_MEMBER',
    'CURRENT_LOCATION_COUNTRY',
    'CURRENT_LOCATION_STATE',
    'CURRENT_LOCATION_CITY_DISTRICT',
    'LATEST_ADDRESS',
    'HOME_LOCATION_GOOGLE_MAP',
    'ZONE',
    'MEMBER_PRESENT_ACTIVITIES',
    'MEMBER_PROFESSION_SKILLS',
    'KEF_KEFGLOBAL_CONTRIBUTIONS',
    'MEMBER_WILLING_TO_VOLUNTEER',
    'MEMBER_DOB_FULL',
    'WEDDING_DATE_FULL',
    'PREFERRED_FAMILY_CONTACT',
    'DATA_CONSENT',
    'WILLING_TO_JOIN',
    'REMARKS'
  ];


  const approvedSpouseFields = [
    'MEMBER_CATEGORY',
    'RECORD_STATUS',
    'MEMBER_NAME',
    'PHOTO',
    'FAMILY_PHOTO',
    'GENDER',
    'BLOOD_GROUP',
    'ALUMNI_ASSOCIATION',
    'BRANCH',
    'YEAR_BATCH',
    'TYPE_OF_MEMBERSHIP',
    'MEMBER_MOBILE',
    'MEMBER_WHATSAPP',
    'MEMBER_EMAIL',
    'WHATSAPP_GROUP_MEMBER',
    'CURRENT_LOCATION_COUNTRY',
    'CURRENT_LOCATION_STATE',
    'CURRENT_LOCATION_CITY_DISTRICT',
    'LATEST_ADDRESS',
    'HOME_LOCATION_GOOGLE_MAP',
    'ZONE',
    'MEMBER_PRESENT_ACTIVITIES',
    'MEMBER_PROFESSION_SKILLS',
    'KEF_KEFGLOBAL_CONTRIBUTIONS',
    'MEMBER_WILLING_TO_VOLUNTEER',
    'MEMBER_DOB_FULL',
    'REMARKS'
  ];


  const primaryChanges =
    KMIS_FP_DetectFieldChanges_(
      primaryRecord,
      primaryFields,
      approvedPrimaryFields,
      primarySheetRow,
      'PRIMARY'
    );


  const spouseChanges =
    spouseRecord
      ? KMIS_FP_DetectFieldChanges_(
          spouseRecord,
          spouseFields,
          approvedSpouseFields,
          spouseSheetRow,
          'SPOUSE'
        )
      : [];


  const allChanges =
    primaryChanges.concat(
      spouseChanges
    );


  if (!allChanges.length) {
    return {
      success: true,
      familyId:
        familyId,
      rowsUpdated: 0,
      fieldsUpdated: 0,
      primaryFieldsUpdated: 0,
      spouseFieldsUpdated: 0,
      message:
        'No changes were detected.'
    };
  }


  const updateResult =
    KMIS_FP_ApplyUpdates_(
      allChanges
    );


  return {
    success: true,

    familyId:
      familyId,

    rowsUpdated:
      updateResult.rowsUpdated,

    fieldsUpdated:
      updateResult.fieldsUpdated,

    primaryFieldsUpdated:
      primaryChanges.length,

    spouseFieldsUpdated:
      spouseChanges.length,

    profileLastUpdated:
      updateResult.profileLastUpdated,

    message:
      updateResult.fieldsUpdated === 1
        ? '1 Family Profile field was updated successfully.'
        : (
            `${updateResult.fieldsUpdated} Family Profile fields ` +
            'were updated successfully.'
          )
  };
}

/**
 * Compares approved submitted fields with the current database record.
 *
 * Returns only fields whose values have actually changed.
 * This function does not write to the database.
 */
function KMIS_FP_DetectFieldChanges_(
  currentRecord,
  submittedFields,
  approvedFields,
  sheetRow,
  recordType
) {
  const changes = [];

  if (
    !currentRecord ||
    typeof currentRecord !== 'object'
  ) {
    return changes;
  }

  if (
    !submittedFields ||
    typeof submittedFields !== 'object'
  ) {
    return changes;
  }

  const safeApprovedFields =
    Array.isArray(approvedFields)
      ? approvedFields
      : [];

  const safeSheetRow =
    Number(sheetRow || 0);

  const safeRecordType =
    KMIS_DB_Clean_(recordType);

  const dateFields = [
    'MEMBER_DOB_FULL',
    'WEDDING_DATE_FULL'
  ];

  safeApprovedFields.forEach(function (fieldName) {
    if (
      !Object.prototype.hasOwnProperty.call(
        submittedFields,
        fieldName
      )
    ) {
      return;
    }

    const oldValue =
      currentRecord[fieldName];

    const submittedValue =
      submittedFields[fieldName];

    let oldComparable;
    let newComparable;
    let finalValue;

    if (
      dateFields.indexOf(fieldName) !== -1
    ) {
      oldComparable =
        KMIS_FP_FormatDate_(
          oldValue,
          KMIS_CONSTANTS
            .DATE_FORMATS
            .HTML_DATE
        );

      newComparable =
        KMIS_FP_FormatDate_(
          submittedValue,
          KMIS_CONSTANTS
            .DATE_FORMATS
            .HTML_DATE
        );

      finalValue =
        newComparable
          ? KMIS_FP_ConvertToDate_(
              newComparable
            )
          : '';
    } else {
      oldComparable =
        KMIS_DB_Clean_(
          oldValue
        );

      newComparable =
        KMIS_DB_Clean_(
          submittedValue
        );

      finalValue =
        newComparable;
    }

    if (
      oldComparable ===
      newComparable
    ) {
      return;
    }

    changes.push({
      recordType:
        safeRecordType,

      sheetRow:
        safeSheetRow,

      fieldName:
        fieldName,

      oldValue:
        oldComparable,

      newValue:
        newComparable,

      writeValue:
        finalValue
    });
  });

  return changes;
}

/**
 * Applies approved Family Profile changes to the Master Database.
 *
 * Only changed cells are written.
 * PROFILE_LAST_UPDATED is updated automatically for each affected row.
 */
function KMIS_FP_ApplyUpdates_(
  changes
) {
  const safeChanges =
    Array.isArray(changes)
      ? changes
      : [];

  if (!safeChanges.length) {
    return {
      rowsUpdated: 0,
      fieldsUpdated: 0,
      profileLastUpdated: ''
    };
  }


  const approvedFields = Object.freeze([
    'MEMBER_CATEGORY',
    'RECORD_STATUS',
    'MEMBER_NAME',
    'PHOTO',
    'FAMILY_PHOTO',
    'GENDER',
    'BLOOD_GROUP',
    'ALUMNI_ASSOCIATION',
    'BRANCH',
    'YEAR_BATCH',
    'TYPE_OF_MEMBERSHIP',
    'MEMBER_MOBILE',
    'MEMBER_WHATSAPP',
    'MEMBER_EMAIL',
    'WHATSAPP_GROUP_MEMBER',
    'CURRENT_LOCATION_COUNTRY',
    'CURRENT_LOCATION_STATE',
    'CURRENT_LOCATION_CITY_DISTRICT',
    'LATEST_ADDRESS',
    'HOME_LOCATION_GOOGLE_MAP',
    'ZONE',
    'MEMBER_PRESENT_ACTIVITIES',
    'MEMBER_PROFESSION_SKILLS',
    'KEF_KEFGLOBAL_CONTRIBUTIONS',
    'MEMBER_WILLING_TO_VOLUNTEER',
    'MEMBER_DOB_FULL',
    'WEDDING_DATE_FULL',
    'PREFERRED_FAMILY_CONTACT',
    'DATA_CONSENT',
    'WILLING_TO_JOIN',
    'REMARKS'
  ]);


  const protectedFields = Object.freeze([
    'KEFG_ID',
    'FAMILY_ID',
    'RELATED_MEMBER_KEFG_ID',
    'PROFILE_LAST_UPDATED'
  ]);


  const lock =
    LockService.getScriptLock();

  try {
    lock.waitLock(30000);


    const context =
      KMIS_DB_GetContext();


    if (
      !context ||
      !context.sheet ||
      !context.column ||
      !Array.isArray(context.values)
    ) {
      throw new Error(
        'The Master Database context is invalid.'
      );
    }


    if (
      !Object.prototype.hasOwnProperty.call(
        context.column,
        'PROFILE_LAST_UPDATED'
      )
    ) {
      throw new Error(
        'PROFILE_LAST_UPDATED header was not found.'
      );
    }


    const affectedRows = {};
    let fieldsUpdated = 0;


    safeChanges.forEach(function (
      change
    ) {
      const sheetRow =
        Number(
          change &&
          change.sheetRow
            ? change.sheetRow
            : 0
        );


      const fieldName =
        KMIS_DB_Clean_(
          change &&
          change.fieldName
        );


      if (
        !Number.isInteger(sheetRow) ||
        sheetRow < 2 ||
        sheetRow > context.lastRow
      ) {
        throw new Error(
          `Invalid Master Database row: ${sheetRow}`
        );
      }


      if (!fieldName) {
        throw new Error(
          'A Family Profile update field name is missing.'
        );
      }


      if (
        protectedFields.indexOf(
          fieldName
        ) !== -1
      ) {
        throw new Error(
          `The protected field ${fieldName} cannot be updated.`
        );
      }


      if (
        approvedFields.indexOf(
          fieldName
        ) === -1
      ) {
        throw new Error(
          `The field ${fieldName} is not approved for Family Profile updates.`
        );
      }


      if (
        !Object.prototype.hasOwnProperty.call(
          context.column,
          fieldName
        )
      ) {
        throw new Error(
          `Master Database header not found: ${fieldName}`
        );
      }


      const columnIndex =
        context.column[fieldName] + 1;


      context.sheet
        .getRange(
          sheetRow,
          columnIndex
        )
        .setValue(
          change.writeValue
        );


      affectedRows[sheetRow] = true;
      fieldsUpdated += 1;
    });


    const timestamp =
      new Date();

    const timestampColumn =
      context.column.PROFILE_LAST_UPDATED + 1;


    Object.keys(
      affectedRows
    ).forEach(function (
      rowNumber
    ) {
      context.sheet
        .getRange(
          Number(rowNumber),
          timestampColumn
        )
        .setValue(
          timestamp
        );
    });


    SpreadsheetApp.flush();


    return {
      rowsUpdated:
        Object.keys(
          affectedRows
        ).length,

      fieldsUpdated:
        fieldsUpdated,

      profileLastUpdated:
        KMIS_FP_FormatDateTime_(
          timestamp
        )
    };

  } finally {
    lock.releaseLock();
  }
}

/**
 * Applies approved Family Profile field changes to the master database.
 *
 * Updates only changed cells and writes PROFILE_LAST_UPDATED
 * once for each affected record.
 */
function KMIS_FP_ApplyUpdates_(
  changes
) {
  const safeChanges =
    Array.isArray(changes)
      ? changes
      : [];

  if (!safeChanges.length) {
    return {
      rowsUpdated: 0,
      fieldsUpdated: 0,
      profileLastUpdated: ''
    };
  }


  const sheet =
    KMIS_DB_GetMasterSheet();

  if (!sheet) {
    throw new Error(
      'KGMIS master database sheet could not be opened.'
    );
  }


  const headers =
    KMIS_DB_GetHeaders(
      sheet
    );

  const headerMap = {};

  headers.forEach(function (
    header,
    index
  ) {
    const safeHeader =
      KMIS_DB_Clean_(header);

    if (safeHeader) {
      headerMap[safeHeader] =
        index + 1;
    }
  });


  const timestampColumn =
    headerMap.PROFILE_LAST_UPDATED;

  if (!timestampColumn) {
    throw new Error(
      'PROFILE_LAST_UPDATED header was not found.'
    );
  }


  const affectedRows = {};
  let fieldsUpdated = 0;


  safeChanges.forEach(function (
    change
  ) {
    const sheetRow =
      Number(
        change &&
        change.sheetRow
          ? change.sheetRow
          : 0
      );

    const fieldName =
      KMIS_DB_Clean_(
        change &&
        change.fieldName
      );

    if (
      !sheetRow ||
      !fieldName
    ) {
      throw new Error(
        'Invalid Family Profile update instruction.'
      );
    }


    const columnIndex =
      headerMap[fieldName];

    if (!columnIndex) {
      throw new Error(
        `Database header not found: ${fieldName}`
      );
    }


    sheet
      .getRange(
        sheetRow,
        columnIndex
      )
      .setValue(
        change.writeValue
      );


    affectedRows[sheetRow] = true;
    fieldsUpdated += 1;
  });


  const timestamp =
    new Date();

  Object.keys(
    affectedRows
  ).forEach(function (
    rowNumber
  ) {
    sheet
      .getRange(
        Number(rowNumber),
        timestampColumn
      )
      .setValue(
        timestamp
      );
  });


  SpreadsheetApp.flush();


  return {
    rowsUpdated:
      Object.keys(
        affectedRows
      ).length,

    fieldsUpdated:
      fieldsUpdated,

    profileLastUpdated:
      KMIS_FP_FormatDateTime_(
        timestamp
      )
  };
}


/**
 * Returns the member-facing profile data.
 *
 * Internal IDs are deliberately excluded.
 */

function KMIS_FP_GetMemberFacingProfile(
  familyId
) {

  const result =
    KMIS_FP_GetFamilyProfile(
      familyId,
      true
    );

  if (!result.success) {
    return result;
  }

  const profile =
    result.data;

  return {
    success: true,

    data: {
      greeting:
        profile.greeting,

      overview:
        profile.overview,

      member:
        profile.member,

      spouse:
        profile.spouse,

      spouseSection:
        profile.spouseSection,

      family:
        profile.family,

      familyMembers:
        profile.familyMembers,

      communication:
        profile.communication,

      subscription:
        profile.subscription,

      completion:
        profile.completion
    }
  };
}


/**
 * Loads all Family Members belonging to one FAMILY_ID.
 *
 * Returns the client-ready collection used by the
 * Family Profile Portal.
 */
function KMIS_FP_LoadFamilyMembers_(
  familyId
) {

  const records =
    KMIS_DB_GetFamilyMembersByFamilyID(
      familyId
    );

  return records.map(function (record) {

    return {

      operation: 'NONE',

      PERSON_ID:
        KMIS_DB_Clean_(record.PERSON_ID),

      DEPENDANT_ID:
        KMIS_DB_Clean_(record.DEPENDANT_ID),

      FAMILY_ID:
        KMIS_DB_Clean_(record.FAMILY_ID),

      RELATED_KEFG_ID:
        KMIS_DB_Clean_(record.RELATED_KEFG_ID),

      FULL_NAME:
        KMIS_DB_Clean_(record.FULL_NAME),

      FAMILY_RELATION:
        KMIS_DB_Clean_(record.FAMILY_RELATION),

      GENDER:
      KMIS_DB_Clean_(
        record.GENDER
      ),

      BLOOD_GROUP:
        KMIS_DB_Clean_(
          record.BLOOD_GROUP
      ),

      DATE_OF_BIRTH:
        KMIS_FP_FormatDate_(
          record.DATE_OF_BIRTH,
          KMIS_CONSTANTS.DATE_FORMATS.HTML_DATE
      ),

      MOBILE:
        KMIS_DB_Clean_(record.MOBILE),

      EMAIL:
        KMIS_DB_Clean_(record.EMAIL),

      PHOTO_FILE_ID:
        KMIS_DB_Clean_(record.PHOTO_FILE_ID),

      PHOTO_URL:
        KMIS_DB_Clean_(record.PHOTO_URL),

      FAMILY_PROFESSION_SKILLS:
        KMIS_DB_Clean_(record.FAMILY_PROFESSION_SKILLS),

      FAMILY_ACTIVITIES:
        KMIS_DB_Clean_(record.FAMILY_ACTIVITIES),

      FAMILY_WILLING_TO_VOLUNTEER:
        KMIS_DB_Clean_(record.FAMILY_WILLING_TO_VOLUNTEER),

      REMARKS:
        KMIS_DB_Clean_(record.REMARKS),

      AGE:
        KMIS_DB_Clean_(record.AGE),

      RELATION_SEQUENCE:
        KMIS_DB_Clean_(record.RELATION_SEQUENCE),

      CARD_ELIGIBLE:
        KMIS_DB_Clean_(record.CARD_ELIGIBLE),

      DEPENDENCY_STATUS:
        KMIS_DB_Clean_(record.DEPENDENCY_STATUS),

      ELIGIBILITY_STATUS:
        KMIS_DB_Clean_(record.ELIGIBILITY_STATUS),

      RECORD_STATUS:
        KMIS_DB_Clean_(record.RECORD_STATUS)
    };

  });

}


/**
 * Builds one KEFG Family Profile from all records sharing a FAMILY_ID.
 */

function KMIS_FP_BuildFamilyProfile_(
  records
) {
  const primaryRecord =
    KMIS_FP_SelectPrimaryRecord_(
      records
    );

  const spouseRecord =
    KMIS_FP_SelectSpouseRecord_(
      records,
      primaryRecord
    );

  const spouseExists =
    KMIS_FP_HasSpouseInformation_(
      primaryRecord,
      spouseRecord
    );

  const member =
    KMIS_FP_BuildMemberSection_(
      primaryRecord
    );

  const spouse =
    KMIS_FP_BuildSpouseSection_(
      primaryRecord,
      spouseRecord,
      spouseExists
    );

  const family =
    KMIS_FP_BuildFamilySection_(
      primaryRecord
    );

  const communication =
    KMIS_FP_BuildCommunicationSection_(
      primaryRecord
    );

  const familyMembers =
    KMIS_FP_LoadFamilyMembers_(
      primaryRecord.FAMILY_ID
    );

  const subscription =
    KMIS_FP_BuildSubscriptionSection_(
      primaryRecord
    );

  const greeting =
    KMIS_FP_CreateGreeting_(
      member.fullName,
      spouse.fullName,
      spouseExists,
      primaryRecord.RECORD_STATUS
    );

  return {
    internal: {
      familyId:
        KMIS_DB_Clean_(
          primaryRecord.FAMILY_ID
        ),

      primaryKefgId:
        KMIS_DB_Clean_(
          primaryRecord.KEFG_ID
        ),

      spouseKefgId:
        spouseRecord
          ? KMIS_DB_Clean_(
              spouseRecord.KEFG_ID
            )
          : '',

      relatedMemberKefgId:
        KMIS_DB_Clean_(
          primaryRecord
            .RELATED_MEMBER_KEFG_ID
        ),

      primarySheetRow:
        primaryRecord.__SHEET_ROW || 0,

      spouseSheetRow:
        spouseRecord
          ? spouseRecord.__SHEET_ROW || 0
          : 0
    },

    greeting,

    overview: {
      primaryMemberName:
        member.fullName,

      spouseName:
        spouse.fullName,

      zone:
        KMIS_DB_Clean_(
          primaryRecord.ZONE
        ),

      recordStatus:
        KMIS_DB_Clean_(
          primaryRecord.RECORD_STATUS
        ),

      profileLastUpdated:
        KMIS_FP_FormatDateTime_(
          primaryRecord
            .PROFILE_LAST_UPDATED
        )
    },

    member,

    spouse,

    spouseSection: {
      spouseExists,

      displayAutomatically:
        spouseExists,

      askAddOrUpdateQuestion:
        !spouseExists,

      question:
        'Would you like to add or update your spouse\'s details in your KEFG Family Profile?',

      options: [
        'YES',
        'NO'
      ]
    },

    family,

    familyMembers,

    communication,

    subscription,

    completion:
      KMIS_FP_CalculateProfileCompletion_({
        member,
        spouse,
        spouseExists,
        family,
        communication
      })
  };
}


/**
 * Selects the Primary Member record.
 *
 * Priority:
 * 1. MEMBER_CATEGORY = PRIMARY MEMBER
 * 2. A record that is not a spouse category
 * 3. First available record
 */
function KMIS_FP_SelectPrimaryRecord_(
  records
) {
  const explicitPrimary =
    records.find(record =>
      KMIS_FP_Normalize_(
        record.MEMBER_CATEGORY
      ) === 'primary member'
    );

  if (explicitPrimary) {
    return explicitPrimary;
  }

  const nonSpouseRecord =
    records.find(record => {
      const category =
        KMIS_FP_Normalize_(
          record.MEMBER_CATEGORY
        );

      return (
        category !==
          'non-alumni spouse' &&
        category !==
          'alumni spouse'
      );
    });

  return (
    nonSpouseRecord ||
    records[0]
  );
}


/**
 * Selects the separate spouse record where available.
 */
function KMIS_FP_SelectSpouseRecord_(
  records,
  primaryRecord
) {
  const relatedId =
    KMIS_DB_Clean_(
      primaryRecord
        .RELATED_MEMBER_KEFG_ID
    );

  if (relatedId) {
    const relatedRecord =
      records.find(record =>
        KMIS_DB_Clean_(
          record.KEFG_ID
        ) === relatedId
      );

    if (relatedRecord) {
      return relatedRecord;
    }
  }

  const spouseCategoryRecord =
    records.find(record => {
      if (
        record.__SHEET_ROW ===
        primaryRecord.__SHEET_ROW
      ) {
        return false;
      }

      const category =
        KMIS_FP_Normalize_(
          record.MEMBER_CATEGORY
        );

      return (
        category ===
          'non-alumni spouse' ||
        category ===
          'alumni spouse'
      );
    });

  return spouseCategoryRecord || null;
}


/**
 * Determines whether spouse information already exists.
 */
function KMIS_FP_HasSpouseInformation_(
  primaryRecord,
  spouseRecord
) {
  const values = [
    primaryRecord.SPOUSE_NAME,
    primaryRecord.SPOUSE_MOBILE,
    primaryRecord.SPOUSE_WHATSAPP,
    primaryRecord.SPOUSE_EMAIL,
    primaryRecord.SPOUSE_GENDER,
    primaryRecord
      .SPOUSE_ALUMNI_ASSOCIATION,
    primaryRecord.SPOUSE_BRANCH,
    primaryRecord.SPOUSE_BATCH_YEAR,
    primaryRecord.SPOUSE_DOB_FULL,

    spouseRecord
      ? spouseRecord.MEMBER_NAME
      : '',

    spouseRecord
      ? spouseRecord.MEMBER_MOBILE
      : ''
  ];

  return values.some(value =>
    KMIS_DB_Clean_(value) !== ''
  );
}


/**
 * Builds the Primary Member section.
 */

function KMIS_FP_BuildMemberSection_(
  record
) {
  return {
    memberCategory:
      KMIS_DB_Clean_(
        record.MEMBER_CATEGORY
      ),

    recordStatus:
      KMIS_DB_Clean_(
        record.RECORD_STATUS
      ),

    fullName:
      KMIS_DB_Clean_(
        record.MEMBER_NAME
      ),

    photo:
      KMIS_DB_Clean_(
        record.PHOTO
      ),

    familyPhoto:
      KMIS_DB_Clean_(
        record.FAMILY_PHOTO
      ),

    membershipType:
      KMIS_DB_Clean_(
        record.TYPE_OF_MEMBERSHIP
      ),

    dobFull:
      KMIS_FP_FormatDate_(
        record.MEMBER_DOB_FULL,
        KMIS_CONSTANTS
          .DATE_FORMATS
          .HTML_DATE
      ),

    remarks:
      KMIS_DB_Clean_(
        record.REMARKS
      ),

    profileLastUpdated:
      KMIS_FP_FormatDateTime_(
        record.PROFILE_LAST_UPDATED
      ),

    personal: {
      gender:
        KMIS_DB_Clean_(
          record.GENDER
        ),

      bloodGroup:
        KMIS_DB_Clean_(
          record.BLOOD_GROUP
        ),

      dateOfBirthIso:
        KMIS_FP_FormatDate_(
          record.MEMBER_DOB_FULL,
          KMIS_CONSTANTS
            .DATE_FORMATS
            .HTML_DATE
        ),

      dateOfBirthDisplay:
        KMIS_FP_FormatDate_(
          record.MEMBER_DOB_FULL,
          KMIS_CONSTANTS
            .DATE_FORMATS
            .SHEET_DATE
        )
    },

    alumni: {
      association:
        KMIS_DB_Clean_(
          record.ALUMNI_ASSOCIATION
        ),

      branch:
        KMIS_DB_Clean_(
          record.BRANCH
        ),

      batchYear:
        KMIS_DB_Clean_(
          record.YEAR_BATCH
        ),

      hasAlumniDetails:
        KMIS_FP_HasAnyValue_([
          record.ALUMNI_ASSOCIATION,
          record.BRANCH,
          record.YEAR_BATCH
        ])
    },

    contact: {
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

      whatsappGroupMember:
        KMIS_DB_Clean_(
          record.WHATSAPP_GROUP_MEMBER
        )
    },

    location: {
      country:
        KMIS_DB_Clean_(
          record.CURRENT_LOCATION_COUNTRY
        ),

      state:
        KMIS_DB_Clean_(
          record.CURRENT_LOCATION_STATE
        ),

      cityDistrict:
        KMIS_DB_Clean_(
          record.CURRENT_LOCATION_CITY_DISTRICT
        ),

      address:
        KMIS_DB_Clean_(
          record.LATEST_ADDRESS
        ),

      googleMapLink:
        KMIS_DB_Clean_(
          record.HOME_LOCATION_GOOGLE_MAP
        ),

      zone:
        KMIS_DB_Clean_(
          record.ZONE
        )
    },

    professional: {
      presentActivities:
        KMIS_DB_Clean_(
          record.MEMBER_PRESENT_ACTIVITIES
        ),

      professionSkills:
        KMIS_DB_Clean_(
          record.MEMBER_PROFESSION_SKILLS
        ),

      contributions:
        KMIS_DB_Clean_(
          record.KEF_KEFGLOBAL_CONTRIBUTIONS
        ),

      willingToVolunteer:
        KMIS_DB_Clean_(
          record.MEMBER_WILLING_TO_VOLUNTEER
        )
    }
  };
}


/**
 * Builds the spouse section.
 *
 * Primary source:
 * spouse fields stored in the Primary Member record.
 *
 * Fallback source:
 * separate spouse record where corresponding member fields exist.
 */

function KMIS_FP_BuildSpouseSection_(
  primaryRecord,
  spouseRecord,
  spouseExists
) {
  const spouseName =
    KMIS_FP_FirstNonBlank_([
      primaryRecord.SPOUSE_NAME,

      spouseRecord
        ? spouseRecord.MEMBER_NAME
        : ''
    ]);

  const spouseMobile =
    KMIS_FP_FirstNonBlank_([
      primaryRecord.SPOUSE_MOBILE,

      spouseRecord
        ? spouseRecord.MEMBER_MOBILE
        : ''
    ]);

  const spouseWhatsapp =
    KMIS_FP_FirstNonBlank_([
      primaryRecord.SPOUSE_WHATSAPP,

      spouseRecord
        ? spouseRecord.MEMBER_WHATSAPP
        : ''
    ]);

  const spouseEmail =
    KMIS_FP_FirstNonBlank_([
      primaryRecord.SPOUSE_EMAIL,

      spouseRecord
        ? spouseRecord.MEMBER_EMAIL
        : ''
    ]);

  const spouseGender =
    KMIS_FP_FirstNonBlank_([
      primaryRecord.SPOUSE_GENDER,

      spouseRecord
        ? spouseRecord.GENDER
        : ''
    ]);

  const spouseAssociation =
    KMIS_FP_FirstNonBlank_([
      primaryRecord
        .SPOUSE_ALUMNI_ASSOCIATION,

      spouseRecord
        ? spouseRecord.ALUMNI_ASSOCIATION
        : ''
    ]);

  const spouseBranch =
    KMIS_FP_FirstNonBlank_([
      primaryRecord.SPOUSE_BRANCH,

      spouseRecord
        ? spouseRecord.BRANCH
        : ''
    ]);

  const spouseBatchYear =
    KMIS_FP_FirstNonBlank_([
      primaryRecord.SPOUSE_BATCH_YEAR,

      spouseRecord
        ? spouseRecord.YEAR_BATCH
        : ''
    ]);

  const spouseDob =
    KMIS_FP_FirstNonBlank_([
      primaryRecord.SPOUSE_DOB_FULL,

      spouseRecord
        ? spouseRecord.MEMBER_DOB_FULL
        : ''
    ]);

  return {
    exists:
      spouseExists,

    memberCategory:
      spouseRecord
        ? KMIS_DB_Clean_(
            spouseRecord.MEMBER_CATEGORY
          )
        : '',

    recordStatus:
      spouseRecord
        ? KMIS_DB_Clean_(
            spouseRecord.RECORD_STATUS
          )
        : '',

    fullName:
      spouseName,

    photo:
      spouseRecord
        ? KMIS_DB_Clean_(
            spouseRecord.PHOTO
          )
        : '',

    familyPhoto:
      spouseRecord
        ? KMIS_DB_Clean_(
            spouseRecord.FAMILY_PHOTO
          )
        : KMIS_DB_Clean_(
            primaryRecord.FAMILY_PHOTO
          ),

    membershipType:
      spouseRecord
        ? KMIS_DB_Clean_(
            spouseRecord.TYPE_OF_MEMBERSHIP
          )
        : '',

    dobFull:
      KMIS_FP_FormatDate_(
        spouseDob,
        KMIS_CONSTANTS
          .DATE_FORMATS
          .HTML_DATE
      ),

    remarks:
      spouseRecord
        ? KMIS_DB_Clean_(
            spouseRecord.REMARKS
          )
        : '',

    profileLastUpdated:
      spouseRecord
        ? KMIS_FP_FormatDateTime_(
            spouseRecord.PROFILE_LAST_UPDATED
          )
        : '',

    personal: {
      gender:
        spouseGender,

      bloodGroup:
        spouseRecord
          ? KMIS_DB_Clean_(
              spouseRecord.BLOOD_GROUP
            )
          : '',

      dateOfBirthIso:
        KMIS_FP_FormatDate_(
          spouseDob,
          KMIS_CONSTANTS
            .DATE_FORMATS
            .HTML_DATE
        ),

      dateOfBirthDisplay:
        KMIS_FP_FormatDate_(
          spouseDob,
          KMIS_CONSTANTS
            .DATE_FORMATS
            .SHEET_DATE
        )
    },

    contact: {
      mobile:
        spouseMobile,

      whatsapp:
        spouseWhatsapp,

      email:
        spouseEmail,

      whatsappGroupMember:
        spouseRecord
          ? KMIS_DB_Clean_(
              spouseRecord.WHATSAPP_GROUP_MEMBER
            )
          : ''
    },

    alumni: {
      association:
        spouseAssociation,

      branch:
        spouseBranch,

      batchYear:
        spouseBatchYear,

      hasAlumniDetails:
        KMIS_FP_HasAnyValue_([
          spouseAssociation,
          spouseBranch,
          spouseBatchYear
        ])
    },

    location: {
      country:
        spouseRecord
          ? KMIS_DB_Clean_(
              spouseRecord
                .CURRENT_LOCATION_COUNTRY
            )
          : '',

      state:
        spouseRecord
          ? KMIS_DB_Clean_(
              spouseRecord
                .CURRENT_LOCATION_STATE
            )
          : '',

      cityDistrict:
        KMIS_FP_FirstNonBlank_([
          primaryRecord
            .SPOUSE_CURRENT_CITY_DISTRICT,

          spouseRecord
            ? spouseRecord
                .CURRENT_LOCATION_CITY_DISTRICT
            : ''
        ]),

      address:
        spouseRecord
          ? KMIS_DB_Clean_(
              spouseRecord.LATEST_ADDRESS
            )
          : '',

      googleMapLink:
        spouseRecord
          ? KMIS_DB_Clean_(
              spouseRecord
                .HOME_LOCATION_GOOGLE_MAP
            )
          : '',

      zone:
        spouseRecord
          ? KMIS_DB_Clean_(
              spouseRecord.ZONE
            )
          : ''
    },

    professional: {
      presentActivities:
        KMIS_FP_FirstNonBlank_([
          primaryRecord.SPOUSE_ACTIVITIES,

          spouseRecord
            ? spouseRecord
                .MEMBER_PRESENT_ACTIVITIES
            : ''
        ]),

      professionSkills:
        KMIS_FP_FirstNonBlank_([
          primaryRecord
            .SPOUSE_PROFESSION_SKILLS,

          spouseRecord
            ? spouseRecord
                .MEMBER_PROFESSION_SKILLS
            : ''
        ]),

      contributions:
        KMIS_FP_FirstNonBlank_([
          primaryRecord
            .SPOUSE_KEF_KEFGLOBAL_CONTRIBUTIONS,

          spouseRecord
            ? spouseRecord
                .KEF_KEFGLOBAL_CONTRIBUTIONS
            : ''
        ]),

      willingToVolunteer:
        KMIS_FP_FirstNonBlank_([
          primaryRecord
            .SPOUSE_WILLING_TO_VOLUNTEER,

          spouseRecord
            ? spouseRecord
                .MEMBER_WILLING_TO_VOLUNTEER
            : ''
        ])
    }
  };
}

/**
 * Builds family-level information.
 */
function KMIS_FP_BuildFamilySection_(
  record
) {
  return {
    photo: {
      existingValue:
        KMIS_DB_Clean_(
          record.FAMILY_PHOTO
        ),

      uploadRequired:
        false,

      replacementOnly:
        true,

      instruction:
        'Upload a new couple photo only if you wish to add or replace the existing photo.'
    },

    weddingDate: {
      iso:
        KMIS_FP_FormatDate_(
          record.WEDDING_DATE_FULL,
          KMIS_CONSTANTS
            .DATE_FORMATS
            .HTML_DATE
        ),

      display:
        KMIS_FP_FormatDate_(
          record.WEDDING_DATE_FULL,
          KMIS_CONSTANTS
            .DATE_FORMATS
            .SHEET_DATE
        )
    },

    children: [
      {
        sequence: 1,

        nameAndProfession:
          KMIS_DB_Clean_(
            record
              .CHILD_1_NAME_AND_PROFESSION
          )
      },

      {
        sequence: 2,

        nameAndProfession:
          KMIS_DB_Clean_(
            record
              .CHILD_2_NAME_AND_PROFESSION
          )
      },

      {
        sequence: 3,

        nameAndProfession:
          KMIS_DB_Clean_(
            record
              .CHILD_3_NAME_AND_PROFESSION
          )
      }
    ]
  };
}


/**
 * Builds communication, consent and declaration information.
 */
function KMIS_FP_BuildCommunicationSection_(
  record
) {
  return {
    preferredFamilyContact:
      KMIS_DB_Clean_(
        record.PREFERRED_FAMILY_CONTACT
      ),

    dataConsent:
      KMIS_DB_Clean_(
        record.DATA_CONSENT
      ),

    willingToJoin:
      KMIS_DB_Clean_(
        record.WILLING_TO_JOIN
      ),

    remarks:
      KMIS_DB_Clean_(
        record.REMARKS
      )
  };
}


/**
 * Builds the Treasurer-controlled subscription display.
 */
function KMIS_FP_BuildSubscriptionSection_(
  record
) {
  const rawStatus =
    KMIS_DB_Clean_(
      record[
        KMIS_FP_CONFIG
          .SUBSCRIPTION_STATUS_HEADER
      ]
    ).toUpperCase();

  return {
    status:
      rawStatus ||
      KMIS_CONSTANTS
        .SUBSCRIPTION_STATUS
        .NOT_PAID,

    memberEditable:
      false,

    controlledBy:
      'TREASURER',

    note:
      'This information is maintained by the Treasurer. Please report any discrepancy in the Remarks field.',

    paymentDateDisplay:
      KMIS_FP_FormatDate_(
        record[
          KMIS_FP_CONFIG
            .PAYMENT_DATE_HEADER
        ],
        KMIS_CONSTANTS
          .DATE_FORMATS
          .SHEET_DATE
      )
  };
}


/**
 * Creates a personalised greeting.
 */
function KMIS_FP_CreateGreeting_(
  memberName,
  spouseName,
  spouseExists,
  memberRecordStatus
) {
  const safeMemberName =
    KMIS_DB_Clean_(memberName);

  const safeSpouseName =
    KMIS_DB_Clean_(spouseName);

  const memberIsDeceased =
    KMIS_FP_Normalize_(memberRecordStatus) ===
    'deceased' ||
    KMIS_FP_NameIndicatesDeceased_(
      safeMemberName
    );

  const spouseIsDeceased =
    KMIS_FP_NameIndicatesDeceased_(
      safeSpouseName
    );

  const memberCanBeGreeted =
    safeMemberName &&
    !memberIsDeceased;

  const spouseCanBeGreeted =
    spouseExists &&
    safeSpouseName &&
    !spouseIsDeceased;

  if (
    memberCanBeGreeted &&
    spouseCanBeGreeted
  ) {
    return (
      `Welcome, ${safeMemberName} & ` +
      `${safeSpouseName}!`
    );
  }

  if (memberCanBeGreeted) {
    return `Welcome, ${safeMemberName}!`;
  }

  if (spouseCanBeGreeted) {
    return `Welcome, ${safeSpouseName}!`;
  }

  return 'KEFG Family Profile';
}

function KMIS_FP_NameIndicatesDeceased_(
  personName
) {
  const name =
    KMIS_FP_Normalize_(personName);

  return (
    name === 'late' ||
    name === 'late.' ||
    name.startsWith('late ') ||
    name.startsWith('late. ') ||
    name.startsWith('late mr ') ||
    name.startsWith('late mr. ') ||
    name.startsWith('late mrs ') ||
    name.startsWith('late mrs. ')
  );
}
/**
 * Calculates a basic profile-completion summary.
 *
 * This does not reject the profile.
 * It only identifies whether important fields currently contain data.
 */
function KMIS_FP_CalculateProfileCompletion_(
  profile
) {
  const checks = [
    {
      key: 'memberName',

      complete:
        Boolean(
          KMIS_DB_Clean_(
            profile.member.fullName
          )
        )
    },

    {
      key: 'memberMobile',

      complete:
        Boolean(
          KMIS_DB_Clean_(
            profile
              .member
              .contact
              .mobile
          )
        )
    },

    {
      key: 'memberWhatsapp',

      complete:
        Boolean(
          KMIS_DB_Clean_(
            profile
              .member
              .contact
              .whatsapp
          )
        )
    },

    {
      key: 'memberLocation',

      complete:
        Boolean(
          KMIS_DB_Clean_(
            profile
              .member
              .location
              .country
          ) &&
          KMIS_DB_Clean_(
            profile
              .member
              .location
              .cityDistrict
          )
        )
    },

    {
      key: 'preferredFamilyContact',

      complete:
        Boolean(
          KMIS_DB_Clean_(
            profile
              .communication
              .preferredFamilyContact
          )
        )
    },

    {
      key: 'dataConsent',

      complete:
        Boolean(
          KMIS_DB_Clean_(
            profile
              .communication
              .dataConsent
          )
        )
    }
  ];

  if (profile.spouseExists) {
    checks.push({
      key: 'spouseName',

      complete:
        Boolean(
          KMIS_DB_Clean_(
            profile.spouse.fullName
          )
        )
    });
  }

  const completedCount =
    checks.filter(
      item => item.complete
    ).length;

  const totalCount =
    checks.length;

  const percentage =
    totalCount
      ? Math.round(
          completedCount /
          totalCount *
          100
        )
      : 0;

  return {
    completedCount,
    totalCount,
    percentage,

    checks,

    incompleteFields:
      checks
        .filter(item => !item.complete)
        .map(item => item.key)
  };
}


/**
 * Returns the first non-blank value.
 */
function KMIS_FP_FirstNonBlank_(
  values
) {
  for (const value of values) {
    const cleaned =
      KMIS_DB_Clean_(value);

    if (cleaned) {
      return cleaned;
    }
  }

  return '';
}


/**
 * Returns true when at least one supplied value is non-blank.
 */
function KMIS_FP_HasAnyValue_(
  values
) {
  return values.some(value =>
    KMIS_DB_Clean_(value) !== ''
  );
}


/**
 * Formats a date safely.
 */
function KMIS_FP_FormatDate_(
  value,
  format
) {
  const date =
    KMIS_FP_ConvertToDate_(value);

  if (!date) {
    return '';
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    format
  );
}


/**
 * Formats a timestamp safely.
 */
function KMIS_FP_FormatDateTime_(
  value
) {
  const date =
    KMIS_FP_ConvertToDate_(value);

  if (!date) {
    return '';
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    KMIS_CONSTANTS
      .DATE_FORMATS
      .SHEET_DATETIME
  );
}


/**
 * Converts common KMIS date values to a Date object.
 */
function KMIS_FP_ConvertToDate_(
  value
) {
  if (
    Object.prototype.toString.call(
      value
    ) === '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return value;
  }

  const text =
    KMIS_DB_Clean_(value);

  if (!text) {
    return null;
  }

  const isoMatch =
    text.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );

  if (isoMatch) {
    return new Date(
      Number(isoMatch[1]),
      Number(isoMatch[2]) - 1,
      Number(isoMatch[3])
    );
  }

  const dayFirstMatch =
    text.match(
      /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/
    );

  if (dayFirstMatch) {
    return new Date(
      Number(dayFirstMatch[3]),
      Number(dayFirstMatch[2]) - 1,
      Number(dayFirstMatch[1])
    );
  }

  return null;
}


function KMIS_FP_Normalize_(
  value
) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}


/**
 * Safe test:
 * Returns the structured Family Profile for FAM00001.
 *
 * No database values are changed.
 */
function KMIS_FP_TestFamilyProfile() {
  const result =
    KMIS_FP_GetFamilyProfile(
      'FAM00001'
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
 * Confirms that the member-facing version contains no IDs.
 *
 * No database values are changed.
 */

function KMIS_FP_TestMemberFacingProfile() {
  const result =
    KMIS_FP_GetMemberFacingProfile(
      'FAM00035'
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
 * Displays Family Profile module configuration.
 */
function KMIS_FP_TestConfiguration() {
  const result =
    KMIS_FP_GetConfiguration();

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}
