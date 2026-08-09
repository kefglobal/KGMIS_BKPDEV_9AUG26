/**
 * KMIS Platform v2.0
 * User Management / Access Control Engine
 *
 * Required sheet:
 * KGMIS_ACCESS_CONTROL
 *
 * Required headers:
 * EMAIL
 * USER_NAME
 * ROLE
 * STATUS
 * LAST_LOGIN
 * CREATED_ON
 * CREATED_BY
 * NOTES
 *
 * Only SUPER_ADMIN users may manage access.
 */


/**
 * Returns all authorised users.
 */
function KMIS_ListUsers() {
  KMIS_RequireSuperAdminAccess_();

  const context = KMIS_GetUserManagementContext_();
  const users = [];

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row = context.values[rowIndex];

    const email = KMIS_NormalizeEmail_(
      row[context.column.EMAIL]
    );

    if (!email) {
      continue;
    }

    users.push({
      email,
      userName: String(
        row[context.column.USER_NAME] || ''
      ).trim(),

      role: String(
        row[context.column.ROLE] || ''
      )
        .trim()
        .toUpperCase(),

      status: String(
        row[context.column.STATUS] || ''
      )
        .trim()
        .toUpperCase(),

      lastLogin: KMIS_FormatAccessDate_(
        row[context.column.LAST_LOGIN]
      ),

      createdOn: KMIS_FormatAccessDate_(
        row[context.column.CREATED_ON]
      ),

      createdBy: String(
        row[context.column.CREATED_BY] || ''
      ).trim(),

      notes: String(
        row[context.column.NOTES] || ''
      ).trim(),

      sheetRow: rowIndex + 1
    });
  }

  return users.sort((a, b) =>
    a.userName.localeCompare(
      b.userName,
      undefined,
      {
        sensitivity: 'base'
      }
    )
  );
}


/**
 * Returns one user by email.
 */
function KMIS_GetUser(email) {
  KMIS_RequireSuperAdminAccess_();

  const normalizedEmail =
    KMIS_NormalizeEmail_(email);

  if (!normalizedEmail) {
    throw new Error(
      'A valid email address is required.'
    );
  }

  const context =
    KMIS_GetUserManagementContext_();

  const rowNumber =
    KMIS_FindUserRow_(
      context,
      normalizedEmail
    );

  if (!rowNumber) {
    throw new Error(
      `No KMIS user was found for ${normalizedEmail}.`
    );
  }

  return KMIS_ReadUserFromRow_(
    context,
    rowNumber
  );
}


/**
 * Adds a new authorised user.
 *
 * userData:
 * {
 *   email,
 *   userName,
 *   role,
 *   status,
 *   notes
 * }
 */
function KMIS_AddUser(userData) {
  const currentUser =
    KMIS_RequireSuperAdminAccess_();

  const safeUser =
    KMIS_ValidateUserPayload_(
      userData,
      true
    );

  const context =
    KMIS_GetUserManagementContext_();

  const existingRow =
    KMIS_FindUserRow_(
      context,
      safeUser.email
    );

  if (existingRow) {
    throw new Error(
      `The email ${safeUser.email} is already registered.`
    );
  }

  const timestamp = new Date();

  const newRow =
    new Array(context.headers.length).fill('');

  newRow[context.column.EMAIL] =
    safeUser.email;

  newRow[context.column.USER_NAME] =
    safeUser.userName;

  newRow[context.column.ROLE] =
    safeUser.role;

  newRow[context.column.STATUS] =
    safeUser.status;

  newRow[context.column.LAST_LOGIN] =
    '';

  newRow[context.column.CREATED_ON] =
    timestamp;

  newRow[context.column.CREATED_BY] =
    currentUser.email;

  newRow[context.column.NOTES] =
    safeUser.notes;

  const targetRow =
    context.sheet.getLastRow() + 1;

  context.sheet
    .getRange(
      targetRow,
      1,
      1,
      context.headers.length
    )
    .setValues([newRow]);

  context.sheet
    .getRange(
      targetRow,
      context.column.CREATED_ON + 1
    )
    .setNumberFormat(
      'dd-MMM-yyyy HH:mm'
    );

  SpreadsheetApp.flush();

  return {
    success: true,
    message:
      `User ${safeUser.userName} added successfully.`,
    user: KMIS_GetUser(safeUser.email)
  };
}


/**
 * Updates name, role, status and notes.
 *
 * userData:
 * {
 *   email,
 *   userName,
 *   role,
 *   status,
 *   notes
 * }
 */
