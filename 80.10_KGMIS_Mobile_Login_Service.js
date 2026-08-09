/*
 * ============================================================
 * KGMIS Authentication Service
 * File: 80.10_KGMIS_Mobile_Login_Service.gs
 * Designed and Developed by James Joseph Alenchery
 * Phase 1:
 * Create Login Registry
 * ============================================================
 */

/*
 * ============================================================
 * PASSWORD SECURITY SETTINGS
 * ============================================================
 */

const KGMIS_LOGIN_PASSWORD_ITERATIONS =
  3000;

const KGMIS_LOGIN_PASSWORD_MIN_LENGTH =
  10;

const KGMIS_LOGIN_PASSWORD_PEPPER_PROPERTY =
  'KGMIS_LOGIN_PASSWORD_PEPPER';

const KGMIS_LOGIN_MAX_FAILED_ATTEMPTS = 5;

const KGMIS_LOGIN_LOCKOUT_MINUTES = 30;

/*
 * ============================================================
 * ONE-TIME SECURITY SETUP
 *
 * Run this function only once.
 * It creates a secret password pepper in Script Properties.
 * ============================================================
 */
function KGMIS_Login_CreatePasswordPepper() {

  const properties =
    PropertiesService
      .getScriptProperties();

  const existingPepper =
    String(
      properties.getProperty(
        KGMIS_LOGIN_PASSWORD_PEPPER_PROPERTY
      ) || ''
    ).trim();

  if (existingPepper) {

    console.log(
      'The KGMIS password pepper already exists.'
    );

    return {
      success: true,
      created: false,
      message:
        'Password pepper already exists.'
    };
  }

  const pepper =
    Utilities
      .getUuid()
      .replace(/-/g, '') +
    Utilities
      .getUuid()
      .replace(/-/g, '');

  properties.setProperty(
    KGMIS_LOGIN_PASSWORD_PEPPER_PROPERTY,
    pepper
  );

  console.log(
    'KGMIS password pepper created successfully.'
  );

  return {
    success: true,
    created: true,
    message:
      'Password pepper created successfully.'
  };
}


/*
 * ============================================================
 * ADMINISTRATOR: SET OR RESET MEMBER PASSWORD
 *
 * Example:
 *
 * KGMIS_Admin_SetPassword(
 *   'KEFG1177',
 *   'Temporary#4827'
 * );
 * ============================================================
 */
function KGMIS_Admin_SetPassword(
  kefgId,
  newPassword
) {

  const safeKefgId =
    String(kefgId || '')
      .trim()
      .toUpperCase();

  const safePassword =
    String(newPassword || '');

  if (!safeKefgId) {
    throw new Error(
      'KEFG_ID is required.'
    );
  }

  KGMIS_Login_ValidatePassword_(
    safePassword
  );

  const loginSheet =
    KGMIS_Login_GetSheet_(
      'KGMIS_LOGIN'
    );

  const lastRow =
    loginSheet.getLastRow();

  const lastColumn =
    loginSheet.getLastColumn();

  if (lastRow < 2) {
    throw new Error(
      'KGMIS_LOGIN does not contain login accounts.'
    );
  }

  const values =
    loginSheet
      .getRange(
        1,
        1,
        lastRow,
        lastColumn
      )
      .getValues();

  const headers =
    values[0].map(
      function (header) {
        return String(header || '')
          .trim()
          .toUpperCase();
      }
    );

  const headerMap = {};

  headers.forEach(
    function (header, index) {
      if (header) {
        headerMap[header] =
          index;
      }
    }
  );

  const requiredHeaders = [
    'KEFG_ID',
    'PASSWORD_HASH',
    'PASSWORD_SALT',
    'PASSWORD_STATUS',
    'FAILED_ATTEMPTS',
    'LOCKED_UNTIL',
    'PASSWORD_CHANGED_ON',
    'UPDATED_ON',
    'STATUS'
  ];

  requiredHeaders.forEach(
    function (header) {

      if (
        !Object.prototype
          .hasOwnProperty.call(
            headerMap,
            header
          )
      ) {
        throw new Error(
          'Missing KGMIS_LOGIN header: ' +
          header
        );
      }
    }
  );

  let matchingRowNumber = 0;

  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const rowKefgId =
      String(
        values[rowIndex][
          headerMap.KEFG_ID
        ] || ''
      )
        .trim()
        .toUpperCase();

    if (rowKefgId === safeKefgId) {
      matchingRowNumber =
        rowIndex + 1;

      break;
    }
  }

  if (!matchingRowNumber) {
    throw new Error(
      'No login account was found for ' +
      safeKefgId +
      '.'
    );
  }

  const accountStatus =
    String(
      loginSheet
        .getRange(
          matchingRowNumber,
          headerMap.STATUS + 1
        )
        .getDisplayValue() || ''
    )
      .trim()
      .toUpperCase();

  if (accountStatus !== 'ACTIVE') {
    throw new Error(
      'The login account is not active.'
    );
  }

  const salt =
    KGMIS_Login_CreateSalt_();

  const passwordHash =
    KGMIS_Login_HashPassword_(
      safePassword,
      salt
    );

  const now =
    new Date();

  loginSheet
    .getRange(
      matchingRowNumber,
      headerMap.PASSWORD_HASH + 1
    )
    .setValue(
      passwordHash
    );

  loginSheet
    .getRange(
      matchingRowNumber,
      headerMap.PASSWORD_SALT + 1
    )
    .setValue(
      salt
    );

  loginSheet
    .getRange(
      matchingRowNumber,
      headerMap.PASSWORD_STATUS + 1
    )
    .setValue(
      'ACTIVE'
    );

  loginSheet
    .getRange(
      matchingRowNumber,
      headerMap.FAILED_ATTEMPTS + 1
    )
    .setValue(
      0
    );

  loginSheet
    .getRange(
      matchingRowNumber,
      headerMap.LOCKED_UNTIL + 1
    )
    .clearContent();

  loginSheet
    .getRange(
      matchingRowNumber,
      headerMap.PASSWORD_CHANGED_ON + 1
    )
    .setValue(
      now
    );

  loginSheet
    .getRange(
      matchingRowNumber,
      headerMap.UPDATED_ON + 1
    )
    .setValue(
      now
    );

  loginSheet
    .getRange(
      matchingRowNumber,
      headerMap.PASSWORD_CHANGED_ON + 1,
      1,
      1
    )
    .setNumberFormat(
      'dd-mmm-yyyy hh:mm'
    );

  loginSheet
    .getRange(
      matchingRowNumber,
      headerMap.UPDATED_ON + 1,
      1,
      1
    )
    .setNumberFormat(
      'dd-mmm-yyyy hh:mm'
    );

  SpreadsheetApp.flush();

  console.log(
    'Password set successfully for ' +
    safeKefgId
  );

  return {
    success: true,
    kefgId:
      safeKefgId,
    passwordStatus:
      'ACTIVE',
    message:
      'Password set successfully.'
  };
}

/*
 * ============================================================
 * VALIDATE PASSWORD POLICY
 * ============================================================
 */
function KGMIS_Login_ValidatePassword_(
  password
) {

  const value =
    String(password || '');

  if (
    value.length <
    KGMIS_LOGIN_PASSWORD_MIN_LENGTH
  ) {
    throw new Error(
      'Password must contain at least ' +
      String(
        KGMIS_LOGIN_PASSWORD_MIN_LENGTH
      ) +
      ' characters.'
    );
  }

  if (!/[A-Z]/.test(value)) {
    throw new Error(
      'Password must contain at least one uppercase letter.'
    );
  }

  if (!/[a-z]/.test(value)) {
    throw new Error(
      'Password must contain at least one lowercase letter.'
    );
  }

  if (!/[0-9]/.test(value)) {
    throw new Error(
      'Password must contain at least one number.'
    );
  }

  if (
    !/[^A-Za-z0-9]/.test(value)
  ) {
    throw new Error(
      'Password must contain at least one special character.'
    );
  }

  if (value.length > 100) {
    throw new Error(
      'Password is too long.'
    );
  }

  return true;
}


/*
 * ============================================================
 * GENERATE UNIQUE RANDOM SALT
 * ============================================================
 */
function KGMIS_Login_CreateSalt_() {

  return (
    Utilities
      .getUuid()
      .replace(/-/g, '') +
    Utilities
      .getUuid()
      .replace(/-/g, '')
  );
}


/*
 * ============================================================
 * DERIVE PASSWORD HASH
 *
 * The password is never written to the spreadsheet or logs.
 * ============================================================
 */
function KGMIS_Login_HashPassword_(
  password,
  salt
) {

  const pepper =
    String(
      PropertiesService
        .getScriptProperties()
        .getProperty(
          KGMIS_LOGIN_PASSWORD_PEPPER_PROPERTY
        ) || ''
    );

  if (!pepper) {
    throw new Error(
      'Password security has not been initialised. ' +
      'Run KGMIS_Login_CreatePasswordPepper first.'
    );
  }

  let derivedValue =
    String(password || '') +
    '|' +
    String(salt || '');

  const key =
    pepper +
    '|' +
    String(salt || '');

  for (
    let iteration = 0;
    iteration <
      KGMIS_LOGIN_PASSWORD_ITERATIONS;
    iteration++
  ) {

    const signature =
      Utilities
        .computeHmacSha256Signature(
          derivedValue,
          key,
          Utilities.Charset.UTF_8
        );

    derivedValue =
      Utilities.base64Encode(
        signature
      );
  }

  return derivedValue;
}


/*
 * ============================================================
 * VERIFY PASSWORD
 *
 * Recreates the password hash using the stored salt,
 * then compares it with the stored hash.
 * ============================================================
 */
function KGMIS_Login_VerifyPassword_(
  password,
  storedSalt,
  storedHash
) {

  const safePassword =
    String(password || '');

  const safeSalt =
    String(storedSalt || '').trim();

  const safeStoredHash =
    String(storedHash || '').trim();

  if (
    !safePassword ||
    !safeSalt ||
    !safeStoredHash
  ) {
    return false;
  }

  const calculatedHash =
    KGMIS_Login_HashPassword_(
      safePassword,
      safeSalt
    );

  return KGMIS_Login_ConstantTimeEquals_(
    calculatedHash,
    safeStoredHash
  );
}


/*
 * ============================================================
 * CONSTANT-TIME STRING COMPARISON
 *
 * Avoids returning immediately when the first different
 * character is found.
 * ============================================================
 */
function KGMIS_Login_ConstantTimeEquals_(
  firstValue,
  secondValue
) {

  const first =
    String(firstValue || '');

  const second =
    String(secondValue || '');

  let difference =
    first.length ^
    second.length;

  const maximumLength =
    Math.max(
      first.length,
      second.length
    );

  for (
    let index = 0;
    index < maximumLength;
    index++
  ) {

    const firstCode =
      index < first.length
        ? first.charCodeAt(index)
        : 0;

    const secondCode =
      index < second.length
        ? second.charCodeAt(index)
        : 0;

    difference |=
      firstCode ^
      secondCode;
  }

  return difference === 0;
}


/*
 * ============================================================
 * FIND LOGIN MEMBER BY REGISTERED MOBILE NUMBER
 *
 * Possible statuses:
 *
 * NO_MATCH
 * SINGLE_MATCH
 * MULTIPLE_FAMILY_MATCH
 * DATA_ERROR
 * INVALID_MOBILE
 * ============================================================
 */
function KGMIS_Login_FindMemberByMobile(
  mobileNumber
) {

  const normalizedMobile =
    KGMIS_Login_NormalizeMobile_(
      mobileNumber
    );

  /*
   * The submitted number is empty or invalid.
   */
  if (!normalizedMobile) {

    return {
      success: false,
      status: 'INVALID_MOBILE',
      message:
        'Please enter a valid registered mobile number.'
    };
  }


  const loginSheet =
    KGMIS_Login_GetSheet_(
      'KGMIS_LOGIN'
    );

  const lastRow =
    loginSheet.getLastRow();

  const lastColumn =
    loginSheet.getLastColumn();

  if (
    lastRow < 2 ||
    lastColumn < 1
  ) {

    throw new Error(
      'KGMIS_LOGIN does not contain login accounts.'
    );
  }


  /*
   * Read login registry.
   */
  const values =
  KGMIS_Login_ReadDisplayValuesWithRetry_(
    loginSheet,
    1,
    1,
    lastRow,
    lastColumn
  );


  /*
   * Build header map.
   */
  const headers =
    values[0].map(
      function (header) {

        return String(
          header || ''
        )
          .trim()
          .toUpperCase();
      }
    );

  const headerMap = {};

  headers.forEach(
    function (header, index) {

      if (header) {
        headerMap[header] =
          index;
      }
    }
  );


  /*
   * Validate required headers.
   */
  const requiredHeaders = [
    'LOGIN_ID',
    'KEFG_ID',
    'FAMILY_ID',
    'MEMBER_NAME',
    'REGISTERED_MOBILE',
    'PASSWORD_STATUS',
    'STATUS'
  ];

  requiredHeaders.forEach(
    function (header) {

      if (
        !Object.prototype
          .hasOwnProperty.call(
            headerMap,
            header
          )
      ) {

        throw new Error(
          'Missing KGMIS_LOGIN header: ' +
          header
        );
      }
    }
  );


  /*
   * Find all ACTIVE accounts matching the mobile number.
   */
  const matches = [];

  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const row =
      values[rowIndex];

    const accountStatus =
      String(
        row[
          headerMap.STATUS
        ] || ''
      )
        .trim()
        .toUpperCase();

    /*
     * Only active login accounts can be returned.
     */
    if (accountStatus !== 'ACTIVE') {
      continue;
    }


    const storedMobile =
      KGMIS_Login_NormalizeMobile_(
        row[
          headerMap.REGISTERED_MOBILE
        ]
      );

    if (
      !storedMobile ||
      storedMobile !== normalizedMobile
    ) {
      continue;
    }


    matches.push({
      loginId:
        String(
          row[
            headerMap.LOGIN_ID
          ] || ''
        ).trim(),

      kefgId:
        String(
          row[
            headerMap.KEFG_ID
          ] || ''
        )
          .trim()
          .toUpperCase(),

      familyId:
        String(
          row[
            headerMap.FAMILY_ID
          ] || ''
        )
          .trim()
          .toUpperCase(),

      memberName:
        String(
          row[
            headerMap.MEMBER_NAME
          ] || ''
        ).trim(),

      passwordStatus:
        String(
          row[
            headerMap.PASSWORD_STATUS
          ] || ''
        )
          .trim()
          .toUpperCase()
    });
  }


  /*
   * ----------------------------------------------------------
   * NO MATCH
   * ----------------------------------------------------------
   */
  if (!matches.length) {

    return {
      success: false,
      status: 'NO_MATCH',
      message:
        'Sorry, your mobile number is not registered. ' +
        'Please contact the KEF Global Data Management Team.'
    };
  }


  /*
   * ----------------------------------------------------------
   * SINGLE MATCH
   * ----------------------------------------------------------
   */
  if (matches.length === 1) {

    return {
      success: true,
      status: 'SINGLE_MATCH',
      registeredMobile:
        normalizedMobile,
      member:
        matches[0]
    };
  }


  /*
   * ----------------------------------------------------------
   * MULTIPLE MATCHES
   *
   * Confirm that every matching account belongs to the same
   * family before allowing member selection.
   * ----------------------------------------------------------
   */
  const familyIds =
    Array.from(
      new Set(
        matches.map(
          function (member) {
            return member.familyId;
          }
        )
      )
    );


  /*
   * Blank FAMILY_ID or multiple FAMILY_ID values indicate
   * a data-integrity problem.
   */
  const hasBlankFamilyId =
    familyIds.some(
      function (familyId) {
        return !familyId;
      }
    );

  if (
    hasBlankFamilyId ||
    familyIds.length !== 1
  ) {

    return {
      success: false,
      status: 'DATA_ERROR',
      registeredMobile:
        normalizedMobile,
      message:
        'This mobile number is associated with multiple ' +
        'family records. Please contact the KEF Global ' +
        'Data Management Team.'
    };
  }


  /*
   * Multiple members, but all belong to one family.
   */
  return {
    success: true,
    status: 'MULTIPLE_FAMILY_MATCH',
    registeredMobile:
      normalizedMobile,
    familyId:
      familyIds[0],
    members:
      matches
  };
}


