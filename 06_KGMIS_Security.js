/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Security Engine v2.0
 *
 * File:
 * 06_KGMIS_Security.gs
 * ============================================================
 *
 * Features:
 * - Signed-in Google user identification
 * - Access-control lookup
 * - Active/inactive user validation
 * - Role validation
 * - Permission enforcement
 * - Module-aware access checks
 * - Throttled LAST_LOGIN updates
 * - Security audit-log framework
 *
 * Required sheet:
 * KGMIS_ACCESS_CONTROL
 *
 * Required Row 1 headers:
 * EMAIL
 * USER_NAME
 * ROLE
 * STATUS
 * LAST_LOGIN
 * CREATED_ON
 * CREATED_BY
 * UPDATED_ON
 * UPDATED_BY
 * REMARKS
 */


/**
 * ============================================================
 * SECURITY CONFIGURATION
 * ============================================================
 */
const KGMIS_SECURITY_CONFIG = Object.freeze({

  ACCESS_HEADERS: Object.freeze({
    EMAIL: 'EMAIL',
    USER_NAME: 'USER_NAME',
    ROLE: 'ROLE',
    STATUS: 'STATUS',
    LAST_LOGIN: 'LAST_LOGIN',
    CREATED_ON: 'CREATED_ON',
    CREATED_BY: 'CREATED_BY',
    UPDATED_ON: 'UPDATED_ON',
    UPDATED_BY: 'UPDATED_BY',
    REMARKS: 'REMARKS'
  }),

  ROLES: Object.freeze({
    DIRECTORY_USER: 'DIRECTORY_USER',
    VIEWER: 'VIEWER',
    TREASURER: 'TREASURER',
    ADMIN: 'ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN'
  }),

  USER_STATUS: Object.freeze({
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE'
  }),

  PERMISSIONS: Object.freeze({
    DIRECTORY_VIEW: 'DIRECTORY_VIEW',
    TREASURER_VIEW: 'TREASURER_VIEW',
    SUBSCRIPTION_UPDATE: 'SUBSCRIPTION_UPDATE',
    FAMILY_PROFILE_REVIEW: 'FAMILY_PROFILE_REVIEW',
    DATABASE_ADMIN: 'DATABASE_ADMIN',
    APPLICATION_ADMIN: 'APPLICATION_ADMIN',
    ACCESS_MANAGEMENT: 'ACCESS_MANAGEMENT'
  }),

  MODULES: Object.freeze({
    DIRECTORY: 'DIRECTORY',
    TREASURER: 'TREASURER',
    FAMILY_PROFILE: 'FAMILY_PROFILE',
    DATABASE: 'DATABASE',
    APPLICATION: 'APPLICATION',
    ACCESS_CONTROL: 'ACCESS_CONTROL',
    REPORTS: 'REPORTS'
  }),

  ACTIONS: Object.freeze({
    VIEW: 'VIEW',
    UPDATE: 'UPDATE',
    REVIEW: 'REVIEW',
    ADMINISTER: 'ADMINISTER',
    MANAGE: 'MANAGE'
  }),

  LAST_LOGIN_UPDATE_MINUTES: 30,

  LAST_LOGIN_FORMAT: 'dd-MMM-yyyy HH:mm:ss',

  AUDIT_HEADERS: Object.freeze([
    'DATE_TIME',
    'USER_EMAIL',
    'USER_NAME',
    'ROLE',
    'MODULE',
    'ACTION',
    'RESULT',
    'DETAILS'
  ])
});


/**
 * ============================================================
 * ROLE-PERMISSION MATRIX
 * ============================================================
 */
const KGMIS_ROLE_PERMISSIONS = Object.freeze({

  DIRECTORY_USER: Object.freeze([
    KGMIS_SECURITY_CONFIG.PERMISSIONS.DIRECTORY_VIEW
  ]),

  VIEWER: Object.freeze([
    KGMIS_SECURITY_CONFIG.PERMISSIONS.DIRECTORY_VIEW,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.TREASURER_VIEW
  ]),

  TREASURER: Object.freeze([
    KGMIS_SECURITY_CONFIG.PERMISSIONS.DIRECTORY_VIEW,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.TREASURER_VIEW,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.SUBSCRIPTION_UPDATE
  ]),

  ADMIN: Object.freeze([
    KGMIS_SECURITY_CONFIG.PERMISSIONS.DIRECTORY_VIEW,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.TREASURER_VIEW,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.SUBSCRIPTION_UPDATE,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.FAMILY_PROFILE_REVIEW,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.DATABASE_ADMIN,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.APPLICATION_ADMIN
  ]),

  SUPER_ADMIN: Object.freeze([
    KGMIS_SECURITY_CONFIG.PERMISSIONS.DIRECTORY_VIEW,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.TREASURER_VIEW,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.SUBSCRIPTION_UPDATE,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.FAMILY_PROFILE_REVIEW,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.DATABASE_ADMIN,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.APPLICATION_ADMIN,
    KGMIS_SECURITY_CONFIG.PERMISSIONS.ACCESS_MANAGEMENT
  ])
});


