const KMIS_FP_PORTAL_CONFIG = Object.freeze({
  PAGE_TITLE: 'KEFG Family Profile',
  MODULE_KEY: 'family-profile'
});


function KMIS_UI_Include(fileName) {
  return HtmlService
    .createHtmlOutputFromFile(fileName)
    .getContent();
}


function KMIS_FP_PORTAL_GetPublicConfiguration() {
  return {
    success: true,

    application: {
      name: 'KEFG Membership Information System',
      shortName: 'KMIS',
      version: '2.0',
      environment: 'DEVELOPMENT'
    },

    module: {
      name: 'KEFG Family Profile',
      subtitle:
        'Review and update your family information'
    },

    alumniOptions: [
      'CETA',
      'KEA',
      'MACE',
      'NIT',
      'NSS',
      'TEC',
      'TKMCE',
      'AECK',
      'NOT APPLICABLE'
    ],

    consentOptions: [
      'I AGREE',
      'I DO NOT AGREE'
    ],

    preferredContactOptions: [
      'PRIMARY MEMBER',
      'SPOUSE',
      'EITHER',
      'BOTH'
    ],

    volunteerOptions: [
      'YES',
      'NO',
      'MAYBE',
      'PLEASE CONTACT ME'
    ],

    photoRules: {
      allowedExtensions: [
        'jpg',
        'jpeg',
        'png'
      ],

      allowedMimeTypes: [
        'image/jpeg',
        'image/png'
      ],

      maximumBytes: 2097152,
      maximumMegabytes: 2,
      minimumWidth: 800,
      minimumHeight: 600,
      preferredWidth: 1200,
      preferredHeight: 900,
      aspectRatio: '4:3'
    }
  };
}


function KMIS_FP_PORTAL_LoadByToken(rawToken) {
  const safeToken =
    String(rawToken || '').trim();

  if (!safeToken) {
    throw new Error(
      'This KEFG Family Profile link is incomplete or invalid.'
    );
  }

  const result =
    KMIS_FP_TOKEN_LoadMemberProfile(
      safeToken
    );

  return {
    success: true,
    profile: result.profile,
    linkInformation:
      result.linkInformation
  };
}

function KMIS_FP_PORTAL_LoadCurrentProfile(
  sessionToken
) {

  const safeSessionToken =
    String(
      sessionToken || ''
    ).trim();

  if (!safeSessionToken) {
    throw new Error(
      'Your KGMIS session is missing. Please return to the Main Portal and sign in again.'
    );
  }

  /*
   * Validate the same OTP session already used by My Family.
   */
  KGMIS_OTP_RequireSessionAccess_(
  safeSessionToken,
  'FAMILY_PROFILE',
  'REVIEW'
);

  /*
   * Reuse the existing My Family service to identify
   * the family linked to this logged-in session.
   */
  let myFamilyResult;

try {
  myFamilyResult =
    KGMIS_MyFamily_GetInitialData(
      safeSessionToken
    );
} catch (error) {
  throw new Error(
    'MY FAMILY STAGE: ' +
    (
      error && error.message
        ? error.message
        : error
    )
  );
}

  const familyId =
    String(
      myFamilyResult &&
      myFamilyResult.profile &&
      myFamilyResult.profile.familyId
        ? myFamilyResult.profile.familyId
        : ''
    ).trim();

  if (!familyId) {
    throw new Error(
      'No FAMILY_ID is linked to the signed-in KGMIS account.'
    );
  }

  let profileResult;

try {
  profileResult =
    KMIS_FP_GetMemberFacingProfile(
      familyId
    );
} catch (error) {
  throw new Error(
    'FAMILY PROFILE STAGE: ' +
    (
      error && error.message
        ? error.message
        : error
    )
  );
}

  if (
    !profileResult ||
    !profileResult.success
  ) {
    throw new Error(
      profileResult &&
      profileResult.message
        ? profileResult.message
        : 'The KEFG Family Profile could not be loaded.'
    );
  }

  return {
    success: true,
    profile: profileResult.data
  };
}

