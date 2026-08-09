/******************************************************************************
 *
 * KEFG Membership Information System (KMIS)
 *
 * Module        : Family Profile Token Service
 * File          : 43_Profile_Token_Service.gs
 * Version       : 2.0
 * Status        : Development
 *
 * Purpose:
 * - Generate secure family-specific portal tokens
 * - Prevent FAMILY_ID and KEFG_ID from appearing in member links or forms
 * - Resolve secure tokens internally to a KMIS family
 * - Support token expiry, activation, revocation and usage tracking
 *
 ******************************************************************************/

const KMIS_FP_TOKEN_CONFIG = Object.freeze({

  SHEET_NAME:
    'KMIS_PROFILE_TOKENS',

  HEADERS: Object.freeze([
    'TOKEN_HASH',
    'FAMILY_ID',
    'STATUS',
    'CREATED_ON',
    'CREATED_BY',
    'EXPIRES_ON',
    'LAST_USED_ON',
    'USE_COUNT',
    'NOTES'
  ]),

  STATUS: Object.freeze({
    ACTIVE: 'ACTIVE',
    REVOKED: 'REVOKED',
    EXPIRED: 'EXPIRED'
  }),

  DEFAULT_VALIDITY_DAYS: 60,

  TOKEN_BYTE_LENGTH: 32,

  DATE_FORMAT:
    'dd-MMM-yyyy HH:mm'
});


/**
 * Creates the token-register sheet when it does not already exist.
 *
 * Only Admin and Super Admin may initialise it.
 */
function KMIS_FP_TOKEN_InitialiseRegister() {
  KMIS_RequireApplicationAdminAccess_();

  const spreadsheet =
    KMIS_DB_GetSpreadsheet();

  let sheet =
    spreadsheet.getSheetByName(
      KMIS_FP_TOKEN_CONFIG.SHEET_NAME
    );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      KMIS_FP_TOKEN_CONFIG.SHEET_NAME
    );

    sheet
      .getRange(
        1,
        1,
        1,
        KMIS_FP_TOKEN_CONFIG.HEADERS.length
      )
      .setValues([
        [...KMIS_FP_TOKEN_CONFIG.HEADERS]
      ]);

    sheet
      .getRange(
        1,
        1,
        1,
        KMIS_FP_TOKEN_CONFIG.HEADERS.length
      )
      .setFontWeight('bold')
      .setBackground('#0d4e70')
      .setFontColor('#ffffff');

    sheet.setFrozenRows(1);

    sheet.autoResizeColumns(
      1,
      KMIS_FP_TOKEN_CONFIG.HEADERS.length
    );
  }

  KMIS_FP_TOKEN_ValidateRegister_(sheet);

  return {
    success: true,
    sheetName: sheet.getName(),
    message:
      'KMIS Family Profile token register is ready.'
  };
}


/**
 * Generates a new secure token for one family.
 *
 * The raw token is returned only once.
 * KMIS stores only its SHA-256 hash.
 *
 * options:
 * {
 *   validityDays,
 *   notes,
 *   revokeExisting
 * }
 */
function KMIS_FP_TOKEN_CreateFamilyToken(
  familyId,
  options
) {
  const currentUser =
    KMIS_RequireApplicationAdminAccess_();

  const safeFamilyId =
    KMIS_DB_Clean_(familyId);

  if (!safeFamilyId) {
    throw new Error(
      'FAMILY_ID is required.'
    );
  }

  const familyRecords =
    KMIS_DB_GetFamilyByFamilyID(
      safeFamilyId
    );

  if (!familyRecords.length) {
    throw new Error(
      `No KMIS family was found for ${safeFamilyId}.`
    );
  }

  const safeOptions =
    options || {};

  const validityDays =
    Number(
      safeOptions.validityDays ||
      KMIS_FP_TOKEN_CONFIG.DEFAULT_VALIDITY_DAYS
    );

  if (
    !Number.isFinite(validityDays) ||
    validityDays < 1 ||
    validityDays > 365
  ) {
    throw new Error(
      'Token validity must be between 1 and 365 days.'
    );
  }

  const sheet =
    KMIS_FP_TOKEN_GetRegister_();

  if (
    safeOptions.revokeExisting !== false
  ) {
    KMIS_FP_TOKEN_RevokeActiveTokensForFamily_(
      safeFamilyId,
      sheet
    );
  }

  const rawToken =
    KMIS_FP_TOKEN_GenerateSecureToken_();

  const tokenHash =
    KMIS_FP_TOKEN_Hash_(rawToken);

  const createdOn =
    new Date();

  const expiresOn =
    new Date(
      createdOn.getTime() +
      validityDays *
      24 *
      60 *
      60 *
      1000
    );

  const newRow = [
    tokenHash,
    safeFamilyId,
    KMIS_FP_TOKEN_CONFIG.STATUS.ACTIVE,
    createdOn,
    currentUser.email,
    expiresOn,
    '',
    0,
    String(
      safeOptions.notes || ''
    ).trim()
  ];

  const rowNumber =
    sheet.getLastRow() + 1;

  sheet
    .getRange(
      rowNumber,
      1,
      1,
      newRow.length
    )
    .setValues([newRow]);

  sheet
    .getRange(
      rowNumber,
      4,
      1,
      4
    )
    .setNumberFormat(
      KMIS_FP_TOKEN_CONFIG.DATE_FORMAT
    );

  SpreadsheetApp.flush();

  return {
    success: true,

    message:
      `Secure Family Profile token created for ${safeFamilyId}.`,

    familyId:
      safeFamilyId,

    token:
      rawToken,

    expiresOn:
      Utilities.formatDate(
        expiresOn,
        Session.getScriptTimeZone(),
        KMIS_FP_TOKEN_CONFIG.DATE_FORMAT
      ),

    portalQuery:
      `?module=family-profile&token=${encodeURIComponent(rawToken)}`
  };
}