/**
 * ============================================================
 * MODULE-ACTION PERMISSION MAP
 * ============================================================
 */
const KGMIS_MODULE_PERMISSION_MAP = Object.freeze({

  DIRECTORY: Object.freeze({
    VIEW:
      KGMIS_SECURITY_CONFIG.PERMISSIONS.DIRECTORY_VIEW
  }),

  TREASURER: Object.freeze({
    VIEW:
      KGMIS_SECURITY_CONFIG.PERMISSIONS.TREASURER_VIEW,

    UPDATE:
      KGMIS_SECURITY_CONFIG.PERMISSIONS.SUBSCRIPTION_UPDATE
  }),

  FAMILY_PROFILE: Object.freeze({
    REVIEW:
      KGMIS_SECURITY_CONFIG.PERMISSIONS
        .FAMILY_PROFILE_REVIEW
  }),

  DATABASE: Object.freeze({
    ADMINISTER:
      KGMIS_SECURITY_CONFIG.PERMISSIONS.DATABASE_ADMIN
  }),

  APPLICATION: Object.freeze({
    ADMINISTER:
      KGMIS_SECURITY_CONFIG.PERMISSIONS
        .APPLICATION_ADMIN
  }),

  ACCESS_CONTROL: Object.freeze({
    MANAGE:
      KGMIS_SECURITY_CONFIG.PERMISSIONS.ACCESS_MANAGEMENT
  }),

  REPORTS: Object.freeze({
    VIEW:
      KGMIS_SECURITY_CONFIG.PERMISSIONS.TREASURER_VIEW
  })
});


/**
 * ============================================================
 * PUBLIC USER-ACCESS PROFILE
 * ============================================================
 *
 * Safe to call from portal HTML using google.script.run.
 */
function KGMIS_GetCurrentUserAccess() {
  const user = KGMIS_GetAuthorisedUser_();

  return {
    email: user.email,
    userName: user.userName,
    role: user.role,
    status: user.status,

    permissions: {
      canViewDirectory:
        KGMIS_UserHasPermission_(
          user.role,
          KGMIS_SECURITY_CONFIG.PERMISSIONS
            .DIRECTORY_VIEW
        ),

      canViewTreasurerModule:
        KGMIS_UserHasPermission_(
          user.role,
          KGMIS_SECURITY_CONFIG.PERMISSIONS
            .TREASURER_VIEW
        ),

      canUpdateSubscription:
        KGMIS_UserHasPermission_(
          user.role,
          KGMIS_SECURITY_CONFIG.PERMISSIONS
            .SUBSCRIPTION_UPDATE
        ),

      canReviewFamilyProfiles:
        KGMIS_UserHasPermission_(
          user.role,
          KGMIS_SECURITY_CONFIG.PERMISSIONS
            .FAMILY_PROFILE_REVIEW
        ),

      canAdministerDatabase:
        KGMIS_UserHasPermission_(
          user.role,
          KGMIS_SECURITY_CONFIG.PERMISSIONS
            .DATABASE_ADMIN
        ),

      canAdministerApplication:
        KGMIS_UserHasPermission_(
          user.role,
          KGMIS_SECURITY_CONFIG.PERMISSIONS
            .APPLICATION_ADMIN
        ),

      canManageAccess:
        KGMIS_UserHasPermission_(
          user.role,
          KGMIS_SECURITY_CONFIG.PERMISSIONS
            .ACCESS_MANAGEMENT
        )
    },

    modules: {
      directory:
        KGMIS_UserCanAccessModule_(
          user.role,
          KGMIS_SECURITY_CONFIG.MODULES.DIRECTORY,
          KGMIS_SECURITY_CONFIG.ACTIONS.VIEW
        ),

      treasurerView:
        KGMIS_UserCanAccessModule_(
          user.role,
          KGMIS_SECURITY_CONFIG.MODULES.TREASURER,
          KGMIS_SECURITY_CONFIG.ACTIONS.VIEW
        ),

      treasurerUpdate:
        KGMIS_UserCanAccessModule_(
          user.role,
          KGMIS_SECURITY_CONFIG.MODULES.TREASURER,
          KGMIS_SECURITY_CONFIG.ACTIONS.UPDATE
        ),

      familyProfileReview:
        KGMIS_UserCanAccessModule_(
          user.role,
          KGMIS_SECURITY_CONFIG.MODULES.FAMILY_PROFILE,
          KGMIS_SECURITY_CONFIG.ACTIONS.REVIEW
        )
    }
  };
}