function KMIS_UpdateUser(userData) {
  const currentUser =
    KMIS_RequireSuperAdminAccess_();

  const safeUser =
    KMIS_ValidateUserPayload_(
      userData,
      true
    );

  const context =
    KMIS_GetUserManagementContext_();

  const rowNumber =
    KMIS_FindUserRow_(
      context,
      safeUser.email
    );

  if (!rowNumber) {
    throw new Error(
      `No KMIS user was found for ${safeUser.email}.`
    );
  }

  const existingUser =
    KMIS_ReadUserFromRow_(
      context,
      rowNumber
    );

  KMIS_ProtectLastSuperAdmin_({
    targetEmail: safeUser.email,
    oldRole: existingUser.role,
    oldStatus: existingUser.status,
    newRole: safeUser.role,
    newStatus: safeUser.status
  });

  /*
   * A Super Admin may update their own name and notes,
   * but cannot deactivate themselves or remove their own
   * SUPER_ADMIN role.
   */
  if (
    safeUser.email === currentUser.email &&
    (
      safeUser.role !==
        KMIS_SECURITY_CONFIG.ROLES.SUPER_ADMIN ||
      safeUser.status !==
        KMIS_SECURITY_CONFIG.USER_STATUS.ACTIVE
    )
  ) {
    throw new Error(
      'You cannot remove your own SUPER_ADMIN access or deactivate your own account.'
    );
  }

  context.sheet
    .getRange(
      rowNumber,
      context.column.USER_NAME + 1
    )
    .setValue(safeUser.userName);

  context.sheet
    .getRange(
      rowNumber,
      context.column.ROLE + 1
    )
    .setValue(safeUser.role);

  context.sheet
    .getRange(
      rowNumber,
      context.column.STATUS + 1
    )
    .setValue(safeUser.status);

  context.sheet
    .getRange(
      rowNumber,
      context.column.NOTES + 1
    )
    .setValue(safeUser.notes);

  SpreadsheetApp.flush();

  return {
    success: true,
    message:
      `User ${safeUser.userName} updated successfully.`,
    user: KMIS_GetUser(safeUser.email)
  };
}


/**
 * Activates a user.
 */
function KMIS_ActivateUser(email) {
  const existing =
    KMIS_GetUser(email);

  return KMIS_UpdateUser({
    email: existing.email,
    userName: existing.userName,
    role: existing.role,
    status:
      KMIS_SECURITY_CONFIG.USER_STATUS.ACTIVE,
    notes: existing.notes
  });
}


/**
 * Deactivates a user.
 */
function KMIS_DeactivateUser(email) {
  const currentUser =
    KMIS_RequireSuperAdminAccess_();

  const normalizedEmail =
    KMIS_NormalizeEmail_(email);

  if (
    normalizedEmail === currentUser.email
  ) {
    throw new Error(
      'You cannot deactivate your own account.'
    );
  }

  const existing =
    KMIS_GetUser(normalizedEmail);

  return KMIS_UpdateUser({
    email: existing.email,
    userName: existing.userName,
    role: existing.role,
    status:
      KMIS_SECURITY_CONFIG.USER_STATUS.INACTIVE,
    notes: existing.notes
  });
}


/**
 * Permanently deletes a user.
 *
 * Use sparingly. Normally, prefer deactivation.
 */
function KMIS_DeleteUser(email) {
  const currentUser =
    KMIS_RequireSuperAdminAccess_();

  const normalizedEmail =
    KMIS_NormalizeEmail_(email);

  if (!normalizedEmail) {
    throw new Error(
      'A valid email address is required.'
    );
  }

  if (
    normalizedEmail === currentUser.email
  ) {
    throw new Error(
      'You cannot delete your own account.'
    );
  }

  const context =
    KMIS_GetUserManagementContext_();

  const rowNumber =
    KMIS_FindUserRow_(
      context,
      normalizedEmail
    );

  if (!rowNumber) {
    throw new Error(
      `No KMIS user was found for ${normalizedEmail}.`
    );
  }

  const existingUser =
    KMIS_ReadUserFromRow_(
      context,
      rowNumber
    );

  KMIS_ProtectLastSuperAdmin_({
    targetEmail: normalizedEmail,
    oldRole: existingUser.role,
    oldStatus: existingUser.status,
    newRole: '',
    newStatus: 'DELETED'
  });

  context.sheet.deleteRow(rowNumber);

  SpreadsheetApp.flush();

  return {
    success: true,
    message:
      `User ${normalizedEmail} deleted successfully.`
  };
}


/**
 * Returns whether an email is already registered.
 */
