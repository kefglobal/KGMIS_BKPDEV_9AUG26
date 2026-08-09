/******************************************************************************
 *
 * KEFG Membership Information System (KGMIS)
 *
 * Module        : Self-Service Portal
 * File          : 50.01_KGMIS_Self_Service.gs
 * Version       : 1.0
 * Status        : Development
 *
 * Designed and Developed by:
 * James Joseph Alenchery
 *
 * Purpose:
 * - Validate the logged-in member session
 * - Identify the member's FAMILY_ID
 * - Load master-database records
 * - Load KEFG_FAMILY_MEMBERS records
 * - Build the Self-Service Portal data model
 * - Save draft update requests
 * - Submit completed update requests for verification
 *
 ******************************************************************************/

/**
 * ============================================================
 * SELF-SERVICE CONFIGURATION
 * ============================================================
 */
const KGMIS_SS_CONFIG = Object.freeze({

  MODULE_NAME:
    'DIRECTORY',

  MODULE_ACTION:
    'VIEW',

  MASTER_SHEET:
    'KGMIS_MASTER_DATABASE_v1.0',

  FAMILY_MEMBERS_SHEET:
    'KEFG_FAMILY_MEMBERS',

  DRAFT_SHEET:
    'KGMIS_SELF_SERVICE_DRAFTS',

  REQUEST_SHEET:
    'KGMIS_SELF_SERVICE_REQUESTS',

  AUDIT_SHEET:
    'KGMIS_SELF_SERVICE_AUDIT',

  REQUEST_PREFIX:
    'SSR',

  DRAFT_PREFIX:
    'SSD',

  REQUEST_STATUS: Object.freeze({

    DRAFT:
      'DRAFT',

    PENDING_VERIFICATION:
      'PENDING_VERIFICATION',

    APPROVED:
      'APPROVED',

    REJECTED:
      'REJECTED',

    CANCELLED:
      'CANCELLED'

  }),

  RECORD_STATUS: Object.freeze({

    ACTIVE:
      'ACTIVE',

    INACTIVE:
      'INACTIVE',

    DECEASED:
      'DECEASED',

    ARCHIVED:
      'ARCHIVED'

  }),

  RELATIONSHIP_STATUS: Object.freeze({

    MARRIED:
      'MARRIED',

    UNMARRIED:
      'UNMARRIED',

    DIVORCED:
      'DIVORCED',

    WIDOWED:
      'WIDOWED'

  }),

  PRIMARY_MEMBER_CATEGORIES: Object.freeze([

    'PRIMARY MEMBER',
    'PRIMARY_MEMBER',
    'MEMBER',
    'SELF'

  ]),

  SPOUSE_CATEGORIES: Object.freeze([

    'SPOUSE',
    'HUSBAND',
    'WIFE',
    'ALUMNI SPOUSE',
    'ALUMNI SPOUSE MEMBER',
    'NON-ALUMNI SPOUSE',
    'NON-ALUMNI SPOUSE MEMBER',
    'NON ALUMNI SPOUSE',
    'NON ALUMNI SPOUSE MEMBER'

  ]),

  PRIMARY_MEMBER_ALUMNI_ASSOCIATIONS:
    Object.freeze([

      'AECK',
      'CET',
      'KEA',
      'MACE',
      'NIT',
      'NSSCE',
      'TEC',
      'TKMCE'

    ]),

  SPOUSE_ALUMNI_ASSOCIATIONS:
    Object.freeze([

      'AECK',
      'CET',
      'KEA',
      'MACE',
      'NIT',
      'NSSCE',
      'TEC',
      'TKMCE',
      'NOT APPLICABLE'

    ]),

  RELATION_SEQUENCE: Object.freeze({

    PRIMARY_MEMBER:
      1,

    SPOUSE:
      2,

    FAMILY_MEMBER_START:
      3

  }),

  DATE_FORMATS: Object.freeze({

    DISPLAY_DATE:
      'dd-MMM-yyyy',

    DISPLAY_DATETIME:
      'dd-MMM-yyyy HH:mm',

    SHEET_DATETIME:
      'dd-MMM-yyyy HH:mm:ss'

  })

});


/**
 * ============================================================
 * DRAFT SHEET HEADERS
 * ============================================================
 */
