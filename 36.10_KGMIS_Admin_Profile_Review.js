/******************************************************************************
 *
 * KEFG Membership Information System
 *
 * Module : Admin Family Profile Review
 * File   : 36.10_KGMIS_Admin_Profile_Review.gs
 * Phase  : 1 — Approve Profile Requests
 *
 * This module:
 * 1. Loads pending Family Profile requests.
 * 2. Loads one request for detailed review.
 * 3. Approves the request exactly as submitted.
 * 4. Writes approved values to KGMIS_MASTER_DATABASE_v1.0.
 * 5. Updates the request audit fields.
 *
 ******************************************************************************/

const KGMIS_ADMIN_PROFILE_REVIEW_CONFIG = Object.freeze({

  PROFILE_REQUEST_SHEET:
    'KGMIS_FAMILY_PROFILE_UPDATE_REQUESTS',

  PENDING_STATUS:
    'PENDING',

  APPROVED_STATUS:
    'APPROVED',

  MAX_PENDING_REQUESTS:
    200
});


/**
 * ============================================================
 * Returns pending Family Profile update requests.
 * ============================================================
 */
function KGMIS_Admin_GetPendingProfileRequests(
  sessionToken
) {

  const admin =
    KGMIS_Admin_ProfileReview_RequireAccess_(
      sessionToken
    );

  const sheet =
    KGMIS_Admin_ProfileReview_GetRequestSheet_();

  const context =
    KGMIS_Admin_ProfileReview_GetSheetContext_(
      sheet
    );

  const requiredHeaders = [
    'REQUEST_ID',
    'SUBMISSION_ID',
    'SUBMITTED_ON',
    'SUBMITTED_BY_EMAIL',
    'FAMILY_ID',
    'PRIMARY_MEMBER_KEFG_ID',
    'CHANGED_SECTIONS',
    'CHANGE_SUMMARY',
    'UPDATE_JSON',
    'REQUEST_STATUS'
  ];

  KGMIS_Admin_ProfileReview_RequireHeaders_(
    context,
    requiredHeaders
  );

  const requests = [];

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {

    const row =
      context.values[rowIndex];

    const requestStatus =
      KGMIS_Admin_ProfileReview_Clean_(
        row[
          context.column.REQUEST_STATUS
        ]
      ).toUpperCase();

    if (
      requestStatus !==
      KGMIS_ADMIN_PROFILE_REVIEW_CONFIG
        .PENDING_STATUS
    ) {
      continue;
    }

    requests.push({

      requestId:
        KGMIS_Admin_ProfileReview_Clean_(
          row[
            context.column.REQUEST_ID
          ]
        ),

      submissionId:
        KGMIS_Admin_ProfileReview_Clean_(
          row[
            context.column.SUBMISSION_ID
          ]
        ),

      submittedOn:
        KGMIS_Admin_ProfileReview_FormatDateTime_(
          row[
            context.column.SUBMITTED_ON
          ]
        ),

      submittedByEmail:
        KGMIS_Admin_ProfileReview_Clean_(
          row[
            context.column.SUBMITTED_BY_EMAIL
          ]
        ),

      familyId:
        KGMIS_Admin_ProfileReview_Clean_(
          row[
            context.column.FAMILY_ID
          ]
        ),

      primaryMemberKefgId:
        KGMIS_Admin_ProfileReview_Clean_(
          row[
            context.column
              .PRIMARY_MEMBER_KEFG_ID
          ]
        ),

      changedSections:
        KGMIS_Admin_ProfileReview_Clean_(
          row[
            context.column.CHANGED_SECTIONS
          ]
        ),

      changeSummary:
        KGMIS_Admin_ProfileReview_Clean_(
          row[
            context.column.CHANGE_SUMMARY
          ]
        ),

      requestStatus:
        requestStatus,

      sheetRow:
        rowIndex + 1
    });

  }

  requests.sort(function (
    first,
    second
  ) {

    return (
      KGMIS_Admin_ProfileReview_DateValue_(
        second.submittedOn
      ) -
      KGMIS_Admin_ProfileReview_DateValue_(
        first.submittedOn
      )
    );

  });

  return {

    success:
      true,

    count:
      requests.length,

    requests:
      requests.slice(
        0,
        KGMIS_ADMIN_PROFILE_REVIEW_CONFIG
          .MAX_PENDING_REQUESTS
      ),

    reviewedBy: {

      email:
        admin.email || '',

      userName:
        admin.userName || '',

      role:
        admin.role || ''
    }
  };
}


/**
 * ============================================================
 * Returns one pending Family Profile request.
 * ============================================================
 */
function KGMIS_Admin_GetProfileRequest(
  sessionToken,
  requestId
) {

  KGMIS_Admin_ProfileReview_RequireAccess_(
    sessionToken
  );

  const safeRequestId =
    KGMIS_Admin_ProfileReview_Clean_(
      requestId
    );

  if (!safeRequestId) {
    throw new Error(
      'The Family Profile Request ID is missing.'
    );
  }

  const request =
    KGMIS_Admin_ProfileReview_FindRequest_(
      safeRequestId
    );

  const updateObject =
    KGMIS_Admin_ProfileReview_ParseJson_(
      request.UPDATE_JSON,
      'The Family Profile UPDATE_JSON is invalid.'
    );

  const formData =
    updateObject &&
    updateObject.formData &&
    typeof updateObject.formData === 'object'
      ? updateObject.formData
      : {};

  const changes =
    Object.keys(formData)
      .map(function (fieldName) {

        const change =
          formData[fieldName] || {};

        return {

          fieldName:
            fieldName,

          oldValue:
            KGMIS_Admin_ProfileReview_Clean_(
              change.old
            ),

          submittedValue:
            KGMIS_Admin_ProfileReview_Clean_(
              change.new
            )
        };

      });

  return {

    success:
      true,

    request: {

      requestId:
        request.REQUEST_ID,

      submissionId:
        request.SUBMISSION_ID,

      submittedOn:
        KGMIS_Admin_ProfileReview_FormatDateTime_(
          request.SUBMITTED_ON
        ),

      submittedByEmail:
        request.SUBMITTED_BY_EMAIL,

      familyId:
        request.FAMILY_ID,

      primaryMemberKefgId:
        request.PRIMARY_MEMBER_KEFG_ID,

      changedSections:
        request.CHANGED_SECTIONS,

      changeSummary:
        request.CHANGE_SUMMARY,

      requestStatus:
        request.REQUEST_STATUS,

      changes:
        changes
    }
  };
}