/*
 * ============================================================
 * VALIDATE ACTIVE MOBILE SESSION MEMBER
 *
 * Revalidates the KGMIS_LOGIN account and resolves the current
 * effective role from KGMIS_ACCESS_CONTROL using REGISTERED_EMAIL.
 * ============================================================
 */

function KGMIS_Mobile_Login_GetActiveSessionUser_(
  kefgId
) {

  const safeKefgId =
    String(
      kefgId || ''
    )
      .trim()
      .toUpperCase();


  if (!safeKefgId) {
    return null;
  }


  const loginSheet =
    KGMIS_Login_GetSheet_(
      'KGMIS_LOGIN'
    );


  const lastRow =
    loginSheet.getLastRow();

  const lastColumn =
    loginSheet.getLastColumn();


  if (
    lastRow < 2 ||
    lastColumn < 1
  ) {
    return null;
  }


  const values =
    loginSheet
      .getRange(
        1,
        1,
        lastRow,
        lastColumn
      )
      .getDisplayValues();


  const headers =
    values[0].map(
      function (header) {

        return String(
          header || ''
        )
          .trim()
          .toUpperCase();

      }
    );


  const headerMap = {};


  headers.forEach(
    function (header, index) {

      if (header) {
        headerMap[header] =
          index;
      }

    }
  );


  const requiredHeaders = [
    'KEFG_ID',
    'FAMILY_ID',
    'MEMBER_NAME',
    'REGISTERED_MOBILE',
    'REGISTERED_EMAIL',
    'STATUS'
  ];


  for (
    let index = 0;
    index < requiredHeaders.length;
    index++
  ) {

    if (
      !Object.prototype
        .hasOwnProperty.call(
          headerMap,
          requiredHeaders[index]
        )
    ) {
      return null;
    }

  }


  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const row =
      values[rowIndex];


    const rowKefgId =
      String(
        row[
          headerMap.KEFG_ID
        ] || ''
      )
        .trim()
        .toUpperCase();


    if (
      rowKefgId !==
      safeKefgId
    ) {
      continue;
    }


    /*
     * KGMIS_LOGIN STATUS controls whether the member is
     * completely blocked from signing in.
     */

    const loginStatus =
      String(
        row[
          headerMap.STATUS
        ] || ''
      )
        .trim()
        .toUpperCase();


    if (
      loginStatus !==
      'ACTIVE'
    ) {
      return null;
    }


    const memberName =
      String(
        row[
          headerMap.MEMBER_NAME
        ] || ''
      ).trim();


    const registeredEmail =
      KGMIS_OTP_NormalizeEmail_(
        row[
          headerMap.REGISTERED_EMAIL
        ]
      );


    /*
     * ACTIVE privileged access-control entry:
     * use the stored role.
     *
     * Missing or INACTIVE access-control entry:
     * DIRECTORY_USER.
     */

    const effectiveUser =
      KGMIS_GetEffectiveUserByEmail_(
        registeredEmail,
        memberName
      );


    return {
      authMethod:
        'MOBILE_PASSWORD',

      email:
        effectiveUser.email,

      kefgId:
        rowKefgId,

      familyId:
        String(
          row[
            headerMap.FAMILY_ID
          ] || ''
        )
          .trim()
          .toUpperCase(),

      registeredMobile:
        String(
          row[
            headerMap.REGISTERED_MOBILE
          ] || ''
        ).trim(),

      userName:
        effectiveUser.userName ||
        memberName,

      role:
        effectiveUser.role,

      status:
        effectiveUser.status
    };

  }


  return null;
}


/**
 * ============================================================
 * MOBILE LOGIN AUTHENTICATION
 *
 * Controlled production replacement for:
 *   KGMIS_Mobile_Login()
 *
 * CHANGE IN THIS VERSION
 * ----------------------
 * Password hashing/verification is performed BEFORE acquiring
 * the global Script Lock.
 *
 * The Script Lock is held only while re-reading and updating
 * the KGMIS_LOGIN security fields.
 *
 * Session creation and effective-role resolution are performed
 * AFTER the lock is released.
 *
 * Existing business rules, statuses, lockout thresholds,
 * session structure and permission/module responses are retained.
 * ============================================================
 */
