/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Member Directory Service
 * File:31.00_KGMIS_Member_Directory.gs 
 * Developed by: JJA Global Systems
 * ============================================================
 *
 * Purpose:
 * - Supply the embedded Member Directory module
 * - Load the signed-in user's own family profile
 * - List one directory record per FAMILY_ID
 * - Search across family, member, spouse and alumni information
 * - Generate the printable Spouse Contact List
 *
 * Security:
 * - Every public function validates the shared OTP session
 * - All users require DIRECTORY + VIEW permission
 * - WhatsApp actions are exposed only to Treasurer/Admin roles
 * - The Spouse Contact List is hidden from DIRECTORY_USER
 */


/**
 * ============================================================
 * DIRECTORY CONFIGURATION
 * ============================================================
 *
 * Literal header names avoid cross-file initialization-order
 * problems in Google Apps Script.
 */
const KGMIS_DIRECTORY_CONFIG = Object.freeze({

  MAX_SEARCH_RESULTS:
    100,

  APPROVED_ALUMNI:
    Object.freeze([
      'CETA',
      'KEA',
      'MACE',
      'NIT',
      'NSS',
      'TEC',
      'TKMCE',
      'AECK'
    ]),

  WHATSAPP_ROLES:
    Object.freeze([
      'TREASURER',
      'ADMIN',
      'SUPER_ADMIN'
    ]),

  SPOUSE_REPORT_ROLES:
    Object.freeze([
      'VIEWER',
      'TREASURER',
      'ADMIN',
      'SUPER_ADMIN'
    ]),

  PHOTO_UPLOAD_ROLES:
    Object.freeze([
      'TREASURER',
      'ADMIN',
      'SUPER_ADMIN'
    ]),

  PHOTO_FOLDER_NAME:
    'KGMIS_FAMILY_PHOTOS',

  PHOTO_REGISTER_SHEET:
    'KGMIS_FAMILY_PHOTOS',

  MASTER_HEADERS:
    Object.freeze({

      FAMILY_ID:
        'FAMILY_ID',

      MEMBER_CATEGORY:
        'MEMBER_CATEGORY',

      RECORD_STATUS:
        'RECORD_STATUS',

      MEMBER_NAME:
        'MEMBER_NAME',

      MEMBER_MOBILE:
        'MEMBER_MOBILE',

      MEMBER_EMAIL:
        'MEMBER_EMAIL',

      MEMBER_ALUMNI:
        'ALUMNI_ASSOCIATION',

      ZONE:
        'ZONE',

      SPOUSE_NAME:
        'SPOUSE_NAME',

      SPOUSE_MOBILE:
        'SPOUSE_MOBILE',

      SPOUSE_EMAIL:
        'SPOUSE_EMAIL',

      SPOUSE_ALUMNI:
        'SPOUSE_ALUMNI_ASSOCIATION'
    }),

  OPTIONAL_HEADER_ALIASES:
    Object.freeze({

      MEMBER_BRANCH:
        Object.freeze([
          'MEMBER_BRANCH',
          'ALUMNI_BRANCH',
          'BRANCH'
        ]),

      MEMBER_BATCH_YEAR:
        Object.freeze([
          'MEMBER_BATCH_YEAR',
          'ALUMNI_YEAR',
          'PASSOUT_YEAR',
          'YEAR_OF_PASSING'
        ]),

      SPOUSE_BRANCH:
        Object.freeze([
          'SPOUSE_BRANCH',
          'SPOUSE_ALUMNI_BRANCH'
        ]),

      SPOUSE_BATCH_YEAR:
        Object.freeze([
          'SPOUSE_BATCH_YEAR',
          'SPOUSE_ALUMNI_YEAR',
          'SPOUSE_PASSOUT_YEAR'
        ]),

      FAMILY_PHOTO_URL:
        Object.freeze([
          'FAMILY_PHOTO_URL',
          'FAMILY_PHOTO',
          'PHOTO_URL'
        ]),

      MEMBER_ADDRESS:
        Object.freeze([
          'LATEST_ADDRESS',
          'MEMBER_ADDRESS',
          'ADDRESS',
          'RESIDENTIAL_ADDRESS',
          'HOME_ADDRESS'
        ]),

      MEMBER_CITY_DISTRICT:
        Object.freeze([
          'CURRENT_LOCATION_CITY_DISTRICT',
          'MEMBER_CITY_DISTRICT',
          'DISTRICT_CITY',
          'CITY_DISTRICT',
          'DISTRICT',
          'CITY'
        ]),

      MEMBER_STATE:
        Object.freeze([
          'CURRENT_LOCATION_STATE',
          'MEMBER_STATE',
          'STATE',
          'STATE_PROVINCE',
          'PROVINCE'
        ]),

      MEMBER_COUNTRY:
        Object.freeze([
          'CURRENT_LOCATION_COUNTRY',
          'MEMBER_COUNTRY',
          'COUNTRY',
          'COUNTRY_OF_RESIDENCE'
        ]),

      MEMBER_PINCODE:
        Object.freeze([
          'MEMBER_PINCODE',
          'PINCODE',
          'PIN_CODE',
          'POSTAL_CODE',
          'ZIP_CODE'
        ]),

      GOOGLE_MAP_LOCATION:
        Object.freeze([
          'HOME_LOCATION_GOOGLE_MAP',
          'GOOGLE_MAP_LOCATION',
          'GOOGLE_MAP_URL',
          'MAP_LOCATION',
          'MAP_URL',
          'LOCATION_URL'
        ])
    })
});


