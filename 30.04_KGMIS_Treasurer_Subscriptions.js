/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Treasurer Module
 *
 * Subscription Management
 *
 * File:
 * 30.03_KGMIS_Treasurer_Subscriptions.gs
 * ============================================================
 */


/**
 * ============================================================
 * Update Subscription
 * ============================================================
 *
 * Updates every member belonging to the same FAMILY_ID.
 */
function KGMIS_Treasurer_UpdateSubscription(
  familyId,
  newStatus,
  paymentDateIso
) {

  const authorisedUser =
    KGMIS_RequireModuleAccess_(

      KGMIS_TREASURER_CONFIG.MODULE_NAME,

      KGMIS_TREASURER_CONFIG.UPDATE_ACTION

    );

  const safeFamilyId =
    KGMIS_Treasurer_CleanValue_(familyId);

  const safeStatus =
    KGMIS_Treasurer_GetEffectiveSubscriptionStatus_(
      newStatus
    );

  const safePaymentDate =
    KGMIS_Treasurer_CleanValue_(paymentDateIso);

  if (!safeFamilyId) {
    throw new Error(
      "Family ID is required."
    );
  }

  if (
    !KGMIS_TREASURER_DATA_CONFIG
      .STATUS_OPTIONS
      .includes(safeStatus)
  ) {
    throw new Error(
      "Invalid subscription status."
    );
  }

  if (
    safeStatus === "PAID" &&
    !safePaymentDate
  ) {
    throw new Error(
      "Payment date is required."
    );
  }

  const paymentDate =
    safePaymentDate
      ? KGMIS_Treasurer_ParseIsoDate_(
          safePaymentDate
        )
      : null;

  const lock =
    LockService.getScriptLock();

  lock.waitLock(30000);

  try {

    const context =
      KGMIS_Treasurer_GetContext_();

    const sheet =
      context.sheet;

    const values =
      context.values;

    const column =
      context.column;

    const matchingRows = [];

    for (
      let rowIndex = 1;
      rowIndex < values.length;
      rowIndex++
    ) {

      const currentFamilyId =
        KGMIS_Treasurer_CleanValue_(
          values[rowIndex][column.FAMILY_ID]
        );

      if (
        currentFamilyId === safeFamilyId
      ) {

        matchingRows.push(
          rowIndex + 1
        );

      }

    }

    if (
      matchingRows.length === 0
    ) {

      throw new Error(

        "Family ID " +
        safeFamilyId +
        " not found."

      );

    }

    matchingRows.forEach(sheetRow => {

      sheet.getRange(

        sheetRow,

        column.SUBSCRIPTION_STATUS + 1

      ).setValue(safeStatus);

    const paymentDateCell =
  sheet.getRange(
    sheetRow,
    column.PAYMENT_DATE + 1
  );

if (safeStatus === 'PAID') {
  paymentDateCell
    .setValue(paymentDate)
    .setNumberFormat(
      KGMIS_TREASURER_DATA_CONFIG
        .DATE_DISPLAY_FORMAT
    );
} else {
  paymentDateCell.clearContent();
}

    });

    SpreadsheetApp.flush();

    return {

      success: true,

      familyId: safeFamilyId,

      status: safeStatus,

      paymentDate: safePaymentDate,

      rowsUpdated:
        matchingRows.length,

      updatedBy: {

        email:
          authorisedUser.email,

        userName:
          authorisedUser.userName,

        role:
          authorisedUser.role

      },

      message:

        "Subscription updated successfully."

    };

  }

  finally {

    lock.releaseLock();

  }

}


/**
 * ============================================================
 * Subscription Status
 * ============================================================
 */

function KGMIS_Treasurer_GetEffectiveSubscriptionStatus_(
  status
) {

  const value =
    KGMIS_Treasurer_CleanValue_(status)
      .toUpperCase();

  return value || "NOT PAID";

}


/**
 * ============================================================
 * Parse ISO Date
 * ============================================================
 */

function KGMIS_Treasurer_ParseIsoDate_(
  isoDate
) {

  const match =

    String(isoDate)

    .match(

      /^(\d{4})-(\d{2})-(\d{2})$/

    );

  if (!match) {

    throw new Error(

      "Invalid payment date."

    );

  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]) - 1;

  const day =
    Number(match[3]);

  return new Date(
    year,
    month,
    day
  );

}


/**
 * ============================================================
 * Compatibility Wrapper
 * ============================================================
 */

function updateSubscriptionDetails(

  familyId,

  newStatus,

  paymentDateIso

) {

  return KGMIS_Treasurer_UpdateSubscription(

    familyId,

    newStatus,

    paymentDateIso

  );

}