/**
 * Saves one Family Profile submission to the temporary
 * administrative-review sheet.
 * added on 28 July 2026
 * This function does NOT update:
 * - KGMIS_MASTER_DATABASE_v1.0
 * - KEFG_FAMILY_MEMBERS
 *
 * Expected submissionData:
 * {
 *   formData: {...},
 *   changedSections: [...],
 *   spouseSectionEnabled: true/false,
 *   photo: {
 *     fileName: '',
 *     mimeType: '',
 *     fileReference: ''
 *   }
 * }
 */
function KMIS_FP_PORTAL_SubmitProfileUpdate(
  sessionToken,
  submissionData,
  submissionId
) {

  const safeSessionToken =
    String(
      sessionToken || ''
    ).trim();

  if (!safeSessionToken) {
    throw new Error(
      'Your KGMIS session is missing. Please sign in again.'
    );
  }

  const safeSubmissionId =
    String(
      submissionId || ''
    ).trim();

  /*
   * Validate the authenticated Main Portal session.
   */
  const sessionAccess =
    KGMIS_OTP_RequireSessionAccess_(
      safeSessionToken,
      'FAMILY_PROFILE',
      'REVIEW'
    );

  const submittedData =
    submissionData &&
    typeof submissionData === 'object'
      ? submissionData
      : {};

  const submittedFormData =
    submittedData.formData &&
    typeof submittedData.formData === 'object'
      ? submittedData.formData
      : {};

  /*
   * Obtain the FAMILY_ID from the authenticated session.
   * Do not accept FAMILY_ID from the browser.
   */
  const myFamilyResult =
    KGMIS_MyFamily_GetInitialData(
      safeSessionToken
    );

  const familyId =
    String(
      myFamilyResult &&
      myFamilyResult.profile &&
      myFamilyResult.profile.familyId
        ? myFamilyResult.profile.familyId
        : ''
    ).trim();

  if (!familyId) {
    throw new Error(
      'No FAMILY_ID is linked to the signed-in KGMIS account.'
    );
  }

  /*
   * Obtain the trusted Primary Member KEFG_ID through
   * the server-side Family Profile service.
   */
  const familyProfileResult =
    KMIS_FP_GetFamilyProfile(
      familyId,
      true
    );

  if (
    !familyProfileResult ||
    !familyProfileResult.success ||
    !familyProfileResult.data
  ) {
    throw new Error(
      familyProfileResult &&
      familyProfileResult.message
        ? familyProfileResult.message
        : 'The family record could not be verified.'
    );
  }

  const primaryMemberKefgId =
    String(
      familyProfileResult.data.internal &&
      familyProfileResult.data.internal.primaryKefgId
        ? familyProfileResult.data.internal.primaryKefgId
        : ''
    ).trim();

  if (!primaryMemberKefgId) {
    throw new Error(
      'The Primary Member KEFG_ID could not be identified.'
    );
  }

  /*
   * Identify the authenticated user's email.
   */
  const submittedByEmail =
    String(
      (
        sessionAccess &&
        (
          sessionAccess.email ||
          sessionAccess.userEmail ||
          sessionAccess.sessionEmail
        )
      ) ||
      (
        myFamilyResult &&
        myFamilyResult.profile &&
        (
          myFamilyResult.profile.loginEmail ||
          myFamilyResult.profile.sessionEmail
        )
      ) ||
      Session.getActiveUser().getEmail() ||
      ''
    ).trim().toLowerCase();

  if (!submittedByEmail) {
    throw new Error(
      'The signed-in email address could not be identified.'
    );
  }

  /*
   * Only these Family Profile fields may be submitted.
   * Treasurer-controlled and internal fields are excluded.
   */
  const allowedFields = [
    'MEMBER_NAME',
    'GENDER',
    'BLOOD_GROUP',
    'MEMBER_DOB_FULL',
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

    'SPOUSE_NAME',
    'SPOUSE_GENDER',
    'SPOUSE_DOB_FULL',
    'SPOUSE_MOBILE',
    'SPOUSE_WHATSAPP',
    'SPOUSE_EMAIL',
    'SPOUSE_ALUMNI_ASSOCIATION',
    'SPOUSE_BRANCH',
    'SPOUSE_BATCH_YEAR',
    'SPOUSE_CURRENT_CITY_DISTRICT',
    'SPOUSE_ACTIVITIES',
    'SPOUSE_PROFESSION_SKILLS',
    'SPOUSE_KEF_KEFGLOBAL_CONTRIBUTIONS',
    'SPOUSE_WILLING_TO_VOLUNTEER',

    'WEDDING_DATE_FULL',
    'CHILD_1_NAME_AND_PROFESSION',
    'CHILD_2_NAME_AND_PROFESSION',
    'CHILD_3_NAME_AND_PROFESSION',

    'PREFERRED_FAMILY_CONTACT',
    'WILLING_TO_JOIN',
    'DATA_CONSENT',
    'REMARKS'
  ];

const cleanFormData = {};

allowedFields.forEach(function (fieldName) {

  if (
    !Object.prototype.hasOwnProperty.call(
      submittedFormData,
      fieldName
    )
  ) {
    return;
  }

  const submittedChange =
    submittedFormData[fieldName];

  if (
    !submittedChange ||
    typeof submittedChange !== 'object'
  ) {
    return;
  }

  const oldValue =
    String(
      submittedChange.old === null ||
      submittedChange.old === undefined
        ? ''
        : submittedChange.old
    ).trim();

  const newValue =
    String(
      submittedChange.new === null ||
      submittedChange.new === undefined
        ? ''
        : submittedChange.new
    ).trim();

  if (oldValue === newValue) {
    return;
  }

  cleanFormData[fieldName] = {
    old: oldValue,
    new: newValue
  };

});

  if (
    !Object.keys(cleanFormData).length
  ) {
    throw new Error(
      'No Family Profile information was received for submission.'
    );
  }

   const changeSummary =
  Object.keys(cleanFormData)
    .map(function (fieldName) {

      const change =
        cleanFormData[fieldName];

      return (
        fieldName +
        '\nOld: ' +
        (
          change.old || '—'
        ) +
        '\nNew: ' +
        (
          change.new || '—'
        )
      );

    })
    .join('\n\n'); 

  /*
   * Accept only recognised editable section names.
   */
  const allowedSections = [
    'MEMBER',
    'SPOUSE',
    'FAMILY',
    'COMMUNICATION'
  ];

  const requestedSections =
    Array.isArray(
      submittedData.changedSections
    )
      ? submittedData.changedSections
      : [];

  const changedSections =
    requestedSections
      .map(function (sectionName) {
        return String(
          sectionName || ''
        ).trim().toUpperCase();
      })
      .filter(function (
        sectionName,
        index,
        sections
      ) {
        return (
          allowedSections.includes(
            sectionName
          ) &&
          sections.indexOf(
            sectionName
          ) === index
        );
      });

  if (!changedSections.length) {
    throw new Error(
      'No updated profile section was identified.'
    );
  }

  /*
   * Photo binary data must not be stored in a sheet cell.
   * Only an uploaded file reference may be included here.
   */
  const submittedPhoto =
    submittedData.photo &&
    typeof submittedData.photo === 'object'
      ? submittedData.photo
      : {};

  const photoInformation = {
    replacementSelected:
      Boolean(
        submittedPhoto.fileReference
      ),

    fileName:
      String(
        submittedPhoto.fileName || ''
      ).trim(),

    mimeType:
      String(
        submittedPhoto.mimeType || ''
      ).trim(),

    fileReference:
      String(
        submittedPhoto.fileReference || ''
      ).trim()
  };

  const updateObject = {
  familyId:
    familyId,

  primaryMemberKefgId:
    primaryMemberKefgId,

  spouseSectionEnabled:
    submittedData.spouseSectionEnabled === true,

  changedSections:
    changedSections,

  formData:
    cleanFormData
  };

  if (
  photoInformation.replacementSelected
  ) {
  updateObject.photo =
    photoInformation;
  }
  const updateJson =
  JSON.stringify(
    updateObject
  );

  /*
   * Google Sheets cells cannot safely hold large image
   * data or exceptionally large JSON submissions.
   */
  if (updateJson.length > 45000) {
    throw new Error(
      'The submitted profile is too large to save. Please remove embedded image data and try again.'
    );
  }

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const requestSheet =
    spreadsheet.getSheetByName(
      'KGMIS_FAMILY_PROFILE_UPDATE_REQUESTS'
    );

  if (!requestSheet) {
    throw new Error(
      'The KGMIS_FAMILY_PROFILE_UPDATE_REQUESTS sheet was not found.'
    );
  }

  const expectedHeaders = [
  'REQUEST_ID',
  'SUBMISSION_ID',
  'SUBMITTED_ON',
  'SUBMITTED_BY_EMAIL',
  'FAMILY_ID',
  'PRIMARY_MEMBER_KEFG_ID',
  'DATABASE_VERSION',
  'REQUEST_SOURCE',
  'CHANGED_SECTIONS',
  'CHANGE_SUMMARY',
  'UPDATE_JSON',
  'REQUEST_STATUS',
  'REVIEWED_ON',
  'REVIEWED_BY',
  'REVIEW_REMARKS',
  'APPLIED_ON'
];

  const lastColumn =
    requestSheet.getLastColumn();

  if (
    lastColumn <
    expectedHeaders.length
  ) {
    throw new Error(
      'The Family Profile Update Requests sheet does not contain all required headers.'
    );
  }

  const actualHeaders =
    requestSheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0]
      .map(function (header) {
        return String(
          header || ''
        ).trim();
      });

  expectedHeaders.forEach(function (
    requiredHeader
  ) {
    if (
      actualHeaders.indexOf(
        requiredHeader
      ) === -1
    ) {
      throw new Error(
        'Required header missing from the update-request sheet: ' +
        requiredHeader
      );
    }
  });

  const now =
    new Date();

  const requestId =
    'FPR-' +
    Utilities.formatDate(
      now,
      Session.getScriptTimeZone(),
      'yyyyMMdd-HHmmss'
    ) +
    '-' +
    Utilities
      .getUuid()
      .substring(0, 8)
      .toUpperCase();
  
  const finalSubmissionId =
    safeSubmissionId ||
    (
      'SUB-' +
      Utilities.formatDate(
        now,
        Session.getScriptTimeZone(),
        'yyyyMMdd-HHmmss'
      ) +
      '-' +
      Utilities
        .getUuid()
        .substring(0, 8)
        .toUpperCase()
    );
  
  const rowData = {
    REQUEST_ID:
      requestId,

    SUBMISSION_ID:
      finalSubmissionId,

    SUBMITTED_ON:
      now,

    SUBMITTED_BY_EMAIL:
      submittedByEmail,

    FAMILY_ID:
      familyId,

    PRIMARY_MEMBER_KEFG_ID:
      primaryMemberKefgId,

    DATABASE_VERSION:
      '1.0',

    REQUEST_SOURCE:
      'FAMILY SELF-SERVICE PROFILE',

    CHANGED_SECTIONS:
      changedSections.join(', '),

    CHANGE_SUMMARY:
      changeSummary,

    UPDATE_JSON:
      updateJson,

    REQUEST_STATUS:
      'PENDING',

    REVIEWED_ON:
      '',

    REVIEWED_BY:
      '',

    REVIEW_REMARKS:
      '',

    APPLIED_ON:
      ''
  };

  const outputRow =
    actualHeaders.map(function (header) {
      return Object.prototype
        .hasOwnProperty.call(
          rowData,
          header
        )
        ? rowData[header]
        : '';
    });

  /*
   * Prevent simultaneous submissions from writing
   * over one another.
   */
  const lock =
    LockService.getScriptLock();

  try {
    lock.waitLock(30000);

    requestSheet.appendRow(
      outputRow
    );

  } finally {
    lock.releaseLock();
  }

  return {
    success: true,

    requestId:
      requestId,

    submissionId:
      finalSubmissionId,

    familyId:
      familyId,

    primaryMemberKefgId:
      primaryMemberKefgId,

    status:
      'PENDING',

    submittedOn:
      Utilities.formatDate(
        now,
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm:ss'
      ),

    message:
      'Your Family Profile update has been submitted successfully for administrative review.'
  };
}