/**
 * ============================================================
 * INITIAL DIRECTORY DATA
 * ============================================================
 */
function KGMIS_Directory_GetInitialData(
  sessionToken
) {

  const user =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'DIRECTORY',
      'VIEW'
    );

  const context =
    KGMIS_Directory_GetMasterContext_();

  const subscriptionYear =
    KGMIS_Directory_GetCurrentYearLabel_();

  const membershipStatusMap =
    KGMIS_Directory_GetCurrentMembershipStatusMap_(
      subscriptionYear
    );

  const directory =
    KGMIS_Directory_BuildFamilyDirectory_(
      context,
      membershipStatusMap,
      subscriptionYear
    );

  const myProfile =
    KGMIS_Directory_EnrichProfileWithPhoto_(
      KGMIS_Directory_FindProfileByLoginEmail_(
        directory,
        user.email
      )
    );

  return {
    success:
      true,

    myProfile:
      myProfile,

    directory:
      directory.map(
        KGMIS_Directory_CreateListRecord_
      ),

    permissions:
      KGMIS_Directory_GetPermissionProfile_(
        user.role
      )
  };
}


/**
 * ============================================================
 * UNIVERSAL DIRECTORY SEARCH
 * ============================================================
 *
 * Searches:
 * - Family ID
 * - Member name
 * - Spouse name
 * - Member mobile
 * - Spouse mobile
 * - Member email
 * - Spouse email
 * - Member alumni
 * - Spouse alumni
 * - Latest address
 * - Current city/district
 * - Current state
 * - Current country
 */
function KGMIS_Directory_Search(
  sessionToken,
  searchText
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'DIRECTORY',
    'VIEW'
  );

  const query =
    KGMIS_Directory_NormalizeSearch_(
      searchText
    );

  if (!query) {
    throw new Error(
      'Enter a Family ID, name, mobile, email, alumni, or address.'
    );
  }

  const context =
    KGMIS_Directory_GetMasterContext_();

  const subscriptionYear =
    KGMIS_Directory_GetCurrentYearLabel_();

  const membershipStatusMap =
    KGMIS_Directory_GetCurrentMembershipStatusMap_(
      subscriptionYear
    );

  const directory =
    KGMIS_Directory_BuildFamilyDirectory_(
      context,
      membershipStatusMap,
      subscriptionYear
    );

  return directory
    .filter(
      function (record) {

        const searchableValues = [
          record.familyId,
          record.memberName,
          record.spouseName,
          record.memberMobile,
          record.spouseMobile,
          record.memberEmail,
          record.spouseEmail,
          record.memberAlumni,
          record.spouseAlumni,
          record.memberAddress,
          record.memberCityDistrict,
          record.memberState,
          record.memberCountry,
          record.memberPincode
        ];

        return searchableValues
          .map(
            KGMIS_Directory_NormalizeSearch_
          )
          .some(
            function (value) {
              return value.indexOf(
                query
              ) !== -1;
            }
          );
      }
    )
    .sort(
      KGMIS_Directory_CompareFamilies_
    )
    .slice(
      0,
      KGMIS_DIRECTORY_CONFIG
        .MAX_SEARCH_RESULTS
    )
    .map(
      KGMIS_Directory_CreateListRecord_
    );
}


/**
 * ============================================================
 * GET ONE FAMILY PROFILE
 * ============================================================
 */
function KGMIS_Directory_GetProfile(
  sessionToken,
  familyId
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'DIRECTORY',
    'VIEW'
  );

  const safeFamilyId =
    KGMIS_Directory_CleanValue_(
      familyId
    )
      .toUpperCase();

  if (!safeFamilyId) {
    throw new Error(
      'Family ID is required.'
    );
  }

  const context =
    KGMIS_Directory_GetMasterContext_();

  const subscriptionYear =
    KGMIS_Directory_GetCurrentYearLabel_();

  const membershipStatusMap =
    KGMIS_Directory_GetCurrentMembershipStatusMap_(
      subscriptionYear
    );

  const directory =
    KGMIS_Directory_BuildFamilyDirectory_(
      context,
      membershipStatusMap,
      subscriptionYear
    );

  const profile =
    directory.find(
      function (record) {
        return (
          String(
            record.familyId || ''
          )
            .trim()
            .toUpperCase() ===
          safeFamilyId
        );
      }
    );

  if (!profile) {
    throw new Error(
      'No directory profile was found for ' +
      safeFamilyId +
      '.'
    );
  }

  return KGMIS_Directory_EnrichProfileWithPhoto_(
    profile
  );
}


/**
 * ============================================================
 * PRINTABLE SPOUSE CONTACT LIST
 * ============================================================
 *
 * Blank mobile and email values are intentionally retained.
 * Rows are sorted alphabetically by spouse name.
 */
