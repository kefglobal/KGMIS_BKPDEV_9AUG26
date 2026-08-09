/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Email OTP Authentication Service
 *
 * File:
 * 06.01_KGMIS_OTP_Authentication.gs
 * ============================================================
 *
 * Purpose:
 * - Verify an authorised KGMIS user through email OTP
 * - Create an 8-hour KGMIS login session
 * - Validate module permissions through the existing
 *   KGMIS role-permission matrix
 * - Allow explicit sign-out and session revocation
 */

/*
 * Important:
 * Use literal module/action values in this global configuration.
 * Apps Script does not guarantee cross-file evaluation order.
 */
const KGMIS_OTP_CONFIG = Object.freeze({
  OTP_DIGITS: 6,
  OTP_VALID_MINUTES: 5,
  SESSION_VALID_MINUTES: 480,
  RESEND_WAIT_SECONDS: 60,
  MAX_OTP_ATTEMPTS: 5,
  MAX_OTP_REQUESTS_PER_HOUR: 5,
  REQUEST_WINDOW_MINUTES: 60,

  MAX_OTP_REQUESTS_PER_EMAIL_PER_DAY: 10,
  PER_EMAIL_DAILY_WINDOW_MINUTES: 1440,

  MAX_GLOBAL_OTP_REQUESTS_PER_WINDOW: 40,
  GLOBAL_REQUEST_WINDOW_MINUTES: 10,

  MAX_GLOBAL_OTP_REQUESTS_PER_DAY: 150,
  GLOBAL_DAILY_WINDOW_MINUTES: 1440,

  SCRIPT_LOCK_WAIT_MILLISECONDS: 20000,

  OTP_PROPERTY_PREFIX: 'KGMIS_OTP_CHALLENGE_',
  SESSION_PROPERTY_PREFIX: 'KGMIS_OTP_SESSION_',
  EMAIL_RATE_PROPERTY_PREFIX: 'KGMIS_OTP_EMAIL_RATE_',
  GLOBAL_RATE_PROPERTY: 'KGMIS_OTP_GLOBAL_RATE',
  SECURITY_SECRET_PROPERTY: 'KGMIS_OTP_SECURITY_SECRET',
  EMAIL_SENDER_NAME: 'KGMIS Security',
  EMAIL_SUBJECT: 'Your KGMIS Main Portal verification code',
  REQUIRED_MODULE: 'TREASURER',
  REQUIRED_ACTION: 'VIEW'
});

function KGMIS_OTP_GetLoginConfig() {
  return {
    success: true,
    otpDigits: KGMIS_OTP_CONFIG.OTP_DIGITS,
    otpValidMinutes: KGMIS_OTP_CONFIG.OTP_VALID_MINUTES,
    sessionValidMinutes: KGMIS_OTP_CONFIG.SESSION_VALID_MINUTES,
    resendWaitSeconds: KGMIS_OTP_CONFIG.RESEND_WAIT_SECONDS,
    maximumAttempts: KGMIS_OTP_CONFIG.MAX_OTP_ATTEMPTS,
    maximumRequestsPerEmailPerDay:
      KGMIS_OTP_CONFIG.MAX_OTP_REQUESTS_PER_EMAIL_PER_DAY,
    maximumGlobalRequestsPerTenMinutes:
      KGMIS_OTP_CONFIG.MAX_GLOBAL_OTP_REQUESTS_PER_WINDOW,
    maximumGlobalRequestsPerDay:
      KGMIS_OTP_CONFIG.MAX_GLOBAL_OTP_REQUESTS_PER_DAY
  };
}