/**
 * Resolves a raw token to its authorised family.
 *
 * This function is intended for the member-facing portal.
 * It does not expose the FAMILY_ID to the browser.
 */
function KMIS_FP_TOKEN_Resolve(rawToken) {
  const safeToken =
    String(rawToken || '').trim();

  if (!safeToken) {
    throw new Error(
      'The Family Profile link is missing or invalid.'
    );
  }

  const tokenHash =
    KMIS_FP_TOKEN_Hash_(safeToken);

  const context =
    KMIS_FP_TOKEN_GetContext_();

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row =
      context.values[rowIndex];

    const storedHash =
      String(
        row[context.column.TOKEN_HASH] || ''
      ).trim();

    if (storedHash !== tokenHash) {
      continue;
    }

    const status =
      String(
        row[context.column.STATUS] || ''
      )
        .trim()
        .toUpperCase();

    if (
      status !==
      KMIS_FP_TOKEN_CONFIG.STATUS.ACTIVE
    ) {
      throw new Error(
        'This Family Profile link is no longer active.'
      );
    }

    const expiresOn =
      KMIS_FP_TOKEN_ToDate_(
        row[context.column.EXPIRES_ON]
      );

    if (
      expiresOn &&
      expiresOn.getTime() <
        new Date().getTime()
    ) {
      context.sheet
        .getRange(
          rowIndex + 1,
          context.column.STATUS + 1
        )
        .setValue(
          KMIS_FP_TOKEN_CONFIG.STATUS.EXPIRED
        );

      SpreadsheetApp.flush();

      throw new Error(
        'This Family Profile link has expired.'
      );
    }

    const familyId =
      KMIS_DB_Clean_(
        row[context.column.FAMILY_ID]
      );

    if (!familyId) {
      throw new Error(
        'The Family Profile link is not connected to a valid family.'
      );
    }

    KMIS_FP_TOKEN_RecordUsage_(
      context,
      rowIndex + 1
    );

    return {
      success: true,

      /*
       * FAMILY_ID remains server-side.
       * Portal functions should use it internally and never return it
       * in member-facing data.
       */
      familyId,

      expiresOn:
        expiresOn
          ? Utilities.formatDate(
              expiresOn,
              Session.getScriptTimeZone(),
              KMIS_FP_TOKEN_CONFIG.DATE_FORMAT
            )
          : ''
    };
  }

  throw new Error(
    'The Family Profile link is invalid or has been revoked.'
  );
}


/**
 * Generates the full member-facing Family Profile from a token.
 *
 * No FAMILY_ID, KEFG_ID or spreadsheet row number is returned.
 */
function KMIS_FP_TOKEN_LoadMemberProfile(
  rawToken
) {
  const resolved =
    KMIS_FP_TOKEN_Resolve(rawToken);

  const profileResult =
    KMIS_FP_GetMemberFacingProfile(
      resolved.familyId
    );

  if (!profileResult.success) {
    throw new Error(
      profileResult.message ||
      'The Family Profile could not be loaded.'
    );
  }

  return {
    success: true,

    profile:
      profileResult.data,

    linkInformation: {
      expiresOn:
        resolved.expiresOn
    }
  };
}


/**
 * Revokes all active tokens for one family.
 */