function KGMIS_Directory_GetSpouseContactReport(
  sessionToken
) {

  const user =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'DIRECTORY',
      'VIEW'
    );

  if (
    !KGMIS_Directory_RoleAllowed_(
      user.role,
      KGMIS_DIRECTORY_CONFIG
        .SPOUSE_REPORT_ROLES
    )
  ) {
    throw new Error(
      'Access denied. Your role cannot view the Spouse Contact List.'
    );
  }

  const context =
    KGMIS_Directory_GetMasterContext_();

  const subscriptionYear =
    KGMIS_Directory_GetCurrentYearLabel_();

  const membershipStatusMap =
    KGMIS_Directory_GetCurrentMembershipStatusMap_(
      subscriptionYear
    );

  const directory =
    KGMIS_Directory_BuildFamilyDirectory_(
      context,
      membershipStatusMap,
      subscriptionYear
    );

  return directory
    .filter(
      function (record) {
        return Boolean(
          KGMIS_Directory_CleanValue_(
            record.spouseName
          )
        );
      }
    )
    .map(
      function (record) {
        return {
          spouseName:
            record.spouseName,

          spouseMobile:
            record.spouseMobile,

          spouseEmail:
            record.spouseEmail,

          familyId:
            record.familyId,

          memberName:
            record.memberName,

          zone:
            record.zone
        };
      }
    )
    .sort(
      function (first, second) {

        const firstName =
          KGMIS_Directory_NormalizeSearch_(
            first.spouseName
          );

        const secondName =
          KGMIS_Directory_NormalizeSearch_(
            second.spouseName
          );

        return firstName.localeCompare(
          secondName
        );
      }
    );
}


/**
 * ============================================================
 * UPDATE OWN GOOGLE MAP LOCATION
 * ============================================================
 */
function KGMIS_Directory_UpdateOwnGoogleMapLocation(
  sessionToken,
  familyId,
  mapLocation
) {

  const user =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'DIRECTORY',
      'VIEW'
    );

  const safeFamilyId =
    KGMIS_Directory_CleanValue_(
      familyId
    )
      .toUpperCase();

  const safeLocation =
    KGMIS_Directory_CleanValue_(
      mapLocation
    );

  if (!safeFamilyId) {
    throw new Error(
      'Family ID is required.'
    );
  }

  if (!safeLocation) {
    throw new Error(
      'Google Map location is required.'
    );
  }

  if (safeLocation.length > 1000) {
    throw new Error(
      'The Google Map location is too long.'
    );
  }

  const context =
    KGMIS_Directory_GetMasterContext_();

  const familyIdColumn =
    context.column.FAMILY_ID;

  const memberEmailColumn =
    context.column.MEMBER_EMAIL;

  const spouseEmailColumn =
    context.column.SPOUSE_EMAIL;

  const mapColumn =
    context.column.GOOGLE_MAP_LOCATION;

  if (mapColumn === -1) {
    throw new Error(
      'HOME_LOCATION_GOOGLE_MAP column was not found in the master database.'
    );
  }

  const loginEmail =
    KGMIS_Directory_NormalizeEmail_(
      user.email
    );

  let targetRowNumber =
    0;

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row =
      context.values[rowIndex];

    const rowFamilyId =
      KGMIS_Directory_CleanValue_(
        row[familyIdColumn]
      )
        .toUpperCase();

    if (rowFamilyId !== safeFamilyId) {
      continue;
    }

    const memberEmail =
      KGMIS_Directory_NormalizeEmail_(
        row[memberEmailColumn]
      );

    const spouseEmail =
      KGMIS_Directory_NormalizeEmail_(
        row[spouseEmailColumn]
      );

    if (
      loginEmail !== memberEmail &&
      loginEmail !== spouseEmail
    ) {
      throw new Error(
        'You can update only your own family Google Map location.'
      );
    }

    targetRowNumber =
      rowIndex + 1;

    break;
  }

  if (!targetRowNumber) {
    throw new Error(
      'Your family record was not found.'
    );
  }

  context.sheet
    .getRange(
      targetRowNumber,
      mapColumn + 1
    )
    .setValue(
      safeLocation
    );

  SpreadsheetApp.flush();

  const profile =
    KGMIS_Directory_GetProfile(
      sessionToken,
      safeFamilyId
    );

  return {
    success:
      true,

    message:
      'Google Map location updated successfully.',

    profile:
      profile
  };
}


/**
 * ============================================================
 * UPLOAD FAMILY PHOTO
 * ============================================================
 */
function KGMIS_Directory_UploadFamilyPhoto(
  sessionToken,
  familyId,
  filePayload
) {

  const user =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'DIRECTORY',
      'VIEW'
    );

  if (
    !KGMIS_Directory_RoleAllowed_(
      user.role,
      KGMIS_DIRECTORY_CONFIG
        .PHOTO_UPLOAD_ROLES
    )
  ) {
    throw new Error(
      'Access denied. Your role cannot upload family photos.'
    );
  }

  const safeFamilyId =
    KGMIS_Directory_CleanValue_(
      familyId
    )
      .toUpperCase();

  if (!safeFamilyId) {
    throw new Error(
      'Family ID is required.'
    );
  }

  const payload =
    filePayload || {};

  const mimeType =
    KGMIS_Directory_CleanValue_(
      payload.mimeType
    )
      .toLowerCase();

  const allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/webp'
  ];

  if (allowedTypes.indexOf(mimeType) === -1) {
    throw new Error(
      'Only JPG, PNG, and WebP images are allowed.'
    );
  }

  const sizeBytes =
    Number(payload.sizeBytes || 0);

  if (!sizeBytes || sizeBytes > 1024 * 1024) {
    throw new Error(
      'The family photo must not exceed 1 MB.'
    );
  }

  const base64Data =
    KGMIS_Directory_CleanValue_(
      payload.base64Data
    );

  if (!base64Data) {
    throw new Error(
      'The uploaded image data is empty.'
    );
  }

  const bytes =
    Utilities.base64Decode(
      base64Data
    );

  if (bytes.length > 1024 * 1024) {
    throw new Error(
      'The decoded family photo exceeds 1 MB.'
    );
  }

  const folder =
    KGMIS_Directory_GetOrCreatePhotoFolder_();

  const extension =
    KGMIS_Directory_GetImageExtension_(
      mimeType
    );

  const fileName =
    safeFamilyId +
    '_FAMILY_PHOTO_' +
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'yyyyMMdd_HHmmss'
    ) +
    extension;

  const blob =
    Utilities.newBlob(
      bytes,
      mimeType,
      fileName
    );

  const newFile =
    folder.createFile(blob);

  KGMIS_Directory_SavePhotoRegister_(
    safeFamilyId,
    newFile.getId(),
    fileName,
    mimeType,
    sizeBytes,
    user.email
  );

  const profile =
    KGMIS_Directory_GetProfile(
      sessionToken,
      safeFamilyId
    );

  return {
    success: true,
    message: 'Family photo uploaded successfully.',
    profile: profile
  };
}