/**
 * ============================================================
 * Approves one Family Profile request exactly as submitted.
 *
 * Phase 1.1 routing:
 * 1. Primary-member fields update the Primary Member row.
 * 2. SPOUSE_* fields update the linked spouse row using the
 *    same standard member headers.
 * 3. Shared family fields update only the Primary Member row.
 * 4. Reciprocal spouse links and FAMILY_ID are verified before
 *    any spouse value is written.
 * ============================================================
 */
function KGMIS_Admin_ApproveProfileRequest(
  sessionToken,
  requestId,
  reviewRemarks,
  editedValues
) {

  const admin =
    KGMIS_Admin_ProfileReview_RequireAccess_(
      sessionToken
    );

  const safeRequestId =
    KGMIS_Admin_ProfileReview_Clean_(
      requestId
    );

  if (!safeRequestId) {
    throw new Error(
      'The Family Profile Request ID is missing.'
    );
  }

  const lock =
    LockService.getScriptLock();

  try {

    lock.waitLock(
      30000
    );

    const request =
      KGMIS_Admin_ProfileReview_FindRequest_(
        safeRequestId
      );

    const requestStatus =
      KGMIS_Admin_ProfileReview_Clean_(
        request.REQUEST_STATUS
      ).toUpperCase();

    if (
      requestStatus !==
      KGMIS_ADMIN_PROFILE_REVIEW_CONFIG
        .PENDING_STATUS
    ) {

      throw new Error(
        'This request cannot be approved because its current status is ' +
        (
          requestStatus || 'UNKNOWN'
        ) +
        '.'
      );
    }

    const primaryMemberKefgId =
      KGMIS_Admin_ProfileReview_Clean_(
        request.PRIMARY_MEMBER_KEFG_ID
      ).toUpperCase();

    const requestFamilyId =
      KGMIS_Admin_ProfileReview_Clean_(
        request.FAMILY_ID
      ).toUpperCase();

    if (!primaryMemberKefgId) {
      throw new Error(
        'The Primary Member KEFG_ID is missing from the request.'
      );
    }

    if (!requestFamilyId) {
      throw new Error(
        'The FAMILY_ID is missing from the request.'
      );
    }

    const updateObject =
      KGMIS_Admin_ProfileReview_ParseJson_(
        request.UPDATE_JSON,
        'The Family Profile UPDATE_JSON is invalid.'
      );

    const submittedFormData =
      updateObject &&
      updateObject.formData &&
      typeof updateObject.formData === 'object'
        ? updateObject.formData
        : {};

    KGMIS_Admin_ProfileReview_ApplyEditedValues_(
      submittedFormData,
      editedValues
    );

    if (
      !Object.keys(
        submittedFormData
      ).length
    ) {

      throw new Error(
        'The request contains no profile fields to approve.'
      );
    }

    const masterContext =
      KMIS_DB_GetContext();

    KGMIS_Admin_ProfileReview_RequireMasterHeaders_(
      masterContext.column,
      [
        'KEFG_ID',
        'FAMILY_ID',
        'RELATED_MEMBER_KEFG_ID'
      ]
    );

    const primaryRow =
      KMIS_DB_FindRowByKEFGID(
        primaryMemberKefgId,
        masterContext
      );

    if (!primaryRow) {
      throw new Error(
        'The Primary Member could not be found in the Master Database: ' +
        primaryMemberKefgId
      );
    }

    const primaryRecord =
      KMIS_DB_GetRecordBySheetRow(
        primaryRow,
        masterContext
      );

    const primaryFamilyId =
      KGMIS_Admin_ProfileReview_Clean_(
        primaryRecord.FAMILY_ID
      ).toUpperCase();

    if (
      primaryFamilyId !==
      requestFamilyId
    ) {
      throw new Error(
        'The request FAMILY_ID does not match the Primary Member record.'
      );
    }

    const routedUpdates =
      KGMIS_Admin_ProfileReview_RouteApprovedFields_(
        submittedFormData,
        masterContext.column
      );

    const primaryFieldNames =
      Object.keys(
        routedUpdates.primaryValues
      );

    const spouseFieldNames =
      Object.keys(
        routedUpdates.spouseValues
      );

    if (
      !primaryFieldNames.length &&
      !spouseFieldNames.length
    ) {
      throw new Error(
        'None of the submitted fields match the approved Master Database field routing.'
      );
    }

    let spouseRow = 0;
    let spouseKefgId = '';

    if (spouseFieldNames.length) {

      spouseKefgId =
        KGMIS_Admin_ProfileReview_Clean_(
          primaryRecord.RELATED_MEMBER_KEFG_ID
        ).toUpperCase();

      if (!spouseKefgId) {
        throw new Error(
          'The Primary Member record does not contain a linked spouse KEFG_ID.'
        );
      }

      spouseRow =
        KMIS_DB_FindRowByKEFGID(
          spouseKefgId,
          masterContext
        );

      if (!spouseRow) {
        throw new Error(
          'The linked spouse could not be found in the Master Database: ' +
          spouseKefgId
        );
      }

      const spouseRecord =
        KMIS_DB_GetRecordBySheetRow(
          spouseRow,
          masterContext
        );

      const spouseFamilyId =
        KGMIS_Admin_ProfileReview_Clean_(
          spouseRecord.FAMILY_ID
        ).toUpperCase();

      const spouseRelatedKefgId =
        KGMIS_Admin_ProfileReview_Clean_(
          spouseRecord.RELATED_MEMBER_KEFG_ID
        ).toUpperCase();

      if (
        spouseFamilyId !==
        primaryFamilyId
      ) {
        throw new Error(
          'The linked spouse does not belong to the same FAMILY_ID as the Primary Member.'
        );
      }

      if (
        spouseRelatedKefgId !==
        primaryMemberKefgId
      ) {
        throw new Error(
          'The reciprocal spouse relationship is not valid for ' +
          primaryMemberKefgId +
          ' and ' +
          spouseKefgId +
          '.'
        );
      }
    }

    const now =
      new Date();

    KGMIS_Admin_ProfileReview_ApplyRowValues_(
      masterContext,
      primaryRow,
      routedUpdates.primaryValues
    );

    if (spouseFieldNames.length) {
      KGMIS_Admin_ProfileReview_ApplyRowValues_(
        masterContext,
        spouseRow,
        routedUpdates.spouseValues
      );
    }

    if (
      Object.prototype
        .hasOwnProperty.call(
          masterContext.column,
          'PROFILE_LAST_UPDATED'
        )
    ) {

      masterContext.sheet
        .getRange(
          primaryRow,
          masterContext.column
            .PROFILE_LAST_UPDATED + 1
        )
        .setValue(
          now
        );

      if (spouseFieldNames.length) {
        masterContext.sheet
          .getRange(
            spouseRow,
            masterContext.column
              .PROFILE_LAST_UPDATED + 1
          )
          .setValue(
            now
          );
      }
    }

    const reviewerEmail =
      KGMIS_Admin_ProfileReview_Clean_(
        admin.email ||
        admin.userEmail ||
        admin.sessionEmail ||
        Session.getActiveUser().getEmail()
      ).toLowerCase();

    if (!reviewerEmail) {
      throw new Error(
        'The reviewing administrator email could not be identified.'
      );
    }

    KGMIS_Admin_ProfileReview_UpdateRequestAudit_(
      request.__SHEET_ROW,
      {
        REQUEST_STATUS:
          KGMIS_ADMIN_PROFILE_REVIEW_CONFIG
            .APPROVED_STATUS,

        REVIEWED_ON:
          now,

        REVIEWED_BY:
          reviewerEmail,

        REVIEW_REMARKS:
          KGMIS_Admin_ProfileReview_Clean_(
            reviewRemarks
          ) ||
          'Approved as submitted.',

        APPLIED_ON:
          now
      }
    );

    return {

      success:
        true,

      requestId:
        safeRequestId,

      familyId:
        requestFamilyId,

      primaryMemberKefgId:
        primaryMemberKefgId,

      spouseKefgId:
        spouseKefgId,

      status:
        KGMIS_ADMIN_PROFILE_REVIEW_CONFIG
          .APPROVED_STATUS,

      primaryFieldsApplied:
        primaryFieldNames,

      spouseFieldsApplied:
        spouseFieldNames,

      fieldsApplied:
        primaryFieldNames.concat(
          spouseFieldNames
        ),

      fieldCount:
        primaryFieldNames.length +
        spouseFieldNames.length,

      ignoredFields:
        routedUpdates.ignoredFields,

      reviewedBy:
        reviewerEmail,

      reviewedOn:
        KGMIS_Admin_ProfileReview_FormatDateTime_(
          now
        ),

      message:
        'The Family Profile request was approved and applied successfully.'
    };

  } finally {

    lock.releaseLock();

  }
}


