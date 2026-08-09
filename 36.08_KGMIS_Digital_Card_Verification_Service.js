/**
 * ============================================================
 * SECTION 9 - CONFIGURATION
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

const KGMIS_VERIFICATION = {

  STATUS: {

    VERIFIED: "VERIFIED",

    FAILED: "FAILED"

  },

  CARD_STATUS: {

    ACTIVE: "ACTIVE",

    INACTIVE: "INACTIVE",

    EXPIRED: "EXPIRED",

    REVOKED: "REVOKED",

    ARCHIVED: "ARCHIVED"

  },

  MEMBERSHIP_STATUS: {

    CURRENT: "CURRENT",

    PENDING: "PENDING",

    EXPIRED: "EXPIRED",

    SUSPENDED: "SUSPENDED",

    CANCELLED: "CANCELLED"

  },

  CARD_STATE: {

    CURRENT: "CURRENT",

    REPLACED: "REPLACED",

    LOST: "LOST",

    DAMAGED: "DAMAGED",

    SUPERSEDED: "SUPERSEDED"

  },

  REASON: {

    VERIFIED:
      "Card verified successfully.",

    CARD_NOT_FOUND:
      "Card not found.",

    QR_TOKEN_INVALID:
      "QR Token not found.",

    CARD_INACTIVE:
      "Card is inactive.",

    CARD_EXPIRED:
      "Card has expired.",

    MEMBERSHIP_NOT_CURRENT:
      "Membership is not current.",

    VALIDATION_FAILED:
      "Card validation failed."

  }

};

/**
 * ============================================================
 * SECTION 9.1 - VERIFY CARD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_VerifyCard_(
  cardRecord
) {

  const result = {

    verified: false,

    reason: "",

    cardId: "",

    memberName: "",

    cardStatus: "",

    membershipStatus: "",

    validUntil: "",

    card: null

  };

  if (!cardRecord) {

    result.reason =
      "Card record not found.";

    return result;

  }

  // Validate Card Record

  const validation =

    KGMIS_ValidateCardRecord_(

      cardRecord

    );

  if (!validation.valid) {

    result.reason =

      validation.errors.join(
        " | "
      );

    return result;

  }

  result.cardId =
    cardRecord.CARD_ID;

  result.memberName =
    cardRecord.CARDHOLDER_NAME;

  result.cardStatus =
    cardRecord.CARD_STATUS;

  result.membershipStatus =
    cardRecord.MEMBERSHIP_STATUS;

  result.validUntil =
    cardRecord.VALID_UNTIL;

  result.card =
    cardRecord;

  // Verify Card Status

  if (

    String(
      cardRecord.CARD_STATUS
    )
    .toUpperCase()

    !==

    "ACTIVE"

  ) {

    result.reason =

      "Card is " +

      cardRecord.CARD_STATUS +

      ".";

    return result;

  }

  // Verify Membership Status

  if (

    String(
      cardRecord.MEMBERSHIP_STATUS
    )
    .toUpperCase()

    !==

    "CURRENT"

  ) {

    result.reason =

      "Membership is " +

      cardRecord.MEMBERSHIP_STATUS +

      ".";

    return result;

  }

  // Verify Expiry

  // Verify Expiry
// Card remains valid until 23:59:59 of VALID_UNTIL

  const today = new Date();
    today.setHours(0, 0, 0, 0);

  const validUntil = new Date(
    cardRecord.VALID_UNTIL
  );

// Make the card valid until the end of the expiry day
  validUntil.setHours(23, 59, 59, 999);

  if (today > validUntil) {

  result.reason =
    "Card has expired.";

  return result;

}

  // Success

  result.verified =
    true;

  result.reason =
    "Card verified successfully.";

  return result;

}

/**
 * ============================================================
 * TEST - VERIFY CARD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestVerifyCard() {

  const card =

    KGMIS_ReadCardById_(

      "TEST000001"

    );

  const result =

    KGMIS_VerifyCard_(

      card

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
 * ============================================================
 * SECTION 9.2 - LOOKUP CARD FROM QR TOKEN
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_LookupCardFromQrToken_(
  qrToken
) {

  if (!qrToken) {

    throw new Error(
      "QR_TOKEN is required."
    );

  }

  return KGMIS_LookupCardByQrToken_(

    qrToken

  );

}

/**
 * ============================================================
 * TEST - LOOKUP CARD FROM QR TOKEN
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestLookupCardFromQrToken() {

  const card =

    KGMIS_LookupCardFromQrToken_(

      "TESTTOKEN"

    );

  Logger.log(

    JSON.stringify(

      card,

      null,

      2

    )

  );

  return card;

}


/**
 * ============================================================
 * SECTION 9.3 - VERIFY MEMBERSHIP STATUS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_VerifyMembershipStatus_(
  cardRecord
) {

  if (!cardRecord) {

    return {

      verified: false,

      reason: "Card record not found."

    };

  }

  const membershipStatus =

    String(
      cardRecord.MEMBERSHIP_STATUS || ""
    )
    .trim()
    .toUpperCase();

  if (

    membershipStatus !== "CURRENT"

  ) {

    return {

      verified: false,

      reason:
        "Membership status is " +
        membershipStatus + "."

    };

  }

  return {

    verified: true,

    reason:
      "Membership verified."

  };

}

/**
 * ============================================================
 * TEST - VERIFY MEMBERSHIP STATUS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestVerifyMembershipStatus() {

  const card =

    KGMIS_ReadCardById_(

      "TEST000001"

    );

  const result =

    KGMIS_VerifyMembershipStatus_(

      card

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
 * ============================================================
 * SECTION 9.4 - VERIFY CARD EXPIRY
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_VerifyCardExpiry_(
  cardRecord
) {

  if (!cardRecord) {

    return {

      verified: false,

      reason:
        KGMIS_VERIFICATION.REASON.CARD_NOT_FOUND

    };

  }

  if (!cardRecord.VALID_UNTIL) {

    return {

      verified: false,

      reason:
        "Card validity date is missing."

    };

  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const validUntil =
    new Date(cardRecord.VALID_UNTIL);

  // Card remains valid until the end of the expiry date

  validUntil.setHours(
    23,
    59,
    59,
    999
  );

  const expiryDate =

    Utilities.formatDate(

      validUntil,

      Session.getScriptTimeZone(),

      "dd-MMM-yyyy"

    );

  if (today > validUntil) {

    return {

      verified: false,

      reason:
        "Card expired on " +
        expiryDate + "."

    };

  }

  return {

    verified: true,

    reason:
      "Card is valid until " +
      expiryDate + "."

  };

}


/**
 * ============================================================
 * TEST - VERIFY CARD EXPIRY
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestVerifyCardExpiry() {

  const card =

    KGMIS_ReadCardById_(

      "TEST000001"

    );

  const result =

    KGMIS_VerifyCardExpiry_(

      card

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
 * ============================================================
 * SECTION 9.5 - VERIFY CARD STATUS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_VerifyCardStatus_(
  cardRecord
) {

  if (!cardRecord) {

    return {

      verified: false,

      status: "NOT_FOUND",

      reason:
        "Card record not found."

    };

  }

  const cardStatus =

    String(
      cardRecord.CARD_STATUS || ""
    )
    .trim()
    .toUpperCase();

  switch (cardStatus) {

    case KGMIS_VERIFICATION.CARD_STATUS.ACTIVE:

      return {

        verified: true,

        status: "VALID",

        reason:
          "Card is active."

      };

    case KGMIS_VERIFICATION.CARD_STATUS.INACTIVE:

      return {

        verified: false,

        status: "INACTIVE",

        reason:
          "Card is inactive."

      };

    case KGMIS_VERIFICATION.CARD_STATUS.EXPIRED:

      return {

        verified: false,

        status: "EXPIRED",

        reason:
          "Card has expired."

      };

    case KGMIS_VERIFICATION.CARD_STATUS.REVOKED:

      return {

        verified: false,

        status: "REVOKED",

        reason:
          "Card has been revoked."

      };

    case KGMIS_VERIFICATION.CARD_STATUS.ARCHIVED:

      return {

        verified: false,

        status: "ARCHIVED",

        reason:
          "Card has been archived."

      };

    default:

      return {

        verified: false,

        status: "INVALID",

        reason:
          "Unknown card status."

      };

  }

}


/**
 * ============================================================
 * TEST - VERIFY CARD STATUS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestVerifyCardStatus() {

  const card =

    KGMIS_ReadCardById_(

      "TEST000001"

    );

  const result =

    KGMIS_VerifyCardStatus_(

      card

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