/**
 * ============================================================
 * DIRECTORY PERMISSION PROFILE
 * ============================================================
 */
function KGMIS_Directory_GetPermissionProfile_(
  role
) {

  const safeRole =
    KGMIS_Directory_CleanValue_(
      role
    )
      .toUpperCase();

  return {
    canUseWhatsApp:
      KGMIS_Directory_RoleAllowed_(
        safeRole,
        KGMIS_DIRECTORY_CONFIG
          .WHATSAPP_ROLES
      ),

    canViewSpouseContactReport:
      KGMIS_Directory_RoleAllowed_(
        safeRole,
        KGMIS_DIRECTORY_CONFIG
          .SPOUSE_REPORT_ROLES
      ),

    canUploadFamilyPhoto:
      KGMIS_Directory_RoleAllowed_(
        safeRole,
        KGMIS_DIRECTORY_CONFIG
          .PHOTO_UPLOAD_ROLES
      )
  };
}


/**
 * ============================================================
 * MASTER SHEET CONTEXT
 * ============================================================
 *
 * Finds the KGMIS master sheet by required Row-1 headers rather
 * than depending on a hard-coded sheet name.
 */
function KGMIS_Directory_GetMasterContext_() {

  const spreadsheet =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const requiredHeaders =
    Object.values(
      KGMIS_DIRECTORY_CONFIG
        .MASTER_HEADERS
    );

  const sheets =
    spreadsheet.getSheets();

  for (
    let sheetIndex = 0;
    sheetIndex < sheets.length;
    sheetIndex++
  ) {

    const sheet =
      sheets[sheetIndex];

    const lastRow =
      sheet.getLastRow();

    const lastColumn =
      sheet.getLastColumn();

    if (
      lastRow < 2 ||
      lastColumn < 1
    ) {
      continue;
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
        .map(
          function (header) {
            return KGMIS_Directory_CleanValue_(
              header
            )
              .toUpperCase();
          }
        );

    const containsRequiredHeaders =
      requiredHeaders.every(
        function (header) {
          return headers.indexOf(
            header
          ) !== -1;
        }
      );

    if (!containsRequiredHeaders) {
      continue;
    }

    const column = {};

    Object.entries(
      KGMIS_DIRECTORY_CONFIG
        .MASTER_HEADERS
    )
      .forEach(
        function (entry) {

          const key =
            entry[0];

          const header =
            entry[1];

          column[key] =
            headers.indexOf(
              header
            );
        }
      );

    Object.entries(
      KGMIS_DIRECTORY_CONFIG
        .OPTIONAL_HEADER_ALIASES
    )
      .forEach(
        function (entry) {
          const key =
            entry[0];

          const aliases =
            entry[1];

          column[key] =
            KGMIS_Directory_FindFirstHeaderIndex_(
              headers,
              aliases
            );
        }
      );

    return {
      spreadsheet:
        spreadsheet,

      sheet:
        sheet,

      sheetName:
        sheet.getName(),

      headers:
        headers,

      column:
        column,

      values:
        sheet
          .getRange(
            1,
            1,
            lastRow,
            lastColumn
          )
          .getDisplayValues()
    };
  }

  throw new Error(
    'KGMIS master sheet was not found. Confirm that the required directory headers exist in Row 1.'
  );
}


/**
 * ============================================================
 * BUILD ONE RECORD PER FAMILY
 * ============================================================
 */
function KGMIS_Directory_BuildFamilyDirectory_(
  context,
  membershipStatusMap,
  subscriptionYear
) {

  const familyMap =
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

    const familyId =
      KGMIS_Directory_CleanValue_(
        row[
          context.column.FAMILY_ID
        ]
      );

    if (!familyId) {
      continue;
    }

    const recordStatus =
      KGMIS_Directory_CleanValue_(
        row[
          context.column.RECORD_STATUS
        ]
      )
        .toUpperCase();

    if (
      recordStatus &&
      recordStatus !== 'ACTIVE'
    ) {
      continue;
    }

    const candidate =
      KGMIS_Directory_CreateFamilyRecord_(
        row,
        context.column,
        membershipStatusMap,
        subscriptionYear
      );

    if (
      !familyMap.has(
        familyId
      )
    ) {
      familyMap.set(
        familyId,
        candidate
      );

      continue;
    }

    const existing =
      familyMap.get(
        familyId
      );

    if (
      KGMIS_Directory_IsPrimaryMember_(
        candidate.memberCategory
      ) &&
      !KGMIS_Directory_IsPrimaryMember_(
        existing.memberCategory
      )
    ) {
      familyMap.set(
        familyId,
        candidate
      );
    }
  }

  return Array
    .from(
      familyMap.values()
    )
    .sort(
      KGMIS_Directory_CompareFamilyIds_
    );
}