/**
 * ============================================================
 * Edits submitted values and approves the request.
 *
 * editedValues format:
 * {
 *   MEMBER_MOBILE: '9999999999',
 *   SPOUSE_EMAIL: 'name@example.com'
 * }
 * ============================================================
 */
function KGMIS_Admin_EditAndApproveProfileRequest(
  sessionToken,
  requestId,
  editedValues,
  reviewRemarks
) {

  if (
    !editedValues ||
    typeof editedValues !== 'object' ||
    Array.isArray(editedValues)
  ) {
    throw new Error(
      'Edited profile values are missing or invalid.'
    );
  }

  return KGMIS_Admin_ApproveProfileRequest(
    sessionToken,
    requestId,
    reviewRemarks || 'Edited and approved by Admin.',
    editedValues
  );
}


/**
 * Applies Admin-edited values only to fields that were present
 * in the original request.
 */
function KGMIS_Admin_ProfileReview_ApplyEditedValues_(
  submittedFormData,
  editedValues
) {

  if (
    !editedValues ||
    typeof editedValues !== 'object' ||
    Array.isArray(editedValues)
  ) {
    return;
  }

  Object.keys(editedValues).forEach(function (fieldName) {

    if (
      !Object.prototype.hasOwnProperty.call(
        submittedFormData,
        fieldName
      )
    ) {
      throw new Error(
        'The edited field was not part of the original request: ' +
        fieldName
      );
    }

    const change = submittedFormData[fieldName];

    if (!change || typeof change !== 'object') {
      throw new Error(
        'The submitted field structure is invalid: ' +
        fieldName
      );
    }

    change.new =
      editedValues[fieldName] === null ||
      editedValues[fieldName] === undefined
        ? ''
        : editedValues[fieldName];
  });
}


/**
 * ============================================================
 * Routes submitted portal fields to the normalized Master
 * Database structure.
 *
 * PRIMARY fields -> Primary Member row.
 * SPOUSE_* fields -> linked spouse row using standard headers.
 * FAMILY fields -> Primary Member row only.
 * ============================================================
 */
