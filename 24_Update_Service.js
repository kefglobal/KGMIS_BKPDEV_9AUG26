/******************************************************************************
 *
 * KEFG Membership Information System (KMIS)
 *
 * Module        : Update Service
 * File          : 24_Update_Service.gs
 * Version       : 2.0
 * Status        : Development
 *
 ******************************************************************************/

/**
 * Central write/update functions for KMIS.
 */


/**
 * Updates selected fields for one KEFG_ID.
 *
 * Example:
 *
 * KMIS_UPDATE_Member(
 *   'KEFG1007',
 *   {
 *     MEMBER_MOBILE: '971501234567',
 *     MEMBER_EMAIL: 'name@example.com'
 *   }
 * );
 */
function KMIS_UPDATE_Member(
  kefgId,
  updates
) {
  const user =
    KMIS_RequireDatabaseAdminAccess_();

  const safeId =
    KMIS_DB_Clean_(kefgId);

  if (!safeId) {
    throw new Error(
      'KEFG_ID is required.'
    );
  }

  const safeUpdates =
    KMIS_UPDATE_ValidateUpdates_(
      updates
    );

  const lock =
    LockService.getScriptLock();

  lock.waitLock(
    KMIS_CONSTANTS.SYSTEM_LIMITS
      .LOCK_TIMEOUT_MILLISECONDS
  );

  try {
    const context =
      KMIS_DB_GetContext();

    const sheetRow =
      KMIS_DB_FindRowByKEFGID(
        safeId,
        context
      );

    if (!sheetRow) {
      throw new Error(
        `No KMIS member was found for ${safeId}.`
      );
    }

    const result =
      KMIS_UPDATE_ApplyToRow_(
        context,
        sheetRow,
        safeUpdates
      );

    SpreadsheetApp.flush();

    return {
      success: true,
      message:
        `KMIS member ${safeId} updated successfully.`,
      updatedBy: user.email,
      changedFields:
        result.changedFields,
      unchangedFields:
        result.unchangedFields
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * Updates selected fields for every row sharing a FAMILY_ID.
 */
function KMIS_UPDATE_Family(
  familyId,
  updates
) {
  const user =
    KMIS_RequireDatabaseAdminAccess_();

  const safeFamilyId =
    KMIS_DB_Clean_(familyId);

  if (!safeFamilyId) {
    throw new Error(
      'FAMILY_ID is required.'
    );
  }

  const safeUpdates =
    KMIS_UPDATE_ValidateUpdates_(
      updates
    );

  const lock =
    LockService.getScriptLock();

  lock.waitLock(
    KMIS_CONSTANTS.SYSTEM_LIMITS
      .LOCK_TIMEOUT_MILLISECONDS
  );

  try {
    const context =
      KMIS_DB_GetContext();

    const rows =
      KMIS_DB_FindRowsByFamilyID(
        safeFamilyId,
        context
      );

    if (!rows.length) {
      throw new Error(
        `No KMIS family was found for ${safeFamilyId}.`
      );
    }

    const results = rows.map(sheetRow =>
      KMIS_UPDATE_ApplyToRow_(
        context,
        sheetRow,
        safeUpdates
      )
    );

    SpreadsheetApp.flush();

    return {
      success: true,
      message:
        `KMIS family ${safeFamilyId} updated successfully.`,
      updatedBy: user.email,
      rowsUpdated: rows.length,
      rowResults: results
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * Updates subscription status and payment date for all rows
 * sharing the same FAMILY_ID.
 */
function KMIS_UPDATE_Subscription(
  familyId,
  status,
  paymentDateIso
) {
  const user =
    KMIS_RequireSubscriptionWriteAccess_();

  const safeFamilyId =
    KMIS_DB_Clean_(familyId);

  if (!safeFamilyId) {
    throw new Error(
      'FAMILY_ID is required.'
    );
  }

  const safeStatus =
    KMIS_DB_Clean_(status)
      .toUpperCase();

  const validStatuses =
    KMIS_CONST_GetSubscriptionStatuses();

  if (
    !validStatuses.includes(
      safeStatus
    )
  ) {
    throw new Error(
      `Invalid subscription status: ${safeStatus}`
    );
  }

  const safePaymentDate =
    KMIS_DB_Clean_(paymentDateIso);

  if (
    safeStatus ===
      KMIS_CONSTANTS
        .SUBSCRIPTION_STATUS
        .PAID &&
    !safePaymentDate
  ) {
    throw new Error(
      'Payment date is required when the subscription status is PAID.'
    );
  }

  const parsedPaymentDate =
    safePaymentDate
      ? KMIS_UPDATE_ParseIsoDate_(
          safePaymentDate
        )
      : null;

  const lock =
    LockService.getScriptLock();

  lock.waitLock(
    KMIS_CONSTANTS.SYSTEM_LIMITS
      .LOCK_TIMEOUT_MILLISECONDS
  );

  try {
    const context =
      KMIS_DB_GetContext();

    const rows =
      KMIS_DB_FindRowsByFamilyID(
        safeFamilyId,
        context
      );

    if (!rows.length) {
      throw new Error(
        `No KMIS family was found for ${safeFamilyId}.`
      );
    }

    rows.forEach(sheetRow => {
      context.sheet
        .getRange(
          sheetRow,
          context.column
            .SUBSCRIPTION_STATUS_2026_2027 +
            1
        )
        .setValue(safeStatus);

      if (parsedPaymentDate) {
        context.sheet
          .getRange(
            sheetRow,
            context.column
              .SUBSCRIPTION_PAYMENT_DATE_2026_2027 +
              1
          )
          .setValue(parsedPaymentDate)
          .setNumberFormat(
            KMIS_CONSTANTS
              .DATE_FORMATS
              .SHEET_DATE
          );
      }
    });

    SpreadsheetApp.flush();

    return {
      success: true,
      message:
        `Subscription details updated successfully for ${safeFamilyId}.`,
      familyId: safeFamilyId,
      status: safeStatus,
      paymentDate:
        safePaymentDate,
      rowsUpdated:
        rows.length,
      updatedBy:
        user.email
    };

  } finally {
    lock.releaseLock();
  }
}


/**
 * Applies an update object to one KMIS row.
 *
 * Blank values do not erase existing data by default.
 *
 * To explicitly clear a field, use:
 *
 * {
 *   FIELD_NAME: {
 *     clear: true
 *   }
 * }
 */
function KMIS_UPDATE_ApplyToRow_(
  context,
  sheetRow,
  updates
) {
  const changedFields = [];
  const unchangedFields = [];

  Object.entries(updates)
    .forEach(([header, requestedValue]) => {
      if (
        !Object.prototype.hasOwnProperty.call(
          context.column,
          header
        )
      ) {
        throw new Error(
          `Unknown KMIS header: ${header}`
        );
      }

      const columnIndex =
        context.column[header];

      const cell =
        context.sheet.getRange(
          sheetRow,
          columnIndex + 1
        );

      const existingValue =
        cell.getValue();

      const clearRequested =
        requestedValue &&
        typeof requestedValue === 'object' &&
        requestedValue.clear === true;

      if (clearRequested) {
        if (
          KMIS_DB_Clean_(existingValue)
        ) {
          cell.clearContent();
          changedFields.push(header);
        } else {
          unchangedFields.push(header);
        }

        return;
      }

      const newValue =
        requestedValue === null ||
        requestedValue === undefined
          ? ''
          : requestedValue;

      /*
       * Protect existing data:
       * a blank submitted value does not erase a valid value.
       */
      if (
        KMIS_DB_Clean_(newValue) === '' &&
        KMIS_DB_Clean_(existingValue) !== ''
      ) {
        unchangedFields.push(header);
        return;
      }

      if (
        KMIS_UPDATE_ValuesEqual_(
          existingValue,
          newValue
        )
      ) {
        unchangedFields.push(header);
        return;
      }

      cell.setValue(newValue);
      changedFields.push(header);
    });

  /*
   * Automatically update PROFILE_LAST_UPDATED
   * when a real change was made.
   */
  if (
    changedFields.length &&
    Object.prototype.hasOwnProperty.call(
      context.column,
      'PROFILE_LAST_UPDATED'
    )
  ) {
    context.sheet
      .getRange(
        sheetRow,
        context.column
          .PROFILE_LAST_UPDATED +
          1
      )
      .setValue(new Date())
      .setNumberFormat(
        KMIS_CONSTANTS
          .DATE_FORMATS
          .SHEET_DATETIME
      );
  }

  return {
    sheetRow,
    changedFields,
    unchangedFields
  };
}


/**
 * Validates the update object.
 */
function KMIS_UPDATE_ValidateUpdates_(
  updates
) {
  if (
    !updates ||
    typeof updates !== 'object' ||
    Array.isArray(updates)
  ) {
    throw new Error(
      'Updates must be supplied as a field-value object.'
    );
  }

  const entries =
    Object.entries(updates);

  if (!entries.length) {
    throw new Error(
      'No update fields were supplied.'
    );
  }

  const protectedHeaders = [
    'KEFG_ID',
    'FAMILY_ID',
    'RELATED_MEMBER_KEFG_ID'
  ];

  entries.forEach(([header]) => {
    if (
      protectedHeaders.includes(header)
    ) {
      throw new Error(
        `Protected identifier cannot be updated through this service: ${header}`
      );
    }
  });

  return updates;
}


function KMIS_UPDATE_ValuesEqual_(
  oldValue,
  newValue
) {
  if (
    Object.prototype.toString.call(oldValue) ===
      '[object Date]' &&
    Object.prototype.toString.call(newValue) ===
      '[object Date]'
  ) {
    return (
      oldValue.getTime() ===
      newValue.getTime()
    );
  }

  return (
    KMIS_DB_Clean_(oldValue) ===
    KMIS_DB_Clean_(newValue)
  );
}


/**
 * Parses YYYY-MM-DD without timezone shifting.
 */
function KMIS_UPDATE_ParseIsoDate_(
  isoDate
) {
  const match =
    String(isoDate).match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    throw new Error(
      'Invalid date format. Expected YYYY-MM-DD.'
    );
  }

  const year = Number(match[1]);
  const monthIndex =
    Number(match[2]) - 1;
  const day = Number(match[3]);

  const date =
    new Date(
      year,
      monthIndex,
      day
    );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    throw new Error(
      'Invalid calendar date.'
    );
  }

  return date;
}


/**
 * Safe manual test.
 *
 * This performs no update. It only confirms the service loads.
 */
function KMIS_UPDATE_TestConfiguration() {
  KMIS_RequireDatabaseAdminAccess_();

  const context =
    KMIS_DB_GetContext();

  const result = {
    success: true,
    sheetName:
      context.sheetName,

    supportsSubscriptionStatus:
      Object.prototype.hasOwnProperty.call(
        context.column,
        'SUBSCRIPTION_STATUS_2026_2027'
      ),

    supportsPaymentDate:
      Object.prototype.hasOwnProperty.call(
        context.column,
        'SUBSCRIPTION_PAYMENT_DATE_2026_2027'
      ),

    supportsProfileTimestamp:
      Object.prototype.hasOwnProperty.call(
        context.column,
        'PROFILE_LAST_UPDATED'
      )
  };

  Logger.log(
    JSON.stringify(result, null, 2)
  );

  return result;
}