/**
 * ============================================================
 * CURRENT GOOGLE USER
 * ============================================================
 */
function KGMIS_GetCurrentUserEmail_() {
  const email = String(
    Session.getActiveUser().getEmail() || ''
  )
    .trim()
    .toLowerCase();

  if (!email) {
    throw new Error(
      'Your Google account identity could not be verified. ' +
      'Please sign in using an authorised Google account.'
    );
  }

  return email;
}


/**
 * ============================================================
 * AUTHORISED USER LOOKUP
 * ============================================================
 */
function KGMIS_GetAuthorisedUser_() {
  const email = KGMIS_GetCurrentUserEmail_();

  const context =
    KGMIS_GetAccessControlContext_();

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row = context.values[rowIndex];

    const rowEmail = String(
      row[context.column.EMAIL] || ''
    )
      .trim()
      .toLowerCase();

    if (rowEmail !== email) {
      continue;
    }

    const status = String(
      row[context.column.STATUS] || ''
    )
      .trim()
      .toUpperCase();

    const userName = String(
      row[context.column.USER_NAME] || ''
    ).trim();

    const role = String(
      row[context.column.ROLE] || ''
    )
      .trim()
      .toUpperCase();

    if (
      status !==
      KGMIS_SECURITY_CONFIG.USER_STATUS.ACTIVE
    ) {
      KGMIS_LogSecurityEvent_({
        email,
        userName,
        role,
        module: 'KGMIS',
        action: 'LOGIN',
        result: 'DENIED',
        details: 'User account is inactive.'
      });

      throw new Error(
        `Access denied. The account ${email} is inactive.`
      );
    }

    try {
      KGMIS_ValidateRole_(role);
    } catch (error) {
      KGMIS_LogSecurityEvent_({
        email,
        userName,
        role,
        module: 'KGMIS',
        action: 'LOGIN',
        result: 'DENIED',
        details: String(error.message || error)
      });

      throw error;
    }

    const user = {
      email: rowEmail,
      userName,
      role,
      status,

      remarks: String(
        row[context.column.REMARKS] || ''
      ).trim(),

      lastLogin:
        row[context.column.LAST_LOGIN],

      sheetRow: rowIndex + 1
    };

    KGMIS_UpdateLastLoginIfDue_(
      context,
      user
    );

    return user;
  }

  KGMIS_LogSecurityEvent_({
    email,
    userName: '',
    role: '',
    module: 'KGMIS',
    action: 'LOGIN',
    result: 'DENIED',
    details: 'Email address is not authorised.'
  });

  throw new Error(
    `Access denied. The Google account ${email} ` +
    'is not authorised for KGMIS.'
  );
}


/**
 * ============================================================
 * ACCESS-CONTROL SHEET CONTEXT
 * ============================================================
 */