function KGMIS_Mobile_Login(
  mobileNumber,
  kefgId,
  password
) {

  const normalizedMobile =
    KGMIS_Login_NormalizeMobile_(
      mobileNumber
    );

  const safeKefgId =
    String(
      kefgId || ''
    )
      .trim()
      .toUpperCase();

  const safePassword =
    String(
      password || ''
    );


  /*
   * ----------------------------------------------------------
   * Basic request validation
   * ----------------------------------------------------------
   */

  if (!normalizedMobile) {

    return {
      success: false,
      status: 'INVALID_MOBILE',
      message:
        'Please enter a valid registered mobile number.'
    };
  }


  if (!safePassword) {

    return {
      success: false,
      status: 'PASSWORD_REQUIRED',
      message:
        'Please enter your password.'
    };
  }


  /*
   * ----------------------------------------------------------
   * Identify all accounts linked to the mobile number
   * ----------------------------------------------------------
   */

  const mobileLookup =
    KGMIS_Login_FindMemberByMobile(
      normalizedMobile
    );


  if (
    !mobileLookup ||
    mobileLookup.status === 'NO_MATCH'
  ) {

    return {
      success: false,
      status: 'NO_MATCH',
      message:
        'Sorry, your mobile number is not registered. ' +
        'Please contact the KEF Global Data Management Team.'
    };
  }


  if (
    mobileLookup.status ===
    'INVALID_MOBILE'
  ) {

    return mobileLookup;
  }


  if (
    mobileLookup.status ===
    'DATA_ERROR'
  ) {

    return mobileLookup;
  }


  /*
   * ----------------------------------------------------------
   * Resolve the selected KEFG_ID
   * ----------------------------------------------------------
   */

  let resolvedKefgId =
    safeKefgId;


  if (
    mobileLookup.status ===
    'SINGLE_MATCH'
  ) {

    const matchedKefgId =
      String(
        mobileLookup.member &&
        mobileLookup.member.kefgId
          ? mobileLookup.member.kefgId
          : ''
      )
        .trim()
        .toUpperCase();


    if (!resolvedKefgId) {

      resolvedKefgId =
        matchedKefgId;
    }


    if (
      resolvedKefgId !==
      matchedKefgId
    ) {

      return {
        success: false,
        status: 'MEMBER_MISMATCH',
        message:
          'The selected member does not match the ' +
          'registered mobile number.'
      };
    }
  }


  if (
    mobileLookup.status ===
    'MULTIPLE_FAMILY_MATCH'
  ) {

    if (!resolvedKefgId) {

      return {
        success: false,
        status:
          'MEMBER_SELECTION_REQUIRED',
        familyId:
          mobileLookup.familyId || '',
        members:
          mobileLookup.members || [],
        message:
          'This mobile number is registered for more ' +
          'than one family member. Please select your name.'
      };
    }


    const selectedMemberExists =
      (
        mobileLookup.members || []
      ).some(
        function (member) {

          return (
            String(
              member.kefgId || ''
            )
              .trim()
              .toUpperCase() ===
            resolvedKefgId
          );
        }
      );


    if (!selectedMemberExists) {

      return {
        success: false,
        status: 'MEMBER_MISMATCH',
        message:
          'The selected member does not match the ' +
          'registered mobile number.'
      };
    }
  }


  if (!resolvedKefgId) {

    return {
      success: false,
      status:
        'MEMBER_SELECTION_REQUIRED',
      message:
        'Please select the member who is signing in.'
    };
  }


  /*
   * ==========================================================
   * PHASE 1 — READ ACCOUNT WITHOUT HOLDING SCRIPT LOCK
   * ==========================================================
   *
   * Expensive password hashing must NOT run while the global
   * Script Lock is held.
   */

  const loginSheet =
    KGMIS_Login_GetSheet_(
      'KGMIS_LOGIN'
    );

  const lastRow =
    loginSheet.getLastRow();

  const lastColumn =
    loginSheet.getLastColumn();


  if (
    lastRow < 2 ||
    lastColumn < 1
  ) {

    throw new Error(
      'KGMIS_LOGIN does not contain login accounts.'
    );
  }


  const values =
    loginSheet
      .getRange(
        1,
        1,
        lastRow,
        lastColumn
      )
      .getValues();


  const headers =
    values[0].map(
      function (header) {

        return String(
          header || ''
        )
          .trim()
          .toUpperCase();
      }
    );


  const headerMap = {};


  headers.forEach(
    function (header, index) {

      if (header) {

        headerMap[header] =
          index;
      }
    }
  );


  const requiredHeaders = [
    'LOGIN_ID',
    'KEFG_ID',
    'FAMILY_ID',
    'MEMBER_NAME',
    'REGISTERED_MOBILE',
    'PASSWORD_HASH',
    'PASSWORD_SALT',
    'PASSWORD_STATUS',
    'FAILED_ATTEMPTS',
    'LAST_FAILED_LOGIN',
    'LOCKED_UNTIL',
    'LAST_LOGIN',
    'UPDATED_ON',
    'STATUS'
  ];


  requiredHeaders.forEach(
    function (header) {

      if (
        !Object.prototype
          .hasOwnProperty.call(
            headerMap,
            header
          )
      ) {

        throw new Error(
          'Missing KGMIS_LOGIN header: ' +
          header
        );
      }
    }
  );


  let matchingRowIndex =
    -1;


  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const rowKefgId =
      String(
        values[rowIndex][
          headerMap.KEFG_ID
        ] || ''
      )
        .trim()
        .toUpperCase();


    if (
      rowKefgId ===
      resolvedKefgId
    ) {

      matchingRowIndex =
        rowIndex;

      break;
    }
  }


  if (matchingRowIndex < 1) {

    return {
      success: false,
      status: 'ACCOUNT_NOT_FOUND',
      message:
        'The selected login account could not be found.'
    };
  }


  const matchingRow =
    values[
      matchingRowIndex
    ];


  const storedMobile =
    KGMIS_Login_NormalizeMobile_(
      matchingRow[
        headerMap.REGISTERED_MOBILE
      ]
    );


  if (
    !storedMobile ||
    storedMobile !==
    normalizedMobile
  ) {

    return {
      success: false,
      status: 'MEMBER_MISMATCH',
      message:
        'The selected member does not match the ' +
        'registered mobile number.'
    };
  }


  const accountStatus =
    String(
      matchingRow[
        headerMap.STATUS
      ] || ''
    )
      .trim()
      .toUpperCase();


  if (
    accountStatus !==
    'ACTIVE'
  ) {

    return {
      success: false,
      status: 'ACCOUNT_INACTIVE',
      message:
        'This login account is not active. ' +
        'Please contact the KEF Global Data Management Team.'
    };
  }


  const passwordStatus =
    String(
      matchingRow[
        headerMap.PASSWORD_STATUS
      ] || ''
    )
      .trim()
      .toUpperCase();


  if (
    passwordStatus ===
    'NOT_SET'
  ) {

    return {
      success: false,
      status:
        'PASSWORD_NOT_SET',
      kefgId:
        resolvedKefgId,
      memberName:
        String(
          matchingRow[
            headerMap.MEMBER_NAME
          ] || ''
        ).trim(),
      message:
        'A password has not yet been created for this account.'
    };
  }


  if (
    passwordStatus !==
    'ACTIVE'
  ) {

    return {
      success: false,
      status:
        'PASSWORD_UNAVAILABLE',
      message:
        'Password login is not currently available for this account.'
    };
  }


  /*
   * Check any existing temporary account lock before doing the
   * expensive password hash.
   */

  const precheckNow =
    new Date();

  const precheckStoredLockedUntil =
    matchingRow[
      headerMap.LOCKED_UNTIL
    ];

  let precheckLockedUntil =
    null;


  if (
    precheckStoredLockedUntil instanceof Date &&
    !isNaN(
      precheckStoredLockedUntil.getTime()
    )
  ) {

    precheckLockedUntil =
      precheckStoredLockedUntil;

  } else if (
    String(
      precheckStoredLockedUntil || ''
    ).trim()
  ) {

    const parsedLockedUntil =
      new Date(
        precheckStoredLockedUntil
      );


    if (
      !isNaN(
        parsedLockedUntil.getTime()
      )
    ) {

      precheckLockedUntil =
        parsedLockedUntil;
    }
  }


  if (
    precheckLockedUntil &&
    precheckLockedUntil.getTime() >
    precheckNow.getTime()
  ) {

    const remainingMinutes =
      Math.max(
        1,
        Math.ceil(
          (
            precheckLockedUntil.getTime() -
            precheckNow.getTime()
          ) /
          60000
        )
      );


    return {
      success: false,
      status:
        'ACCOUNT_LOCKED',
      lockedUntil:
        precheckLockedUntil.toISOString(),
      remainingMinutes:
        remainingMinutes,
      message:
        'Your account is temporarily locked. ' +
        'Please try again after ' +
        String(
          remainingMinutes
        ) +
        (
          remainingMinutes === 1
            ? ' minute.'
            : ' minutes.'
        )
    };
  }


  /*
   * Snapshot the credential fields.
   *
   * After acquiring the lock we confirm these values have not
   * changed. This prevents using an old password result after an
   * administrator or first-time-registration process changes the
   * password concurrently.
   */

  const passwordSaltSnapshot =
    String(
      matchingRow[
        headerMap.PASSWORD_SALT
      ] || ''
    ).trim();

  const passwordHashSnapshot =
    String(
      matchingRow[
        headerMap.PASSWORD_HASH
      ] || ''
    ).trim();


  /*
   * ----------------------------------------------------------
   * EXPENSIVE PASSWORD VERIFICATION — OUTSIDE SCRIPT LOCK
   * ----------------------------------------------------------
   */

  const passwordVerified =
    KGMIS_Login_VerifyPassword_(
      safePassword,
      passwordSaltSnapshot,
      passwordHashSnapshot
    );


  /*
   * ==========================================================
   * PHASE 2 — SHORT, CONTROLLED SECURITY UPDATE LOCK
   * ==========================================================
   */

  const scriptLock =
    LockService.getScriptLock();


  /*
   * Keep the existing 30-second acquisition window for
   * compatibility, but the lock itself is now held only for the
   * short security-update section below.
   */
  scriptLock.waitLock(
    30000
  );


  let finalFamilyId =
    '';

  let finalMemberName =
    '';

  let finalRegisteredEmail =
    '';

  let loginResult =
    null;


  try {

    /*
     * Re-read KGMIS_LOGIN after obtaining the lock.
     *
     * This is the authoritative state used for the update.
     */

    const lockedLastRow =
      loginSheet.getLastRow();

    const lockedLastColumn =
      loginSheet.getLastColumn();


    if (
      lockedLastRow < 2 ||
      lockedLastColumn < 1
    ) {

      throw new Error(
        'KGMIS_LOGIN does not contain login accounts.'
      );
    }


    const lockedValues =
      loginSheet
        .getRange(
          1,
          1,
          lockedLastRow,
          lockedLastColumn
        )
        .getValues();


    const lockedHeaders =
      lockedValues[0].map(
        function (header) {

          return String(
            header || ''
          )
            .trim()
            .toUpperCase();
        }
      );


    const lockedHeaderMap =
      {};


    lockedHeaders.forEach(
      function (header, index) {

        if (header) {

          lockedHeaderMap[header] =
            index;
        }
      }
    );


    requiredHeaders.forEach(
      function (header) {

        if (
          !Object.prototype
            .hasOwnProperty.call(
              lockedHeaderMap,
              header
            )
        ) {

          throw new Error(
            'Missing KGMIS_LOGIN header: ' +
            header
          );
        }
      }
    );


    let lockedMatchingRowIndex =
      -1;


    for (
      let rowIndex = 1;
      rowIndex < lockedValues.length;
      rowIndex++
    ) {

      const rowKefgId =
        String(
          lockedValues[rowIndex][
            lockedHeaderMap.KEFG_ID
          ] || ''
        )
          .trim()
          .toUpperCase();


      if (
        rowKefgId ===
        resolvedKefgId
      ) {

        lockedMatchingRowIndex =
          rowIndex;

        break;
      }
    }


    if (
      lockedMatchingRowIndex < 1
    ) {

      loginResult = {
        success: false,
        status:
          'ACCOUNT_NOT_FOUND',
        message:
          'The selected login account could not be found.'
      };

    } else {

      const lockedRow =
        lockedValues[
          lockedMatchingRowIndex
        ];

      const sheetRowNumber =
        lockedMatchingRowIndex + 1;


      const lockedStoredMobile =
        KGMIS_Login_NormalizeMobile_(
          lockedRow[
            lockedHeaderMap.REGISTERED_MOBILE
          ]
        );


      if (
        !lockedStoredMobile ||
        lockedStoredMobile !==
        normalizedMobile
      ) {

        loginResult = {
          success: false,
          status:
            'MEMBER_MISMATCH',
          message:
            'The selected member does not match the ' +
            'registered mobile number.'
        };

      } else {

        const lockedAccountStatus =
          String(
            lockedRow[
              lockedHeaderMap.STATUS
            ] || ''
          )
            .trim()
            .toUpperCase();


        if (
          lockedAccountStatus !==
          'ACTIVE'
        ) {

          loginResult = {
            success: false,
            status:
              'ACCOUNT_INACTIVE',
            message:
              'This login account is not active. ' +
              'Please contact the KEF Global Data Management Team.'
          };

        } else {

          const lockedPasswordStatus =
            String(
              lockedRow[
                lockedHeaderMap.PASSWORD_STATUS
              ] || ''
            )
              .trim()
              .toUpperCase();


          if (
            lockedPasswordStatus ===
            'NOT_SET'
          ) {

            loginResult = {
              success: false,
              status:
                'PASSWORD_NOT_SET',
              kefgId:
                resolvedKefgId,
              memberName:
                String(
                  lockedRow[
                    lockedHeaderMap.MEMBER_NAME
                  ] || ''
                ).trim(),
              message:
                'A password has not yet been created for this account.'
            };

          } else if (
            lockedPasswordStatus !==
            'ACTIVE'
          ) {

            loginResult = {
              success: false,
              status:
                'PASSWORD_UNAVAILABLE',
              message:
                'Password login is not currently available for this account.'
            };

          } else {

            /*
             * Confirm credentials did not change after the
             * password was verified outside the lock.
             */

            const lockedPasswordSalt =
              String(
                lockedRow[
                  lockedHeaderMap.PASSWORD_SALT
                ] || ''
              ).trim();

            const lockedPasswordHash =
              String(
                lockedRow[
                  lockedHeaderMap.PASSWORD_HASH
                ] || ''
              ).trim();


            if (
              lockedPasswordSalt !==
                passwordSaltSnapshot ||
              lockedPasswordHash !==
                passwordHashSnapshot
            ) {

              loginResult = {
                success: false,
                status:
                  'ACCOUNT_CHANGED',
                message:
                  'Your account security information changed while signing in. ' +
                  'Please try again.'
              };

            } else {

              /*
               * Re-check temporary lock status under the lock.
               */

              const now =
                new Date();

              const storedLockedUntil =
                lockedRow[
                  lockedHeaderMap.LOCKED_UNTIL
                ];

              let lockedUntil =
                null;


              if (
                storedLockedUntil instanceof Date &&
                !isNaN(
                  storedLockedUntil.getTime()
                )
              ) {

                lockedUntil =
                  storedLockedUntil;

              } else if (
                String(
                  storedLockedUntil || ''
                ).trim()
              ) {

                const parsedLockedUntil =
                  new Date(
                    storedLockedUntil
                  );


                if (
                  !isNaN(
                    parsedLockedUntil.getTime()
                  )
                ) {

                  lockedUntil =
                    parsedLockedUntil;
                }
              }


              if (
                lockedUntil &&
                lockedUntil.getTime() >
                now.getTime()
              ) {

                const remainingMinutes =
                  Math.max(
                    1,
                    Math.ceil(
                      (
                        lockedUntil.getTime() -
                        now.getTime()
                      ) /
                      60000
                    )
                  );


                loginResult = {
                  success: false,
                  status:
                    'ACCOUNT_LOCKED',
                  lockedUntil:
                    lockedUntil.toISOString(),
                  remainingMinutes:
                    remainingMinutes,
                  message:
                    'Your account is temporarily locked. ' +
                    'Please try again after ' +
                    String(
                      remainingMinutes
                    ) +
                    (
                      remainingMinutes === 1
                        ? ' minute.'
                        : ' minutes.'
                    )
                };

              } else {

                /*
                 * Expired lock: clear it before applying this
                 * login attempt.
                 */
                let currentFailedAttempts =
                  Math.max(
                    0,
                    Number(
                      lockedRow[
                        lockedHeaderMap.FAILED_ATTEMPTS
                      ]
                    ) || 0
                  );


                if (
                  lockedUntil &&
                  lockedUntil.getTime() <=
                  now.getTime()
                ) {

                  loginSheet
                    .getRange(
                      sheetRowNumber,
                      lockedHeaderMap.LOCKED_UNTIL + 1
                    )
                    .clearContent();


                  loginSheet
                    .getRange(
                      sheetRowNumber,
                      lockedHeaderMap.FAILED_ATTEMPTS + 1
                    )
                    .setValue(
                      0
                    );


                  currentFailedAttempts =
                    0;
                }


                /*
                 * ----------------------------------------------
                 * PASSWORD FAILED
                 * ----------------------------------------------
                 */
                if (!passwordVerified) {

                  const failedAttempts =
                    currentFailedAttempts + 1;

                  const lastFailedLogin =
                    new Date();


                  loginSheet
                    .getRange(
                      sheetRowNumber,
                      lockedHeaderMap.FAILED_ATTEMPTS + 1
                    )
                    .setValue(
                      failedAttempts
                    );


                  loginSheet
                    .getRange(
                      sheetRowNumber,
                      lockedHeaderMap.LAST_FAILED_LOGIN + 1
                    )
                    .setValue(
                      lastFailedLogin
                    )
                    .setNumberFormat(
                      'dd-mmm-yyyy hh:mm'
                    );


                  loginSheet
                    .getRange(
                      sheetRowNumber,
                      lockedHeaderMap.UPDATED_ON + 1
                    )
                    .setValue(
                      lastFailedLogin
                    )
                    .setNumberFormat(
                      'dd-mmm-yyyy hh:mm'
                    );


                  if (
                    failedAttempts >=
                    KGMIS_LOGIN_MAX_FAILED_ATTEMPTS
                  ) {

                    const newLockedUntil =
                      new Date(
                        lastFailedLogin.getTime() +
                        (
                          KGMIS_LOGIN_LOCKOUT_MINUTES *
                          60 *
                          1000
                        )
                      );


                    loginSheet
                      .getRange(
                        sheetRowNumber,
                        lockedHeaderMap.LOCKED_UNTIL + 1
                      )
                      .setValue(
                        newLockedUntil
                      )
                      .setNumberFormat(
                        'dd-mmm-yyyy hh:mm'
                      );


                    SpreadsheetApp.flush();


                    loginResult = {
                      success: false,
                      status:
                        'ACCOUNT_LOCKED',
                      failedAttempts:
                        failedAttempts,
                      lockedUntil:
                        newLockedUntil.toISOString(),
                      remainingMinutes:
                        KGMIS_LOGIN_LOCKOUT_MINUTES,
                      message:
                        'Your account has been temporarily locked for ' +
                        String(
                          KGMIS_LOGIN_LOCKOUT_MINUTES
                        ) +
                        ' minutes because of repeated incorrect passwords.'
                    };

                  } else {

                    const attemptsRemaining =
                      Math.max(
                        0,
                        KGMIS_LOGIN_MAX_FAILED_ATTEMPTS -
                        failedAttempts
                      );


                    SpreadsheetApp.flush();


                    loginResult = {
                      success: false,
                      status:
                        'INVALID_CREDENTIALS',
                      failedAttempts:
                        failedAttempts,
                      attemptsRemaining:
                        attemptsRemaining,
                      message:
                        'The password is incorrect. ' +
                        String(
                          attemptsRemaining
                        ) +
                        (
                          attemptsRemaining === 1
                            ? ' attempt remains.'
                            : ' attempts remain.'
                        )
                    };
                  }

                } else {

                  /*
                   * ----------------------------------------------
                   * PASSWORD SUCCESS
                   * ----------------------------------------------
                   */

                  const successfulLogin =
                    new Date();


                  loginSheet
                    .getRange(
                      sheetRowNumber,
                      lockedHeaderMap.FAILED_ATTEMPTS + 1
                    )
                    .setValue(
                      0
                    );


                  loginSheet
                    .getRange(
                      sheetRowNumber,
                      lockedHeaderMap.LAST_FAILED_LOGIN + 1
                    )
                    .clearContent();


                  loginSheet
                    .getRange(
                      sheetRowNumber,
                      lockedHeaderMap.LOCKED_UNTIL + 1
                    )
                    .clearContent();


                  loginSheet
                    .getRange(
                      sheetRowNumber,
                      lockedHeaderMap.LAST_LOGIN + 1
                    )
                    .setValue(
                      successfulLogin
                    )
                    .setNumberFormat(
                      'dd-mmm-yyyy hh:mm'
                    );


                  loginSheet
                    .getRange(
                      sheetRowNumber,
                      lockedHeaderMap.UPDATED_ON + 1
                    )
                    .setValue(
                      successfulLogin
                    )
                    .setNumberFormat(
                      'dd-mmm-yyyy hh:mm'
                    );


                  /*
                   * Capture the session identity while the row
                   * is authoritative. Session creation itself is
                   * deliberately deferred until after releaseLock().
                   */

                  finalFamilyId =
                    String(
                      lockedRow[
                        lockedHeaderMap.FAMILY_ID
                      ] || ''
                    )
                      .trim()
                      .toUpperCase();


                  finalMemberName =
                    String(
                      lockedRow[
                        lockedHeaderMap.MEMBER_NAME
                      ] || ''
                    ).trim();


                  finalRegisteredEmail =
                    Object.prototype
                      .hasOwnProperty.call(
                        lockedHeaderMap,
                        'REGISTERED_EMAIL'
                      )
                        ? KGMIS_OTP_NormalizeEmail_(
                            lockedRow[
                              lockedHeaderMap.REGISTERED_EMAIL
                            ]
                          )
                        : '';


                  SpreadsheetApp.flush();


                  loginResult = {
                    success: true,
                    status:
                      'PASSWORD_VERIFIED'
                  };
                }
              }
            }
          }
        }
      }
    }

  } finally {

    scriptLock.releaseLock();
  }


  /*
   * Any denial result is returned after the lock is released.
   */

  if (
    !loginResult ||
    loginResult.success !== true
  ) {

    return loginResult || {
      success: false,
      status:
        'LOGIN_FAILED',
      message:
        'The login could not be completed.'
    };
  }


  /*
   * ==========================================================
   * PHASE 3 — SESSION / ROLE RESOLUTION OUTSIDE SCRIPT LOCK
   * ==========================================================
   */

  const effectiveUser =
    KGMIS_GetEffectiveUserByEmail_(
      finalRegisteredEmail,
      finalMemberName
    );


  const sessionUser = {

    authMethod:
      'MOBILE_PASSWORD',

    email:
      effectiveUser.email,

    kefgId:
      resolvedKefgId,

    familyId:
      finalFamilyId,

    registeredMobile:
      normalizedMobile,

    userName:
      effectiveUser.userName ||
      finalMemberName,

    role:
      effectiveUser.role,

    status:
      effectiveUser.status
  };


  const session =
    KGMIS_OTP_CreateSession_(
      sessionUser
    );


  return {

    success:
      true,

    status:
      'LOGIN_SUCCESS',

    authenticated:
      true,

    sessionToken:
      session.sessionToken,

    expiresAt:
      session.expiresAt,

    expiresInSeconds:
      Math.floor(
        (
          session.expiresAt -
          Date.now()
        ) /
        1000
      ),

    registeredMobile:
      normalizedMobile,

    user: {

      email:
        sessionUser.email,

      userName:
        sessionUser.userName,

      role:
        sessionUser.role,

      status:
        sessionUser.status,

      kefgId:
        sessionUser.kefgId,

      familyId:
        sessionUser.familyId,

      registeredMobile:
        sessionUser.registeredMobile,

      authMethod:
        sessionUser.authMethod
    },

    permissions:
      KGMIS_OTP_GetUserPermissionProfile_(
        sessionUser.role
      ),

    modules:
      KGMIS_OTP_GetUserModuleProfile_(
        sessionUser.role
      ),

    message:
      'Mobile login successful.'
  };
}