function KGMIS_Admin_ProfileReview_RouteApprovedFields_(
  submittedFormData,
  masterColumn
) {

  const primaryFieldMap = {

    MEMBER_NAME:
      ['MEMBER_NAME'],

    GENDER:
      ['GENDER'],

    BLOOD_GROUP:
      ['BLOOD_GROUP'],

    MEMBER_DOB_FULL:
      [
        'MEMBER_DOB_FULL',
        'MEMBER_BIRTHDAY_DATE_AND_MONTH'
      ],

    ALUMNI_ASSOCIATION:
      ['ALUMNI_ASSOCIATION'],

    BRANCH:
      ['BRANCH'],

    YEAR_BATCH:
      ['YEAR_BATCH'],

    MEMBER_MOBILE:
      ['MEMBER_MOBILE'],

    MEMBER_WHATSAPP:
      ['MEMBER_WHATSAPP'],

    MEMBER_EMAIL:
      ['MEMBER_EMAIL'],

    WHATSAPP_GROUP_MEMBER:
      ['WHATSAPP_GROUP_MEMBER'],

    CURRENT_LOCATION_COUNTRY:
      ['CURRENT_LOCATION_COUNTRY'],

    CURRENT_LOCATION_STATE:
      ['CURRENT_LOCATION_STATE'],

    CURRENT_LOCATION_CITY_DISTRICT:
      ['CURRENT_LOCATION_CITY_DISTRICT'],

    LATEST_ADDRESS:
      ['LATEST_ADDRESS'],

    HOME_LOCATION_GOOGLE_MAP:
      ['HOME_LOCATION_GOOGLE_MAP'],

    MEMBER_PRESENT_ACTIVITIES:
      ['MEMBER_PRESENT_ACTIVITIES'],

    MEMBER_PROFESSION_SKILLS:
      ['MEMBER_PROFESSION_SKILLS'],

    KEF_KEFGLOBAL_CONTRIBUTIONS:
      ['KEF_KEFGLOBAL_CONTRIBUTIONS'],

    MEMBER_WILLING_TO_VOLUNTEER:
      ['MEMBER_WILLING_TO_VOLUNTEER'],

    WEDDING_DATE_FULL:
      [
        'WEDDING_DATE_FULL',
        'WEDDING_DATE'
      ],

    FAMILY_PHOTO:
      ['FAMILY_PHOTO'],

    PREFERRED_FAMILY_CONTACT:
      ['PREFERRED_FAMILY_CONTACT'],

    DATA_CONSENT:
      ['DATA_CONSENT'],

    WILLING_TO_JOIN:
      ['WILLING_TO_JOIN'],

    REMARKS:
      ['REMARKS']
  };

  const spouseFieldMap = {

    SPOUSE_NAME:
      ['MEMBER_NAME'],

    SPOUSE_GENDER:
      ['GENDER'],

    SPOUSE_DOB_FULL:
      [
        'MEMBER_DOB_FULL',
        'MEMBER_BIRTHDAY_DATE_AND_MONTH'
      ],

    SPOUSE_MOBILE:
      ['MEMBER_MOBILE'],

    SPOUSE_WHATSAPP:
      ['MEMBER_WHATSAPP'],

    SPOUSE_EMAIL:
      ['MEMBER_EMAIL'],

    SPOUSE_ALUMNI_ASSOCIATION:
      ['ALUMNI_ASSOCIATION'],

    SPOUSE_BRANCH:
      ['BRANCH'],

    SPOUSE_BATCH_YEAR:
      ['YEAR_BATCH'],

    SPOUSE_CURRENT_CITY_DISTRICT:
      ['CURRENT_LOCATION_CITY_DISTRICT'],

    SPOUSE_ACTIVITIES:
      ['MEMBER_PRESENT_ACTIVITIES'],

    SPOUSE_PROFESSION_SKILLS:
      ['MEMBER_PROFESSION_SKILLS'],

    SPOUSE_KEF_KEFGLOBAL_CONTRIBUTIONS:
      ['KEF_KEFGLOBAL_CONTRIBUTIONS'],

    SPOUSE_WILLING_TO_VOLUNTEER:
      ['MEMBER_WILLING_TO_VOLUNTEER']
  };

  const routed = {
    primaryValues: {},
    spouseValues: {},
    ignoredFields: []
  };

  Object.keys(
    submittedFormData
  ).forEach(function (
    portalFieldName
  ) {

    const submittedChange =
      submittedFormData[
        portalFieldName
      ];

    if (
      !submittedChange ||
      typeof submittedChange !== 'object'
    ) {
      routed.ignoredFields.push(
        portalFieldName
      );
      return;
    }

    const newValue =
      submittedChange.new === null ||
      submittedChange.new === undefined
        ? ''
        : submittedChange.new;

    if (
      Object.prototype
        .hasOwnProperty.call(
          primaryFieldMap,
          portalFieldName
        )
    ) {

      KGMIS_Admin_ProfileReview_AddMappedValues_(
        routed.primaryValues,
        primaryFieldMap[
          portalFieldName
        ],
        newValue,
        masterColumn
      );

      return;
    }

    if (
      Object.prototype
        .hasOwnProperty.call(
          spouseFieldMap,
          portalFieldName
        )
    ) {

      KGMIS_Admin_ProfileReview_AddMappedValues_(
        routed.spouseValues,
        spouseFieldMap[
          portalFieldName
        ],
        newValue,
        masterColumn
      );

      return;
    }

    routed.ignoredFields.push(
      portalFieldName
    );
  });

  return routed;
}


/**
 * Adds one submitted value to every mapped target header that
 * exists in the current Master Database schema.
 */
function KGMIS_Admin_ProfileReview_AddMappedValues_(
  targetValues,
  targetHeaders,
  value,
  masterColumn
) {

  targetHeaders.forEach(function (
    targetHeader
  ) {

    if (
      Object.prototype
        .hasOwnProperty.call(
          masterColumn,
          targetHeader
        )
    ) {
      targetValues[
        targetHeader
      ] = value;
    }
  });
}


/**
 * Writes approved values to one Master Database row.
 */
function KGMIS_Admin_ProfileReview_ApplyRowValues_(
  masterContext,
  sheetRow,
  valuesByHeader
) {

  Object.keys(
    valuesByHeader
  ).forEach(function (
    header
  ) {

    if (
      !Object.prototype
        .hasOwnProperty.call(
          masterContext.column,
          header
        )
    ) {
      throw new Error(
        'The Master Database header is missing: ' +
        header
      );
    }

    masterContext.sheet
      .getRange(
        sheetRow,
        masterContext.column[header] + 1
      )
      .setValue(
        valuesByHeader[header]
      );
  });
}


/**
 * Verifies required Master Database headers.
 */
