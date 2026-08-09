/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Module        : Add New Member
 * File Name     : 38.10_KGMIS_Add_New_Member.gs
 * Version       : Enterprise Edition 1.0
 * Status        : Development
 * Designed & Developed by: James Joseph Alenchery
 * ============================================================
 *
 * DESCRIPTION
 * -----------
 * This file contains the backend workflow functions for the
 * "Add New Member" Administration Portal.
 *
 * The portal is used to create a new KEF Global family by
 * registering the Primary Member and Spouse in the
 * KGMIS Master Database.
 *
 * The complete registration process will:
 *
 * 1. Generate the next available:
 *      • FAMILY_ID
 *      • Primary Member KEFG_ID
 *      • Spouse KEFG_ID
 *
 * 2. Validate and normalise the submitted registration data.
 *
 * 3. Create consecutive records in the
 *    KGMIS_MASTER_DATABASE_v1.0 sheet:
 *      • Primary Member
 *      • Spouse, when included
 *
 * 4. Link both records using RELATED_MEMBER_KEFG_ID.
 *
 * 5. Automatically assign:
 *      • MEMBER_CATEGORY
 *      • RECORD_STATUS
 *      • PROFILE_LAST_UPDATED
 *
 * IMPORTANT
 * ---------
 * Preview IDs are provisional.
 *
 * Final IDs are recalculated while holding a Script Lock
 * immediately before writing to the database.
 * ============================================================
 */


/**
 * Returns the next proposed IDs for the
 * Add New Member Administration Portal.
 *
 * No database values are changed by this function.
 *
 * @return {Object}
 */
function KGMIS_AddNewMember_PreviewIds() {

  const ids =
    KGMIS_DB_GetNextFamilyRegistrationIds();

  if (
    !ids ||
    !ids.familyId ||
    !ids.primaryMemberKefgId ||
    !ids.spouseKefgId
  ) {
    throw new Error(
      'The proposed Family ID and KEFG IDs could not be generated.'
    );
  }

  return {
    success: true,
    previewOnly: true,

    familyId:
      ids.familyId,

    primaryMemberKefgId:
      ids.primaryMemberKefgId,

    spouseKefgId:
      ids.spouseKefgId,

    message:
      'The proposed Family ID and KEFG IDs were generated successfully.'
  };

}


/**
 * Validates and normalises the registration information
 * received from the Add New Member Administration Portal.
 *
 * This function does not write anything to the database.
 *
 * @param {Object} registrationData
 * @return {Object}
 */
function KGMIS_AddNewMember_ValidateRegistration(
  registrationData
) {

  const data =
    registrationData &&
    typeof registrationData === 'object'
      ? registrationData
      : {};

  const includeSpouse =
    data.includeSpouse !== false;

  const primaryMember =
    KGMIS_AddNewMember_NormalisePerson_(
      data.primaryMember
    );

  const spouse =
    includeSpouse
      ? KGMIS_AddNewMember_NormalisePerson_(
          data.spouse
        )
      : null;

  KGMIS_AddNewMember_ValidatePerson_(
    primaryMember,
    'Primary Member',
    false
  );

  if (includeSpouse) {
    KGMIS_AddNewMember_ValidatePerson_(
      spouse,
      'Spouse',
      true
    );
  }

  return {
    success: true,

    message:
      'The new-family registration information is valid.',

    data: {
      includeSpouse:
        includeSpouse,

      primaryMember:
        primaryMember,

      spouse:
        spouse,

      remarks:
        KGMIS_AddNewMember_Clean_(
          data.remarks
        )
    }
  };

}


/**
 * Validates one Primary Member or Spouse record.
 *
 * @param {Object} person
 * @param {string} label
 * @param {boolean} allowNotApplicableAlumni
 */
