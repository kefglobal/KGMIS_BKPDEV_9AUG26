/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * My Family Service
 *
 * File: 32.00_KGMIS_My_Family.gs
 * Developed by: James Joseph Alenchery
 * ============================================================
 *
 * Initial Phase:
 * - Load the signed-in user's own family profile
 * - Build Member and Spouse card-readiness records
 * - Read approved people from KEFG_FAMILY_MEMBERS
 * - Read issued cards from KEFG_MEMBER_CARDS
 *
 * Security:
 * - Uses the shared OTP session
 * - Requires DIRECTORY + VIEW permission during Phase 1
 */


/**
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */
const KGMIS_MY_FAMILY_CONFIG = Object.freeze({

  FAMILY_MEMBERS_SHEET:
    'KEFG_FAMILY_MEMBERS',

  MEMBER_CARDS_SHEET:
    'KEFG_MEMBER_CARDS',

  FAMILY_MEMBER_HEADERS:
    Object.freeze([
      'PERSON_ID',
      'FAMILY_ID',
      'RELATED_KEFG_ID',
      'FULL_NAME',
      'FAMILY_RELATION',
      'GENDER',
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
      'REMARKS'
    ]),

  MEMBER_CARD_HEADERS:
    Object.freeze([
      'CARD_ID',
      'FAMILY_ID',
      'KEFG_ID',
      'CARDHOLDER_TYPE',
      'RELATION_SEQUENCE',
      'CARDHOLDER_NAME',
      'MEMBERSHIP_TYPE',
      'MEMBERSHIP_YEAR',
      'MEMBERSHIP_STATUS',
      'ISSUE_DATE',
      'VALID_UNTIL',
      'CARD_STATUS',
      'MEMBER_MOBILE',
      'MEMBER_EMAIL',
      'PHOTO_FILE_ID',
      'PHOTO_URL',
      'QR_TOKEN',
      'CARD_PDF_FILE_ID',
      'CARD_PDF_FILE_URL',
      'CARD_IMAGE_FILE_ID',
      'CARD_IMAGE_FILE_URL',
      'CREATED_ON',
      'CREATED_BY',
      'UPDATED_ON',
      'UPDATED_BY',
      'CARD_VERSION',
      'REMARKS'
    ])
});


/**
 * ============================================================
 * INITIAL MY FAMILY DATA
 * ============================================================
 */
function KGMIS_MyFamily_GetInitialData(
  sessionToken
) {

  const user =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'DIRECTORY',
      'VIEW'
    );

  const directoryContext =
    KGMIS_Directory_GetMasterContext_();

  const subscriptionYear =
    KGMIS_Directory_GetCurrentYearLabel_();

  const membershipStatusMap =
    KGMIS_Directory_GetCurrentMembershipStatusMap_(
      subscriptionYear
    );

  const directory =
    KGMIS_Directory_BuildFamilyDirectory_(
      directoryContext,
      membershipStatusMap,
      subscriptionYear
    );

  const profile =
    KGMIS_Directory_FindProfileByLoginEmail_(
      directory,
      user.email
    );

  if (!profile) {
    throw new Error(
      'No family profile is linked to your signed-in email.'
    );
  }

  const familyId =
    KGMIS_MyFamily_Clean_(
      profile.familyId
    )
      .toUpperCase();

  const storedFamilyMembers =
    KGMIS_MyFamily_ReadRowsByFamily_(
      KGMIS_MY_FAMILY_CONFIG
        .FAMILY_MEMBERS_SHEET,
      KGMIS_MY_FAMILY_CONFIG
        .FAMILY_MEMBER_HEADERS,
      familyId
    );

  const cards =
    KGMIS_MyFamily_ReadRowsByFamily_(
      KGMIS_MY_FAMILY_CONFIG
        .MEMBER_CARDS_SHEET,
      KGMIS_MY_FAMILY_CONFIG
        .MEMBER_CARD_HEADERS,
      familyId
    );

  const readiness =
    KGMIS_MyFamily_BuildReadiness_(
      profile,
      storedFamilyMembers
    );

  const summary =
    KGMIS_MyFamily_BuildSummary_(
      profile,
      readiness,
      cards
    );

  return {
    success:
      true,

    profile:
      {
        familyId:
          profile.familyId,

        memberName:
          profile.memberName,

        memberMobile:
          profile.memberMobile,

        memberEmail:
          profile.memberEmail,

        spouseName:
          profile.spouseName,

        spouseMobile:
          profile.spouseMobile,

        spouseEmail:
          profile.spouseEmail,

        zone:
          profile.zone,

        membershipStatus:
          profile.membershipStatus,

        subscriptionYear:
          profile.subscriptionYear
      },

    cardReadiness:
      readiness,

    cards:
      cards.map(
        KGMIS_MyFamily_CreateCardResponse_
      ),

    summary:
      summary
  };
}