function KMIS_IsEmailRegistered(email) {
  KMIS_RequireSuperAdminAccess_();

  const normalizedEmail =
    KMIS_NormalizeEmail_(email);

  if (!normalizedEmail) {
    return false;
  }

  const context =
    KMIS_GetUserManagementContext_();

  return Boolean(
    KMIS_FindUserRow_(
      context,
      normalizedEmail
    )
  );
}


/**
 * Returns valid KMIS roles.
 */
function KMIS_GetRoles() {
  KMIS_RequireSuperAdminAccess_();

  return Object.values(
    KMIS_SECURITY_CONFIG.ROLES
  );
}


/**
 * Returns valid user statuses.
 */
function KMIS_GetUserStatuses() {
  KMIS_RequireSuperAdminAccess_();

  return Object.values(
    KMIS_SECURITY_CONFIG.USER_STATUS
  );
}


/**
 * Updates LAST_LOGIN for the signed-in user.
 *
 * This may be called when a portal loads successfully.
 */
function KMIS_RecordCurrentUserLogin() {
  const user =
    KMIS_GetAuthorisedUser_();

  const context =
    KMIS_GetUserManagementContext_();

  const rowNumber =
    KMIS_FindUserRow_(
      context,
      user.email
    );

  if (!rowNumber) {
    throw new Error(
      'The signed-in user could not be found in the access-control register.'
    );
  }

  context.sheet
    .getRange(
      rowNumber,
      context.column.LAST_LOGIN + 1
    )
    .setValue(new Date())
    .setNumberFormat(
      'dd-MMM-yyyy HH:mm'
    );

  SpreadsheetApp.flush();

  return {
    success: true,
    email: user.email
  };
}


/**
 * Reads and validates the full access-control structure.
 */
function KMIS_GetUserManagementContext_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    spreadsheet.getSheetByName(
      KMIS_SECURITY_CONFIG.ACCESS_SHEET_NAME
    );

  if (!sheet) {
    throw new Error(
      `Required sheet "${KMIS_SECURITY_CONFIG.ACCESS_SHEET_NAME}" was not found.`
    );
  }

  const lastRow =
    Math.max(sheet.getLastRow(), 1);

  const lastColumn =
    sheet.getLastColumn();

  if (!lastColumn) {
    throw new Error(
      'KGMIS_ACCESS_CONTROL contains no columns.'
    );
  }

  const values = sheet
    .getRange(
      1,
      1,
      lastRow,
      lastColumn
    )
    .getValues();

  const headers = values[0].map(
    value => String(value).trim()
  );

  const requiredHeaders = [
    'EMAIL',
    'USER_NAME',
    'ROLE',
    'STATUS',
    'LAST_LOGIN',
    'CREATED_ON',
    'CREATED_BY',
    'NOTES'
  ];

  requiredHeaders.forEach(header => {
    if (!headers.includes(header)) {
      throw new Error(
        `Missing access-control header: ${header}`
      );
    }
  });

  const column = {};

  requiredHeaders.forEach(header => {
    column[header] =
      headers.indexOf(header);
  });

  return {
    spreadsheet,
    sheet,
    values,
    headers,
    column
  };
}


/**
 * Finds the sheet row for an email.
 *
 * Returns zero when not found.
 */
function KMIS_FindUserRow_(
  context,
  normalizedEmail
) {
  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const rowEmail =
      KMIS_NormalizeEmail_(
        context.values[rowIndex][
          context.column.EMAIL
        ]
      );

    if (
      rowEmail === normalizedEmail
    ) {
      return rowIndex + 1;
    }
  }

  return 0;
}


/**
 * Reads one user from a sheet row.
 */
function KMIS_ReadUserFromRow_(
  context,
  sheetRow
) {
  const row =
    context.sheet
      .getRange(
        sheetRow,
        1,
        1,
        context.headers.length
      )
      .getValues()[0];

  return {
    email:
      KMIS_NormalizeEmail_(
        row[context.column.EMAIL]
      ),

    userName: String(
      row[context.column.USER_NAME] || ''
    ).trim(),

    role: String(
      row[context.column.ROLE] || ''
    )
      .trim()
      .toUpperCase(),

    status: String(
      row[context.column.STATUS] || ''
    )
      .trim()
      .toUpperCase(),

    lastLogin:
      KMIS_FormatAccessDate_(
        row[context.column.LAST_LOGIN]
      ),

    createdOn:
      KMIS_FormatAccessDate_(
        row[context.column.CREATED_ON]
      ),

    createdBy: String(
      row[context.column.CREATED_BY] || ''
    ).trim(),

    notes: String(
      row[context.column.NOTES] || ''
    ).trim()
  };
}


/**
 * Validates user-management input.
 */