function KGMIS_AddNewMember_ValidatePerson_(
  person,
  label,
  allowNotApplicableAlumni
) {

  if (!person.fullName) {
    throw new Error(
      label + ': Full Name is required.'
    );
  }

  if (!person.alumniAssociation) {
    throw new Error(
      label +
      ': Alumni Association is required.'
    );
  }

  const allowedAssociations = [
    'AECK',
    'CETA',
    'KEA',
    'MACE',
    'NIT',
    'NSS',
    'TEC',
    'TKMCE'
  ];

  if (allowNotApplicableAlumni) {
    allowedAssociations.push(
      'NOT APPLICABLE'
    );
  }

  if (
    allowedAssociations.indexOf(
      person.alumniAssociation
    ) === -1
  ) {
    throw new Error(
      label +
      ': Invalid Alumni Association.'
    );
  }

  if (!person.mobile) {
    throw new Error(
      label +
      ': Mobile Number is required.'
    );
  }

  if (
    !KGMIS_AddNewMember_IsValidPhone_(
      person.mobile
    )
  ) {
    throw new Error(
      label +
      ': Enter a valid Mobile Number.'
    );
  }

  if (!person.whatsapp) {
    throw new Error(
      label +
      ': WhatsApp Number is required.'
    );
  }

  if (
    !KGMIS_AddNewMember_IsValidPhone_(
      person.whatsapp
    )
  ) {
    throw new Error(
      label +
      ': Enter a valid WhatsApp Number.'
    );
  }

  if (
    person.email &&
    !KGMIS_AddNewMember_IsValidEmail_(
      person.email
    )
  ) {
    throw new Error(
      label +
      ': Enter a valid Email Address.'
    );
  }

  const allowedMembershipTypes = [
    'PRIMARY MEMBERSHIP',
    'LIFETIME MEMBERSHIP',
    'HONORARY MEMBERSHIP',
    'TEMPORARY MEMBERSHIP'
  ];

  if (!person.membershipType) {
    throw new Error(
      label +
      ': Membership Category is required.'
    );
  }

  if (
    allowedMembershipTypes.indexOf(
      person.membershipType
    ) === -1
  ) {
    throw new Error(
      label +
      ': Invalid Membership Category.'
    );
  }

}


/**
 * Normalises one person's registration information.
 *
 * @param {Object} personData
 * @return {Object}
 */
function KGMIS_AddNewMember_NormalisePerson_(
  personData
) {

  const person =
    personData &&
    typeof personData === 'object'
      ? personData
      : {};

  return {
    fullName:
      KGMIS_AddNewMember_Clean_(
        person.fullName
      ),

    alumniAssociation:
      KGMIS_AddNewMember_Clean_(
        person.alumniAssociation
      ).toUpperCase(),

    branch:
      KGMIS_AddNewMember_Clean_(
        person.branch
      ),

    mobile:
      KGMIS_AddNewMember_NormalisePhone_(
        person.mobile
      ),

    whatsapp:
      KGMIS_AddNewMember_NormalisePhone_(
        person.whatsapp
      ),

    email:
      KGMIS_AddNewMember_Clean_(
        person.email
      ).toLowerCase(),

    membershipType:
      KGMIS_AddNewMember_Clean_(
        person.membershipType
      ).toUpperCase()
  };

}


/**
 * Removes surrounding and repeated spaces.
 *
 * @param {*} value
 * @return {string}
 */
function KGMIS_AddNewMember_Clean_(
  value
) {

  return String(
    value === null ||
    value === undefined
      ? ''
      : value
  )
    .trim()
    .replace(/\s+/g, ' ');

}


/**
 * Normalises a telephone number while retaining
 * an optional leading plus sign.
 *
 * @param {*} value
 * @return {string}
 */
function KGMIS_AddNewMember_NormalisePhone_(
  value
) {

  const cleaned =
    KGMIS_AddNewMember_Clean_(
      value
    );

  if (!cleaned) {
    return '';
  }

  const hasPlus =
    cleaned.charAt(0) === '+';

  const digits =
    cleaned.replace(/\D/g, '');

  return hasPlus
    ? '+' + digits
    : digits;

}