function KMIS_FP_TOKEN_RevokeFamilyTokens(
  familyId
) {
  KMIS_RequireApplicationAdminAccess_();

  const safeFamilyId =
    KMIS_DB_Clean_(familyId);

  if (!safeFamilyId) {
    throw new Error(
      'FAMILY_ID is required.'
    );
  }

  const sheet =
    KMIS_FP_TOKEN_GetRegister_();

  const revokedCount =
    KMIS_FP_TOKEN_RevokeActiveTokensForFamily_(
      safeFamilyId,
      sheet
    );

  return {
    success: true,
    familyId: safeFamilyId,
    revokedCount,
    message:
      `${revokedCount} active token(s) revoked for ${safeFamilyId}.`
  };
}


/**
 * Lists token-register entries.
 *
 * Raw tokens cannot be retrieved because KMIS stores hashes only.
 */
function KMIS_FP_TOKEN_ListRegister() {
  KMIS_RequireApplicationAdminAccess_();

  const context =
    KMIS_FP_TOKEN_GetContext_();

  const rows = [];

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row =
      context.values[rowIndex];

    const tokenHash =
      String(
        row[context.column.TOKEN_HASH] || ''
      ).trim();

    if (!tokenHash) {
      continue;
    }

    rows.push({
      familyId:
        KMIS_DB_Clean_(
          row[context.column.FAMILY_ID]
        ),

      status:
        String(
          row[context.column.STATUS] || ''
        )
          .trim()
          .toUpperCase(),

      createdOn:
        KMIS_FP_TOKEN_FormatDate_(
          row[context.column.CREATED_ON]
        ),

      createdBy:
        String(
          row[context.column.CREATED_BY] || ''
        ).trim(),

      expiresOn:
        KMIS_FP_TOKEN_FormatDate_(
          row[context.column.EXPIRES_ON]
        ),

      lastUsedOn:
        KMIS_FP_TOKEN_FormatDate_(
          row[context.column.LAST_USED_ON]
        ),

      useCount:
        Number(
          row[context.column.USE_COUNT] || 0
        ),

      notes:
        String(
          row[context.column.NOTES] || ''
        ).trim()
    });
  }

  return {
    success: true,
    count: rows.length,
    rows
  };
}


/**
 * Returns the register sheet, creating it when necessary.
 */
function KMIS_FP_TOKEN_GetRegister_() {
  const spreadsheet =
    KMIS_DB_GetSpreadsheet();

  let sheet =
    spreadsheet.getSheetByName(
      KMIS_FP_TOKEN_CONFIG.SHEET_NAME
    );

  if (!sheet) {
    KMIS_FP_TOKEN_InitialiseRegister();

    sheet =
      spreadsheet.getSheetByName(
        KMIS_FP_TOKEN_CONFIG.SHEET_NAME
      );
  }

  KMIS_FP_TOKEN_ValidateRegister_(sheet);

  return sheet;
}


/**
 * Reads token-register context.
 */
function KMIS_FP_TOKEN_GetContext_() {
  const sheet =
    KMIS_FP_TOKEN_GetRegister_();

  const lastRow =
    Math.max(
      sheet.getLastRow(),
      1
    );

  const lastColumn =
    sheet.getLastColumn();

  const values =
    sheet
      .getRange(
        1,
        1,
        lastRow,
        lastColumn
      )
      .getValues();

  const headers =
    values[0].map(
      value =>
        String(value).trim()
    );

  const column = {};

  KMIS_FP_TOKEN_CONFIG.HEADERS
    .forEach(header => {
      column[header] =
        headers.indexOf(header);
    });

  return {
    sheet,
    values,
    headers,
    column
  };
}


/**
 * Validates token-register headers.
 */
function KMIS_FP_TOKEN_ValidateRegister_(
  sheet
) {
  if (!sheet) {
    throw new Error(
      'KMIS_PROFILE_TOKENS sheet was not found.'
    );
  }

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        sheet.getLastColumn()
      )
      .getDisplayValues()[0]
      .map(
        value =>
          String(value).trim()
      );

  KMIS_FP_TOKEN_CONFIG.HEADERS
    .forEach(header => {
      if (!headers.includes(header)) {
        throw new Error(
          `Missing token-register header: ${header}`
        );
      }
    });
}


/**
 * Revokes active tokens for one family.
 */