function KGMIS_Admin_ProfileReview_RequireMasterHeaders_(
  masterColumn,
  requiredHeaders
) {

  const missingHeaders =
    requiredHeaders.filter(
      function (header) {

        return !Object.prototype
          .hasOwnProperty.call(
            masterColumn,
            header
          );
      }
    );

  if (missingHeaders.length) {
    throw new Error(
      'The Master Database is missing required headers: ' +
      missingHeaders.join(', ')
    );
  }
}


/**
 * ============================================================
 * Finds one request by REQUEST_ID.
 * ============================================================
 */
function KGMIS_Admin_ProfileReview_FindRequest_(
  requestId
) {

  const sheet =
    KGMIS_Admin_ProfileReview_GetRequestSheet_();

  const context =
    KGMIS_Admin_ProfileReview_GetSheetContext_(
      sheet
    );

  KGMIS_Admin_ProfileReview_RequireHeaders_(
    context,
    [
      'REQUEST_ID',
      'SUBMISSION_ID',
      'SUBMITTED_ON',
      'SUBMITTED_BY_EMAIL',
      'FAMILY_ID',
      'PRIMARY_MEMBER_KEFG_ID',
      'CHANGED_SECTIONS',
      'CHANGE_SUMMARY',
      'UPDATE_JSON',
      'REQUEST_STATUS',
      'REVIEWED_ON',
      'REVIEWED_BY',
      'REVIEW_REMARKS',
      'APPLIED_ON'
    ]
  );

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {

    const row =
      context.values[
        rowIndex
      ];

    const rowRequestId =
      KGMIS_Admin_ProfileReview_Clean_(
        row[
          context.column.REQUEST_ID
        ]
      );

    if (
      rowRequestId !== requestId
    ) {
      continue;
    }

    const result = {
      __SHEET_ROW:
        rowIndex + 1
    };

    context.headers.forEach(
      function (
        header,
        columnIndex
      ) {

        if (!header) {
          return;
        }

        result[header] =
          row[columnIndex];

      }
    );

    return result;
  }

  throw new Error(
    'The Family Profile request was not found: ' +
    requestId
  );
}


/**
 * ============================================================
 * Updates audit columns in the request sheet.
 * ============================================================
 */
function KGMIS_Admin_ProfileReview_UpdateRequestAudit_(
  sheetRow,
  auditValues
) {

  const sheet =
    KGMIS_Admin_ProfileReview_GetRequestSheet_();

  const context =
    KGMIS_Admin_ProfileReview_GetSheetContext_(
      sheet
    );

  Object.keys(
    auditValues
  ).forEach(function (
    header
  ) {

    if (
      !Object.prototype
        .hasOwnProperty.call(
          context.column,
          header
        )
    ) {
      throw new Error(
        'Required audit header is missing: ' +
        header
      );
    }

    sheet
      .getRange(
        sheetRow,
        context.column[header] + 1
      )
      .setValue(
        auditValues[header]
      );

  });
}


/**
 * ============================================================
 * Requires authenticated Admin access.
 * ============================================================
 */
function KGMIS_Admin_ProfileReview_RequireAccess_(
  sessionToken
) {

  const safeSessionToken =
    KGMIS_Admin_ProfileReview_Clean_(
      sessionToken
    );

  if (!safeSessionToken) {
    throw new Error(
      'Your KGMIS session is missing. Please sign in again.'
    );
  }

  return KGMIS_OTP_RequireSessionAccess_(
    safeSessionToken,
    'APPLICATION',
    'ADMINISTER'
  );
}


/**
 * ============================================================
 * Returns the Family Profile request sheet.
 * ============================================================
 */
function KGMIS_Admin_ProfileReview_GetRequestSheet_() {

  const spreadsheet =
    KMIS_DB_GetSpreadsheet();

  const sheet =
    spreadsheet.getSheetByName(
      KGMIS_ADMIN_PROFILE_REVIEW_CONFIG
        .PROFILE_REQUEST_SHEET
    );

  if (!sheet) {
    throw new Error(
      'The sheet "' +
      KGMIS_ADMIN_PROFILE_REVIEW_CONFIG
        .PROFILE_REQUEST_SHEET +
      '" was not found.'
    );
  }

  return sheet;
}


/**
 * ============================================================
 * Returns sheet headers, column map and values.
 * ============================================================
 */
function KGMIS_Admin_ProfileReview_GetSheetContext_(
  sheet
) {

  const lastRow =
    sheet.getLastRow();

  const lastColumn =
    sheet.getLastColumn();

  if (lastColumn < 1) {
    throw new Error(
      'The sheet "' +
      sheet.getName() +
      '" contains no headers.'
    );
  }

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0]
      .map(function (header) {

        return KGMIS_Admin_ProfileReview_Clean_(
          header
        ).toUpperCase();

      });

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
        'Duplicate sheet header found: ' +
        header
      );
    }

    column[header] =
      index;

  });

  const values =
    lastRow >= 1
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
    sheet:
      sheet,

    headers:
      headers,

    column:
      column,

    values:
      values,

    lastRow:
      lastRow,

    lastColumn:
      lastColumn
  };
}


/**
 * ============================================================
 * Validates required headers.
 * ============================================================
 */
function KGMIS_Admin_ProfileReview_RequireHeaders_(
  context,
  requiredHeaders
) {

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
      'Required headers are missing from "' +
      context.sheet.getName() +
      '": ' +
      missingHeaders.join(', ')
    );
  }
}


/**
 * ============================================================
 * Safely parses JSON.
 * ============================================================
 */
function KGMIS_Admin_ProfileReview_ParseJson_(
  value,
  errorMessage
) {

  try {

    const parsed =
      JSON.parse(
        String(
          value || ''
        )
      );

    if (
      !parsed ||
      typeof parsed !== 'object'
    ) {
      throw new Error(
        'Invalid JSON object.'
      );
    }

    return parsed;

  } catch (error) {

    throw new Error(
      errorMessage ||
      'The submitted JSON could not be read.'
    );

  }
}