const KGMIS_SS_DRAFT_HEADERS = Object.freeze([

  'DRAFT_ID',
  'FAMILY_ID',
  'SESSION_EMAIL',
  'DRAFT_DATA_JSON',
  'CURRENT_STEP',
  'COMPLETED_SECTIONS_JSON',
  'CREATED_ON',
  'UPDATED_ON',
  'STATUS'

]);


/**
 * ============================================================
 * SUBMISSION REQUEST HEADERS
 * ============================================================
 */
const KGMIS_SS_REQUEST_HEADERS = Object.freeze([

  'REQUEST_ID',
  'FAMILY_ID',
  'SUBMITTED_BY',
  'SUBMITTED_ON',
  'REQUEST_TYPE',
  'MASTER_CHANGES_JSON',
  'FAMILY_MEMBER_CHANGES_JSON',
  'PHOTO_CHANGE_JSON',
  'RELATIONSHIP_CHANGE_REQUIRED',
  'DECLARATION_ACCEPTED',
  'STATUS',
  'REVIEWED_BY',
  'REVIEWED_ON',
  'REVIEW_REMARKS'

]);


/**
 * ============================================================
 * AUDIT HEADERS
 * ============================================================
 */
const KGMIS_SS_AUDIT_HEADERS = Object.freeze([

  'AUDIT_ID',
  'EVENT_TYPE',
  'FAMILY_ID',
  'REQUEST_ID',
  'USER_EMAIL',
  'EVENT_DATE',
  'DETAILS_JSON'

]);


/**
 * ============================================================
 * PUBLIC SERVICE
 * GET COMPLETE INITIAL PORTAL DATA
 * ============================================================
 *
 * This is the main service called when the Self-Service Portal
 * opens.
 *
 * The master database is read once for the identified family.
 * Family-member records are also loaded once.
 */
function KGMIS_SS_GetInitialData(
  sessionToken
) {

  const session =
    KGMIS_SS_RequireSession_(
      sessionToken
    );

  /*
   * The existing My Family service already performs the
   * authorised login-email-to-family lookup.
   */
  const myFamilyData =
    KGMIS_MyFamily_GetInitialData(
      sessionToken
    );

  const familyId =
    KGMIS_SS_CleanText_(
      myFamilyData &&
      myFamilyData.profile &&
      myFamilyData.profile.familyId
    )
      .toUpperCase();

  if (!familyId) {

    throw new Error(
      'No FAMILY_ID is linked to your KGMIS login.'
    );

  }

  const masterRecords =
    KGMIS_SS_LoadMasterFamilyRecords_(
      familyId
    );

  if (!masterRecords.length) {

    throw new Error(
      'No master-database records were found for ' +
      familyId +
      '.'
    );

  }

  const familyMemberRecords =
    KGMIS_SS_LoadFamilyMemberRecords_(
      familyId
    );

  const primaryMember =
    KGMIS_SS_FindPrimaryMember_(
      masterRecords
    );

  if (!primaryMember) {

    throw new Error(
      'The Primary Member record could not be identified for ' +
      familyId +
      '.'
    );

  }

  const spouse =
    KGMIS_SS_FindSpouse_(
      masterRecords
    );

  const overview =
    KGMIS_SS_BuildOverview_({

      familyId:
        familyId,

      session:
        session,

      primaryMember:
        primaryMember,

      spouse:
        spouse,

      masterRecords:
        masterRecords,

      familyMemberRecords:
        familyMemberRecords,

      myFamilyData:
        myFamilyData

    });

  const primaryMemberData =
    KGMIS_SS_BuildPrimaryMember_(
      primaryMember
    );

  const spouseData =
    KGMIS_SS_BuildSpouse_(
      spouse,
      primaryMember
    );

  const familyMembers =
    KGMIS_SS_BuildFamilyMembers_(
      familyMemberRecords
    );

  const communication =
    KGMIS_SS_BuildCommunication_(
      primaryMember,
      spouse
    );

  const photo =
    KGMIS_SS_BuildFamilyPhoto_(
      primaryMember,
      spouse
    );

  const existingDraft =
    KGMIS_SS_GetExistingDraft_(
      familyId,
      session.email
    );

  return {

    success:
      true,

    message:
      'KGMIS Self-Service Portal data loaded successfully.',

    data: {

      familyId:
        familyId,

      user: {

        email:
          KGMIS_SS_CleanText_(
            session.email
          ),

        userName:
          KGMIS_SS_CleanText_(
            session.userName
          ),

        role:
          KGMIS_SS_CleanText_(
            session.role
          )

      },

      overview:
        overview,

      primaryMember:
        primaryMemberData,

      spouse:
        spouseData,

      familyMembers:
        familyMembers,

      familyPhoto:
        photo,

      communication:
        communication,

      draft:
        existingDraft,

      options:
        KGMIS_SS_GetPortalOptions_(),

      permissions: {

        canEditProfile:
          true,

        canSubmit:
          true,

        canEditProtectedIdentifiers:
          false,

        relationshipChangesRequireSeparateProcess:
          true,

        photoChangesRequireAdminApproval:
          true

      }

    }

  };

}