function KGMIS_GetAccessControlContext_() {
  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheetName =
    KGMIS_CONFIG.ACCESS_CONTROL_SHEET;

  const sheet =
    spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error(
      `Required sheet "${sheetName}" was not found.`
    );
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();

  if (lastRow < 2) {
    throw new Error(
      `No authorised users are configured in ${sheetName}.`
    );
  }

  if (lastColumn === 0) {
    throw new Error(
      `${sheetName} does not contain any columns.`
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

  const requiredHeaders =
    Object.values(
      KGMIS_SECURITY_CONFIG.ACCESS_HEADERS
    );

  requiredHeaders.forEach(header => {
    if (!headers.includes(header)) {
      throw new Error(
        `Missing access-control header: ${header}`
      );
    }
  });

  const column = {};

  Object.entries(
    KGMIS_SECURITY_CONFIG.ACCESS_HEADERS
  ).forEach(([key, header]) => {
    column[key] = headers.indexOf(header);
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
 * ============================================================
 * THROTTLED LAST_LOGIN UPDATE
 * ============================================================
 *
 * LAST_LOGIN is updated only when:
 * - the field is blank, or
 * - the previous update is older than the configured interval.
 */
function KGMIS_UpdateLastLoginIfDue_(
  context,
  user
) {
  if (
    !context ||
    !context.sheet ||
    !user ||
    !user.sheetRow
  ) {
    return;
  }

  const previousLogin =
    KGMIS_ConvertToDate_(user.lastLogin);

  const now = new Date();

  const intervalMilliseconds =
    KGMIS_SECURITY_CONFIG
      .LAST_LOGIN_UPDATE_MINUTES *
    60 *
    1000;

  if (
    previousLogin &&
    now.getTime() - previousLogin.getTime() <
      intervalMilliseconds
  ) {
    return;
  }

  const lastLoginColumn =
    context.column.LAST_LOGIN + 1;

  context.sheet
    .getRange(
      user.sheetRow,
      lastLoginColumn
    )
    .setValue(now)
    .setNumberFormat(
      KGMIS_SECURITY_CONFIG.LAST_LOGIN_FORMAT
    );
}


/**
 * Converts a date value into a valid Date object.
 */
function KGMIS_ConvertToDate_(value) {
  if (
    Object.prototype.toString.call(value) ===
      '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return value;
  }

  const text = String(value || '').trim();

  if (!text) {
    return null;
  }

  const parsed = new Date(text);

  if (isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}


/**
 * ============================================================
 * ROLE VALIDATION
 * ============================================================
 */
function KGMIS_ValidateRole_(role) {
  const validRoles =
    Object.values(
      KGMIS_SECURITY_CONFIG.ROLES
    );

  if (!validRoles.includes(role)) {
    throw new Error(
      `Invalid KGMIS role configured: ${role}`
    );
  }
}


/**
 * ============================================================
 * PERMISSION CHECK
 * ============================================================
 */
function KGMIS_UserHasPermission_(
  role,
  permission
) {
  const safeRole = String(role || '')
    .trim()
    .toUpperCase();

  const safePermission =
    String(permission || '')
      .trim()
      .toUpperCase();

  const rolePermissions =
    KGMIS_ROLE_PERMISSIONS[safeRole] || [];

  return rolePermissions.includes(
    safePermission
  );
}


/**
 * ============================================================
 * MODULE ACCESS CHECK
 * ============================================================
 */
function KGMIS_UserCanAccessModule_(
  role,
  moduleName,
  action
) {
  const safeModule =
    String(moduleName || '')
      .trim()
      .toUpperCase();

  const safeAction =
    String(action || '')
      .trim()
      .toUpperCase();

  const modulePermissions =
    KGMIS_MODULE_PERMISSION_MAP[safeModule];

  if (!modulePermissions) {
    return false;
  }

  const requiredPermission =
    modulePermissions[safeAction];

  if (!requiredPermission) {
    return false;
  }

  return KGMIS_UserHasPermission_(
    role,
    requiredPermission
  );
}


/**
 * ============================================================
 * GENERIC PERMISSION ENFORCEMENT
 * ============================================================
 */
function KGMIS_RequirePermission_(
  permission,
  moduleName,
  actionName
) {
  const user =
    KGMIS_GetAuthorisedUser_();

  const allowed =
    KGMIS_UserHasPermission_(
      user.role,
      permission
    );

  if (!allowed) {
    KGMIS_LogSecurityEvent_({
      email: user.email,
      userName: user.userName,
      role: user.role,
      module: moduleName || 'KGMIS',
      action: actionName || permission,
      result: 'DENIED',
      details:
        `Role ${user.role} does not have permission ${permission}.`
    });

    throw new Error(
      `Access denied. Your role "${user.role}" ` +
      'does not permit this action.'
    );
  }

  return user;
}


/**
 * ============================================================
 * GENERIC MODULE-ACTION ENFORCEMENT
 * ============================================================
 */
function KGMIS_RequireModuleAccess_(
  moduleName,
  action
) {
  const safeModule =
    String(moduleName || '')
      .trim()
      .toUpperCase();

  const safeAction =
    String(action || '')
      .trim()
      .toUpperCase();

  const modulePermissions =
    KGMIS_MODULE_PERMISSION_MAP[safeModule];

  if (!modulePermissions) {
    throw new Error(
      `Unknown KGMIS module: ${safeModule}`
    );
  }

  const permission =
    modulePermissions[safeAction];

  if (!permission) {
    throw new Error(
      `Invalid action "${safeAction}" for module "${safeModule}".`
    );
  }

  return KGMIS_RequirePermission_(
    permission,
    safeModule,
    safeAction
  );
}


/**
 * ============================================================
 * COMPATIBILITY WRAPPERS
 * ============================================================
 *
 * These functions preserve the existing API used by portals.
 */


/**
 * Allows Directory User and all higher roles.
 */
function KGMIS_RequireDirectoryAccess_() {
  return KGMIS_RequireModuleAccess_(
    KGMIS_SECURITY_CONFIG.MODULES.DIRECTORY,
    KGMIS_SECURITY_CONFIG.ACTIONS.VIEW
  );
}


/**
 * Allows Viewer, Treasurer, Admin and Super Admin.
 */
function KGMIS_RequireTreasurerViewAccess_() {
  return KGMIS_RequireModuleAccess_(
    KGMIS_SECURITY_CONFIG.MODULES.TREASURER,
    KGMIS_SECURITY_CONFIG.ACTIONS.VIEW
  );
}


/**
 * Allows Treasurer, Admin and Super Admin.
 */
function KGMIS_RequireSubscriptionWriteAccess_() {
  return KGMIS_RequireModuleAccess_(
    KGMIS_SECURITY_CONFIG.MODULES.TREASURER,
    KGMIS_SECURITY_CONFIG.ACTIONS.UPDATE
  );
}


/**
 * Allows Admin and Super Admin.
 */
function KGMIS_RequireDatabaseAdminAccess_() {
  return KGMIS_RequireModuleAccess_(
    KGMIS_SECURITY_CONFIG.MODULES.DATABASE,
    KGMIS_SECURITY_CONFIG.ACTIONS.ADMINISTER
  );
}


/**
 * Allows Admin and Super Admin.
 */
function KGMIS_RequireApplicationAdminAccess_() {
  return KGMIS_RequireModuleAccess_(
    KGMIS_SECURITY_CONFIG.MODULES.APPLICATION,
    KGMIS_SECURITY_CONFIG.ACTIONS.ADMINISTER
  );
}


/**
 * Allows Super Admin only.
 */
function KGMIS_RequireSuperAdminAccess_() {
  return KGMIS_RequireModuleAccess_(
    KGMIS_SECURITY_CONFIG.MODULES.ACCESS_CONTROL,
    KGMIS_SECURITY_CONFIG.ACTIONS.MANAGE
  );
}


/**
 * ============================================================
 * SECURITY AUDIT-LOG FRAMEWORK
 * ============================================================
 *
 * If KGMIS_AUDIT_LOG does not yet exist, this function exits
 * without interrupting the portal.
 */
function KGMIS_LogSecurityEvent_(eventData) {
  try {
    const spreadsheet =
      SpreadsheetApp.getActiveSpreadsheet();

    const auditSheetName =
      KGMIS_CONFIG.AUDIT_LOG_SHEET ||
      'KGMIS_AUDIT_LOG';

    const sheet =
      spreadsheet.getSheetByName(
        auditSheetName
      );

    if (!sheet) {
      return;
    }

    if (sheet.getLastRow() === 0) {
      sheet
        .getRange(
          1,
          1,
          1,
          KGMIS_SECURITY_CONFIG
            .AUDIT_HEADERS.length
        )
        .setValues([
          KGMIS_SECURITY_CONFIG.AUDIT_HEADERS
        ]);
    }

    const data = eventData || {};

    sheet.appendRow([
      new Date(),
      String(data.email || ''),
      String(data.userName || ''),
      String(data.role || ''),
      String(data.module || ''),
      String(data.action || ''),
      String(data.result || ''),
      String(data.details || '')
    ]);

    sheet
      .getRange(
        sheet.getLastRow(),
        1
      )
      .setNumberFormat(
        KGMIS_SECURITY_CONFIG.LAST_LOGIN_FORMAT
      );

  } catch (error) {
    console.error(
      'KGMIS security audit logging failed:',
      error
    );
  }
}


/**
 * ============================================================
 * MANUAL SECURITY TEST
 * ============================================================
 */
function KGMIS_TestCurrentUserAccess() {
  const access =
    KGMIS_GetCurrentUserAccess();

  Logger.log(
    JSON.stringify(
      access,
      null,
      2
    )
  );

  return access;
}