/**
 * ============================================================
 * Returns trimmed text.
 * ============================================================
 */
function KGMIS_Admin_ProfileReview_Clean_(
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


/**
 * ============================================================
 * Formats a date for the Admin portal.
 * ============================================================
 */
function KGMIS_Admin_ProfileReview_FormatDateTime_(
  value
) {

  if (!value) {
    return '';
  }

  const date =
    Object.prototype
      .toString.call(value) ===
      '[object Date]'
      ? value
      : new Date(value);

  if (
    isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone() ||
      'Asia/Kolkata',
    'dd/MM/yyyy HH:mm:ss'
  );
}


/**
 * ============================================================
 * Converts a date value to milliseconds.
 * ============================================================
 */
function KGMIS_Admin_ProfileReview_DateValue_(
  value
) {

  if (!value) {
    return 0;
  }

  const date =
    new Date(value);

  return isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();
}

function KGMIS_Admin_GetPendingFamilyMemberRequests(sessionToken) {

  KGMIS_Admin_ProfileReview_RequireAccess_(sessionToken);

  const sheet = KMIS_DB_GetSpreadsheet()
    .getSheetByName('KGMIS_FAMILY_MEMBER_UPDATE_REQUESTS');

  if (!sheet || sheet.getLastRow() < 2) {
    return { success: true, requests: [] };
  }

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(function (header) {
    return String(header || '').trim().toUpperCase();
  });

  const col = {};

  headers.forEach(function (header, index) {
    col[header] = index;
  });

  const requests = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {

    const row = values[rowIndex];

    if (
      String(row[col.REQUEST_STATUS] || '')
        .trim()
        .toUpperCase() !== 'PENDING'
    ) {
      continue;
    }

    let requestData = {};

    try {
      requestData = JSON.parse(
        String(row[col.FAMILY_MEMBER_JSON] || '{}')
      );
    } catch (error) {
      requestData = {};
    }

    const formData =
      requestData.formData &&
      typeof requestData.formData === 'object'
        ? requestData.formData
        : requestData;

    const nameData =
      formData.FULL_NAME &&
      typeof formData.FULL_NAME === 'object'
        ? formData.FULL_NAME.new
        : formData.FULL_NAME;

    requests.push({
      requestId: String(row[col.REQUEST_ID] || ''),
      submittedOn:
        KGMIS_Admin_ProfileReview_FormatDateTime_(
          row[col.SUBMITTED_ON]
        ),
      submittedByEmail:
        String(row[col.SUBMITTED_BY_EMAIL] || ''),
      familyId:
        String(row[col.FAMILY_ID] || ''),
      primaryMemberKefgId:
        String(row[col.PRIMARY_MEMBER_KEFG_ID] || ''),
      operation:
        String(row[col.OPERATION] || ''),
      personId:
        String(row[col.PERSON_ID] || ''),
      dependantId:
        String(row[col.DEPENDANT_ID] || ''),
      memberName:
        String(nameData || ''),
      changeSummary:
        String(row[col.CHANGE_SUMMARY] || ''),
      requestStatus:
        String(row[col.REQUEST_STATUS] || '')
    });
  }

  return {
    success: true,
    requests: requests
  };
}

function KGMIS_Admin_GetFamilyMemberRequest(
  sessionToken,
  requestId
) {

  KGMIS_Admin_ProfileReview_RequireAccess_(
    sessionToken
  );

  const sheet =
    KMIS_DB_GetSpreadsheet()
      .getSheetByName(
        'KGMIS_FAMILY_MEMBER_UPDATE_REQUESTS'
      );

  if (!sheet) {
    throw new Error(
      'Family Member request sheet not found.'
    );
  }

  const values =
    sheet.getDataRange().getValues();

  const headers =
    values[0].map(function (header) {
      return String(header || '')
        .trim()
        .toUpperCase();
    });

  const col = {};

  headers.forEach(function (header, index) {
    col[header] = index;
  });

  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const row =
      values[rowIndex];

    if (
      String(
        row[col.REQUEST_ID] || ''
      ) !== requestId
    ) {
      continue;
    }

    const requestObject =
      JSON.parse(
        String(
          row[col.FAMILY_MEMBER_JSON] || '{}'
        )
      );

    const formData =
      requestObject.formData || requestObject;

    const changes = [];

    Object.keys(formData).forEach(function(field){

      const item =
        formData[field];

      if (
        item &&
        typeof item === 'object' &&
        ('old' in item || 'new' in item)
      ) {

        changes.push({

          field: field,

          existingValue:
            item.old === null ||
            item.old === undefined
            ? ''
            : item.old,

          submittedValue:
            item.new === null ||
            item.new === undefined
            ? ''
            : item.new

          });

        }

      });

    return {

      success: true,

      request: {

        requestId:
          row[col.REQUEST_ID],

        familyId:
          row[col.FAMILY_ID],

        primaryMemberKefgId:
          row[col.PRIMARY_MEMBER_KEFG_ID],

        operation:
          row[col.OPERATION],

        changeSummary:
          row[col.CHANGE_SUMMARY],

        changes:
          changes

      }

    };

  }

  throw new Error(
    'Family Member request not found.'
  );

}