/**
 * ============================================================
 * CREATE FAMILY RECORD
 * ============================================================
 */
function KGMIS_Directory_CreateFamilyRecord_(
  row,
  column,
  membershipStatusMap,
  subscriptionYear
) {

  const familyId =
    KGMIS_Directory_CleanValue_(
      row[
        column.FAMILY_ID
      ]
    );

  return {
    familyId:
      familyId,

    memberCategory:
      KGMIS_Directory_CleanValue_(
        row[
          column.MEMBER_CATEGORY
        ]
      ),

    memberName:
      KGMIS_Directory_CleanValue_(
        row[
          column.MEMBER_NAME
        ]
      ),

    spouseName:
      KGMIS_Directory_CleanValue_(
        row[
          column.SPOUSE_NAME
        ]
      ),

    zone:
      KGMIS_Directory_CleanValue_(
        row[
          column.ZONE
        ]
      ),

    membershipStatus:
      membershipStatusMap[
        familyId.toUpperCase()
      ] ||
      'PENDING',

    memberAlumni:
      KGMIS_Directory_GetApprovedAlumni_(
        row[
          column.MEMBER_ALUMNI
        ]
      ),

    spouseAlumni:
      KGMIS_Directory_GetApprovedAlumni_(
        row[
          column.SPOUSE_ALUMNI
        ]
      ),

    memberMobile:
      KGMIS_Directory_CleanValue_(
        row[
          column.MEMBER_MOBILE
        ]
      ),

    spouseMobile:
      KGMIS_Directory_CleanValue_(
        row[
          column.SPOUSE_MOBILE
        ]
      ),

    memberEmail:
      KGMIS_Directory_NormalizeEmail_(
        row[
          column.MEMBER_EMAIL
        ]
      ),

    spouseEmail:
      KGMIS_Directory_NormalizeEmail_(
        row[
          column.SPOUSE_EMAIL
        ]
      ),

    memberBranch:
      KGMIS_Directory_ReadOptionalColumn_(
        row,
        column.MEMBER_BRANCH
      ),

    memberBatchYear:
      KGMIS_Directory_ReadOptionalColumn_(
        row,
        column.MEMBER_BATCH_YEAR
      ),

    spouseBranch:
      KGMIS_Directory_ReadOptionalColumn_(
        row,
        column.SPOUSE_BRANCH
      ),

    spouseBatchYear:
      KGMIS_Directory_ReadOptionalColumn_(
        row,
        column.SPOUSE_BATCH_YEAR
      ),

    familyPhotoUrl:
      KGMIS_Directory_ReadOptionalColumn_(
        row,
        column.FAMILY_PHOTO_URL
      ),

    memberAddress:
      KGMIS_Directory_ReadOptionalColumn_(
        row,
        column.MEMBER_ADDRESS
      ),

    memberCityDistrict:
      KGMIS_Directory_ReadOptionalColumn_(
        row,
        column.MEMBER_CITY_DISTRICT
      ),

    memberState:
      KGMIS_Directory_ReadOptionalColumn_(
        row,
        column.MEMBER_STATE
      ),

    memberCountry:
      KGMIS_Directory_ReadOptionalColumn_(
        row,
        column.MEMBER_COUNTRY
      ),

    memberPincode:
      KGMIS_Directory_ReadOptionalColumn_(
        row,
        column.MEMBER_PINCODE
      ),

    googleMapLocation:
      KGMIS_Directory_ReadOptionalColumn_(
        row,
        column.GOOGLE_MAP_LOCATION
      ),

    subscriptionYear:
      subscriptionYear || ''
  };
}


/**
 * ============================================================
 * CREATE COMPACT LIST/SEARCH RECORD
 * ============================================================
 */
function KGMIS_Directory_CreateListRecord_(
  record
) {

  return {
    familyId:
      record.familyId,

    membershipStatus:
      record.membershipStatus,

    memberName:
      record.memberName,

    spouseName:
      record.spouseName,

    memberAlumni:
      record.memberAlumni,

    spouseAlumni:
      record.spouseAlumni,

    memberMobile:
      record.memberMobile,

    spouseMobile:
      record.spouseMobile,

    memberEmail:
      record.memberEmail,

    spouseEmail:
      record.spouseEmail,

    zone:
      record.zone,

    memberBranch:
      record.memberBranch,

    memberBatchYear:
      record.memberBatchYear,

    spouseBranch:
      record.spouseBranch,

    spouseBatchYear:
      record.spouseBatchYear,

    familyPhotoUrl:
      record.familyPhotoUrl,

    memberAddress:
      record.memberAddress,

    memberCityDistrict:
      record.memberCityDistrict,

    memberState:
      record.memberState,

    memberCountry:
      record.memberCountry,

    memberPincode:
      record.memberPincode,

    googleMapLocation:
      record.googleMapLocation,

    subscriptionYear:
      record.subscriptionYear
  };
}


/**
 * ============================================================
 * FIND SIGNED-IN USER'S PROFILE
 * ============================================================
 *
 * Matches either MEMBER_EMAIL or SPOUSE_EMAIL.
 */