/**
 * ============================================================
 * CARD READINESS
 * ============================================================
 */
function KGMIS_MyFamily_BuildReadiness_(
  profile,
  storedRows
) {

  const records =
    Array.isArray(storedRows)
      ? storedRows.slice()
      : [];

  const readinessMap =
    {};

  records.forEach(
    function (row) {
      const relation =
        KGMIS_MyFamily_Clean_(
          row.FAMILY_RELATION
        )
          .toUpperCase();

      if (relation) {
        readinessMap[relation] =
          KGMIS_MyFamily_CreateReadinessResponse_(
            row
          );
      }
    }
  );

  if (!readinessMap.PRIMARY_MEMBER) {
    readinessMap.PRIMARY_MEMBER = {
      personId:
        '',

      familyId:
        profile.familyId,

      fullName:
        profile.memberName,

      familyRelation:
        'PRIMARY_MEMBER',

      relationSequence:
        '01',

      cardEligible:
        Boolean(
          KGMIS_MyFamily_Clean_(
            profile.memberName
          )
        ),

      mobile:
        profile.memberMobile,

      email:
        profile.memberEmail,

      eligibilityStatus:
        'PROFILE SOURCE',

      recordStatus:
        'ACTIVE'
    };
  }

  if (
    KGMIS_MyFamily_Clean_(
      profile.spouseName
    ) &&
    !readinessMap.SPOUSE
  ) {
    readinessMap.SPOUSE = {
      personId:
        '',

      familyId:
        profile.familyId,

      fullName:
        profile.spouseName,

      familyRelation:
        'SPOUSE',

      relationSequence:
        '02',

      cardEligible:
        true,

      mobile:
        profile.spouseMobile,

      email:
        profile.spouseEmail,

      eligibilityStatus:
        'PROFILE SOURCE',

      recordStatus:
        'ACTIVE'
    };
  }

  return Object
    .keys(
      readinessMap
    )
    .map(
      function (key) {
        return readinessMap[key];
      }
    )
    .sort(
      function (first, second) {
        return (
          Number(
            first.relationSequence || 999
          ) -
          Number(
            second.relationSequence || 999
          )
        );
      }
    );
}


/**
 * ============================================================
 * SUMMARY
 * ============================================================
 */
function KGMIS_MyFamily_BuildSummary_(
  profile,
  readiness,
  cards
) {

  const activeCards =
    cards.filter(
      function (row) {
        return (
          KGMIS_MyFamily_Clean_(
            row.CARD_STATUS
          )
            .toUpperCase() ===
          'ACTIVE'
        );
      }
    ).length;

  const eligiblePeople =
    readiness.filter(
      function (row) {
        return Boolean(
          row.cardEligible
        );
      }
    ).length;

  const pendingVerification =
    readiness.filter(
      function (row) {
        return (
          row.fullName &&
          !row.cardEligible
        );
      }
    ).length;

  return {
    profileCompleteness:
      KGMIS_MyFamily_CalculateCompleteness_(
        profile
      ),

    eligiblePeople:
      eligiblePeople,

    activeCards:
      activeCards,

    pendingVerification:
      pendingVerification
  };
}


function KGMIS_MyFamily_CalculateCompleteness_(
  profile
) {

  const values = [
    profile.memberName,
    profile.memberMobile,
    profile.memberEmail,
    profile.spouseName,
    profile.spouseMobile,
    profile.spouseEmail,
    profile.memberAddress,
    profile.memberCityDistrict,
    profile.memberState,
    profile.memberCountry,
    profile.googleMapLocation,
    profile.familyPhotoUrl
  ];

  const completed =
    values.filter(
      function (value) {
        return Boolean(
          KGMIS_MyFamily_Clean_(
            value
          )
        );
      }
    ).length;

  return Math.round(
    (
      completed /
      values.length
    ) *
    100
  );
}


/**
 * ============================================================
 * SHEET READER
 * ============================================================
 */