/*
 * ============================================================
 * PUBLIC FUNCTION
 * Creates the KGMIS_LOGIN registry from the master database.
 * ============================================================
 */
function KGMIS_Create_Login_Registry() {

  const masterSheetName =
    'KGMIS_MASTER_DATABASE_v1.0';

  const loginSheetName =
    'KGMIS_LOGIN';

  const masterSheet =
    KGMIS_Login_GetSheet_(
      masterSheetName
    );

  const loginSheet =
    KGMIS_Login_GetSheet_(
      loginSheetName
    );


  /*
   * ----------------------------------------------------------
   * Read and validate the Login Registry headers
   * ----------------------------------------------------------
   */

  const requiredLoginHeaders = [
    'LOGIN_ID',
    'KEFG_ID',
    'FAMILY_ID',
    'MEMBER_NAME',
    'REGISTERED_MOBILE',
    'PASSWORD_HASH',
    'PASSWORD_SALT',
    'PASSWORD_STATUS',
    'FAILED_ATTEMPTS',
    'LOCKED_UNTIL',
    'LAST_LOGIN',
    'PASSWORD_CHANGED_ON',
    'CREATED_ON',
    'UPDATED_ON',
    'STATUS',
    'REMARKS'
  ];

  const loginLastColumn =
    loginSheet.getLastColumn();

  if (loginLastColumn < 1) {
    throw new Error(
      'The KGMIS_LOGIN sheet does not contain headers.'
    );
  }

  const loginHeaders =
    loginSheet
      .getRange(
        1,
        1,
        1,
        loginLastColumn
      )
      .getDisplayValues()[0]
      .map(function (header) {
        return String(header || '')
          .trim()
          .toUpperCase();
      });

  const loginHeaderMap = {};

  loginHeaders.forEach(
    function (header, index) {
      if (header) {
        loginHeaderMap[header] =
          index;
      }
    }
  );

  const missingLoginHeaders =
    requiredLoginHeaders.filter(
      function (header) {
        return !Object.prototype
          .hasOwnProperty.call(
            loginHeaderMap,
            header
          );
      }
    );

  if (missingLoginHeaders.length) {
    throw new Error(
      'Missing KGMIS_LOGIN headers: ' +
      missingLoginHeaders.join(', ')
    );
  }


  /*
   * ----------------------------------------------------------
   * Read and validate the Master Database headers
   * ----------------------------------------------------------
   */

  const requiredMasterHeaders = [
    'KEFG_ID',
    'FAMILY_ID',
    'MEMBER_NAME',
    'RECORD_STATUS',
    'MEMBER_MOBILE',
    'MEMBER_WHATSAPP'
  ];

  const masterLastRow =
    masterSheet.getLastRow();

  const masterLastColumn =
    masterSheet.getLastColumn();

  if (
    masterLastRow < 2 ||
    masterLastColumn < 1
  ) {
    throw new Error(
      'The master database does not contain member records.'
    );
  }

  const masterValues =
    masterSheet
      .getRange(
        1,
        1,
        masterLastRow,
        masterLastColumn
      )
      .getDisplayValues();

  const masterHeaders =
    masterValues[0]
      .map(function (header) {
        return String(header || '')
          .trim()
          .toUpperCase();
      });

  const masterHeaderMap = {};

  masterHeaders.forEach(
    function (header, index) {
      if (header) {
        masterHeaderMap[header] =
          index;
      }
    }
  );

  const missingMasterHeaders =
    requiredMasterHeaders.filter(
      function (header) {
        return !Object.prototype
          .hasOwnProperty.call(
            masterHeaderMap,
            header
          );
      }
    );

  if (missingMasterHeaders.length) {
    throw new Error(
      'Missing master database headers: ' +
      missingMasterHeaders.join(', ')
    );
  }


  /*
   * ----------------------------------------------------------
   * Build Registry Rows
   * ----------------------------------------------------------
   */

  const outputRows = [];

  const processedKefgIds =
    new Set();

  const registeredMobileMap =
    new Map();

  let currentRecords = 0;
  let accountsCreated = 0;
  let noMobileNumber = 0;
  let duplicateKefgIds = 0;
  let duplicateMobileNumbers = 0;
  let blankKefgIds = 0;
  let closedRecordsSkipped = 0;

  const createdOn =
    new Date();

  for (
    let rowIndex = 1;
    rowIndex < masterValues.length;
    rowIndex++
  ) {

    const row =
      masterValues[rowIndex];

    const recordStatus =
      String(
        row[
          masterHeaderMap.RECORD_STATUS
        ] || ''
      )
        .trim()
        .toUpperCase();

    if (recordStatus === 'CLOSED') {
      closedRecordsSkipped++;
      continue;
    }

    currentRecords++;


    const kefgId =
      String(
        row[
          masterHeaderMap.KEFG_ID
        ] || ''
      )
        .trim()
        .toUpperCase();

    const familyId =
  String(
    row[
      masterHeaderMap.FAMILY_ID
    ] || ''
  )
    .trim()
    .toUpperCase();

const memberName =
  String(
    row[
      masterHeaderMap.MEMBER_NAME
    ] || ''
  ).trim();

    if (!kefgId) {
      blankKefgIds++;
      continue;
    }

    if (processedKefgIds.has(kefgId)) {
      duplicateKefgIds++;
      continue;
    }

    processedKefgIds.add(kefgId);


    /*
     * Business rule:
     *
     * 1. Use MEMBER_MOBILE when available.
     * 2. Otherwise use MEMBER_WHATSAPP.
     * 3. Otherwise leave blank and add a remark.
     */

    const memberMobile =
      String(
        row[
          masterHeaderMap.MEMBER_MOBILE
        ] || ''
      ).trim();

    const memberWhatsApp =
      String(
        row[
          masterHeaderMap.MEMBER_WHATSAPP
        ] || ''
      ).trim();

    let sourceMobile = '';
    let mobileSource = '';

    if (memberMobile) {
      sourceMobile =
        memberMobile;

      mobileSource =
        'MEMBER_MOBILE';

    } else if (memberWhatsApp) {
      sourceMobile =
        memberWhatsApp;

      mobileSource =
        'MEMBER_WHATSAPP';
    }

    const registeredMobile =
      KGMIS_Login_NormalizeMobile_(
        sourceMobile
      );

    let remarks = '';

    if (!registeredMobile) {

      noMobileNumber++;

      remarks =
        'NO MOBILE NUMBER';

    } else {

      if (
        registeredMobileMap.has(
          registeredMobile
        )
      ) {

        duplicateMobileNumbers++;

        const existingKefgId =
          registeredMobileMap.get(
            registeredMobile
          );

        remarks =
          'DUPLICATE MOBILE NUMBER ALSO USED BY ' +
          existingKefgId;

      } else {

        registeredMobileMap.set(
          registeredMobile,
          kefgId
        );

        if (
          mobileSource ===
          'MEMBER_WHATSAPP'
        ) {
          remarks =
            'USING MEMBER_WHATSAPP';
        }
      }
    }


    const loginId =
      KGMIS_Login_GenerateLoginId_(
        accountsCreated + 1
      );

    const outputRow =
      new Array(
        loginHeaders.length
      ).fill('');

    outputRow[
      loginHeaderMap.LOGIN_ID
    ] = loginId;

    outputRow[
      loginHeaderMap.KEFG_ID
    ] = kefgId;

    outputRow[
  loginHeaderMap.FAMILY_ID
] = familyId;

outputRow[
  loginHeaderMap.MEMBER_NAME
] = memberName;

    outputRow[
      loginHeaderMap.REGISTERED_MOBILE
    ] = registeredMobile;

    outputRow[
      loginHeaderMap.PASSWORD_HASH
    ] = '';

    outputRow[
      loginHeaderMap.PASSWORD_SALT
    ] = '';

    outputRow[
      loginHeaderMap.PASSWORD_STATUS
    ] = 'NOT_SET';

    outputRow[
      loginHeaderMap.FAILED_ATTEMPTS
    ] = 0;

    outputRow[
      loginHeaderMap.LOCKED_UNTIL
    ] = '';

    outputRow[
      loginHeaderMap.LAST_LOGIN
    ] = '';

    outputRow[
      loginHeaderMap.PASSWORD_CHANGED_ON
    ] = '';

    outputRow[
      loginHeaderMap.CREATED_ON
    ] = createdOn;

    outputRow[
      loginHeaderMap.UPDATED_ON
    ] = '';

    outputRow[
      loginHeaderMap.STATUS
    ] = 'ACTIVE';

    outputRow[
      loginHeaderMap.REMARKS
    ] = remarks;

    outputRows.push(
      outputRow
    );

    accountsCreated++;
  }


  /*
   * ----------------------------------------------------------
   * Replace only the existing data rows
   * Header row is preserved.
   * ----------------------------------------------------------
   */

  const existingLoginLastRow =
    loginSheet.getLastRow();

  if (existingLoginLastRow > 1) {

    loginSheet
      .getRange(
        2,
        1,
        existingLoginLastRow - 1,
        loginLastColumn
      )
      .clearContent();
  }

  if (outputRows.length) {

    loginSheet
      .getRange(
        2,
        1,
        outputRows.length,
        loginHeaders.length
      )
      .setValues(
        outputRows
      );
  }


  /*
   * ----------------------------------------------------------
   * Apply date formatting
   * ----------------------------------------------------------
   */

  if (outputRows.length) {

    const createdOnColumn =
      loginHeaderMap.CREATED_ON + 1;

    loginSheet
      .getRange(
        2,
        createdOnColumn,
        outputRows.length,
        1
      )
      .setNumberFormat(
        'dd-mmm-yyyy hh:mm'
      );
  }


  /*
   * ----------------------------------------------------------
   * Completion Summary
   * ----------------------------------------------------------
   */

  const summary = [
    'KGMIS Login Registry Created',
    '',
    'Master Records Read: ' +
      String(masterValues.length - 1),

    'Current Records Processed: ' +
      String(currentRecords),

    'Login Accounts Created: ' +
      String(accountsCreated),

    'No Mobile Number: ' +
      String(noMobileNumber),

    'Duplicate KEFG IDs Skipped: ' +
      String(duplicateKefgIds),

    'Duplicate Mobile Numbers Found: ' +
      String(duplicateMobileNumbers),

    'Blank KEFG IDs Skipped: ' +
      String(blankKefgIds),

    'Non-current Records Skipped: ' +
      String(closedRecordsSkipped)
  ].join('\n');

    console.log(summary);

    SpreadsheetApp.flush();

  return {
    success: true,
    masterRecordsRead:
      masterValues.length - 1,
    currentRecordsProcessed:
      currentRecords,
    loginAccountsCreated:
      accountsCreated,
    noMobileNumber:
      noMobileNumber,
    duplicateKefgIds:
      duplicateKefgIds,
    duplicateMobileNumbers:
      duplicateMobileNumbers,
    blankKefgIds:
      blankKefgIds,
    nonCurrentRecordsSkipped:
      closedRecordsSkipped
  };
}


/*
 * ============================================================
 * NORMALISE MOBILE NUMBER
 *
 * Stores numbers as digits only.
 *
 * Indian examples:
 * 9876543210      → 919876543210
 * 09876543210     → 919876543210
 * +91 9876543210  → 919876543210
 *
 * International numbers already containing a country code
 * are retained as digits only.
 * ============================================================
 */
function KGMIS_Login_NormalizeMobile_(
  mobile
) {

  let digits =
    String(mobile || '')
      .replace(/\D/g, '');

  if (!digits) {
    return '';
  }


  /*
   * Remove international dialing prefix 00.
   */
  if (
    digits.indexOf('00') === 0
  ) {
    digits =
      digits.substring(2);
  }


  /*
   * Indian local mobile:
   * 10 digits beginning with 6, 7, 8 or 9.
   */
  if (
    digits.length === 10 &&
    /^[6-9]/.test(digits)
  ) {
    return '91' + digits;
  }


  /*
   * Indian mobile with leading zero.
   */
  if (
    digits.length === 11 &&
    digits.charAt(0) === '0' &&
    /^[6-9]/.test(
      digits.substring(1)
    )
  ) {
    return (
      '91' +
      digits.substring(1)
    );
  }


  /*
   * Indian number already containing country code.
   */
  if (
    digits.length === 12 &&
    digits.indexOf('91') === 0
  ) {
    return digits;
  }


  /*
   * Other international numbers are retained.
   */
  if (
    digits.length >= 8 &&
    digits.length <= 15
  ) {
    return digits;
  }


  /*
   * Invalid or unusable number.
   */
  return '';
}


/*
 * ============================================================
 * GENERATE LOGIN ID
 * ============================================================
 */
function KGMIS_Login_GenerateLoginId_(
  sequenceNumber
) {

  return (
    'LOGIN' +
    String(sequenceNumber)
      .padStart(
        6,
        '0'
      )
  );
}


/*
 * ============================================================
 * GET SHEET
 * ============================================================
 */
function KGMIS_Login_GetSheet_(
  sheetName
) {

  const spreadsheet =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const sheet =
    spreadsheet
      .getSheetByName(
        sheetName
      );

  if (!sheet) {
    throw new Error(
      'Required sheet not found: ' +
      sheetName
    );
  }

  return sheet;
}


function KGMIS_Test_Admin_SetPassword() {

  return KGMIS_Admin_SetPassword(
    'KEFG1455',
    'TestPassword#1177'
  );
}

/*
 * ============================================================
 * TEST STORED PASSWORD
 *
 * Temporary development function.
 * ============================================================
 */