function KGMIS_Admin_EditAndApproveFamilyMemberRequest(
  sessionToken,
  requestId,
  editedValues,
  reviewRemarks
) {

  KGMIS_Admin_ProfileReview_RequireAccess_(
    sessionToken
  );

  const safeRequestId =
    String(requestId || '').trim();

  if (!safeRequestId) {
    throw new Error(
      'The Family Member Request ID is missing.'
    );
  }

  const safeEditedValues =
    editedValues &&
    typeof editedValues === 'object'
      ? editedValues
      : {};

  if (!Object.keys(safeEditedValues).length) {
    throw new Error(
      'No edited Family Member values were received.'
    );
  }

  const spreadsheet =
    KMIS_DB_GetSpreadsheet();

  const requestSheet =
    spreadsheet.getSheetByName(
      'KGMIS_FAMILY_MEMBER_UPDATE_REQUESTS'
    );

  if (!requestSheet) {
    throw new Error(
      'The Family Member request sheet was not found.'
    );
  }

  const lock =
    LockService.getScriptLock();

  try {

    lock.waitLock(30000);

    const values =
      requestSheet.getDataRange().getValues();

    const headers =
      values[0].map(function (header) {
        return String(header || '')
          .trim()
          .toUpperCase();
      });

    const column = {};

    headers.forEach(function (
      header,
      index
    ) {
      column[header] = index;
    });

    if (
      column.REQUEST_ID === undefined ||
      column.REQUEST_STATUS === undefined ||
      column.FAMILY_MEMBER_JSON === undefined
    ) {
      throw new Error(
        'The Family Member request sheet is missing required headers.'
      );
    }

    let requestRowIndex = -1;
    let requestRow = null;

    for (
      let rowIndex = 1;
      rowIndex < values.length;
      rowIndex++
    ) {

      if (
        String(
          values[rowIndex][
            column.REQUEST_ID
          ] || ''
        ).trim() === safeRequestId
      ) {

        requestRowIndex = rowIndex;
        requestRow = values[rowIndex];
        break;
      }
    }

    if (!requestRow) {
      throw new Error(
        'The Family Member request was not found.'
      );
    }

    const requestStatus =
      String(
        requestRow[
          column.REQUEST_STATUS
        ] || ''
      )
        .trim()
        .toUpperCase();

    if (requestStatus !== 'PENDING') {
      throw new Error(
        'This request is already ' +
        (requestStatus || 'processed') +
        '.'
      );
    }

    let requestObject;

    try {

      requestObject =
        JSON.parse(
          String(
            requestRow[
              column.FAMILY_MEMBER_JSON
            ] || '{}'
          )
        );

    } catch (error) {

      throw new Error(
        'The Family Member request JSON is invalid.'
      );
    }

    if (
      !requestObject.formData ||
      typeof requestObject.formData !== 'object'
    ) {
      throw new Error(
        'The Family Member request contains no editable changes.'
      );
    }

    const formData =
      requestObject.formData;

    Object.keys(safeEditedValues).forEach(function (
      fieldName
    ) {

      const cleanFieldName =
        String(fieldName || '')
          .trim()
          .toUpperCase();

      if (
        !Object.prototype.hasOwnProperty.call(
          formData,
          cleanFieldName
        )
      ) {
        return;
      }

      const editedValue =
        safeEditedValues[fieldName];

      formData[cleanFieldName].new =
        editedValue === null ||
        editedValue === undefined
          ? ''
          : String(editedValue).trim();
    });

    const changeSummary =
      Object.keys(formData)
        .map(function (fieldName) {

          const change =
            formData[fieldName] || {};

          return (
            fieldName +
            '\nOld: ' +
            (
              change.old === null ||
              change.old === undefined ||
              change.old === ''
                ? '—'
                : change.old
            ) +
            '\nNew: ' +
            (
              change.new === null ||
              change.new === undefined ||
              change.new === ''
                ? '—'
                : change.new
            )
          );

        })
        .join('\n\n');

    const sheetRow =
      requestRowIndex + 1;

    requestSheet
      .getRange(
        sheetRow,
        column.FAMILY_MEMBER_JSON + 1
      )
      .setValue(
        JSON.stringify(requestObject)
      );

    if (column.CHANGE_SUMMARY !== undefined) {
      requestSheet
        .getRange(
          sheetRow,
          column.CHANGE_SUMMARY + 1
        )
        .setValue(changeSummary);
    }

  } finally {

    lock.releaseLock();
  }

  return KGMIS_Admin_ApproveFamilyMemberRequest(
    sessionToken,
    safeRequestId,
    reviewRemarks
  );
}