function KMIS_FP_TOKEN_RevokeActiveTokensForFamily_(
  familyId,
  sheet
) {
  const targetSheet =
    sheet ||
    KMIS_FP_TOKEN_GetRegister_();

  const context =
    KMIS_FP_TOKEN_GetContext_();

  let revokedCount = 0;

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row =
      context.values[rowIndex];

    const rowFamilyId =
      KMIS_DB_Clean_(
        row[context.column.FAMILY_ID]
      );

    const status =
      String(
        row[context.column.STATUS] || ''
      )
        .trim()
        .toUpperCase();

    if (
      rowFamilyId === familyId &&
      status ===
        KMIS_FP_TOKEN_CONFIG.STATUS.ACTIVE
    ) {
      targetSheet
        .getRange(
          rowIndex + 1,
          context.column.STATUS + 1
        )
        .setValue(
          KMIS_FP_TOKEN_CONFIG.STATUS.REVOKED
        );

      revokedCount++;
    }
  }

  SpreadsheetApp.flush();

  return revokedCount;
}


/**
 * Updates token usage information.
 */
function KMIS_FP_TOKEN_RecordUsage_(
  context,
  sheetRow
) {
  const lastUsedCell =
    context.sheet.getRange(
      sheetRow,
      context.column.LAST_USED_ON + 1
    );

  const useCountCell =
    context.sheet.getRange(
      sheetRow,
      context.column.USE_COUNT + 1
    );

  const existingCount =
    Number(
      useCountCell.getValue() || 0
    );

  lastUsedCell
    .setValue(new Date())
    .setNumberFormat(
      KMIS_FP_TOKEN_CONFIG.DATE_FORMAT
    );

  useCountCell.setValue(
    existingCount + 1
  );

  SpreadsheetApp.flush();
}


/**
 * Generates a cryptographically strong URL-safe token.
 */
function KMIS_FP_TOKEN_GenerateSecureToken_() {
  const randomValues = [];

  for (
    let index = 0;
    index <
      KMIS_FP_TOKEN_CONFIG.TOKEN_BYTE_LENGTH;
    index++
  ) {
    randomValues.push(
      Math.floor(
        Math.random() * 256
      )
    );
  }

  const uuidText =
    Utilities.getUuid() +
    Utilities.getUuid() +
    new Date().getTime();

  const combinedBytes =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      uuidText +
      randomValues.join('-'),
      Utilities.Charset.UTF_8
    );

  return Utilities.base64EncodeWebSafe(
    combinedBytes
  ).replace(/=+$/g, '');
}


/**
 * Returns the SHA-256 hash of a raw token.
 */
function KMIS_FP_TOKEN_Hash_(rawToken) {
  const digest =
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(rawToken),
      Utilities.Charset.UTF_8
    );

  return digest
    .map(byte => {
      const unsigned =
        byte < 0
          ? byte + 256
          : byte;

      return unsigned
        .toString(16)
        .padStart(2, '0');
    })
    .join('');
}


function KMIS_FP_TOKEN_ToDate_(value) {
  if (
    Object.prototype.toString.call(value) ===
      '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return value;
  }

  const text =
    String(value || '').trim();

  if (!text) {
    return null;
  }

  const parsed =
    new Date(text);

  return isNaN(parsed.getTime())
    ? null
    : parsed;
}


function KMIS_FP_TOKEN_FormatDate_(value) {
  const date =
    KMIS_FP_TOKEN_ToDate_(value);

  if (!date) {
    return '';
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    KMIS_FP_TOKEN_CONFIG.DATE_FORMAT
  );
}


/**
 * Test 1: initialise the token register.
 */
function KMIS_FP_TOKEN_TestInitialise() {
  const result =
    KMIS_FP_TOKEN_InitialiseRegister();

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
 * Test 2: create a temporary token for FAM00001.
 *
 * Copy the returned token from the Execution log.
 */
function KMIS_FP_TOKEN_TestCreate() {
  const result =
    KMIS_FP_TOKEN_CreateFamilyToken(
      'FAM00001',
      {
        validityDays: 7,
        notes:
          'Development test token',
        revokeExisting: true
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


/**
 * Test 3:
 * Paste the raw token generated by KMIS_FP_TOKEN_TestCreate below.
 */
function KMIS_FP_TOKEN_TestResolve() {
  const testToken =
    'TjBET_YJgWziGAUiF_M7sB8e7-a5cx9VbqXImQVvMsQ';

  if (
    testToken ===
    'TjBET_YJgWziGAUiF_M7sB8e7-a5cx9VbqXImQVvMsQ'
  ) {
    throw new Error(
      'Paste the generated test token into KMIS_FP_TOKEN_TestResolve first.'
    );
  }

  const result =
    KMIS_FP_TOKEN_LoadMemberProfile(
      testToken
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