function KMIS_ValidateUserPayload_(
  userData,
  requireStatus
) {
  const input = userData || {};

  const email =
    KMIS_NormalizeEmail_(
      input.email
    );

  const userName =
    KMIS_NormalizeUserName_(
      input.userName
    );

  const role = String(
    input.role || ''
  )
    .trim()
    .toUpperCase();

  const status = String(
    input.status ||
    KMIS_SECURITY_CONFIG.USER_STATUS.ACTIVE
  )
    .trim()
    .toUpperCase();

  const notes = String(
    input.notes || ''
  ).trim();

  if (!email) {
    throw new Error(
      'A valid email address is required.'
    );
  }

  if (!KMIS_IsValidEmail_(email)) {
    throw new Error(
      `Invalid email address: ${email}`
    );
  }

  if (!userName) {
    throw new Error(
      'User name is required.'
    );
  }

  KMIS_ValidateRole_(role);

  if (requireStatus) {
    const validStatuses =
      Object.values(
        KMIS_SECURITY_CONFIG.USER_STATUS
      );

    if (
      !validStatuses.includes(status)
    ) {
      throw new Error(
        `Invalid user status: ${status}`
      );
    }
  }

  return {
    email,
    userName,
    role,
    status,
    notes
  };
}


/**
 * Prevents removal of the last active SUPER_ADMIN.
 */
function KMIS_ProtectLastSuperAdmin_(
  change
) {
  const oldRole = String(
    change.oldRole || ''
  )
    .trim()
    .toUpperCase();

  const oldStatus = String(
    change.oldStatus || ''
  )
    .trim()
    .toUpperCase();

  const newRole = String(
    change.newRole || ''
  )
    .trim()
    .toUpperCase();

  const newStatus = String(
    change.newStatus || ''
  )
    .trim()
    .toUpperCase();

  const wasActiveSuperAdmin =
    oldRole ===
      KMIS_SECURITY_CONFIG.ROLES.SUPER_ADMIN &&
    oldStatus ===
      KMIS_SECURITY_CONFIG.USER_STATUS.ACTIVE;

  const remainsActiveSuperAdmin =
    newRole ===
      KMIS_SECURITY_CONFIG.ROLES.SUPER_ADMIN &&
    newStatus ===
      KMIS_SECURITY_CONFIG.USER_STATUS.ACTIVE;

  if (
    !wasActiveSuperAdmin ||
    remainsActiveSuperAdmin
  ) {
    return;
  }

  const activeSuperAdminCount =
    KMIS_CountActiveSuperAdmins_();

  if (activeSuperAdminCount <= 1) {
    throw new Error(
      'This action is blocked because KMIS must retain at least one active SUPER_ADMIN.'
    );
  }
}


/**
 * Counts active Super Administrators.
 */
function KMIS_CountActiveSuperAdmins_() {
  const context =
    KMIS_GetUserManagementContext_();

  let count = 0;

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const role = String(
      context.values[rowIndex][
        context.column.ROLE
      ] || ''
    )
      .trim()
      .toUpperCase();

    const status = String(
      context.values[rowIndex][
        context.column.STATUS
      ] || ''
    )
      .trim()
      .toUpperCase();

    if (
      role ===
        KMIS_SECURITY_CONFIG.ROLES.SUPER_ADMIN &&
      status ===
        KMIS_SECURITY_CONFIG.USER_STATUS.ACTIVE
    ) {
      count++;
    }
  }

  return count;
}


/**
 * Converts emails to lowercase and removes spaces.
 */
function KMIS_NormalizeEmail_(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}


/**
 * Cleans user names.
 */
function KMIS_NormalizeUserName_(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}


/**
 * Basic email validation.
 */
function KMIS_IsValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(email);
}


/**
 * Formats sheet dates for portal display.
 */
function KMIS_FormatAccessDate_(value) {
  if (
    Object.prototype.toString.call(value) ===
      '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      'dd-MMM-yyyy HH:mm'
    );
  }

  return String(value || '').trim();
}


/**
 * Manual test: list all configured users.
 */
function KMIS_TestListUsers() {
  const users = KMIS_ListUsers();

  Logger.log(
    JSON.stringify(users, null, 2)
  );

  return users;
}


/**
 * Manual test: verify role and status lists.
 */
function KMIS_TestAccessControlConfiguration() {
  const result = {
    roles: KMIS_GetRoles(),
    statuses: KMIS_GetUserStatuses(),
    activeSuperAdmins:
      KMIS_CountActiveSuperAdmins_()
  };

  Logger.log(
    JSON.stringify(result, null, 2)
  );

  return result;
}