function KGMIS_Test_VerifyStoredPassword_(
  kefgId,
  password
) {

  const safeKefgId =
    String(kefgId || '')
      .trim()
      .toUpperCase();

  const loginSheet =
    KGMIS_Login_GetSheet_(
      'KGMIS_LOGIN'
    );

  const lastRow =
    loginSheet.getLastRow();

  const lastColumn =
    loginSheet.getLastColumn();

  if (lastRow < 2) {
    throw new Error(
      'KGMIS_LOGIN contains no login accounts.'
    );
  }

  const values =
    loginSheet
      .getRange(
        1,
        1,
        lastRow,
        lastColumn
      )
      .getDisplayValues();

  const headers =
    values[0].map(
      function (header) {
        return String(header || '')
          .trim()
          .toUpperCase();
      }
    );

  const headerMap = {};

  headers.forEach(
    function (header, index) {
      if (header) {
        headerMap[header] =
          index;
      }
    }
  );

  [
    'KEFG_ID',
    'PASSWORD_HASH',
    'PASSWORD_SALT',
    'PASSWORD_STATUS',
    'STATUS'
  ].forEach(
    function (header) {

      if (
        !Object.prototype
          .hasOwnProperty.call(
            headerMap,
            header
          )
      ) {
        throw new Error(
          'Missing KGMIS_LOGIN header: ' +
          header
        );
      }
    }
  );

  let matchingRow =
    null;

  for (
    let rowIndex = 1;
    rowIndex < values.length;
    rowIndex++
  ) {

    const rowKefgId =
      String(
        values[rowIndex][
          headerMap.KEFG_ID
        ] || ''
      )
        .trim()
        .toUpperCase();

    if (rowKefgId === safeKefgId) {
      matchingRow =
        values[rowIndex];

      break;
    }
  }

  if (!matchingRow) {
    throw new Error(
      'No login account found for ' +
      safeKefgId +
      '.'
    );
  }

  const accountStatus =
    String(
      matchingRow[
        headerMap.STATUS
      ] || ''
    )
      .trim()
      .toUpperCase();

  if (accountStatus !== 'ACTIVE') {
    throw new Error(
      'The login account is not active.'
    );
  }

  const passwordStatus =
    String(
      matchingRow[
        headerMap.PASSWORD_STATUS
      ] || ''
    )
      .trim()
      .toUpperCase();

  if (passwordStatus !== 'ACTIVE') {
    throw new Error(
      'A password has not been activated for ' +
      safeKefgId +
      '.'
    );
  }

  const verified =
    KGMIS_Login_VerifyPassword_(
      password,
      matchingRow[
        headerMap.PASSWORD_SALT
      ],
      matchingRow[
        headerMap.PASSWORD_HASH
      ]
    );

  console.log(
    'Password verification for ' +
    safeKefgId +
    ': ' +
    (
      verified
        ? 'PASS'
        : 'FAIL'
    )
  );

  return {
    success: true,
    kefgId:
      safeKefgId,
    verified:
      verified,
    result:
      verified
        ? 'PASS'
        : 'FAIL'
  };
}

function KGMIS_Test_CorrectPassword() {

  return KGMIS_Test_VerifyStoredPassword_(
    'KEFG1455',
    'TestPassword#1177'
  );
}

function KGMIS_Test_WrongPassword() {

  return KGMIS_Test_VerifyStoredPassword_(
    'KEFG1455',
    'WrongPassword#1177'
  );
}