/**
 * ============================================================
 * PUBLIC SERVICE
 * GET OVERVIEW
 * ============================================================
 */
function KGMIS_SS_GetOverview(
  sessionToken
) {

  const initialData =
    KGMIS_SS_GetInitialData(
      sessionToken
    );

  return {

    success:
      true,

    message:
      'Family overview loaded successfully.',

    data:
      initialData.data.overview

  };

}


/**
 * ============================================================
 * PUBLIC SERVICE
 * GET PRIMARY MEMBER
 * ============================================================
 */
function KGMIS_SS_GetPrimaryMember(
  sessionToken
) {

  const initialData =
    KGMIS_SS_GetInitialData(
      sessionToken
    );

  return {

    success:
      true,

    message:
      'Primary Member information loaded successfully.',

    data:
      initialData.data.primaryMember

  };

}


/**
 * ============================================================
 * PUBLIC SERVICE
 * GET SPOUSE
 * ============================================================
 */
function KGMIS_SS_GetSpouse(
  sessionToken
) {

  const initialData =
    KGMIS_SS_GetInitialData(
      sessionToken
    );

  return {

    success:
      true,

    message:
      'Spouse information loaded successfully.',

    data:
      initialData.data.spouse

  };

}


/**
 * ============================================================
 * PUBLIC SERVICE
 * GET FAMILY MEMBERS
 * ============================================================
 */
function KGMIS_SS_GetFamilyMembers(
  sessionToken
) {

  const initialData =
    KGMIS_SS_GetInitialData(
      sessionToken
    );

  return {

    success:
      true,

    message:
      'Family-member information loaded successfully.',

    data:
      initialData.data.familyMembers

  };

}


/**
 * ============================================================
 * PUBLIC SERVICE
 * GET PORTAL OPTIONS
 * ============================================================
 */
function KGMIS_SS_GetPortalOptions() {

  return {

    success:
      true,

    message:
      'Self-Service Portal options loaded successfully.',

    data:
      KGMIS_SS_GetPortalOptions_()

  };

}


/**
 * ============================================================
 * INTERNAL
 * STANDARD PORTAL OPTIONS
 * ============================================================
 */
function KGMIS_SS_GetPortalOptions_() {

  return {

    genderOptions: [

      'MALE',
      'FEMALE',
      'PREFER NOT TO SAY'

    ],

    bloodGroupOptions: [

      'A+',
      'A-',
      'B+',
      'B-',
      'AB+',
      'AB-',
      'O+',
      'O-',
      'NOT KNOWN'

    ],

    primaryMemberAlumniAssociations:
      Array.from(
        KGMIS_SS_CONFIG
          .PRIMARY_MEMBER_ALUMNI_ASSOCIATIONS
      ),

    spouseAlumniAssociations:
      Array.from(
        KGMIS_SS_CONFIG
          .SPOUSE_ALUMNI_ASSOCIATIONS
      ),

    volunteerOptions: [

      'YES',
      'NO',
      'MAYBE',
      'PLEASE CONTACT ME'

    ],

    yesNoOptions: [

      'YES',
      'NO'

    ],

    consentOptions: [

      'AGREE',
      'NOT AGREE'

    ],

    preferredContactOptions: [

      'PRIMARY MEMBER',
      'SPOUSE',
      'EITHER',
      'BOTH'

    ],

    relationshipUpdateOptions: [

      'NO',
      'YES'

    ],

    recordStatuses:
      Object.values(
        KGMIS_SS_CONFIG.RECORD_STATUS
      ),

    relationshipStatuses:
      Object.values(
        KGMIS_SS_CONFIG
          .RELATIONSHIP_STATUS
      )

  };

}