function KGMIS_MyFamily_ReadRowsByFamily_(
  sheetName,
  requiredHeaders,
  familyId
) {

  const spreadsheet =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const sheet =
    spreadsheet.getSheetByName(
      sheetName
    );

  if (!sheet) {
    throw new Error(
      sheetName +
      ' was not found.'
    );
  }

  const lastRow =
    sheet.getLastRow();

  const lastColumn =
    sheet.getLastColumn();

  if (lastColumn < 1) {
    throw new Error(
      sheetName +
      ' has no headers.'
    );
  }

  const values =
    sheet
      .getRange(
        1,
        1,
        Math.max(lastRow, 1),
        lastColumn
      )
      .getDisplayValues();

  const headers =
    values[0]
      .map(
        function (header) {
          return KGMIS_MyFamily_Clean_(
            header
          )
            .toUpperCase();
        }
      );

  const missingHeaders =
    requiredHeaders.filter(
      function (header) {
        return headers.indexOf(
          header
        ) === -1;
      }
    );

  if (missingHeaders.length) {
    throw new Error(
      sheetName +
      ' is missing headers: ' +
      missingHeaders.join(', ')
    );
  }

  const familyIdIndex =
    headers.indexOf(
      'FAMILY_ID'
    );

  if (lastRow < 2) {
    return [];
  }

  return values
    .slice(1)
    .filter(
      function (row) {
        return (
          KGMIS_MyFamily_Clean_(
            row[familyIdIndex]
          )
            .toUpperCase() ===
          familyId
        );
      }
    )
    .map(
      function (row) {
        const record = {};

        headers.forEach(
          function (header, index) {
            record[header] =
              row[index];
          }
        );

        return record;
      }
    );
}


/**
 * ============================================================
 * RESPONSE MAPPERS
 * ============================================================
 */
function KGMIS_MyFamily_CreateReadinessResponse_(
  row
) {

  return {
    personId:
      row.PERSON_ID || '',

    familyId:
      row.FAMILY_ID || '',

    fullName:
      row.FULL_NAME || '',

    familyRelation:
      row.FAMILY_RELATION || '',

    relationSequence:
      row.RELATION_SEQUENCE || '',

    cardEligible:
      KGMIS_MyFamily_IsYes_(
        row.CARD_ELIGIBLE
      ),

    mobile:
      row.MOBILE || '',

    email:
      row.EMAIL || '',

    eligibilityStatus:
      row.ELIGIBILITY_STATUS || '',

    recordStatus:
      row.RECORD_STATUS || ''
  };
}


function KGMIS_MyFamily_CreateCardResponse_(
  row
) {

  return {
    cardId:
      row.CARD_ID || '',

    familyId:
      row.FAMILY_ID || '',

    kefgId:
      row.KEFG_ID || '',

    cardholderType:
      row.CARDHOLDER_TYPE || '',

    relationSequence:
      row.RELATION_SEQUENCE || '',

    cardholderName:
      row.CARDHOLDER_NAME || '',

    membershipType:
      row.MEMBERSHIP_TYPE || '',

    membershipYear:
      row.MEMBERSHIP_YEAR || '',

    membershipStatus:
      row.MEMBERSHIP_STATUS || '',

    issueDate:
      row.ISSUE_DATE || '',

    validUntil:
      row.VALID_UNTIL || '',

    cardStatus:
      row.CARD_STATUS || '',

    cardPdfUrl:
      row.CARD_PDF_FILE_URL || '',

    cardImageUrl:
      row.CARD_IMAGE_FILE_URL || ''
  };
}


/**
 * ============================================================
 * UTILITIES
 * ============================================================
 */
function KGMIS_MyFamily_IsYes_(
  value
) {

  return [
    'YES',
    'Y',
    'TRUE',
    '1',
    'ELIGIBLE'
  ].indexOf(
    KGMIS_MyFamily_Clean_(
      value
    )
      .toUpperCase()
  ) !== -1;
}


function KGMIS_MyFamily_Clean_(
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


/**
 * ============================================================
 * SAFE TEST
 * ============================================================
 */
function KGMIS_TestMyFamilySheets() {

  const result = {
    success:
      true,

    sheets:
      {}
  };

  [
    {
      name:
        KGMIS_MY_FAMILY_CONFIG
          .FAMILY_MEMBERS_SHEET,

      headers:
        KGMIS_MY_FAMILY_CONFIG
          .FAMILY_MEMBER_HEADERS
    },
    {
      name:
        KGMIS_MY_FAMILY_CONFIG
          .MEMBER_CARDS_SHEET,

      headers:
        KGMIS_MY_FAMILY_CONFIG
          .MEMBER_CARD_HEADERS
    }
  ].forEach(
    function (definition) {

      try {
        const rows =
          KGMIS_MyFamily_ReadRowsByFamily_(
            definition.name,
            definition.headers,
            '__TEST_FAMILY__'
          );

        result.sheets[
          definition.name
        ] = {
          found:
            true,

          matchingRows:
            rows.length
        };

      } catch (error) {
        result.success =
          false;

        result.sheets[
          definition.name
        ] = {
          found:
            false,

          error:
            String(
              error && error.message
                ? error.message
                : error
            )
        };
      }
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