function KGMIS_Test_Mobile_SingleMatch() {

  const result =
    KGMIS_Login_FindMemberByMobile(
      '7306472682'
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}

function KGMIS_Test_Mobile_NoMatch() {

  const result =
    KGMIS_Login_FindMemberByMobile(
      '9999999999'
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}

function KGMIS_Test_Mobile_MultipleMatch() {

  const result =
    KGMIS_Login_FindMemberByMobile(
      '96599421016'
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}

function KGMIS_Test_Mobile_Login_Correct() {

  const result =
    KGMIS_Mobile_Login(
      '1234567899',
      'KEFG1455',
      'TestPassword#1177'
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}

function KGMIS_Test_Mobile_Login_Wrong() {

  const result =
    KGMIS_Mobile_Login(
      '1234567899',
      'KEFG1455',
      'WrongPassword#1177'
    );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}

function KGMIS_Test_Mobile_Session() {

  const loginResult =
    KGMIS_Mobile_Login(
      '1234567899',
      'KEFG1455',
      'TestPassword#1177'
    );

  if (
    !loginResult ||
    !loginResult.sessionToken
  ) {
    throw new Error(
      'Mobile login did not create a session token.'
    );
  }

  const sessionResult =
    KGMIS_OTP_GetSessionUser(
      loginResult.sessionToken
    );

  console.log(
    JSON.stringify(
      sessionResult,
      null,
      2
    )
  );

  return sessionResult;
}

/*
 * ============================================================
 * FIRST-TIME EMAIL REGISTRATION SETTINGS
 * ============================================================
 */

const KGMIS_MOBILE_EMAIL_OTP_PROPERTY_PREFIX =
  'KGMIS_MOBILE_EMAIL_OTP_';


/*
 * ============================================================
 * REQUEST FIRST-TIME EMAIL OTP
 *
 * Used only when PASSWORD_STATUS = NOT_SET.
 *
 * This function:
 * 1. Verifies the registered mobile number.
 * 2. Verifies the selected KEFG_ID.
 * 3. Confirms that no password has been created.
 * 4. Validates the supplied email address.
 * 5. Creates and emails a six-digit OTP.
 * 6. Does not update the database yet.
 * ============================================================
 */

function KGMIS_Mobile_RequestEmailOtp(
  mobileNumber,
  kefgId,
  emailAddress
) {

  const normalizedMobile =
    KGMIS_Login_NormalizeMobile_(
      mobileNumber
    );

  const safeKefgId =
    String(
      kefgId || ''
    )
      .trim()
      .toUpperCase();

  const email =
    KGMIS_OTP_NormalizeEmail_(
      emailAddress
    );


  if (!normalizedMobile) {
    return {
      success: false,
      status: 'INVALID_MOBILE',
      message:
        'Please enter a valid registered mobile number.'
    };
  }


  if (!safeKefgId) {
    return {
      success: false,
      status: 'MEMBER_REQUIRED',
      message:
        'The member account could not be identified.'
    };
  }


  if (
    !KGMIS_OTP_IsValidEmail_(
      email
    )
  ) {
    return {
      success: false,
      status: 'INVALID_EMAIL',
      message:
        'Please enter a valid email address.'
    };
  }


  /*
   * Verify that the submitted mobile number and KEFG_ID
   * belong to the same active login account.
   */

  const mobileLookup =
    KGMIS_Login_FindMemberByMobile(
      normalizedMobile
    );


  if (
    !mobileLookup ||
    mobileLookup.success !== true
  ) {
    return mobileLookup || {
      success: false,
      status: 'NO_MATCH',
      message:
        'The registered mobile number could not be verified.'
    };
  }


  let selectedMember = null;


  if (
    mobileLookup.status ===
    'SINGLE_MATCH'
  ) {

    const member =
      mobileLookup.member || {};

    if (
      String(
        member.kefgId || ''
      )
        .trim()
        .toUpperCase() !==
      safeKefgId
    ) {
      return {
        success: false,
        status: 'MEMBER_MISMATCH',
        message:
          'The selected member does not match the registered mobile number.'
      };
    }

    selectedMember =
      member;
  }


  if (
    mobileLookup.status ===
    'MULTIPLE_FAMILY_MATCH'
  ) {

    selectedMember =
      (
        mobileLookup.members || []
      ).find(
        function (member) {
          return (
            String(
              member.kefgId || ''
            )
              .trim()
              .toUpperCase() ===
            safeKefgId
          );
        }
      ) || null;


    if (!selectedMember) {
      return {
        success: false,
        status: 'MEMBER_MISMATCH',
        message:
          'The selected member does not match the registered mobile number.'
      };
    }
  }


  if (!selectedMember) {
    return {
      success: false,
      status: 'ACCOUNT_NOT_FOUND',
      message:
        'The selected login account could not be found.'
    };
  }


  const passwordStatus =
    String(
      selectedMember.passwordStatus || ''
    )
      .trim()
      .toUpperCase();


  if (
    passwordStatus ===
    'ACTIVE'
  ) {
    return {
      success: false,
      status: 'PASSWORD_ALREADY_SET',
      message:
        'A password has already been created for this account. Please use the normal password login.'
    };
  }


  if (
    passwordStatus !==
    'NOT_SET'
  ) {
    return {
      success: false,
      status: 'PASSWORD_UNAVAILABLE',
      message:
        'First-time password registration is not currently available for this account.'
    };
  }


  const lock =
    LockService.getScriptLock();

  lock.waitLock(
    KGMIS_OTP_CONFIG
      .SCRIPT_LOCK_WAIT_MILLISECONDS
  );


  try {

    KGMIS_OTP_CleanupExpiredRecords_();

    const now =
      Date.now();


    /*
     * Reuse the existing OTP global and email rate limits.
     */

    KGMIS_OTP_EnforceAndRecordRateLimits_(
      email,
      now
    );


    const properties =
      PropertiesService
        .getScriptProperties();


    const challengeKey =
      KGMIS_Mobile_GetEmailOtpPropertyKey_(
        safeKefgId
      );


    const existingChallenge =
      KGMIS_OTP_ParseJson_(
        properties.getProperty(
          challengeKey
        )
      );


    KGMIS_OTP_EnforceRequestLimits_(
      existingChallenge,
      now
    );


    const otp =
      KGMIS_OTP_GenerateNumericCode_(
        KGMIS_OTP_CONFIG.OTP_DIGITS
      );


    const challengeId =
      KGMIS_OTP_GenerateToken_();


    const otpHash =
      KGMIS_OTP_Hash_(
        [
          challengeId,
          safeKefgId,
          normalizedMobile,
          email,
          otp
        ].join('|')
      );


    const requestHistory =
      KGMIS_OTP_GetActiveRequestHistory_(
        existingChallenge,
        now
      );

    requestHistory.push(
      now
    );


    const challenge = {
      version: 1,

      purpose:
        'MOBILE_INITIAL_PASSWORD',

      challengeId:
        challengeId,

      kefgId:
        safeKefgId,

      registeredMobile:
        normalizedMobile,

      email:
        email,

      otpHash:
        otpHash,

      createdAt:
        now,

      expiresAt:
        now +
        KGMIS_OTP_CONFIG
          .OTP_VALID_MINUTES *
        60 *
        1000,

      lastSentAt:
        now,

      failedAttempts:
        0,

      requestHistory:
        requestHistory
    };


    properties.setProperty(
      challengeKey,
      JSON.stringify(
        challenge
      )
    );


    /*
     * Reuse the existing secure OTP email sender.
     */

    KGMIS_OTP_SendEmail_(
      {
        email:
          email,

        userName:
          'KEF Global Member'
      },
      otp
    );


    return {
      success: true,

      status:
        'EMAIL_OTP_SENT',

      challengeId:
        challengeId,

      maskedEmail:
        KGMIS_OTP_MaskEmail_(
          email
        ),

      expiresInSeconds:
        KGMIS_OTP_CONFIG
          .OTP_VALID_MINUTES *
        60,

      resendAfterSeconds:
        KGMIS_OTP_CONFIG
          .RESEND_WAIT_SECONDS,

      message:
        'A verification code has been sent to your email address.'
    };

  } finally {

    lock.releaseLock();
  }
}


/*
 * ============================================================
 * BUILD FIRST-TIME EMAIL OTP PROPERTY KEY
 * ============================================================
 */

function KGMIS_Mobile_GetEmailOtpPropertyKey_(
  kefgId
) {

  const safeKefgId =
    String(
      kefgId || ''
    )
      .trim()
      .toUpperCase();

  return (
    KGMIS_MOBILE_EMAIL_OTP_PROPERTY_PREFIX +
    KGMIS_OTP_ShortHash_(
      safeKefgId
    )
  );
}

/*
 * ============================================================
 * VERIFY FIRST-TIME EMAIL OTP
 *
 * PART 1 OF 2
 *
 * Paste Part 2 immediately after this part.
 * Do not add or remove any braces between the two parts.
 * ============================================================
 */

function KGMIS_Mobile_VerifyEmailOtp(
  challengeId,
  otpCode
) {

  const safeChallengeId =
    String(
      challengeId || ''
    ).trim();

  const safeOtp =
    String(
      otpCode || ''
    ).trim();


  if (!safeChallengeId) {

    return {
      success: false,
      status: 'CHALLENGE_REQUIRED',
      message:
        'The email-verification request is missing. Please request a new code.'
    };
  }


  const otpPattern =
    new RegExp(
      '^\\d{' +
      String(
        KGMIS_OTP_CONFIG.OTP_DIGITS
      ) +
      '}$'
    );


  if (
    !otpPattern.test(
      safeOtp
    )
  ) {

    return {
      success: false,
      status: 'INVALID_OTP_FORMAT',
      message:
        'Please enter the complete ' +
        String(
          KGMIS_OTP_CONFIG.OTP_DIGITS
        ) +
        '-digit verification code.'
    };
  }


  const lock =
    LockService.getScriptLock();


  lock.waitLock(
    KGMIS_OTP_CONFIG
      .SCRIPT_LOCK_WAIT_MILLISECONDS
  );


  try {

    const properties =
      PropertiesService
        .getScriptProperties();


    const allProperties =
      properties.getProperties();


    let challengeKey = '';

    let challenge = null;


    /*
     * Locate the first-time registration challenge by its
     * challengeId. The property key itself is based on KEFG_ID,
     * which is intentionally not supplied by the browser here.
     */

    Object.keys(
      allProperties
    ).some(
      function (propertyKey) {

        if (
          propertyKey.indexOf(
            KGMIS_MOBILE_EMAIL_OTP_PROPERTY_PREFIX
          ) !== 0
        ) {
          return false;
        }


        const candidateChallenge =
          KGMIS_OTP_ParseJson_(
            allProperties[
              propertyKey
            ]
          );


        if (
          !candidateChallenge ||
          String(
            candidateChallenge.challengeId ||
            ''
          ).trim() !==
          safeChallengeId
        ) {
          return false;
        }


        challengeKey =
          propertyKey;

        challenge =
          candidateChallenge;

        return true;
      }
    );


    if (
      !challengeKey ||
      !challenge
    ) {

      return {
        success: false,
        status: 'INVALID_CHALLENGE',
        message:
          'The verification request is invalid or has expired. Please request a new code.'
      };
    }


    const purpose =
      String(
        challenge.purpose || ''
      )
        .trim()
        .toUpperCase();


    if (
      purpose !==
      'MOBILE_INITIAL_PASSWORD'
    ) {

      properties.deleteProperty(
        challengeKey
      );


      return {
        success: false,
        status: 'INVALID_CHALLENGE',
        message:
          'The verification request is not valid for first-time password registration.'
      };
    }


    const now =
      Date.now();


    const expiresAt =
      Number(
        challenge.expiresAt || 0
      );


    if (
      !expiresAt ||
      now > expiresAt
    ) {

      properties.deleteProperty(
        challengeKey
      );


      return {
        success: false,
        status: 'OTP_EXPIRED',
        message:
          'The verification code has expired. Please request a new code.'
      };
    }


    const previousAttempts =
      Math.max(
        0,
        Number(
          challenge.failedAttempts || 0
        )
      );


    if (
      previousAttempts >=
      KGMIS_OTP_CONFIG
        .MAX_OTP_ATTEMPTS
    ) {

      properties.deleteProperty(
        challengeKey
      );


      return {
        success: false,
        status: 'TOO_MANY_OTP_ATTEMPTS',
        message:
          'Too many incorrect attempts. Please request a new verification code.'
      };
    }


    const kefgId =
      String(
        challenge.kefgId || ''
      )
        .trim()
        .toUpperCase();


    const registeredMobile =
      KGMIS_Login_NormalizeMobile_(
        challenge.registeredMobile
      );


    const email =
      KGMIS_OTP_NormalizeEmail_(
        challenge.email
      );


    if (
      !kefgId ||
      !registeredMobile ||
      !KGMIS_OTP_IsValidEmail_(
        email
      )
    ) {

      properties.deleteProperty(
        challengeKey
      );


      return {
        success: false,
        status: 'INVALID_CHALLENGE',
        message:
          'The verification request is incomplete. Please restart first-time registration.'
      };
    }


    const suppliedOtpHash =
      KGMIS_OTP_Hash_(
        [
          safeChallengeId,
          kefgId,
          registeredMobile,
          email,
          safeOtp
        ].join('|')
      );


    const otpVerified =
      KGMIS_OTP_SafeEquals_(
        String(
          challenge.otpHash || ''
        ),
        suppliedOtpHash
      );


    if (!otpVerified) {

      challenge.failedAttempts =
        previousAttempts + 1;


      const remainingAttempts =
        Math.max(
          0,
          KGMIS_OTP_CONFIG
            .MAX_OTP_ATTEMPTS -
          challenge.failedAttempts
        );


      if (
        challenge.failedAttempts >=
        KGMIS_OTP_CONFIG
          .MAX_OTP_ATTEMPTS
      ) {

        properties.deleteProperty(
          challengeKey
        );


        return {
          success: false,
          status:
            'TOO_MANY_OTP_ATTEMPTS',
          remainingAttempts:
            0,
          message:
            'Too many incorrect attempts. Please request a new verification code.'
        };
      }


      properties.setProperty(
        challengeKey,
        JSON.stringify(
          challenge
        )
      );


      return {
        success: false,
        status: 'INVALID_OTP',
        remainingAttempts:
          remainingAttempts,
        message:
          'The verification code is incorrect. ' +
          String(
            remainingAttempts
          ) +
          (
            remainingAttempts === 1
              ? ' attempt remains.'
              : ' attempts remain.'
          )
      };
    }


    /*
     * OTP is correct.
     * Part 2 creates a short-lived verification token and
     * returns the verified registration context.
     * Reconfirm that the mobile number and KEFG_ID still belong
     * to an active first-time-registration account.
     */

    const mobileLookup =
      KGMIS_Login_FindMemberByMobile(
        registeredMobile
      );


    if (
      !mobileLookup ||
      mobileLookup.success !== true
    ) {

      properties.deleteProperty(
        challengeKey
      );


      return {
        success: false,
        status: 'ACCOUNT_UNAVAILABLE',
        message:
          'The registered account could not be verified. Please restart first-time registration.'
      };
    }


    let selectedMember =
      null;


    if (
      mobileLookup.status ===
      'SINGLE_MATCH'
    ) {

      const member =
        mobileLookup.member || {};


      if (
        String(
          member.kefgId || ''
        )
          .trim()
          .toUpperCase() ===
        kefgId
      ) {
        selectedMember =
          member;
      }
    }


    if (
      mobileLookup.status ===
      'MULTIPLE_FAMILY_MATCH'
    ) {

      selectedMember =
        (
          mobileLookup.members || []
        ).find(
          function (member) {

            return (
              String(
                member.kefgId || ''
              )
                .trim()
                .toUpperCase() ===
              kefgId
            );
          }
        ) || null;
    }


    if (!selectedMember) {

      properties.deleteProperty(
        challengeKey
      );


      return {
        success: false,
        status: 'MEMBER_MISMATCH',
        message:
          'The selected member no longer matches the registered mobile number.'
      };
    }


    const passwordStatus =
      String(
        selectedMember.passwordStatus || ''
      )
        .trim()
        .toUpperCase();


    if (
      passwordStatus ===
      'ACTIVE'
    ) {

      properties.deleteProperty(
        challengeKey
      );


      return {
        success: false,
        status: 'PASSWORD_ALREADY_SET',
        message:
          'A password has already been created. Please use the normal password login.'
      };
    }


    if (
      passwordStatus !==
      'NOT_SET'
    ) {

      properties.deleteProperty(
        challengeKey
      );


      return {
        success: false,
        status: 'PASSWORD_UNAVAILABLE',
        message:
          'First-time password registration is not currently available for this account.'
      };
    }


    /*
     * Generate a separate short-lived verification token.
     *
     * The browser receives the original token.
     * Only its secure hash is stored in Script Properties.
     */

    const verificationToken =
      KGMIS_OTP_GenerateToken_() +
      KGMIS_OTP_GenerateToken_();


    const verificationTokenHash =
      KGMIS_OTP_Hash_(
        [
          safeChallengeId,
          kefgId,
          registeredMobile,
          email,
          verificationToken
        ].join('|')
      );


    const verificationValidMinutes =
      10;


    challenge.status =
      'EMAIL_VERIFIED';

    challenge.verifiedAt =
      now;

    challenge.verificationTokenHash =
      verificationTokenHash;

    challenge.verificationExpiresAt =
      now +
      verificationValidMinutes *
      60 *
      1000;

    challenge.failedAttempts =
      0;

    /*
     * The OTP must not remain usable after successful
     * verification.
     */

    challenge.otpHash =
      '';


    properties.setProperty(
      challengeKey,
      JSON.stringify(
        challenge
      )
    );


    return {
      success: true,

      status:
        'EMAIL_VERIFIED',

      challengeId:
        safeChallengeId,

      verificationToken:
        verificationToken,

      kefgId:
        kefgId,

      maskedEmail:
        KGMIS_OTP_MaskEmail_(
          email
        ),

      verificationExpiresInSeconds:
        verificationValidMinutes *
        60,

      message:
        'Email verified successfully. You may now create your password.'
    };

  } finally {

    lock.releaseLock();
  }
}

/*
 * ============================================================
 * CREATE INITIAL PASSWORD AFTER EMAIL VERIFICATION
 *
 * PART 1 OF 3
 *
 * Paste Part 2 immediately after this part.
 * Do not add any closing braces between the parts.
 * ============================================================
 */

function KGMIS_Mobile_CreateInitialPassword(
  challengeId,
  verificationToken,
  password,
  confirmPassword
) {

  const safeChallengeId =
    String(
      challengeId || ''
    ).trim();

  const safeVerificationToken =
    String(
      verificationToken || ''
    ).trim();

  const safePassword =
    String(
      password || ''
    );

  const safeConfirmPassword =
    String(
      confirmPassword || ''
    );


  /*
   * ----------------------------------------------------------
   * BASIC REQUEST VALIDATION
   * ----------------------------------------------------------
   */

  if (!safeChallengeId) {

    return {
      success: false,
      status: 'CHALLENGE_REQUIRED',
      message:
        'The email-verification request is missing. Please restart first-time registration.'
    };
  }


  if (!safeVerificationToken) {

    return {
      success: false,
      status: 'VERIFICATION_TOKEN_REQUIRED',
      message:
        'The verified email session is missing. Please verify your email again.'
    };
  }


  if (!safePassword) {

    return {
      success: false,
      status: 'PASSWORD_REQUIRED',
      message:
        'Please enter your new password.'
    };
  }


  if (!safeConfirmPassword) {

    return {
      success: false,
      status: 'CONFIRM_PASSWORD_REQUIRED',
      message:
        'Please confirm your new password.'
    };
  }


  if (
    safePassword !==
    safeConfirmPassword
  ) {

    return {
      success: false,
      status: 'PASSWORD_MISMATCH',
      message:
        'The password and confirmation password do not match.'
    };
  }


  /*
   * Apply the existing KGMIS password policy.
   *
   * This throws a clear validation error when the password
   * does not meet the required security rules.
   */

  try {

    KGMIS_Login_ValidatePassword_(
      safePassword
    );

  } catch (error) {

    return {
      success: false,
      status: 'INVALID_PASSWORD',
      message:
        error &&
        error.message
          ? error.message
          : 'The password does not meet the required security rules.'
    };
  }


  const lock =
    LockService.getScriptLock();


  lock.waitLock(
    30000
  );


  try {

    const properties =
      PropertiesService
        .getScriptProperties();


    const allProperties =
      properties.getProperties();


    let challengeKey =
      '';

    let challenge =
      null;


    /*
     * Locate the verified registration challenge.
     */

    Object.keys(
      allProperties
    ).some(
      function (propertyKey) {

        if (
          propertyKey.indexOf(
            KGMIS_MOBILE_EMAIL_OTP_PROPERTY_PREFIX
          ) !== 0
        ) {
          return false;
        }


        const candidateChallenge =
          KGMIS_OTP_ParseJson_(
            allProperties[
              propertyKey
            ]
          );


        if (
          !candidateChallenge ||
          String(
            candidateChallenge.challengeId ||
            ''
          ).trim() !==
          safeChallengeId
        ) {
          return false;
        }


        challengeKey =
          propertyKey;

        challenge =
          candidateChallenge;

        return true;
      }
    );


    if (
      !challengeKey ||
      !challenge
    ) {

      return {
        success: false,
        status: 'INVALID_CHALLENGE',
        message:
          'The verified email session is invalid or has expired. Please restart first-time registration.'
      };
    }


    /*
     * ----------------------------------------------------------
     * VERIFY CHALLENGE PURPOSE AND STATUS
     * ----------------------------------------------------------
     */

    const purpose =
      String(
        challenge.purpose || ''
      )
        .trim()
        .toUpperCase();


    if (
      purpose !==
      'MOBILE_INITIAL_PASSWORD'
    ) {

      properties.deleteProperty(
        challengeKey
      );


      return {
        success: false,
        status: 'INVALID_CHALLENGE',
        message:
          'This verification request cannot be used to create a password.'
      };
    }


    const challengeStatus =
      String(
        challenge.status || ''
      )
        .trim()
        .toUpperCase();


    if (
      challengeStatus !==
      'EMAIL_VERIFIED'
    ) {

      return {
        success: false,
        status: 'EMAIL_NOT_VERIFIED',
        message:
          'The email address has not been verified. Please complete email verification first.'
      };
    }


    const now =
      Date.now();


    const verificationExpiresAt =
      Number(
        challenge.verificationExpiresAt ||
        0
      );


    if (
      !verificationExpiresAt ||
      now >
      verificationExpiresAt
    ) {

      properties.deleteProperty(
        challengeKey
      );


      return {
        success: false,
        status: 'VERIFICATION_EXPIRED',
        message:
          'The verified email session has expired. Please request and verify a new code.'
      };
    }


    /*
     * ----------------------------------------------------------
     * VERIFY THE SHORT-LIVED VERIFICATION TOKEN
     * ----------------------------------------------------------
     */

    const kefgId =
      String(
        challenge.kefgId || ''
      )
        .trim()
        .toUpperCase();


    const registeredMobile =
      KGMIS_Login_NormalizeMobile_(
        challenge.registeredMobile
      );


    const verifiedEmail =
      KGMIS_OTP_NormalizeEmail_(
        challenge.email
      );


    if (
      !kefgId ||
      !registeredMobile ||
      !KGMIS_OTP_IsValidEmail_(
        verifiedEmail
      )
    ) {

      properties.deleteProperty(
        challengeKey
      );


      return {
        success: false,
        status: 'INVALID_CHALLENGE',
        message:
          'The verified registration information is incomplete. Please restart first-time registration.'
      };
    }


    const suppliedVerificationTokenHash =
      KGMIS_OTP_Hash_(
        [
          safeChallengeId,
          kefgId,
          registeredMobile,
          verifiedEmail,
          safeVerificationToken
        ].join('|')
      );


    const verificationTokenValid =
      KGMIS_OTP_SafeEquals_(
        String(
          challenge.verificationTokenHash ||
          ''
        ),
        suppliedVerificationTokenHash
      );


    if (!verificationTokenValid) {

      return {
        success: false,
        status: 'INVALID_VERIFICATION_TOKEN',
        message:
          'The verified email session is invalid. Please verify your email again.'
      };
    }


    /*
     * Verification token is valid.
     * Part 2 will locate and update the KGMIS_LOGIN record.
     */
        /*
     * ----------------------------------------------------------
     * LOCATE THE KGMIS_LOGIN ACCOUNT
     * ----------------------------------------------------------
     */

    const loginSheet =
      KGMIS_Login_GetSheet_(
        'KGMIS_LOGIN'
      );

    const loginLastRow =
      loginSheet.getLastRow();

    const loginLastColumn =
      loginSheet.getLastColumn();


    if (
      loginLastRow < 2 ||
      loginLastColumn < 1
    ) {

      return {
        success: false,
        status: 'LOGIN_REGISTRY_EMPTY',
        message:
          'The KGMIS login registry does not contain any accounts.'
      };
    }


    const loginValues =
      loginSheet
        .getRange(
          1,
          1,
          loginLastRow,
          loginLastColumn
        )
        .getValues();


    const loginHeaders =
      loginValues[0].map(
        function (header) {
          return String(
            header || ''
          )
            .trim()
            .toUpperCase();
        }
      );


    const loginHeaderMap =
      {};


    loginHeaders.forEach(
      function (header, index) {

        if (header) {
          loginHeaderMap[header] =
            index;
        }
      }
    );


    const requiredLoginHeaders = [
      'KEFG_ID',
      'REGISTERED_MOBILE',
      'PASSWORD_HASH',
      'PASSWORD_SALT',
      'PASSWORD_STATUS',
      'FAILED_ATTEMPTS',
      'LAST_FAILED_LOGIN',
      'LOCKED_UNTIL',
      'PASSWORD_CHANGED_ON',
      'UPDATED_ON',
      'STATUS'
    ];


    for (
      let headerIndex = 0;
      headerIndex <
        requiredLoginHeaders.length;
      headerIndex++
    ) {

      const requiredHeader =
        requiredLoginHeaders[
          headerIndex
        ];


      if (
        !Object.prototype
          .hasOwnProperty.call(
            loginHeaderMap,
            requiredHeader
          )
      ) {

        return {
          success: false,
          status: 'LOGIN_HEADER_MISSING',
          message:
            'Missing KGMIS_LOGIN header: ' +
            requiredHeader
        };
      }
    }


    let loginRowIndex =
      -1;


    for (
      let rowIndex = 1;
      rowIndex <
        loginValues.length;
      rowIndex++
    ) {

      const rowKefgId =
        String(
          loginValues[rowIndex][
            loginHeaderMap.KEFG_ID
          ] || ''
        )
          .trim()
          .toUpperCase();


      if (
        rowKefgId ===
        kefgId
      ) {

        loginRowIndex =
          rowIndex;

        break;
      }
    }


    if (
      loginRowIndex < 1
    ) {

      return {
        success: false,
        status: 'ACCOUNT_NOT_FOUND',
        message:
          'The selected KGMIS login account could not be found.'
      };
    }


    const loginRow =
      loginValues[
        loginRowIndex
      ];


    const loginSheetRowNumber =
      loginRowIndex + 1;


    const accountStatus =
      String(
        loginRow[
          loginHeaderMap.STATUS
        ] || ''
      )
        .trim()
        .toUpperCase();


    if (
      accountStatus !==
      'ACTIVE'
    ) {

      return {
        success: false,
        status: 'ACCOUNT_INACTIVE',
        message:
          'This login account is not active.'
      };
    }


    const storedMobile =
      KGMIS_Login_NormalizeMobile_(
        loginRow[
          loginHeaderMap
            .REGISTERED_MOBILE
        ]
      );


    if (
      !storedMobile ||
      storedMobile !==
      registeredMobile
    ) {

      return {
        success: false,
        status: 'MEMBER_MISMATCH',
        message:
          'The verified member does not match the registered mobile number.'
      };
    }


    const existingPasswordStatus =
      String(
        loginRow[
          loginHeaderMap
            .PASSWORD_STATUS
        ] || ''
      )
        .trim()
        .toUpperCase();


    if (
      existingPasswordStatus ===
      'ACTIVE'
    ) {

      properties.deleteProperty(
        challengeKey
      );


      return {
        success: false,
        status: 'PASSWORD_ALREADY_SET',
        message:
          'A password has already been created. Please use normal password login.'
      };
    }


    if (
      existingPasswordStatus !==
      'NOT_SET'
    ) {

      return {
        success: false,
        status: 'PASSWORD_UNAVAILABLE',
        message:
          'Password creation is not available for this account.'
      };
    }


    /*
     * ----------------------------------------------------------
     * CREATE AND STORE THE PASSWORD
     * ----------------------------------------------------------
     */

    const passwordSalt =
      KGMIS_Login_CreateSalt_();


    const passwordHash =
      KGMIS_Login_HashPassword_(
        safePassword,
        passwordSalt
      );


    const updatedOn =
      new Date();


    loginSheet
      .getRange(
        loginSheetRowNumber,
        loginHeaderMap
          .PASSWORD_HASH + 1
      )
      .setValue(
        passwordHash
      );


    loginSheet
      .getRange(
        loginSheetRowNumber,
        loginHeaderMap
          .PASSWORD_SALT + 1
      )
      .setValue(
        passwordSalt
      );


    loginSheet
      .getRange(
        loginSheetRowNumber,
        loginHeaderMap
          .PASSWORD_STATUS + 1
      )
      .setValue(
        'ACTIVE'
      );


    loginSheet
      .getRange(
        loginSheetRowNumber,
        loginHeaderMap
          .FAILED_ATTEMPTS + 1
      )
      .setValue(
        0
      );


    loginSheet
      .getRange(
        loginSheetRowNumber,
        loginHeaderMap
          .LAST_FAILED_LOGIN + 1
      )
      .clearContent();


    loginSheet
      .getRange(
        loginSheetRowNumber,
        loginHeaderMap
          .LOCKED_UNTIL + 1
      )
      .clearContent();


    loginSheet
      .getRange(
        loginSheetRowNumber,
        loginHeaderMap
          .PASSWORD_CHANGED_ON + 1
      )
      .setValue(
        updatedOn
      )
      .setNumberFormat(
        'dd-mmm-yyyy hh:mm'
      );


    loginSheet
      .getRange(
        loginSheetRowNumber,
        loginHeaderMap
          .UPDATED_ON + 1
      )
      .setValue(
        updatedOn
      )
      .setNumberFormat(
        'dd-mmm-yyyy hh:mm'
      );


    /*
     * ----------------------------------------------------------
     * UPDATE VERIFIED EMAIL IN MASTER DATABASE
     * ----------------------------------------------------------
     */

    const masterSheet =
      KGMIS_Login_GetSheet_(
        'KGMIS_MASTER_DATABASE_v1.0'
      );


    const masterLastRow =
      masterSheet.getLastRow();

    const masterLastColumn =
      masterSheet.getLastColumn();


    if (
      masterLastRow < 2 ||
      masterLastColumn < 1
    ) {

      return {
        success: false,
        status: 'MASTER_DATABASE_EMPTY',
        message:
          'The KGMIS master database does not contain member records.'
      };
    }


    const masterValues =
      masterSheet
        .getRange(
          1,
          1,
          masterLastRow,
          masterLastColumn
        )
        .getValues();


    const masterHeaders =
      masterValues[0].map(
        function (header) {
          return String(
            header || ''
          )
            .trim()
            .toUpperCase();
        }
      );


    const masterHeaderMap =
      {};


    masterHeaders.forEach(
      function (header, index) {

        if (header) {
          masterHeaderMap[header] =
            index;
        }
      }
    );


    if (
      !Object.prototype
        .hasOwnProperty.call(
          masterHeaderMap,
          'KEFG_ID'
        ) ||
      !Object.prototype
        .hasOwnProperty.call(
          masterHeaderMap,
          'MEMBER_EMAIL'
        )
    ) {

      return {
        success: false,
        status: 'MASTER_HEADER_MISSING',
        message:
          'The master database requires KEFG_ID and MEMBER_EMAIL headers.'
      };
    }


    let masterRowIndex =
      -1;


    for (
      let rowIndex = 1;
      rowIndex <
        masterValues.length;
      rowIndex++
    ) {

      const rowKefgId =
        String(
          masterValues[rowIndex][
            masterHeaderMap.KEFG_ID
          ] || ''
        )
          .trim()
          .toUpperCase();


      if (
        rowKefgId ===
        kefgId
      ) {

        masterRowIndex =
          rowIndex;

        break;
      }
    }


    if (
      masterRowIndex < 1
    ) {

      return {
        success: false,
        status: 'MASTER_MEMBER_NOT_FOUND',
        message:
          'The member record could not be found in the master database.'
      };
    }


    const masterSheetRowNumber =
      masterRowIndex + 1;


    masterSheet
      .getRange(
        masterSheetRowNumber,
        masterHeaderMap
          .MEMBER_EMAIL + 1
      )
      .setValue(
        verifiedEmail
      );

    /*
 * ----------------------------------------------------------
 * UPDATE VERIFIED EMAIL IN KGMIS_LOGIN
 * ----------------------------------------------------------
 */

if (
  Object.prototype
    .hasOwnProperty.call(
      loginHeaderMap,
      'REGISTERED_EMAIL'
    )
) {

  loginSheet
    .getRange(
      loginSheetRowNumber,
      loginHeaderMap
        .REGISTERED_EMAIL + 1
    )
    .setValue(
      verifiedEmail
    );
}


if (
  Object.prototype
    .hasOwnProperty.call(
      loginHeaderMap,
      'EMAIL_VERIFIED_ON'
    )
) {

  loginSheet
    .getRange(
      loginSheetRowNumber,
      loginHeaderMap
        .EMAIL_VERIFIED_ON + 1
    )
    .setValue(
      updatedOn
    )
    .setNumberFormat(
      'dd-mmm-yyyy hh:mm'
    );
}


    if (
      Object.prototype
        .hasOwnProperty.call(
          masterHeaderMap,
          'PROFILE_LAST_UPDATED'
        )
    ) {

      masterSheet
        .getRange(
          masterSheetRowNumber,
          masterHeaderMap
            .PROFILE_LAST_UPDATED + 1
        )
        .setValue(
          updatedOn
        )
        .setNumberFormat(
          'dd-mmm-yyyy hh:mm'
        );
    }


    SpreadsheetApp.flush();


    /*
     * Password and verified email have now been saved.
     * Part 3 removes the challenge and performs automatic login.
     */
        /*
     * ----------------------------------------------------------
     * COMPLETE FIRST-TIME REGISTRATION
     * ----------------------------------------------------------
     */

    const successfulLogin =
      new Date();


    /*
     * Record the first successful login when the column exists.
     */

    if (
      Object.prototype
        .hasOwnProperty.call(
          loginHeaderMap,
          'LAST_LOGIN'
        )
    ) {

      loginSheet
        .getRange(
          loginSheetRowNumber,
          loginHeaderMap.LAST_LOGIN + 1
        )
        .setValue(
          successfulLogin
        )
        .setNumberFormat(
          'dd-mmm-yyyy hh:mm'
        );
    }


    /*
     * Read the member identity required for the session.
     */

    const memberName =
      Object.prototype
        .hasOwnProperty.call(
          loginHeaderMap,
          'MEMBER_NAME'
        )
        ? String(
            loginRow[
              loginHeaderMap.MEMBER_NAME
            ] || ''
          ).trim()
        : 'KEF Global Member';


    const familyId =
      Object.prototype
        .hasOwnProperty.call(
          loginHeaderMap,
          'FAMILY_ID'
        )
        ? String(
            loginRow[
              loginHeaderMap.FAMILY_ID
            ] || ''
          )
            .trim()
            .toUpperCase()
        : '';


    /*
     * Create the same shared 8-hour KGMIS session used by
     * normal Mobile Password Login.
     *
     * Do not call KGMIS_Mobile_Login() here because this
     * function already holds the script lock.
     */

    const effectiveUser =
      KGMIS_GetEffectiveUserByEmail_(
      verifiedEmail,
      memberName
      );

    const sessionUser = {
      authMethod:
        'MOBILE_PASSWORD',

      email:
        effectiveUser.email,

      kefgId:
        kefgId,

      familyId:
        familyId,

      registeredMobile:
        registeredMobile,

      userName:
        effectiveUser.userName ||
        memberName,

      role:
        effectiveUser.role,

      status:
        effectiveUser.status
    };


    const session =
      KGMIS_OTP_CreateSession_(
        sessionUser
      );


    /*
     * The OTP and verification token are single-use.
     */

    properties.deleteProperty(
      challengeKey
    );


    SpreadsheetApp.flush();


    return {
      success:
        true,

      status:
        'LOGIN_SUCCESS',

      authenticated:
        true,

      registrationCompleted:
        true,

      sessionToken:
        session.sessionToken,

      expiresAt:
        session.expiresAt,

      expiresInSeconds:
        Math.floor(
          (
            session.expiresAt -
            Date.now()
          ) /
          1000
        ),

      registeredMobile:
        registeredMobile,

      verifiedEmail:
        verifiedEmail,

      user: {
        email:
          sessionUser.email,

        userName:
          sessionUser.userName,

        role:
          sessionUser.role,

        status:
          sessionUser.status,

        kefgId:
          sessionUser.kefgId,

        familyId:
          sessionUser.familyId,

        registeredMobile:
          sessionUser.registeredMobile,

        authMethod:
          sessionUser.authMethod
      },

      permissions:
        KGMIS_OTP_GetUserPermissionProfile_(
          sessionUser.role
        ),

      modules:
        KGMIS_OTP_GetUserModuleProfile_(
          sessionUser.role
        ),

      message:
        'Your password has been created and you are now signed in.'
    };

  } finally {

    lock.releaseLock();
  }
}

/*
 * ============================================================
 * SYNCHRONISE EFFECTIVE ROLES INTO KGMIS_LOGIN
 *
 * Rules:
 * - ACTIVE entry in KGMIS_ACCESS_CONTROL:
 *     use the configured role.
 * - Missing or INACTIVE access-control entry:
 *     DIRECTORY_USER.
 * ============================================================
 */

function KGMIS_Login_SyncEffectiveRoles() {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();


  const loginSheet =
    spreadsheet.getSheetByName(
      'KGMIS_LOGIN'
    );

  const accessSheet =
    spreadsheet.getSheetByName(
      'KGMIS_ACCESS_CONTROL'
    );


  if (!loginSheet) {
    throw new Error(
      'KGMIS_LOGIN sheet was not found.'
    );
  }


  if (!accessSheet) {
    throw new Error(
      'KGMIS_ACCESS_CONTROL sheet was not found.'
    );
  }


  /*
   * ----------------------------------------------------------
   * READ ACCESS CONTROL
   * ----------------------------------------------------------
   */

  const accessValues =
    accessSheet
      .getDataRange()
      .getDisplayValues();


  if (accessValues.length < 2) {
    throw new Error(
      'KGMIS_ACCESS_CONTROL does not contain user records.'
    );
  }


  const accessHeaders =
    accessValues[0].map(
      function (header) {
        return String(
          header || ''
        )
          .trim()
          .toUpperCase();
      }
    );


  const accessHeaderMap = {};


  accessHeaders.forEach(
    function (header, index) {
      if (header) {
        accessHeaderMap[header] =
          index;
      }
    }
  );


  [
    'EMAIL',
    'ROLE',
    'STATUS'
  ].forEach(
    function (header) {

      if (
        !Object.prototype
          .hasOwnProperty.call(
            accessHeaderMap,
            header
          )
      ) {
        throw new Error(
          'Missing KGMIS_ACCESS_CONTROL header: ' +
          header
        );
      }

    }
  );


  const activeRoleByEmail =
    new Map();


  for (
    let rowIndex = 1;
    rowIndex < accessValues.length;
    rowIndex++
  ) {

    const row =
      accessValues[rowIndex];


    const email =
      KGMIS_OTP_NormalizeEmail_(
        row[
          accessHeaderMap.EMAIL
        ]
      );


    const status =
      String(
        row[
          accessHeaderMap.STATUS
        ] || ''
      )
        .trim()
        .toUpperCase();


    const role =
      String(
        row[
          accessHeaderMap.ROLE
        ] || ''
      )
        .trim()
        .toUpperCase();


    if (
      !email ||
      status !== 'ACTIVE'
    ) {
      continue;
    }


    try {

      KGMIS_ValidateRole_(
        role
      );

    } catch (error) {

      continue;
    }


    activeRoleByEmail.set(
      email,
      role
    );
  }


  /*
   * ----------------------------------------------------------
   * READ LOGIN REGISTRY
   * ----------------------------------------------------------
   */

  const loginLastRow =
    loginSheet.getLastRow();

  const loginLastColumn =
    loginSheet.getLastColumn();


  if (
    loginLastRow < 2 ||
    loginLastColumn < 1
  ) {
    throw new Error(
      'KGMIS_LOGIN does not contain login accounts.'
    );
  }


  const loginValues =
    loginSheet
      .getRange(
        1,
        1,
        loginLastRow,
        loginLastColumn
      )
      .getDisplayValues();


  const loginHeaders =
    loginValues[0].map(
      function (header) {
        return String(
          header || ''
        )
          .trim()
          .toUpperCase();
      }
    );


  const loginHeaderMap = {};


  loginHeaders.forEach(
    function (header, index) {
      if (header) {
        loginHeaderMap[header] =
          index;
      }
    }
  );


  [
    'REGISTERED_EMAIL',
    'EFFECTIVE_ROLE'
  ].forEach(
    function (header) {

      if (
        !Object.prototype
          .hasOwnProperty.call(
            loginHeaderMap,
            header
          )
      ) {
        throw new Error(
          'Missing KGMIS_LOGIN header: ' +
          header
        );
      }

    }
  );


  const roleOutput = [];

  let privilegedAccounts = 0;
  let directoryUsers = 0;


  for (
    let rowIndex = 1;
    rowIndex < loginValues.length;
    rowIndex++
  ) {

    const row =
      loginValues[rowIndex];


    const registeredEmail =
      KGMIS_OTP_NormalizeEmail_(
        row[
          loginHeaderMap.REGISTERED_EMAIL
        ]
      );


    const effectiveRole =
      (
        registeredEmail &&
        activeRoleByEmail.has(
          registeredEmail
        )
      )
        ? activeRoleByEmail.get(
            registeredEmail
          )
        : 'DIRECTORY_USER';


    if (
      effectiveRole ===
      'DIRECTORY_USER'
    ) {
      directoryUsers++;
    } else {
      privilegedAccounts++;
    }


    roleOutput.push([
      effectiveRole
    ]);
  }


  loginSheet
    .getRange(
      2,
      loginHeaderMap.EFFECTIVE_ROLE + 1,
      roleOutput.length,
      1
    )
    .setValues(
      roleOutput
    );


  SpreadsheetApp.flush();


  const result = {
    success: true,
    accountsUpdated:
      roleOutput.length,
    privilegedAccounts:
      privilegedAccounts,
    directoryUsers:
      directoryUsers
  };


  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );


  return result;
}

/*
 * ============================================================
 * READ DISPLAY VALUES WITH RETRY
 *
 * Handles occasional temporary Google Spreadsheet service
 * failures without changing the authentication architecture.
 * ============================================================
 */

function KGMIS_Login_ReadDisplayValuesWithRetry_(
  sheet,
  startRow,
  startColumn,
  numberOfRows,
  numberOfColumns
) {

  const maximumAttempts = 3;

  let lastError = null;


  for (
    let attempt = 1;
    attempt <= maximumAttempts;
    attempt++
  ) {

    try {

      return sheet
        .getRange(
          startRow,
          startColumn,
          numberOfRows,
          numberOfColumns
        )
        .getDisplayValues();

    } catch (error) {

      lastError = error;

      console.warn(
        'Spreadsheet read attempt ' +
        String(attempt) +
        ' failed: ' +
        String(
          error && error.message
            ? error.message
            : error
        )
      );


      if (attempt < maximumAttempts) {

        Utilities.sleep(
          attempt * 400
        );

      }

    }

  }


  throw new Error(
    'The KGMIS login registry could not be read after ' +
    String(maximumAttempts) +
    ' attempts. ' +
    String(
      lastError && lastError.message
        ? lastError.message
        : lastError
    )
  );
}
/*
 * ============================================================
 * SYNCHRONISE ONE MEMBER INTO KGMIS_LOGIN
 *
 * Used after Add New Member creates the final Master Database
 * record.
 *
 * Rules:
 * - Reads identity and contact data from the Master Database.
 * - Uses MEMBER_MOBILE, otherwise MEMBER_WHATSAPP.
 * - Uses the existing KGMIS mobile normalisation rule.
 * - Creates a new ACTIVE login account when KEFG_ID is absent.
 * - Updates identity/contact fields when KEFG_ID already exists.
 * - NEVER overwrites PASSWORD_HASH, PASSWORD_SALT,
 *   PASSWORD_STATUS, PASSWORD_CHANGED_ON or LAST_LOGIN for an
 *   existing account.
 * - New accounts start with PASSWORD_STATUS = NOT_SET.
 * ============================================================
 */
function KGMIS_Login_SyncMemberAccount(
  kefgId
) {

  const safeKefgId =
    String(kefgId || '')
      .trim()
      .toUpperCase();

  if (!safeKefgId) {
    throw new Error(
      'KEFG_ID is required for login-account synchronisation.'
    );
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(
    30000
  );

  try {

    const masterSheet =
      KGMIS_Login_GetSheet_(
        'KGMIS_MASTER_DATABASE_v1.0'
      );

    const loginSheet =
      KGMIS_Login_GetSheet_(
        'KGMIS_LOGIN'
      );

    /*
     * --------------------------------------------------------
     * Read the final Master Database record.
     * --------------------------------------------------------
     */
    const masterLastRow =
      masterSheet.getLastRow();

    const masterLastColumn =
      masterSheet.getLastColumn();

    if (
      masterLastRow < 2 ||
      masterLastColumn < 1
    ) {
      throw new Error(
        'The master database does not contain member records.'
      );
    }

    const masterValues =
      masterSheet
        .getRange(
          1,
          1,
          masterLastRow,
          masterLastColumn
        )
        .getDisplayValues();

    const masterHeaders =
      masterValues[0].map(
        function (header) {
          return String(header || '')
            .trim()
            .toUpperCase();
        }
      );

    const masterHeaderMap = {};

    masterHeaders.forEach(
      function (header, index) {
        if (header) {
          masterHeaderMap[header] =
            index;
        }
      }
    );

    [
      'KEFG_ID',
      'FAMILY_ID',
      'MEMBER_NAME',
      'RECORD_STATUS',
      'MEMBER_MOBILE',
      'MEMBER_WHATSAPP'
    ].forEach(
      function (header) {
        if (
          !Object.prototype
            .hasOwnProperty.call(
              masterHeaderMap,
              header
            )
        ) {
          throw new Error(
            'Missing master database header: ' +
            header
          );
        }
      }
    );

    let masterRow = null;

    for (
      let rowIndex = 1;
      rowIndex < masterValues.length;
      rowIndex++
    ) {

      const rowKefgId =
        String(
          masterValues[rowIndex][
            masterHeaderMap.KEFG_ID
          ] || ''
        )
          .trim()
          .toUpperCase();

      if (rowKefgId === safeKefgId) {
        masterRow =
          masterValues[rowIndex];
        break;
      }
    }

    if (!masterRow) {
      throw new Error(
        'No Master Database record was found for ' +
        safeKefgId +
        '.'
      );
    }

    const recordStatus =
      String(
        masterRow[
          masterHeaderMap.RECORD_STATUS
        ] || ''
      )
        .trim()
        .toUpperCase();

    if (
      recordStatus &&
      recordStatus !== 'ACTIVE'
    ) {
      throw new Error(
        'The Master Database record for ' +
        safeKefgId +
        ' is not ACTIVE.'
      );
    }

    const familyId =
      String(
        masterRow[
          masterHeaderMap.FAMILY_ID
        ] || ''
      )
        .trim()
        .toUpperCase();

    const memberName =
      String(
        masterRow[
          masterHeaderMap.MEMBER_NAME
        ] || ''
      ).trim();

    const memberMobile =
      String(
        masterRow[
          masterHeaderMap.MEMBER_MOBILE
        ] || ''
      ).trim();

    const memberWhatsApp =
      String(
        masterRow[
          masterHeaderMap.MEMBER_WHATSAPP
        ] || ''
      ).trim();

    const sourceMobile =
      memberMobile ||
      memberWhatsApp;

    const registeredMobile =
      KGMIS_Login_NormalizeMobile_(
        sourceMobile
      );

    if (!registeredMobile) {
      throw new Error(
        'No valid mobile number is available for ' +
        safeKefgId +
        '.'
      );
    }

    const registeredEmail =
      Object.prototype
        .hasOwnProperty.call(
          masterHeaderMap,
          'MEMBER_EMAIL'
        )
        ? String(
            masterRow[
              masterHeaderMap.MEMBER_EMAIL
            ] || ''
          )
            .trim()
            .toLowerCase()
        : '';

    /*
     * --------------------------------------------------------
     * Read and validate KGMIS_LOGIN.
     * --------------------------------------------------------
     */
    const loginLastColumn =
      loginSheet.getLastColumn();

    if (loginLastColumn < 1) {
      throw new Error(
        'The KGMIS_LOGIN sheet does not contain headers.'
      );
    }

    const loginLastRow =
      loginSheet.getLastRow();

    const loginHeaders =
      loginSheet
        .getRange(
          1,
          1,
          1,
          loginLastColumn
        )
        .getDisplayValues()[0]
        .map(
          function (header) {
            return String(header || '')
              .trim()
              .toUpperCase();
          }
        );

    const loginHeaderMap = {};

    loginHeaders.forEach(
      function (header, index) {
        if (header) {
          loginHeaderMap[header] =
            index;
        }
      }
    );

    const requiredLoginHeaders = [
      'LOGIN_ID',
      'KEFG_ID',
      'FAMILY_ID',
      'MEMBER_NAME',
      'REGISTERED_MOBILE',
      'PASSWORD_HASH',
      'PASSWORD_SALT',
      'PASSWORD_STATUS',
      'FAILED_ATTEMPTS',
      'LOCKED_UNTIL',
      'LAST_LOGIN',
      'PASSWORD_CHANGED_ON',
      'CREATED_ON',
      'UPDATED_ON',
      'STATUS',
      'REMARKS'
    ];

    requiredLoginHeaders.forEach(
      function (header) {
        if (
          !Object.prototype
            .hasOwnProperty.call(
              loginHeaderMap,
              header
            )
        ) {
          throw new Error(
            'Missing KGMIS_LOGIN header: ' +
            header
          );
        }
      }
    );

    const loginValues =
      loginLastRow >= 2
        ? loginSheet
            .getRange(
              2,
              1,
              loginLastRow - 1,
              loginLastColumn
            )
            .getValues()
        : [];

    /*
     * --------------------------------------------------------
     * If KEFG_ID already exists, update identity/contact only.
     * Password and authentication history are preserved.
     * --------------------------------------------------------
     */
    let existingRowNumber = 0;

    for (
      let rowIndex = 0;
      rowIndex < loginValues.length;
      rowIndex++
    ) {

      const rowKefgId =
        String(
          loginValues[rowIndex][
            loginHeaderMap.KEFG_ID
          ] || ''
        )
          .trim()
          .toUpperCase();

      if (rowKefgId === safeKefgId) {
        existingRowNumber =
          rowIndex + 2;
        break;
      }
    }

    const now =
      new Date();

    if (existingRowNumber) {

      loginSheet
        .getRange(
          existingRowNumber,
          loginHeaderMap.FAMILY_ID + 1
        )
        .setValue(
          familyId
        );

      loginSheet
        .getRange(
          existingRowNumber,
          loginHeaderMap.MEMBER_NAME + 1
        )
        .setValue(
          memberName
        );

      loginSheet
        .getRange(
          existingRowNumber,
          loginHeaderMap.REGISTERED_MOBILE + 1
        )
        .setValue(
          registeredMobile
        );

      if (
        registeredEmail &&
        Object.prototype
          .hasOwnProperty.call(
            loginHeaderMap,
            'REGISTERED_EMAIL'
          )
      ) {
        loginSheet
          .getRange(
            existingRowNumber,
            loginHeaderMap.REGISTERED_EMAIL + 1
          )
          .setValue(
            registeredEmail
          );
      }

      loginSheet
        .getRange(
          existingRowNumber,
          loginHeaderMap.STATUS + 1
        )
        .setValue(
          'ACTIVE'
        );

      loginSheet
        .getRange(
          existingRowNumber,
          loginHeaderMap.UPDATED_ON + 1
        )
        .setValue(
          now
        )
        .setNumberFormat(
          'dd-mmm-yyyy hh:mm'
        );

      SpreadsheetApp.flush();

      return {
        success: true,
        created: false,
        updated: true,
        kefgId:
          safeKefgId,
        familyId:
          familyId,
        registeredMobile:
          registeredMobile,
        message:
          'Existing login account synchronised.'
      };
    }

    /*
     * --------------------------------------------------------
     * Generate the next LOGIN_ID without rebuilding the
     * registry or relying on row count.
     * --------------------------------------------------------
     */
    let highestLoginSequence = 0;

    loginValues.forEach(
      function (row) {

        const loginId =
          String(
            row[
              loginHeaderMap.LOGIN_ID
            ] || ''
          )
            .trim()
            .toUpperCase();

        const match =
          loginId.match(
            /^LOGIN(\d+)$/
          );

        if (match) {
          highestLoginSequence =
            Math.max(
              highestLoginSequence,
              Number(match[1]) || 0
            );
        }
      }
    );

    const loginId =
      KGMIS_Login_GenerateLoginId_(
        highestLoginSequence + 1
      );

    const outputRow =
      new Array(
        loginHeaders.length
      ).fill('');

    outputRow[
      loginHeaderMap.LOGIN_ID
    ] = loginId;

    outputRow[
      loginHeaderMap.KEFG_ID
    ] = safeKefgId;

    outputRow[
      loginHeaderMap.FAMILY_ID
    ] = familyId;

    outputRow[
      loginHeaderMap.MEMBER_NAME
    ] = memberName;

    outputRow[
      loginHeaderMap.REGISTERED_MOBILE
    ] = registeredMobile;

    outputRow[
      loginHeaderMap.PASSWORD_HASH
    ] = '';

    outputRow[
      loginHeaderMap.PASSWORD_SALT
    ] = '';

    outputRow[
      loginHeaderMap.PASSWORD_STATUS
    ] = 'NOT_SET';

    outputRow[
      loginHeaderMap.FAILED_ATTEMPTS
    ] = 0;

    if (
      Object.prototype
        .hasOwnProperty.call(
          loginHeaderMap,
          'LAST_FAILED_LOGIN'
        )
    ) {
      outputRow[
        loginHeaderMap.LAST_FAILED_LOGIN
      ] = '';
    }

    outputRow[
      loginHeaderMap.LOCKED_UNTIL
    ] = '';

    outputRow[
      loginHeaderMap.LAST_LOGIN
    ] = '';

    outputRow[
      loginHeaderMap.PASSWORD_CHANGED_ON
    ] = '';

    outputRow[
      loginHeaderMap.CREATED_ON
    ] = now;

    outputRow[
      loginHeaderMap.UPDATED_ON
    ] = '';

    outputRow[
      loginHeaderMap.STATUS
    ] = 'ACTIVE';

    outputRow[
      loginHeaderMap.REMARKS
    ] =
      memberMobile
        ? 'CREATED FROM ADD NEW MEMBER'
        : 'CREATED FROM ADD NEW MEMBER; USING MEMBER_WHATSAPP';

    if (
      Object.prototype
        .hasOwnProperty.call(
          loginHeaderMap,
          'REGISTERED_EMAIL'
        )
    ) {
      outputRow[
        loginHeaderMap.REGISTERED_EMAIL
      ] = registeredEmail;
    }

    if (
      Object.prototype
        .hasOwnProperty.call(
          loginHeaderMap,
          'EFFECTIVE_ROLE'
        )
    ) {
      outputRow[
        loginHeaderMap.EFFECTIVE_ROLE
      ] = 'DIRECTORY_USER';
    }

    loginSheet
      .getRange(
        loginSheet.getLastRow() + 1,
        1,
        1,
        loginHeaders.length
      )
      .setValues([
        outputRow
      ]);

    const newRowNumber =
      loginSheet.getLastRow();

    loginSheet
      .getRange(
        newRowNumber,
        loginHeaderMap.CREATED_ON + 1
      )
      .setNumberFormat(
        'dd-mmm-yyyy hh:mm'
      );

    SpreadsheetApp.flush();

    return {
      success: true,
      created: true,
      updated: false,
      loginId:
        loginId,
      kefgId:
        safeKefgId,
      familyId:
        familyId,
      registeredMobile:
        registeredMobile,
      passwordStatus:
        'NOT_SET',
      status:
        'ACTIVE',
      message:
        'New login account created successfully.'
    };

  } finally {

    lock.releaseLock();
  }
}