function KGMIS_Directory_FindProfileByLoginEmail_(
  directory,
  loginEmail
) {

  const email =
    KGMIS_Directory_NormalizeEmail_(
      loginEmail
    );

  if (!email) {
    return null;
  }

  return directory.find(
    function (record) {
      return (
        KGMIS_Directory_NormalizeEmail_(
          record.memberEmail
        ) === email ||
        KGMIS_Directory_NormalizeEmail_(
          record.spouseEmail
        ) === email
      );
    }
  ) || null;
}


/**
 * ============================================================
 * CURRENT MEMBERSHIP STATUS MAP
 * ============================================================
 *
 * Reads the current ACTIVE record in KGMIS_MEMBERSHIP_YEAR.
 * If the sheet is unavailable, families default to PENDING.
 */
function KGMIS_Directory_GetCurrentMembershipStatusMap_(
  resolvedFinancialYear
) {

  const result = {};

  try {

    const financialYear =
      KGMIS_Directory_CleanValue_(
        resolvedFinancialYear
      ) ||
      KGMIS_Directory_GetCurrentYearLabel_();

    if (!financialYear) {
      return result;
    }

    const spreadsheet =
      SpreadsheetApp
        .getActiveSpreadsheet();

    const sheetName =
      (
        typeof KGMIS_CONFIG !==
          'undefined' &&
        KGMIS_CONFIG
          .MEMBERSHIP_YEAR_SHEET
      )
        ? KGMIS_CONFIG
            .MEMBERSHIP_YEAR_SHEET
        : 'KGMIS_MEMBERSHIP_YEAR';

    const sheet =
      spreadsheet.getSheetByName(
        sheetName
      );

    if (!sheet) {
      return result;
    }

    const lastRow =
      sheet.getLastRow();

    const lastColumn =
      sheet.getLastColumn();

    if (
      lastRow < 2 ||
      lastColumn < 1
    ) {
      return result;
    }

    const values =
      sheet
        .getRange(
          1,
          1,
          lastRow,
          lastColumn
        )
        .getDisplayValues();

    const headers =
      values[0]
        .map(
          function (header) {
            return KGMIS_Directory_CleanValue_(
              header
            )
              .toUpperCase();
          }
        );

    const familyIdIndex =
      headers.indexOf(
        'FAMILY_ID'
      );

    const yearIndex =
      headers.indexOf(
        'FINANCIAL_YEAR'
      );

    const membershipStatusIndex =
      headers.indexOf(
        'MEMBERSHIP_STATUS'
      );

    const paymentStatusIndex =
      headers.indexOf(
        'PAYMENT_STATUS'
      );

    const recordStatusIndex =
      headers.indexOf(
        'RECORD_STATUS'
      );

    if (
      familyIdIndex === -1 ||
      yearIndex === -1
    ) {
      return result;
    }

    for (
      let rowIndex = 1;
      rowIndex < values.length;
      rowIndex++
    ) {

      const row =
        values[
          rowIndex
        ];

      const rowFamilyId =
        KGMIS_Directory_CleanValue_(
          row[
            familyIdIndex
          ]
        );

      const rowYear =
        KGMIS_Directory_CleanValue_(
          row[
            yearIndex
          ]
        );

      const rowRecordStatus =
        recordStatusIndex === -1
          ? 'ACTIVE'
          : KGMIS_Directory_CleanValue_(
              row[
                recordStatusIndex
              ]
            )
              .toUpperCase();

      if (
        !rowFamilyId ||
        rowYear !== financialYear ||
        rowRecordStatus !== 'ACTIVE'
      ) {
        continue;
      }

      const membershipStatus =
        membershipStatusIndex === -1
          ? ''
          : KGMIS_Directory_CleanValue_(
              row[
                membershipStatusIndex
              ]
            )
              .toUpperCase();

      const paymentStatus =
        paymentStatusIndex === -1
          ? ''
          : KGMIS_Directory_CleanValue_(
              row[
                paymentStatusIndex
              ]
            )
              .toUpperCase();

      result[
        rowFamilyId.toUpperCase()
      ] =
        KGMIS_Directory_ResolveMembershipStatus_(
          membershipStatus,
          paymentStatus
        );
    }

  } catch (error) {

    console.warn(
      'Member Directory could not read current membership status:',
      error
    );
  }

  return result;
}


/**
 * ============================================================
 * MEMBERSHIP STATUS RESOLUTION
 * ============================================================
 */
function KGMIS_Directory_ResolveMembershipStatus_(
  membershipStatus,
  paymentStatus
) {

  const membership =
    KGMIS_Directory_CleanValue_(
      membershipStatus
    )
      .toUpperCase();

  const payment =
    KGMIS_Directory_CleanValue_(
      paymentStatus
    )
      .toUpperCase();

  if (
    membership ===
      'LIFETIME MEMBER'
  ) {
    return 'LIFETIME MEMBER';
  }

  if (
    membership === 'EXEMPT' ||
    payment === 'WAIVED' ||
    payment ===
      'NOT APPLICABLE'
  ) {
    return 'EXEMPTED';
  }

  if (
    membership === 'CURRENT' ||
    payment === 'PAID'
  ) {
    return 'CURRENT';
  }

  return 'PENDING';
}


/**
 * ============================================================
 * ALUMNI NORMALIZATION
 * ============================================================
 *
 * Only approved alumni values are returned. Negative or
 * non-alumni wording is suppressed.
 */