/**
 * Validates a Mobile or WhatsApp number.
 *
 * Accepts 8 to 15 digits, with an optional leading plus sign.
 *
 * @param {*} value
 * @return {boolean}
 */
function KGMIS_AddNewMember_IsValidPhone_(
  value
) {

  return /^\+?\d{8,15}$/.test(
    String(value || '')
  );

}


/**
 * Validates an optional email address.
 *
 * @param {*} value
 * @return {boolean}
 */
function KGMIS_AddNewMember_IsValidEmail_(
  value
) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || '')
  );

}


/**
 * Creates a new KGMIS family from the
 * Add New Member Administration Portal.
 *
 * @param {Object} registrationData
 * @return {Object}
 */
function KGMIS_AddNewMember_CreateFamily(
  registrationData
) {

  /*
   * Always validate on the server.
   *
   * Never pass the original browser payload directly
   * to the database-writing function.
   */
  const validation =
    KGMIS_AddNewMember_ValidateRegistration(
      registrationData
    );

  if (
    !validation ||
    validation.success !== true ||
    !validation.data
  ) {
    throw new Error(
      validation && validation.message
        ? validation.message
        : 'The new-family registration information is invalid.'
    );
  }

  /*
   * The Database Service handles:
   *
   * - Script locking
   * - Duplicate checking
   * - Final ID generation
   * - Row allocation
   * - Primary Member creation
   * - Spouse creation
   * - Reciprocal relationship links
   * - Database writing
   */
  const creationResult =
    KGMIS_DB_CreateFamily(
      validation.data
    );

  if (
    !creationResult ||
    creationResult.success !== true
  ) {
    throw new Error(
      creationResult &&
      creationResult.message
        ? creationResult.message
        : 'The new family could not be created.'
    );
  }

  /*
   * ----------------------------------------------------------
   * Synchronise the new member(s) into KGMIS_LOGIN.
   *
   * The Login Service reads the final saved Master Database
   * record by KEFG_ID and creates/updates the login account.
   *
   * Existing password data is never overwritten.
   * ----------------------------------------------------------
   */
  const loginSyncResults = [];

  try {

    loginSyncResults.push(
      KGMIS_Login_SyncMemberAccount(
        creationResult.primaryMemberKefgId
      )
    );

    if (
      creationResult.includeSpouse === true &&
      creationResult.spouseKefgId
    ) {
      loginSyncResults.push(
        KGMIS_Login_SyncMemberAccount(
          creationResult.spouseKefgId
        )
      );
    }

  } catch (loginSyncError) {

    return {
      success: true,

      familyId:
        creationResult.familyId,

      primaryMemberKefgId:
        creationResult.primaryMemberKefgId,

      spouseKefgId:
        creationResult.spouseKefgId || '',

      primaryMemberRow:
        creationResult.primaryMemberRow,

      spouseRow:
        creationResult.spouseRow || 0,

      includeSpouse:
        creationResult.includeSpouse === true,

      loginSyncSuccess:
        false,

      loginSyncError:
        loginSyncError &&
        loginSyncError.message
          ? loginSyncError.message
          : String(loginSyncError || ''),

      message:
        'The new family was created successfully, but the login account could not be synchronised. ' +
        'Please contact the KGMIS administrator before asking the member to sign in.'
    };
  }

  return {
    success: true,

    familyId:
      creationResult.familyId,

    primaryMemberKefgId:
      creationResult.primaryMemberKefgId,

    spouseKefgId:
      creationResult.spouseKefgId || '',

    primaryMemberRow:
      creationResult.primaryMemberRow,

    spouseRow:
      creationResult.spouseRow || 0,

    includeSpouse:
      creationResult.includeSpouse === true,

    loginSyncSuccess:
      true,

    loginAccountsSynced:
      loginSyncResults.length,

    message:
      creationResult.message ||
      'The new family was created successfully.'
  };

}