/**
 * Saves new Family Member requests to the temporary
 * administrative-review sheet.
 *
 * This function does NOT directly update:
 * - KEFG_FAMILY_MEMBERS
 * - KGMIS_MASTER_DATABASE_v1.0
 *
 * At this stage, every submitted family member is treated as:
 * OPERATION = ADD
 *
 * Expected familyMembers:
 * [
 *   {
 *     FULL_NAME: '',
 *     FAMILY_RELATION: '',
 *     GENDER: '',
 *     DATE_OF_BIRTH: '',
 *     MOBILE: '',
 *     EMAIL: '',
 *     PROFESSION_SKILLS: '',
 *     ACTIVITIES: '',
 *     WILLING_TO_VOLUNTEER: '',
 *     REMARKS: ''
 *   }
 * ]
 * xxxxxxxxxx
 */

function KMIS_FP_PORTAL_SaveFamilyMemberUpdates(
  sessionToken,
  familyMembers,
  submissionId
) {

  const safeSessionToken =
    String(
      sessionToken || ''
    ).trim();

  if (!safeSessionToken) {
    throw new Error(
      'Your KGMIS session is missing. Please sign in again.'
    );
  }

  const safeSubmissionId =
    String(
      submissionId || ''
    ).trim();

  const sessionAccess =
    KGMIS_OTP_RequireSessionAccess_(
      safeSessionToken,
      'FAMILY_PROFILE',
      'REVIEW'
    );

  const submittedFamilyMembers =
    Array.isArray(familyMembers)
      ? familyMembers
      : [];

  if (!submittedFamilyMembers.length) {
    throw new Error(
      'No Family Member changes were received for submission.'
    );
  }

  const myFamilyResult =
    KGMIS_MyFamily_GetInitialData(
      safeSessionToken
    );

  const familyId =
    String(
      myFamilyResult &&
      myFamilyResult.profile &&
      myFamilyResult.profile.familyId
        ? myFamilyResult.profile.familyId
        : ''
    ).trim();

  if (!familyId) {
    throw new Error(
      'No FAMILY_ID is linked to the signed-in KGMIS account.'
    );
  }

  const familyProfileResult =
    KMIS_FP_GetFamilyProfile(
      familyId,
      true
    );

  if (
    !familyProfileResult ||
    !familyProfileResult.success ||
    !familyProfileResult.data
  ) {
    throw new Error(
      familyProfileResult &&
      familyProfileResult.message
        ? familyProfileResult.message
        : 'The family record could not be verified.'
    );
  }

  const primaryMemberKefgId =
    String(
      familyProfileResult.data.internal &&
      familyProfileResult.data.internal.primaryKefgId
        ? familyProfileResult.data.internal.primaryKefgId
        : ''
    ).trim();

  if (!primaryMemberKefgId) {
    throw new Error(
      'The Primary Member KEFG_ID could not be identified.'
    );
  }

  const submittedByEmail =
    String(
      (
        sessionAccess &&
        (
          sessionAccess.email ||
          sessionAccess.userEmail ||
          sessionAccess.sessionEmail
        )
      ) ||
      (
        myFamilyResult &&
        myFamilyResult.profile &&
        (
          myFamilyResult.profile.loginEmail ||
          myFamilyResult.profile.sessionEmail
        )
      ) ||
      Session.getActiveUser().getEmail() ||
      ''
    ).trim().toLowerCase();

  if (!submittedByEmail) {
    throw new Error(
      'The signed-in email address could not be identified.'
    );
  }

  const spreadsheet =
  SpreadsheetApp.getActiveSpreadsheet();

  const familyMemberSheet =
  spreadsheet.getSheetByName(
    'KEFG_FAMILY_MEMBERS'
  );

  if (!familyMemberSheet) {
      throw new Error(
      'The KEFG_FAMILY_MEMBERS sheet was not found.'
    );
  }

const existingMemberValues =
  familyMemberSheet
    .getDataRange()
    .getDisplayValues();

const existingMemberHeaders =
  existingMemberValues[0].map(function (
    header
  ) {
    return String(header || '')
      .trim()
      .toUpperCase();
  });

const existingMemberColumn = {};

existingMemberHeaders.forEach(function (
  header,
  index
) {
  existingMemberColumn[header] = index;
});

  const allowedFields = [
    'FULL_NAME',
    'FAMILY_RELATION',
    'GENDER',
    'BLOOD_GROUP',
    'DATE_OF_BIRTH',
    'MOBILE',
    'EMAIL',
    'PROFESSION_SKILLS',
    'ACTIVITIES',
    'WILLING_TO_VOLUNTEER',
    'REMARKS'
  ];

  const cleanFamilyMembers = [];

  submittedFamilyMembers.forEach(function (
    submittedMember,
    memberIndex
  ) {

    if (
      !submittedMember ||
      typeof submittedMember !== 'object'
    ) {
      throw new Error(
        'Family Member ' +
        (memberIndex + 1) +
        ' contains invalid information.'
      );
    }

    const operation =
      String(
        submittedMember.OPERATION || ''
      ).trim().toUpperCase();

    if (
      operation !== 'ADD' &&
      operation !== 'EDIT'
    ) {
      throw new Error(
        'Family Member ' +
        (memberIndex + 1) +
        ' has an invalid operation.'
      );
    }

    const cleanMember = {
      OPERATION:
        operation,

      PERSON_ID:
        String(
          submittedMember.PERSON_ID || ''
        ).trim(),

      DEPENDANT_ID:
        String(
          submittedMember.DEPENDANT_ID || ''
        ).trim()
    };

    allowedFields.forEach(function (fieldName) {

      cleanMember[fieldName] =
        String(
          submittedMember[fieldName] === null ||
          submittedMember[fieldName] === undefined
            ? ''
            : submittedMember[fieldName]
        ).trim();

    });

    if (!cleanMember.FULL_NAME) {
      throw new Error(
        'Full Name is missing for Family Member ' +
        (memberIndex + 1) +
        '.'
      );
    }

    if (!cleanMember.FAMILY_RELATION) {
      throw new Error(
        'Relationship is missing for Family Member ' +
        (memberIndex + 1) +
        '.'
      );
    }

    if (!cleanMember.GENDER) {
      throw new Error(
        'Gender is missing for Family Member ' +
        (memberIndex + 1) +
        '.'
      );
    }

    let existingMemberRow = null;

if (operation === 'EDIT') {

  for (
    let rowIndex = 1;
    rowIndex < existingMemberValues.length;
    rowIndex++
  ) {

    const row =
      existingMemberValues[rowIndex];

    const rowFamilyId =
      String(
        row[
          existingMemberColumn.FAMILY_ID
        ] || ''
      )
        .trim()
        .toUpperCase();

    if (
      rowFamilyId !==
      familyId.toUpperCase()
    ) {
      continue;
    }

    const rowPersonId =
      existingMemberColumn.PERSON_ID !== undefined
        ? String(
            row[
              existingMemberColumn.PERSON_ID
            ] || ''
          )
            .trim()
            .toUpperCase()
        : '';

    const rowDependantId =
      existingMemberColumn.DEPENDANT_ID !== undefined
        ? String(
            row[
              existingMemberColumn.DEPENDANT_ID
            ] || ''
          )
            .trim()
            .toUpperCase()
        : '';

    if (
      (
        cleanMember.PERSON_ID &&
        rowPersonId ===
          cleanMember.PERSON_ID.toUpperCase()
      ) ||
      (
        cleanMember.DEPENDANT_ID &&
        rowDependantId ===
          cleanMember.DEPENDANT_ID.toUpperCase()
      )
    ) {
      existingMemberRow = row;
      break;
    }
  }

  if (!existingMemberRow) {
    throw new Error(
      'The existing record for Family Member ' +
      (memberIndex + 1) +
      ' could not be found.'
    );
  }
}

const formData = {};

allowedFields.forEach(function (
  fieldName
) {

  const oldValue =
    operation === 'EDIT' &&
    existingMemberRow &&
    existingMemberColumn[fieldName] !== undefined
      ? String(
          existingMemberRow[
            existingMemberColumn[fieldName]
          ] || ''
        ).trim()
      : '';

  const newValue =
    String(
      cleanMember[fieldName] || ''
    ).trim();

  if (oldValue === newValue) {
    return;
  }

  formData[fieldName] = {
    old: oldValue,
    new: newValue
  };
});

if (!Object.keys(formData).length) {
  throw new Error(
    'No changes were found for Family Member ' +
    (memberIndex + 1) +
    '.'
  );
}

cleanMember.formData =
  formData;

    if (
      JSON.stringify(cleanMember).length >
      40000
    ) {
      throw new Error(
        'The information for Family Member ' +
        (memberIndex + 1) +
        ' is too large to save.'
      );
    }

    cleanFamilyMembers.push(
      cleanMember
    );

  });


  const requestSheet =
    spreadsheet.getSheetByName(
      'KGMIS_FAMILY_MEMBER_UPDATE_REQUESTS'
    );

  if (!requestSheet) {
    throw new Error(
      'The KGMIS_FAMILY_MEMBER_UPDATE_REQUESTS sheet was not found.'
    );
  }

  const expectedHeaders = [
    'REQUEST_ID',
    'SUBMISSION_ID',
    'SUBMITTED_ON',
    'SUBMITTED_BY_EMAIL',
    'FAMILY_ID',
    'PRIMARY_MEMBER_KEFG_ID',
    'OPERATION',
    'PERSON_ID',
    'DEPENDANT_ID',
    'CHANGE_SUMMARY',
    'FAMILY_MEMBER_JSON',
    'REQUEST_STATUS',
    'REVIEWED_ON',
    'REVIEWED_BY',
    'REVIEW_REMARKS',
    'APPLIED_ON'
  ];

  const lastColumn =
    requestSheet.getLastColumn();

  if (
    lastColumn <
    expectedHeaders.length
  ) {
    throw new Error(
      'The Family Member Update Requests sheet does not contain all required headers.'
    );
  }

  const actualHeaders =
    requestSheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0]
      .map(function (header) {
        return String(
          header || ''
        ).trim();
      });

  expectedHeaders.forEach(function (
    requiredHeader
  ) {

    if (
      actualHeaders.indexOf(
        requiredHeader
      ) === -1
    ) {
      throw new Error(
        'Required header missing from the Family Member update-request sheet: ' +
        requiredHeader
      );
    }

  });

  const now =
    new Date();

  const idTimestamp =
    Utilities.formatDate(
      now,
      Session.getScriptTimeZone(),
      'yyyyMMdd-HHmmss'
    );

  const requestId =
    'FMR-' +
    idTimestamp +
    '-' +
    Utilities
      .getUuid()
      .substring(0, 8)
      .toUpperCase();

  const finalSubmissionId =
    safeSubmissionId ||
    (
      'SUB-' +
      idTimestamp +
      '-' +
      Utilities
        .getUuid()
        .substring(0, 8)
        .toUpperCase()
    );

  const outputRows =
    cleanFamilyMembers.map(function (
      familyMember
    ) {

      const changeSummary = [
        'Operation: ' +
          familyMember.OPERATION,

        'Full Name: ' +
          (familyMember.FULL_NAME || '—'),

        'Relationship: ' +
          (familyMember.FAMILY_RELATION || '—'),

        'Gender: ' +
          (familyMember.GENDER || '—'),

        'Blood Group: ' +
          (familyMember.BLOOD_GROUP || '—'),

        'Date of Birth: ' +
          (familyMember.DATE_OF_BIRTH || '—'),

        'Mobile: ' +
          (familyMember.MOBILE || '—'),

        'Email: ' +
          (familyMember.EMAIL || '—'),

        'Profession / Skills: ' +
          (familyMember.PROFESSION_SKILLS || '—'),

        'Activities: ' +
          (familyMember.ACTIVITIES || '—'),

        'Willing to Volunteer: ' +
          (familyMember.WILLING_TO_VOLUNTEER || '—'),

        'Remarks: ' +
          (familyMember.REMARKS || '—')
      ].join('\n');

      const rowData = {

        REQUEST_ID:
          requestId,

        SUBMISSION_ID:
          finalSubmissionId,

        SUBMITTED_ON:
          now,

        SUBMITTED_BY_EMAIL:
          submittedByEmail,

        FAMILY_ID:
          familyId,

        PRIMARY_MEMBER_KEFG_ID:
          primaryMemberKefgId,

        OPERATION:
          familyMember.OPERATION,

        PERSON_ID:
          familyMember.PERSON_ID,

        DEPENDANT_ID:
          familyMember.DEPENDANT_ID,

        CHANGE_SUMMARY:
          changeSummary,

        FAMILY_MEMBER_JSON:
          JSON.stringify(
            familyMember
          ),

        REQUEST_STATUS:
          'PENDING',

        REVIEWED_ON:
          '',

        REVIEWED_BY:
          '',

        REVIEW_REMARKS:
          '',

        APPLIED_ON:
          ''
      };

      return actualHeaders.map(function (
        header
      ) {

        return Object.prototype
          .hasOwnProperty.call(
            rowData,
            header
          )
            ? rowData[header]
            : '';

      });

    });

  const lock =
    LockService.getScriptLock();

  try {

    lock.waitLock(30000);

    const startRow =
      requestSheet.getLastRow() + 1;

    requestSheet
      .getRange(
        startRow,
        1,
        outputRows.length,
        actualHeaders.length
      )
      .setValues(
        outputRows
      );

  } finally {

    lock.releaseLock();

  }

  return {

    success:
      true,

    requestId:
      requestId,

    submissionId:
      finalSubmissionId,

    familyId:
      familyId,

    primaryMemberKefgId:
      primaryMemberKefgId,

    familyMemberCount:
      cleanFamilyMembers.length,

    status:
      'PENDING',

    submittedOn:
      Utilities.formatDate(
        now,
        Session.getScriptTimeZone(),
        'dd/MM/yyyy HH:mm:ss'
      ),

    message:
      cleanFamilyMembers.length +
      (
        cleanFamilyMembers.length === 1
          ? ' Family Member change has'
          : ' Family Member changes have'
      ) +
      ' been submitted successfully for administrative review.'

  };

}


function KMIS_FP_PORTAL_TestPublicConfiguration() {
  const result =
    KMIS_FP_PORTAL_GetPublicConfiguration();

  Logger.log(
    JSON.stringify(result, null, 2)
  );

  return result;
}