function KGMIS_OTP_Request(emailAddress) {
  const email = KGMIS_OTP_NormalizeEmail_(emailAddress);

  if (!KGMIS_OTP_IsValidEmail_(email)) {
    throw new Error('Enter a valid email address.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(KGMIS_OTP_CONFIG.SCRIPT_LOCK_WAIT_MILLISECONDS);

  try {
    KGMIS_OTP_CleanupExpiredRecords_();

    const now = Date.now();

    /*
     * Apply global and per-email throttling before checking
     * whether the submitted email is authorised.
     */
    KGMIS_OTP_EnforceAndRecordRateLimits_(email, now);

    const user = KGMIS_OTP_FindActiveUserByEmail_(email);

    if (!user) {
      KGMIS_LogSecurityEvent_({
        email: email,
        userName: '',
        role: '',
        module: KGMIS_OTP_CONFIG.AUTHENTICATION_MODULE,
        action: 'OTP_REQUEST',
        result: 'DENIED',
        details: 'OTP requested for an email that is not eligible.'
      });

      return KGMIS_OTP_GenericRequestResponse_();
    }

    const properties = PropertiesService.getScriptProperties();
    const challengeKey = KGMIS_OTP_GetChallengePropertyKey_(email);
    const existingChallenge = KGMIS_OTP_ParseJson_(
      properties.getProperty(challengeKey)
    );

    KGMIS_OTP_EnforceRequestLimits_(existingChallenge, now);

    const otp = KGMIS_OTP_GenerateNumericCode_(
      KGMIS_OTP_CONFIG.OTP_DIGITS
    );
    const challengeId = KGMIS_OTP_GenerateToken_();
    const otpHash = KGMIS_OTP_Hash_([
      challengeId,
      email,
      otp
    ].join('|'));

    const requestHistory = KGMIS_OTP_GetActiveRequestHistory_(
      existingChallenge,
      now
    );
    requestHistory.push(now);

    const challenge = {
      version: 1,
      challengeId: challengeId,
      email: email,
      otpHash: otpHash,
      createdAt: now,
      expiresAt: now +
        KGMIS_OTP_CONFIG.OTP_VALID_MINUTES * 60 * 1000,
      lastSentAt: now,
      failedAttempts: 0,
      requestHistory: requestHistory
    };

    properties.setProperty(
      challengeKey,
      JSON.stringify(challenge)
    );

    KGMIS_OTP_SendEmail_(user, otp);

    KGMIS_LogSecurityEvent_({
      email: user.email,
      userName: user.userName,
      role: user.role,
      module: KGMIS_OTP_CONFIG.AUTHENTICATION_MODULE,
      action: 'OTP_REQUEST',
      result: 'SUCCESS',
      details: 'OTP sent to authorised email address.'
    });

    return {
      success: true,
      challengeId: challengeId,
      maskedEmail: KGMIS_OTP_MaskEmail_(email),
      expiresInSeconds: KGMIS_OTP_CONFIG.OTP_VALID_MINUTES * 60,
      resendAfterSeconds: KGMIS_OTP_CONFIG.RESEND_WAIT_SECONDS,
      message: 'A verification code has been sent to the authorised email address.'
    };
  } finally {
    lock.releaseLock();
  }
}

function KGMIS_OTP_Verify(emailAddress, challengeId, otpCode) {
  const email = KGMIS_OTP_NormalizeEmail_(emailAddress);
  const safeChallengeId = KGMIS_OTP_CleanText_(challengeId);
  const otp = KGMIS_OTP_CleanText_(otpCode);

  if (!KGMIS_OTP_IsValidEmail_(email)) {
    throw new Error('Enter a valid email address.');
  }

  if (!safeChallengeId) {
    throw new Error(
      'The verification request is missing. Request a new code.'
    );
  }

  const otpPattern = new RegExp(
    '^\\d{' + KGMIS_OTP_CONFIG.OTP_DIGITS + '}$'
  );

  if (!otpPattern.test(otp)) {
    throw new Error(
      'Enter the complete ' +
      KGMIS_OTP_CONFIG.OTP_DIGITS +
      '-digit verification code.'
    );
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(KGMIS_OTP_CONFIG.SCRIPT_LOCK_WAIT_MILLISECONDS);

  try {
    const properties = PropertiesService.getScriptProperties();
    const challengeKey = KGMIS_OTP_GetChallengePropertyKey_(email);
    const challenge = KGMIS_OTP_ParseJson_(
      properties.getProperty(challengeKey)
    );

    if (!challenge || challenge.challengeId !== safeChallengeId) {
      throw new Error(
        'The verification request is invalid or has expired. Request a new code.'
      );
    }

    const now = Date.now();

    if (!challenge.expiresAt || now > Number(challenge.expiresAt)) {
      properties.deleteProperty(challengeKey);
      throw new Error(
        'The verification code has expired. Request a new code.'
      );
    }

    const attempts = Number(challenge.failedAttempts || 0);

    if (attempts >= KGMIS_OTP_CONFIG.MAX_OTP_ATTEMPTS) {
      properties.deleteProperty(challengeKey);
      throw new Error(
        'Too many incorrect attempts. Request a new verification code.'
      );
    }

    const suppliedHash = KGMIS_OTP_Hash_([
      safeChallengeId,
      email,
      otp
    ].join('|'));

    if (!KGMIS_OTP_SafeEquals_(challenge.otpHash, suppliedHash)) {
      challenge.failedAttempts = attempts + 1;
      properties.setProperty(
        challengeKey,
        JSON.stringify(challenge)
      );

      const remainingAttempts = Math.max(
        0,
        KGMIS_OTP_CONFIG.MAX_OTP_ATTEMPTS -
          challenge.failedAttempts
      );

      KGMIS_LogSecurityEvent_({
        email: email,
        userName: '',
        role: '',
        module: KGMIS_OTP_CONFIG.AUTHENTICATION_MODULE,
        action: 'OTP_VERIFY',
        result: 'DENIED',
        details: 'Incorrect OTP. Remaining attempts: ' +
          remainingAttempts
      });

      throw new Error(
        'The verification code is incorrect. ' +
        remainingAttempts +
        ' attempt(s) remaining.'
      );
    }

    const user = KGMIS_OTP_FindActiveUserByEmail_(email);

    if (!user) {
      properties.deleteProperty(challengeKey);
      throw new Error(
        'This account is no longer active in KGMIS.'
      );
    }

    properties.deleteProperty(challengeKey);

    const session = KGMIS_OTP_CreateSession_(user);

    KGMIS_LogSecurityEvent_({
      email: user.email,
      userName: user.userName,
      role: user.role,
      module: KGMIS_OTP_CONFIG.AUTHENTICATION_MODULE,
      action: 'OTP_VERIFY',
      result: 'SUCCESS',
      details: 'OTP verified and 8-hour session created.'
    });

    return {
      success: true,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      expiresInSeconds: Math.floor(
        (session.expiresAt - Date.now()) / 1000
      ),
      user: {
        email: user.email,
        userName: user.userName,
        role: user.role,
        status: user.status
      },
      permissions:
        KGMIS_OTP_GetUserPermissionProfile_(
          user.role
        ),
      modules:
        KGMIS_OTP_GetUserModuleProfile_(
          user.role
        ),
      message: 'Login verified successfully.'
    };
  } finally {
    lock.releaseLock();
  }
}

function KGMIS_OTP_GetSessionUser(sessionToken) {
  const session = KGMIS_OTP_ValidateSession_(
    sessionToken
  );

  return {
    success: true,
    expiresAt: session.expiresAt,
    user: {
      email: session.email,
      userName: session.userName,
      role: session.role,
      status: session.status
    },
    permissions:
      KGMIS_OTP_GetUserPermissionProfile_(
        session.role
      ),
    modules:
      KGMIS_OTP_GetUserModuleProfile_(
        session.role
      )
  };
}


function KGMIS_OTP_GetUserModuleProfile_(role) {
  return {
    directory:
      KGMIS_UserCanAccessModule_(
        role,
        'DIRECTORY',
        'VIEW'
      ),

    reports:
      KGMIS_UserCanAccessModule_(
        role,
        'REPORTS',
        'VIEW'
      ),

    treasurer:
      KGMIS_UserCanAccessModule_(
        role,
        'TREASURER',
        'VIEW'
      ),

    treasurerUpdate:
      KGMIS_UserCanAccessModule_(
        role,
        'TREASURER',
        'UPDATE'
      ),

    familyProfileReview:
      KGMIS_UserCanAccessModule_(
        role,
        'FAMILY_PROFILE',
        'REVIEW'
      ),

    databaseAdmin:
      KGMIS_UserCanAccessModule_(
        role,
        'DATABASE',
        'ADMINISTER'
      ),

    applicationAdmin:
      KGMIS_UserCanAccessModule_(
        role,
        'APPLICATION',
        'ADMINISTER'
      ),

    accessManagement:
      KGMIS_UserCanAccessModule_(
        role,
        'ACCESS_CONTROL',
        'MANAGE'
      ),

    admin:
      (
        KGMIS_UserCanAccessModule_(
          role,
          'DATABASE',
          'ADMINISTER'
        ) ||
        KGMIS_UserCanAccessModule_(
          role,
          'APPLICATION',
          'ADMINISTER'
        ) ||
        KGMIS_UserCanAccessModule_(
          role,
          'ACCESS_CONTROL',
          'MANAGE'
        )
      )
  };
}


function KGMIS_OTP_GetUserPermissionProfile_(role) {
  return {
    directoryView:
      KGMIS_UserHasPermission_(
        role,
        'DIRECTORY_VIEW'
      ),

    treasurerView:
      KGMIS_UserHasPermission_(
        role,
        'TREASURER_VIEW'
      ),

    subscriptionUpdate:
      KGMIS_UserHasPermission_(
        role,
        'SUBSCRIPTION_UPDATE'
      ),

    familyProfileReview:
      KGMIS_UserHasPermission_(
        role,
        'FAMILY_PROFILE_REVIEW'
      ),

    databaseAdmin:
      KGMIS_UserHasPermission_(
        role,
        'DATABASE_ADMIN'
      ),

    applicationAdmin:
      KGMIS_UserHasPermission_(
        role,
        'APPLICATION_ADMIN'
      ),

    accessManagement:
      KGMIS_UserHasPermission_(
        role,
        'ACCESS_MANAGEMENT'
      )
  };
}


function KGMIS_OTP_SignOut(sessionToken) {
  const token = KGMIS_OTP_CleanText_(sessionToken);

  if (!token) {
    return {
      success: true,
      message: 'Signed out.'
    };
  }

  PropertiesService.getScriptProperties().deleteProperty(
    KGMIS_OTP_GetSessionPropertyKey_(token)
  );

  return {
    success: true,
    message: 'Signed out successfully.'
  };
}

function KGMIS_OTP_RequireSessionAccess_(
  sessionToken,
  moduleName,
  action
) {
  const safeModule =
    KGMIS_OTP_CleanText_(
      moduleName
    )
      .toUpperCase();

  const safeAction =
    KGMIS_OTP_CleanText_(
      action
    )
      .toUpperCase();

  if (!safeModule || !safeAction) {
    throw new Error(
      'Module name and action are required for access validation.'
    );
  }

  return KGMIS_OTP_ValidateSession_(
    sessionToken,
    safeModule,
    safeAction
  );
}


function KGMIS_OTP_ValidateSession_(
  sessionToken,
  moduleName,
  action
) {
  const token =
    KGMIS_OTP_CleanText_(
      sessionToken
    );

  if (!token) {
    throw new Error(
      'Your KGMIS login session is missing. Please sign in again.'
    );
  }

  const properties =
    PropertiesService
      .getScriptProperties();

  const sessionKey =
    KGMIS_OTP_GetSessionPropertyKey_(
      token
    );

  const session =
    KGMIS_OTP_ParseJson_(
      properties.getProperty(
        sessionKey
      )
    );

  if (!session) {
    throw new Error(
      'Your KGMIS login session is invalid. Please sign in again.'
    );
  }

  const now =
    Date.now();

  if (
    !session.expiresAt ||
    now > Number(
      session.expiresAt
    )
  ) {
    properties.deleteProperty(
      sessionKey
    );

    throw new Error(
      'Your KGMIS login session has expired. Please sign in again.'
    );
  }

  let user = null;

const authMethod =
  String(
    session.authMethod ||
    'EMAIL_OTP'
  )
    .trim()
    .toUpperCase();

if (
  authMethod ===
  'MOBILE_PASSWORD'
) {

  user =
    KGMIS_Mobile_Login_GetActiveSessionUser_(
      session.kefgId
    );

} else {

  user =
    KGMIS_OTP_FindActiveUserByEmail_(
      session.email
    );
}

if (!user) {

  properties.deleteProperty(
    sessionKey
  );

  throw new Error(
    'Your KGMIS access is no longer active.'
  );
}

  const safeModule =
    KGMIS_OTP_CleanText_(
      moduleName
    )
      .toUpperCase();

  const safeAction =
    KGMIS_OTP_CleanText_(
      action
    )
      .toUpperCase();

  if (safeModule || safeAction) {
    if (!safeModule || !safeAction) {
      throw new Error(
        'Both module name and action are required.'
      );
    }

    const allowed =
      KGMIS_UserCanAccessModule_(
        user.role,
        safeModule,
        safeAction
      );

    if (!allowed) {
      KGMIS_LogSecurityEvent_({
        email: user.email,
        userName: user.userName,
        role: user.role,
        module: safeModule,
        action: safeAction,
        result: 'DENIED',
        details:
          'The KGMIS session is valid, but the role does not permit this action.'
      });

      throw new Error(
        'Access denied. Your role does not permit this action.'
      );
    }
  }

  return {
  sessionToken:
    token,

  authMethod:
    String(
      session.authMethod || 'EMAIL_OTP'
    )
      .trim()
      .toUpperCase(),

  email:
    String(
      user.email ||
      session.email ||
      ''
    )
      .trim()
      .toLowerCase(),

  kefgId:
    String(
      session.kefgId ||
      user.kefgId ||
      ''
    )
      .trim()
      .toUpperCase(),

  familyId:
    String(
      session.familyId ||
      user.familyId ||
      ''
    )
      .trim()
      .toUpperCase(),

  registeredMobile:
    String(
      session.registeredMobile ||
      user.registeredMobile ||
      ''
    ).trim(),

  userName:
    String(
      user.userName ||
      session.userName ||
      ''
    ).trim(),

  role:
    String(
      user.role ||
      session.role ||
      'DIRECTORY_USER'
    )
      .trim()
      .toUpperCase(),

  status:
    String(
      user.status ||
      session.status ||
      'ACTIVE'
    )
      .trim()
      .toUpperCase(),

  createdAt:
    session.createdAt,

  expiresAt:
    session.expiresAt
  };
}


function KGMIS_OTP_CreateSession_(user) {
  const properties = PropertiesService.getScriptProperties();
  const now = Date.now();
  const sessionToken =
    KGMIS_OTP_GenerateToken_() +
    KGMIS_OTP_GenerateToken_();

  const session = {
  version: 2,

  authMethod:
    String(
      user.authMethod || 'EMAIL_OTP'
    )
      .trim()
      .toUpperCase(),

  email:
    String(
      user.email || ''
    )
      .trim()
      .toLowerCase(),

  kefgId:
    String(
      user.kefgId || ''
    )
      .trim()
      .toUpperCase(),

  familyId:
    String(
      user.familyId || ''
    )
      .trim()
      .toUpperCase(),

  registeredMobile:
    String(
      user.registeredMobile || ''
    ).trim(),

  userName:
    String(
      user.userName || ''
    ).trim(),

  role:
    String(
      user.role || ''
    )
      .trim()
      .toUpperCase(),

  status:
    String(
      user.status || ''
    )
      .trim()
      .toUpperCase(),

  createdAt:
    now,

  expiresAt:
    now +
    KGMIS_OTP_CONFIG.SESSION_VALID_MINUTES *
    60 *
    1000
};

  properties.setProperty(
    KGMIS_OTP_GetSessionPropertyKey_(sessionToken),
    JSON.stringify(session)
  );

  return {
    sessionToken: sessionToken,
    expiresAt: session.expiresAt
  };
}

function KGMIS_OTP_FindActiveUserByEmail_(emailAddress) {
  const email = KGMIS_OTP_NormalizeEmail_(emailAddress);

  if (!email) {
    return null;
  }

  const context = KGMIS_GetAccessControlContext_();

  for (
    let rowIndex = 1;
    rowIndex < context.values.length;
    rowIndex++
  ) {
    const row = context.values[rowIndex];
    const rowEmail = KGMIS_OTP_NormalizeEmail_(
      row[context.column.EMAIL]
    );

    if (rowEmail !== email) {
      continue;
    }

    const status = String(
      row[context.column.STATUS] || ''
    ).trim().toUpperCase();

    const role = String(
      row[context.column.ROLE] || ''
    ).trim().toUpperCase();

    const userName = KGMIS_OTP_CleanText_(
      row[context.column.USER_NAME]
    );

    if (
      status !==
      KGMIS_SECURITY_CONFIG.USER_STATUS.ACTIVE
    ) {
      return null;
    }

    try {
      KGMIS_ValidateRole_(role);
    } catch (error) {
      return null;
    }
return {
      email: rowEmail,
      userName: userName,
      role: role,
      status: status,
      remarks: KGMIS_OTP_CleanText_(
        row[context.column.REMARKS]
      )
    };
  }

  return null;
}


/**
 * Backward-compatible alias for earlier builds.
 */
function KGMIS_OTP_FindEligibleUserByEmail_(
  emailAddress
) {
  return KGMIS_OTP_FindActiveUserByEmail_(
    emailAddress
  );
}


/**
 * Applies and records global and per-email OTP request limits.
 *
 * Limits:
 * - 40 total requests per 10 minutes
 * - 150 total requests per day
 * - 10 requests per email address per day
 */
function KGMIS_OTP_EnforceAndRecordRateLimits_(email, now) {
  const properties = PropertiesService.getScriptProperties();

  const globalRecord = KGMIS_OTP_ParseJson_(
    properties.getProperty(
      KGMIS_OTP_CONFIG.GLOBAL_RATE_PROPERTY
    )
  ) || { requests: [] };

  const emailRateKey =
    KGMIS_OTP_GetEmailRatePropertyKey_(email);

  const emailRecord = KGMIS_OTP_ParseJson_(
    properties.getProperty(emailRateKey)
  ) || { requests: [] };

  const globalRequests =
    KGMIS_OTP_NormalizeTimestampHistory_(
      globalRecord.requests
    );

  const emailRequests =
    KGMIS_OTP_NormalizeTimestampHistory_(
      emailRecord.requests
    );

  const globalShortWindowStart =
    now -
    KGMIS_OTP_CONFIG.GLOBAL_REQUEST_WINDOW_MINUTES *
    60 *
    1000;

  const globalDailyWindowStart =
    now -
    KGMIS_OTP_CONFIG.GLOBAL_DAILY_WINDOW_MINUTES *
    60 *
    1000;

  const emailDailyWindowStart =
    now -
    KGMIS_OTP_CONFIG.PER_EMAIL_DAILY_WINDOW_MINUTES *
    60 *
    1000;

  const recentGlobalRequests =
    globalRequests.filter(function (timestamp) {
      return timestamp >= globalShortWindowStart;
    });

  const dailyGlobalRequests =
    globalRequests.filter(function (timestamp) {
      return timestamp >= globalDailyWindowStart;
    });

  const dailyEmailRequests =
    emailRequests.filter(function (timestamp) {
      return timestamp >= emailDailyWindowStart;
    });

  if (
    recentGlobalRequests.length >=
    KGMIS_OTP_CONFIG.MAX_GLOBAL_OTP_REQUESTS_PER_WINDOW
  ) {
    throw new Error(
      'The verification service is temporarily busy. ' +
      'Please wait a few minutes and try again.'
    );
  }

  if (
    dailyGlobalRequests.length >=
    KGMIS_OTP_CONFIG.MAX_GLOBAL_OTP_REQUESTS_PER_DAY
  ) {
    throw new Error(
      'The verification service has reached its daily request limit. ' +
      'Please try again later.'
    );
  }

  if (
    dailyEmailRequests.length >=
    KGMIS_OTP_CONFIG.MAX_OTP_REQUESTS_PER_EMAIL_PER_DAY
  ) {
    throw new Error(
      'The daily verification-code limit for this email address ' +
      'has been reached. Please try again tomorrow.'
    );
  }

  dailyGlobalRequests.push(now);
  dailyEmailRequests.push(now);

  properties.setProperty(
    KGMIS_OTP_CONFIG.GLOBAL_RATE_PROPERTY,
    JSON.stringify({
      requests: dailyGlobalRequests,
      expiresAt:
        now +
        KGMIS_OTP_CONFIG.GLOBAL_DAILY_WINDOW_MINUTES *
        60 *
        1000
    })
  );

  properties.setProperty(
    emailRateKey,
    JSON.stringify({
      requests: dailyEmailRequests,
      expiresAt:
        now +
        KGMIS_OTP_CONFIG.PER_EMAIL_DAILY_WINDOW_MINUTES *
        60 *
        1000
    })
  );
}


function KGMIS_OTP_NormalizeTimestampHistory_(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .map(function (timestamp) {
      return Number(timestamp);
    })
    .filter(function (timestamp) {
      return Number.isFinite(timestamp);
    });
}


function KGMIS_OTP_EnforceRequestLimits_(existingChallenge, now) {
  if (!existingChallenge) {
    return;
  }

  const lastSentAt = Number(existingChallenge.lastSentAt || 0);
  const secondsSinceLastRequest = Math.floor(
    (now - lastSentAt) / 1000
  );

  if (
    lastSentAt &&
    secondsSinceLastRequest <
      KGMIS_OTP_CONFIG.RESEND_WAIT_SECONDS
  ) {
    const waitSeconds =
      KGMIS_OTP_CONFIG.RESEND_WAIT_SECONDS -
      secondsSinceLastRequest;

    throw new Error(
      'Please wait ' +
      waitSeconds +
      ' second(s) before requesting another code.'
    );
  }

  const requestHistory = KGMIS_OTP_GetActiveRequestHistory_(
    existingChallenge,
    now
  );

  if (
    requestHistory.length >=
    KGMIS_OTP_CONFIG.MAX_OTP_REQUESTS_PER_HOUR
  ) {
    throw new Error(
      'Too many verification-code requests. Please try again later.'
    );
  }
}

function KGMIS_OTP_GetActiveRequestHistory_(challenge, now) {
  const history =
    challenge && Array.isArray(challenge.requestHistory)
      ? challenge.requestHistory
      : [];

  const windowStart = now -
    KGMIS_OTP_CONFIG.REQUEST_WINDOW_MINUTES * 60 * 1000;

  return history
    .map(function (timestamp) {
      return Number(timestamp);
    })
    .filter(function (timestamp) {
      return Number.isFinite(timestamp) && timestamp >= windowStart;
    });
}

function KGMIS_OTP_SendEmail_(user, otp) {
  if (MailApp.getRemainingDailyQuota() < 1) {
    throw new Error(
      'The verification email could not be sent because the daily email limit has been reached.'
    );
  }

  const expiryMinutes = KGMIS_OTP_CONFIG.OTP_VALID_MINUTES;

  const plainBody =
    'KEF Global Membership Information System\n\n' +
    'Your KGMIS verification code is:\n\n' +
    otp +
    '\n\nThis code is valid for ' +
    expiryMinutes +
    ' minutes and can be used only once.\n\n' +
    'Do not share this code with anyone.\n\n' +
    'If you did not request this code, you may ignore this email.';

  const htmlBody =
    '<div style="font-family:Arial,sans-serif;max-width:560px;' +
    'margin:0 auto;padding:24px;color:#1f2937;">' +
      '<div style="padding:22px;border:1px solid #d5e0e8;' +
      'border-radius:14px;background:#ffffff;">' +
        '<h2 style="margin:0 0 8px;color:#0d4e70;">' +
          'KGMIS Main Portal' +
        '</h2>' +
        '<p style="margin:0 0 20px;color:#64748b;">' +
          'Email verification code' +
        '</p>' +
        '<p style="margin:0 0 10px;">Hello ' +
          KGMIS_OTP_EscapeHtml_(user.userName || user.email) +
          ',</p>' +
        '<p style="margin:0 0 16px;">Use the following code to sign in:</p>' +
        '<div style="margin:18px 0;padding:16px;border-radius:10px;' +
        'background:#e7f4f9;color:#0d4e70;font-size:32px;' +
        'font-weight:800;letter-spacing:8px;text-align:center;">' +
          KGMIS_OTP_EscapeHtml_(otp) +
        '</div>' +
        '<p style="margin:0 0 8px;color:#475569;">' +
          'This code is valid for ' +
          expiryMinutes +
          ' minutes and can be used only once.' +
        '</p>' +
        '<p style="margin:0;color:#991b1b;font-weight:700;">' +
          'Do not share this code with anyone.' +
        '</p>' +
      '</div>' +
      '<p style="margin:14px 0 0;color:#94a3b8;font-size:12px;' +
      'text-align:center;">KEF Global Membership Information System</p>' +
    '</div>';

  MailApp.sendEmail({
    to: user.email,
    subject: KGMIS_OTP_CONFIG.EMAIL_SUBJECT,
    body: plainBody,
    htmlBody: htmlBody,
    name: KGMIS_OTP_CONFIG.EMAIL_SENDER_NAME
  });
}

function KGMIS_OTP_CleanupExpiredRecords_() {
  const properties = PropertiesService.getScriptProperties();
  const allProperties = properties.getProperties();
  const now = Date.now();

  Object.keys(allProperties).forEach(function (key) {
    const isOtpRecord = key.indexOf(
      KGMIS_OTP_CONFIG.OTP_PROPERTY_PREFIX
    ) === 0;

    const isSessionRecord = key.indexOf(
      KGMIS_OTP_CONFIG.SESSION_PROPERTY_PREFIX
    ) === 0;

    const isEmailRateRecord = key.indexOf(
      KGMIS_OTP_CONFIG.EMAIL_RATE_PROPERTY_PREFIX
    ) === 0;

    const isGlobalRateRecord =
      key === KGMIS_OTP_CONFIG.GLOBAL_RATE_PROPERTY;

    if (
      !isOtpRecord &&
      !isSessionRecord &&
      !isEmailRateRecord &&
      !isGlobalRateRecord
    ) {
      return;
    }

    const record = KGMIS_OTP_ParseJson_(allProperties[key]);

    if (
      !record ||
      !record.expiresAt ||
      now > Number(record.expiresAt)
    ) {
      properties.deleteProperty(key);
    }
  });
}

function KGMIS_OTP_GenericRequestResponse_() {
  return {
    success: true,
    challengeId: '',
    maskedEmail: '',
    expiresInSeconds: KGMIS_OTP_CONFIG.OTP_VALID_MINUTES * 60,
    resendAfterSeconds: KGMIS_OTP_CONFIG.RESEND_WAIT_SECONDS,
    message: 'If the email address is authorised, a verification code will be sent shortly.'
  };
}

function KGMIS_OTP_GetChallengePropertyKey_(email) {
  return KGMIS_OTP_CONFIG.OTP_PROPERTY_PREFIX +
    KGMIS_OTP_ShortHash_(KGMIS_OTP_NormalizeEmail_(email));
}

function KGMIS_OTP_GetSessionPropertyKey_(sessionToken) {
  return KGMIS_OTP_CONFIG.SESSION_PROPERTY_PREFIX +
    KGMIS_OTP_ShortHash_(KGMIS_OTP_CleanText_(sessionToken));
}

function KGMIS_OTP_GetEmailRatePropertyKey_(email) {
  return KGMIS_OTP_CONFIG.EMAIL_RATE_PROPERTY_PREFIX +
    KGMIS_OTP_ShortHash_(
      KGMIS_OTP_NormalizeEmail_(email)
    );
}

function KGMIS_OTP_GenerateNumericCode_(digits) {
  const safeDigits = Math.max(
    4,
    Math.min(8, Number(digits) || 6)
  );

  const source = Utilities.getUuid().replace(/-/g, '');
  const numeric = source
    .split('')
    .map(function (character) {
      return String(parseInt(character, 16) % 10);
    })
    .join('');

  return numeric.slice(0, safeDigits).padEnd(safeDigits, '0');
}

function KGMIS_OTP_GenerateToken_() {
  return Utilities.getUuid().replace(/-/g, '');
}

function KGMIS_OTP_Hash_(value) {
  const secret = KGMIS_OTP_GetSecuritySecret_();
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    secret + '|' + String(value || ''),
    Utilities.Charset.UTF_8
  );

  return bytes.map(function (byte) {
    const unsigned = byte < 0 ? byte + 256 : byte;
    return ('0' + unsigned.toString(16)).slice(-2);
  }).join('');
}

function KGMIS_OTP_ShortHash_(value) {
  return KGMIS_OTP_Hash_(value).slice(0, 32);
}

function KGMIS_OTP_GetSecuritySecret_() {
  const properties = PropertiesService.getScriptProperties();
  let secret = properties.getProperty(
    KGMIS_OTP_CONFIG.SECURITY_SECRET_PROPERTY
  );

  if (!secret) {
    secret = KGMIS_OTP_GenerateToken_() +
      KGMIS_OTP_GenerateToken_();

    properties.setProperty(
      KGMIS_OTP_CONFIG.SECURITY_SECRET_PROPERTY,
      secret
    );
  }

  return secret;
}

function KGMIS_OTP_SafeEquals_(firstValue, secondValue) {
  const first = String(firstValue || '');
  const second = String(secondValue || '');
  let difference = first.length ^ second.length;
  const maximumLength = Math.max(first.length, second.length);

  for (let index = 0; index < maximumLength; index++) {
    const firstCode = index < first.length
      ? first.charCodeAt(index)
      : 0;
    const secondCode = index < second.length
      ? second.charCodeAt(index)
      : 0;

    difference |= firstCode ^ secondCode;
  }

  return difference === 0;
}

function KGMIS_OTP_NormalizeEmail_(value) {
  return String(value || '').trim().toLowerCase();
}

function KGMIS_OTP_IsValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(email || '')
  );
}