function KGMIS_Directory_GetApprovedAlumni_(
  value
) {

  const alumni =
    KGMIS_Directory_CleanValue_(
      value
    )
      .toUpperCase();

  return KGMIS_DIRECTORY_CONFIG
    .APPROVED_ALUMNI
    .indexOf(
      alumni
    ) !== -1
      ? alumni
      : '';
}


/**
 * ============================================================
 * FAMILY PHOTO STORAGE
 * ============================================================
 */
function KGMIS_Directory_GetOrCreatePhotoFolder_() {

  const folders =
    DriveApp.getFoldersByName(
      KGMIS_DIRECTORY_CONFIG
        .PHOTO_FOLDER_NAME
    );

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(
    KGMIS_DIRECTORY_CONFIG
      .PHOTO_FOLDER_NAME
  );
}


function KGMIS_Directory_GetOrCreatePhotoRegisterSheet_() {

  const spreadsheet =
    SpreadsheetApp
      .getActiveSpreadsheet();

  let sheet =
    spreadsheet.getSheetByName(
      KGMIS_DIRECTORY_CONFIG
        .PHOTO_REGISTER_SHEET
    );

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet(
        KGMIS_DIRECTORY_CONFIG
          .PHOTO_REGISTER_SHEET
      );

    sheet
      .getRange(1, 1, 1, 8)
      .setValues([[
        'FAMILY_ID',
        'FILE_ID',
        'FILE_NAME',
        'MIME_TYPE',
        'SIZE_BYTES',
        'UPLOADED_BY',
        'UPLOADED_AT',
        'RECORD_STATUS'
      ]]);

    sheet.setFrozenRows(1);
  }

  return sheet;
}


function KGMIS_Directory_SavePhotoRegister_(
  familyId,
  fileId,
  fileName,
  mimeType,
  sizeBytes,
  uploadedBy
) {

  const sheet =
    KGMIS_Directory_GetOrCreatePhotoRegisterSheet_();

  const lastRow =
    sheet.getLastRow();

  if (lastRow >= 2) {
    const values =
      sheet
        .getRange(2, 1, lastRow - 1, 8)
        .getValues();

    values.forEach(
      function (row, index) {
        if (
          String(row[0] || '')
            .trim()
            .toUpperCase() === familyId &&
          String(row[7] || '')
            .trim()
            .toUpperCase() === 'ACTIVE'
        ) {
          sheet
            .getRange(index + 2, 8)
            .setValue('REPLACED');

          try {
            DriveApp
              .getFileById(
                String(row[1] || '')
              )
              .setTrashed(true);
          } catch (error) {
            console.warn(
              'Previous family photo could not be moved to Trash:',
              error
            );
          }
        }
      }
    );
  }

  sheet.appendRow([
    familyId,
    fileId,
    fileName,
    mimeType,
    sizeBytes,
    uploadedBy || '',
    new Date(),
    'ACTIVE'
  ]);
}


function KGMIS_Directory_GetActivePhotoFileId_(
  familyId
) {

  const spreadsheet =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const sheet =
    spreadsheet.getSheetByName(
      KGMIS_DIRECTORY_CONFIG
        .PHOTO_REGISTER_SHEET
    );

  if (!sheet || sheet.getLastRow() < 2) {
    return '';
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        sheet.getLastRow() - 1,
        8
      )
      .getDisplayValues();

  for (
    let index = values.length - 1;
    index >= 0;
    index--
  ) {
    const row =
      values[index];

    if (
      String(row[0] || '')
        .trim()
        .toUpperCase() ===
        String(familyId || '')
          .trim()
          .toUpperCase() &&
      String(row[7] || '')
        .trim()
        .toUpperCase() === 'ACTIVE'
    ) {
      return String(row[1] || '').trim();
    }
  }

  return '';
}


function KGMIS_Directory_EnrichProfileWithPhoto_(
  profile
) {

  if (!profile) {
    return null;
  }

  const enriched =
    Object.assign({}, profile);

  const fileId =
    KGMIS_Directory_GetActivePhotoFileId_(
      profile.familyId
    );

  if (!fileId) {
    enriched.familyPhotoUrl = '';
    return enriched;
  }

  try {
    const file =
      DriveApp.getFileById(fileId);

    const blob =
      file.getBlob();

    enriched.familyPhotoUrl =
      'data:' +
      blob.getContentType() +
      ';base64,' +
      Utilities.base64Encode(
        blob.getBytes()
      );

  } catch (error) {
    enriched.familyPhotoUrl = '';

    console.warn(
      'Family photo could not be loaded:',
      error
    );
  }

  return enriched;
}


function KGMIS_Directory_GetImageExtension_(
  mimeType
) {

  if (mimeType === 'image/png') {
    return '.png';
  }

  if (mimeType === 'image/webp') {
    return '.webp';
  }

  return '.jpg';
}


/**
 * ============================================================
 * ROLE AND SORT UTILITIES
 * ============================================================
 */
function KGMIS_Directory_RoleAllowed_(
  role,
  allowedRoles
) {

  const safeRole =
    KGMIS_Directory_CleanValue_(
      role
    )
      .toUpperCase();

  return allowedRoles.indexOf(
    safeRole
  ) !== -1;
}


function KGMIS_Directory_IsPrimaryMember_(
  memberCategory
) {

  return (
    KGMIS_Directory_NormalizeSearch_(
      memberCategory
    ) ===
    'primary member'
  );
}