function KGMIS_Admin_ApproveFamilyMemberRequest(
  sessionToken,
  requestId,
  reviewRemarks
) {

  const admin =
    KGMIS_Admin_ProfileReview_RequireAccess_(
      sessionToken
    );

  const safeRequestId =
    String(requestId || '').trim();

  if (!safeRequestId) {
    throw new Error(
      'The Family Member Request ID is missing.'
    );
  }

  const spreadsheet =
    KMIS_DB_GetSpreadsheet();

  const requestSheet =
    spreadsheet.getSheetByName(
      'KGMIS_FAMILY_MEMBER_UPDATE_REQUESTS'
    );

  const memberSheet =
    spreadsheet.getSheetByName(
      'KEFG_FAMILY_MEMBERS'
    );

  if (!requestSheet) {
    throw new Error(
      'The Family Member request sheet was not found.'
    );
  }

  if (!memberSheet) {
    throw new Error(
      'The KEFG_FAMILY_MEMBERS sheet was not found.'
    );
  }

  const lock =
    LockService.getScriptLock();

  try {

    lock.waitLock(30000);

    const requestValues =
      requestSheet.getDataRange().getValues();

    const requestHeaders =
      requestValues[0].map(function (header) {
        return String(header || '')
          .trim()
          .toUpperCase();
      });

    const requestColumn = {};

    requestHeaders.forEach(function (
      header,
      index
    ) {
      requestColumn[header] = index;
    });

    let requestRowIndex = -1;
    let requestRow = null;

    for (
      let rowIndex = 1;
      rowIndex < requestValues.length;
      rowIndex++
    ) {

      if (
        String(
          requestValues[rowIndex][
            requestColumn.REQUEST_ID
          ] || ''
        ).trim() === safeRequestId
      ) {

        requestRowIndex = rowIndex;
        requestRow = requestValues[rowIndex];

        break;
      }
    }

    if (!requestRow) {
      throw new Error(
        'The Family Member request was not found.'
      );
    }

    const requestStatus =
      String(
        requestRow[
          requestColumn.REQUEST_STATUS
        ] || ''
      )
        .trim()
        .toUpperCase();

    if (requestStatus !== 'PENDING') {
      throw new Error(
        'This request is already ' +
        (requestStatus || 'processed') +
        '.'
      );
    }

    const operation =
      String(
        requestRow[
          requestColumn.OPERATION
        ] || ''
      )
        .trim()
        .toUpperCase();

    if (operation !== 'EDIT') {
      throw new Error(
        'This approval function currently supports EDIT requests only.'
      );
    }

    const familyId =
      String(
        requestRow[
          requestColumn.FAMILY_ID
        ] || ''
      )
        .trim()
        .toUpperCase();

let requestObject;

try {

  requestObject =
    JSON.parse(
      String(
        requestRow[
          requestColumn.FAMILY_MEMBER_JSON
        ] || '{}'
      )
    );

} catch (error) {

  throw new Error(
    'The Family Member request JSON is invalid.'
  );
}

const personId =
  String(
    requestRow[
      requestColumn.PERSON_ID
    ] ||
    requestObject.personId ||
    requestObject.PERSON_ID ||
    ''
  )
    .trim()
    .toUpperCase();

const dependantId =
  String(
    requestRow[
      requestColumn.DEPENDANT_ID
    ] ||
    requestObject.dependantId ||
    requestObject.DEPENDANT_ID ||
    ''
  )
    .trim()
    .toUpperCase();

if (!personId && !dependantId) {
  throw new Error(
    'The Family Member identifier is missing.'
  );
}

    const formData =
      requestObject &&
      requestObject.formData &&
      typeof requestObject.formData === 'object'
        ? requestObject.formData
        : requestObject;

    if (
      !formData ||
      typeof formData !== 'object'
    ) {
      throw new Error(
        'The Family Member request contains no valid changes.'
      );
    }

    const memberValues =
      memberSheet.getDataRange().getValues();

    const memberHeaders =
      memberValues[0].map(function (header) {
        return String(header || '')
          .trim()
          .toUpperCase();
      });

    const memberColumn = {};

    memberHeaders.forEach(function (
      header,
      index
    ) {
      memberColumn[header] = index;
    });

    let targetSheetRow = 0;

    for (
      let rowIndex = 1;
      rowIndex < memberValues.length;
      rowIndex++
    ) {

      const row = memberValues[rowIndex];

      const rowFamilyId =
        String(
          row[memberColumn.FAMILY_ID] || ''
        )
          .trim()
          .toUpperCase();

      if (rowFamilyId !== familyId) {
        continue;
      }

      const rowPersonId =
        memberColumn.PERSON_ID !== undefined
          ? String(
              row[memberColumn.PERSON_ID] || ''
            )
              .trim()
              .toUpperCase()
          : '';

      const rowDependantId =
        memberColumn.DEPENDANT_ID !== undefined
          ? String(
              row[memberColumn.DEPENDANT_ID] || ''
            )
              .trim()
              .toUpperCase()
          : '';

      if (
        (personId && rowPersonId === personId) ||
        (
          dependantId &&
          rowDependantId === dependantId
        )
      ) {

        targetSheetRow = rowIndex + 1;
        break;
      }
    }

    if (!targetSheetRow) {
      throw new Error(
        'The Family Member record could not be found in KEFG_FAMILY_MEMBERS.'
      );
    }

    const fieldsApplied = [];

    Object.keys(formData).forEach(function (
      fieldName
    ) {

      const cleanFieldName =
        String(fieldName || '')
          .trim()
          .toUpperCase();

      if (
        memberColumn[cleanFieldName] === undefined
      ) {
        return;
      }

      const change =
        formData[fieldName];

      const newValue =
        change &&
        typeof change === 'object' &&
        Object.prototype.hasOwnProperty.call(
          change,
          'new'
        )
          ? change.new
          : change;

      memberSheet
        .getRange(
          targetSheetRow,
          memberColumn[cleanFieldName] + 1
        )
        .setValue(
          newValue === null ||
          newValue === undefined
            ? ''
            : newValue
        );

      fieldsApplied.push(
        cleanFieldName
      );
    });

    if (!fieldsApplied.length) {
      throw new Error(
        'None of the submitted fields match KEFG_FAMILY_MEMBERS headers.'
      );
    }

    const now =
      new Date();

    const reviewerEmail =
      String(
        admin.email ||
        admin.userEmail ||
        admin.sessionEmail ||
        Session.getActiveUser().getEmail() ||
        ''
      )
        .trim()
        .toLowerCase();

    if (
      memberColumn.UPDATED_ON !== undefined
    ) {
      memberSheet
        .getRange(
          targetSheetRow,
          memberColumn.UPDATED_ON + 1
        )
        .setValue(now);
    }

    if (
      memberColumn.UPDATED_BY !== undefined
    ) {
      memberSheet
        .getRange(
          targetSheetRow,
          memberColumn.UPDATED_BY + 1
        )
        .setValue(reviewerEmail);
    }

    const requestSheetRow =
      requestRowIndex + 1;

    const auditValues = {
      REQUEST_STATUS: 'APPROVED',
      REVIEWED_ON: now,
      REVIEWED_BY: reviewerEmail,
      REVIEW_REMARKS:
        String(reviewRemarks || '').trim() ||
        'Approved by Admin.',
      APPLIED_ON: now
    };

    Object.keys(auditValues).forEach(function (
      header
    ) {

      if (
        requestColumn[header] === undefined
      ) {
        throw new Error(
          'Required request-sheet header is missing: ' +
          header
        );
      }

      requestSheet
        .getRange(
          requestSheetRow,
          requestColumn[header] + 1
        )
        .setValue(
          auditValues[header]
        );
    });

    return {
      success: true,
      requestId: safeRequestId,
      familyId: familyId,
      operation: operation,
      fieldsApplied: fieldsApplied,
      message:
        'The Family Member request was approved and applied successfully.'
    };

  } finally {

    lock.releaseLock();
  }
}


/**
 * ============================================================
 * Safe manual test.
 *
 * Replace the token before running.
 * This test performs READ operations only.
 * ============================================================
 */
function KGMIS_TestAdminPendingProfileRequests() {

  const sessionToken =
    'PASTE_VALID_ADMIN_SESSION_TOKEN';

  const result =
    KGMIS_Admin_GetPendingProfileRequests(
      sessionToken
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