function KGMIS_OTP_CleanText_(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function KGMIS_OTP_ParseJson_(value) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function KGMIS_OTP_MaskEmail_(email) {
  const parts = KGMIS_OTP_NormalizeEmail_(email).split('@');

  if (parts.length !== 2) {
    return '';
  }

  const local = parts[0];
  const domain = parts[1];
  const visibleCharacters = Math.min(2, local.length);

  return local.slice(0, visibleCharacters) +
    '*'.repeat(Math.max(2, local.length - visibleCharacters)) +
    '@' + domain;
}

function KGMIS_OTP_EscapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function KGMIS_TestOtpModuleProfile(role) {
  const safeRole =
    KGMIS_OTP_CleanText_(
      role || 'DIRECTORY_USER'
    )
      .toUpperCase();

  KGMIS_ValidateRole_(
    safeRole
  );

  const result = {
    success: true,
    role: safeRole,
    permissions:
      KGMIS_OTP_GetUserPermissionProfile_(
        safeRole
      ),
    modules:
      KGMIS_OTP_GetUserModuleProfile_(
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


function KGMIS_TestOtpConfiguration() {
  const result = KGMIS_OTP_GetLoginConfig();
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}


function KGMIS_TestOtpRateLimitConfiguration() {
  const result = {
    success: true,
    perEmailPerHour:
      KGMIS_OTP_CONFIG.MAX_OTP_REQUESTS_PER_HOUR,
    perEmailPerDay:
      KGMIS_OTP_CONFIG.MAX_OTP_REQUESTS_PER_EMAIL_PER_DAY,
    globalPerTenMinutes:
      KGMIS_OTP_CONFIG.MAX_GLOBAL_OTP_REQUESTS_PER_WINDOW,
    globalPerDay:
      KGMIS_OTP_CONFIG.MAX_GLOBAL_OTP_REQUESTS_PER_DAY
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

function KGMIS_TestOtpCleanup() {
  KGMIS_OTP_CleanupExpiredRecords_();

  const result = {
    success: true,
    message: 'Expired OTP and session records were cleaned.'
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/*
 * ============================================================
 * GET EFFECTIVE USER BY EMAIL
 *
 * Business Rules
 * ------------------------------------------------------------
 * 1. Email found and ACTIVE
 *      -> Use stored ROLE
 *
 * 2. Email found but INACTIVE
 *      -> DIRECTORY_USER
 *
 * 3. Email not found
 *      -> DIRECTORY_USER
 * ============================================================
 */

function KGMIS_GetEffectiveUserByEmail_(
  emailAddress,
  fallbackUserName
) {

  const email =
    KGMIS_OTP_NormalizeEmail_(
      emailAddress
    );

  const defaultUser = {

    email:
      email,

    userName:
      String(
        fallbackUserName || ''
      ).trim(),

    role:
      'DIRECTORY_USER',

    status:
      'ACTIVE',

    privileged:
      false

  };


  if (
    !email
  ) {
    return defaultUser;
  }


  const context =
    KGMIS_GetAccessControlContext_();


  for (
    let rowIndex = 1;
    rowIndex <
      context.values.length;
    rowIndex++
  ) {

    const row =
      context.values[
        rowIndex
      ];


    const rowEmail =
      KGMIS_OTP_NormalizeEmail_(
        row[
          context.column.EMAIL
        ]
      );


    if (
      rowEmail !==
      email
    ) {
      continue;
    }


    const status =
      String(
        row[
          context.column.STATUS
        ] || ''
      )
        .trim()
        .toUpperCase();


    /*
     * Inactive users simply lose
     * elevated privileges.
     */

    if (
      status !==
      'ACTIVE'
    ) {
      return defaultUser;
    }


    const role =
      String(
        row[
          context.column.ROLE
        ] || ''
      )
        .trim()
        .toUpperCase();


    try {

      KGMIS_ValidateRole_(
        role
      );

    } catch (error) {

      return defaultUser;

    }


    return {

      email:
        email,

      userName:
        KGMIS_OTP_CleanText_(
          row[
            context.column.USER_NAME
          ]
        ) ||
        defaultUser.userName,

      role:
        role,

      status:
        'ACTIVE',

      privileged:
        (
          role !==
          'DIRECTORY_USER'
        )

    };

  }


  /*
   * Email not listed.
   * Every verified member automatically
   * becomes DIRECTORY_USER.
   */

  return defaultUser;

}