function KGMIS_Directory_CompareFamilyIds_(
  first,
  second
) {

  return (
    KGMIS_Directory_ExtractFamilyNumber_(
      first.familyId
    ) -
    KGMIS_Directory_ExtractFamilyNumber_(
      second.familyId
    )
  );
}


function KGMIS_Directory_ExtractFamilyNumber_(
  familyId
) {

  const match =
    String(familyId || '')
      .match(/(\d+)/);

  return match
    ? Number(match[1])
    : Number.MAX_SAFE_INTEGER;
}


function KGMIS_Directory_CompareFamilies_(
  first,
  second
) {

  const firstName =
    KGMIS_Directory_NormalizeSearch_(
      first.memberName ||
      first.familyId
    );

  const secondName =
    KGMIS_Directory_NormalizeSearch_(
      second.memberName ||
      second.familyId
    );

  return firstName.localeCompare(
    secondName
  );
}


/**
 * Returns the first matching optional header index.
 */
function KGMIS_Directory_FindFirstHeaderIndex_(
  headers,
  aliases
) {

  for (
    let aliasIndex = 0;
    aliasIndex < aliases.length;
    aliasIndex++
  ) {
    const index =
      headers.indexOf(
        String(
          aliases[aliasIndex]
        )
          .trim()
          .toUpperCase()
      );

    if (index !== -1) {
      return index;
    }
  }

  return -1;
}


function KGMIS_Directory_ReadOptionalColumn_(
  row,
  columnIndex
) {

  if (
    columnIndex === -1 ||
    columnIndex === null ||
    columnIndex === undefined
  ) {
    return '';
  }

  return KGMIS_Directory_CleanValue_(
    row[
      columnIndex
    ]
  );
}


function KGMIS_Directory_GetCurrentYearLabel_() {

  const cache =
    CacheService.getScriptCache();

  const cacheKey =
    'KGMIS_DIRECTORY_CURRENT_FINANCIAL_YEAR';

  const cachedValue =
    cache.get(
      cacheKey
    );

  if (cachedValue) {
    return cachedValue;
  }

  try {
    const record =
      KGMIS_GetCurrentFinancialYear();

    const financialYear =
      KGMIS_Directory_CleanValue_(
        record &&
        (
          record.financialYear ||
          record.FINANCIAL_YEAR
        )
      );

    if (financialYear) {
      cache.put(
        cacheKey,
        financialYear,
        300
      );
    }

    return financialYear;

  } catch (error) {
    return '';
  }
}


/**
 * ============================================================
 * VALUE UTILITIES
 * ============================================================
 */
function KGMIS_Directory_CleanValue_(
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
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    );
}


function KGMIS_Directory_NormalizeEmail_(
  value
) {

  return KGMIS_Directory_CleanValue_(
    value
  )
    .toLowerCase();
}


function KGMIS_Directory_NormalizeSearch_(
  value
) {

  return KGMIS_Directory_CleanValue_(
    value
  )
    .toLowerCase();
}


/**
 * ============================================================
 * SAFE TESTS
 * ============================================================
 */

/**
 * Validates the master sheet and reports the number of family
 * records without requiring a web-app session.
 */
function KGMIS_TestDirectoryMasterContext() {

  const context =
    KGMIS_Directory_GetMasterContext_();

  const subscriptionYear =
    KGMIS_Directory_GetCurrentYearLabel_();

  const membershipStatusMap =
    KGMIS_Directory_GetCurrentMembershipStatusMap_(
      subscriptionYear
    );

  const directory =
    KGMIS_Directory_BuildFamilyDirectory_(
      context,
      membershipStatusMap,
      subscriptionYear
    );

  const result = {
    success:
      true,

    masterSheet:
      context.sheetName,

    familyCount:
      directory.length,

    approvedAlumni:
      Array.from(
        KGMIS_DIRECTORY_CONFIG
          .APPROVED_ALUMNI
      )
  };

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
 * Tests the role-based Directory privileges.
 */
function KGMIS_TestDirectoryPermissions(
  role
) {

  const safeRole =
    KGMIS_Directory_CleanValue_(
      role ||
      'DIRECTORY_USER'
    )
      .toUpperCase();

  const result = {
    success:
      true,

    role:
      safeRole,

    permissions:
      KGMIS_Directory_GetPermissionProfile_(
        safeRole
      )
  };

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
 * TEST EXACT DIRECTORY ADDRESS HEADERS
 * ============================================================
 *
 * Confirms the exact KGMIS_MASTER_DATABASE_v1.0 address columns.
 */
function KGMIS_TestExactDirectoryAddressHeaders() {

  const context =
    KGMIS_Directory_GetMasterContext_();

  const expectedHeaders = [
    'CURRENT_LOCATION_COUNTRY',
    'CURRENT_LOCATION_STATE',
    'CURRENT_LOCATION_CITY_DISTRICT',
    'LATEST_ADDRESS',
    'HOME_LOCATION_GOOGLE_MAP'
  ];

  const result = {
    success:
      true,

    masterSheet:
      context.sheetName,

    headers:
      {}
  };

  expectedHeaders.forEach(
    function (header) {
      const index =
        context.headers.indexOf(
          header
        );

      result.headers[header] =
        index === -1
          ? 'NOT FOUND'
          : 'FOUND AT COLUMN ' +
            String(index + 1);
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
