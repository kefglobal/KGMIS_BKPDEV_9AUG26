/**
 * ============================================================
 * KGMIS Production Digital Card Module
 *
 * File: 35.01_KGMIS_Membership_Verification.gs
 * ============================================================
 *
 */

function KGMIS_RenderMembershipVerification_(e) {

  const parameters =
    e && e.parameter
      ? e.parameter
      : {};

  const kefgId =
    String(
      parameters.id || ''
    )
    .trim()
    .toUpperCase();

  const qrToken =
    String(
      parameters.token || ''
    )
    .trim();

  const verificationResult =
    KGMIS_GetMembershipVerificationData_(
      kefgId,
      qrToken
    );

  const template =
    HtmlService.createTemplateFromFile(
      'KGMIS_Membership_Verification'
    );

  template.verificationData =
    verificationResult;

  return template
    .evaluate()
    .setTitle(
      'KEF Global Membership Verification'
    )
    .addMetaTag(
      'viewport',
      'width=device-width, initial-scale=1'
    )
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.DEFAULT
    );

}


function KGMIS_GetMembershipVerificationData_(
  cardId,
  qrToken
) {

  const verifiedAt =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      'dd/MM/yyyy hh:mm a'
    );

  const cleanCardId =
    String(cardId || '').trim();

  const cleanQrToken =
    String(qrToken || '').trim();

  // ---------------------------------------------------------
  // VALIDATE QR PARAMETERS
  // ---------------------------------------------------------

  if (!cleanCardId || !cleanQrToken) {

    return {
      success: false,
      verificationStatus: 'INVALID QR CODE',
      verificationMessage:
        'The membership verification link is incomplete.',
      memberName: '',
      kefgId: '',
      cardId: cleanCardId,
      membershipType: '',
      membershipYear: '',
      validUntil: '',
      photoUrl: '',
      verifiedAt: verifiedAt
    };

  }

  // ---------------------------------------------------------
  // LOOK UP CARD USING QR TOKEN
  // ---------------------------------------------------------

  const cardRecord =
    KGMIS_LookupCardFromQrToken_(
      cleanQrToken
    );

  Logger.log(
  JSON.stringify(
    cardRecord,
    null,
    2
  )
);

  if (!cardRecord) {

    return {
      success: false,
      verificationStatus: 'INVALID',
      verificationMessage:
        'No Digital Membership ID was found for this QR code.',
      memberName: '',
      kefgId: '',
      cardId: cleanCardId,
      membershipType: '',
      membershipYear: '',
      validUntil: '',
      photoUrl: '',
      verifiedAt: verifiedAt
    };

  }

  // ---------------------------------------------------------
  // VERIFY CARD ID MATCHES QR RECORD
  // ---------------------------------------------------------

  const storedCardId =
    String(
      cardRecord.CARD_ID || ''
    ).trim();

  if (storedCardId !== cleanCardId) {

    return {
      success: false,
      verificationStatus: 'INVALID',
      verificationMessage:
        'The QR code does not match the Digital Membership ID.',
      memberName:
        cardRecord.CARDHOLDER_NAME || '',
      kefgId:
        cardRecord.KEFG_ID || '',
      cardId:
        storedCardId,
      membershipType:
        cardRecord.MEMBERSHIP_TYPE || '',
      membershipYear:
        cardRecord.MEMBERSHIP_YEAR || '',
      validUntil:
        cardRecord.VALID_UNTIL || '',
      photoUrl:
        cardRecord.PHOTO_URL || '',
      verifiedAt: verifiedAt
    };

  }

  // ---------------------------------------------------------
  // CHECK CARD STATUS
  // ---------------------------------------------------------

  const cardStatus =
    String(
      cardRecord.CARD_STATUS || ''
    )
    .trim()
    .toUpperCase();

  if (cardStatus === 'REVOKED') {

    return {
      success: false,
      verificationStatus: 'REVOKED',
      verificationMessage:
        'This Digital Membership ID has been revoked.',
      memberName:
        cardRecord.CARDHOLDER_NAME || '',
      kefgId:
        cardRecord.KEFG_ID || '',
      cardId:
        storedCardId,
      membershipType:
        cardRecord.MEMBERSHIP_TYPE || '',
      membershipYear:
        cardRecord.MEMBERSHIP_YEAR || '',
      validUntil:
        cardRecord.VALID_UNTIL || '',
      photoUrl:
        cardRecord.PHOTO_URL || '',
      verifiedAt: verifiedAt
    };

  }

  if (
    cardStatus !== 'ACTIVE' &&
    cardStatus !== 'EXTENDED'
  ) {

    return {
      success: false,
      verificationStatus: cardStatus || 'INVALID',
      verificationMessage:
        'This Digital Membership ID is not active.',
      memberName:
        cardRecord.CARDHOLDER_NAME || '',
      kefgId:
        cardRecord.KEFG_ID || '',
      cardId:
        storedCardId,
      membershipType:
        cardRecord.MEMBERSHIP_TYPE || '',
      membershipYear:
        cardRecord.MEMBERSHIP_YEAR || '',
      validUntil:
        cardRecord.VALID_UNTIL || '',
      photoUrl:
        cardRecord.PHOTO_URL || '',
      verifiedAt: verifiedAt
    };

  }

  // ---------------------------------------------------------
  // READ FINANCIAL YEAR
  // ---------------------------------------------------------

  const membershipYear =
    String(
      cardRecord.MEMBERSHIP_YEAR || ''
    ).trim();

  const financialYearRecord =
    KGMIS_GetFinancialYear(
      membershipYear
    );

  const officialValidUntil =
    financialYearRecord.gracePeriodEnd ||
    financialYearRecord.endDate;

  if (!officialValidUntil) {

    return {
      success: false,
      verificationStatus: 'INVALID',
      verificationMessage:
        'No validity date is configured for this membership year.',
      memberName:
        cardRecord.CARDHOLDER_NAME || '',
      kefgId:
        cardRecord.KEFG_ID || '',
      cardId:
        storedCardId,
      membershipType:
        cardRecord.MEMBERSHIP_TYPE || '',
      membershipYear:
        membershipYear,
      validUntil: '',
      photoUrl:
        cardRecord.PHOTO_URL || '',
      verifiedAt: verifiedAt
    };

  }

  // ---------------------------------------------------------
  // CHECK CURRENT DATE AGAINST OFFICIAL VALIDITY
  // ---------------------------------------------------------

  const now = new Date();

  const validityDate =
    new Date(
      officialValidUntil
    );

  validityDate.setHours(
    23,
    59,
    59,
    999
  );

  const formattedValidUntil =
    Utilities.formatDate(
      validityDate,
      Session.getScriptTimeZone(),
      'dd/MM/yyyy'
    );

  if (now > validityDate) {

    return {
      success: false,
      verificationStatus: 'EXPIRED',
      verificationMessage:
        'This Digital Membership ID expired on ' +
        formattedValidUntil +
        '.',
      memberName:
        cardRecord.CARDHOLDER_NAME || '',
      kefgId:
        cardRecord.KEFG_ID || '',
      cardId:
        storedCardId,
      membershipType:
        cardRecord.MEMBERSHIP_TYPE || '',
      membershipYear:
        membershipYear,
      validUntil:
        formattedValidUntil,
      photoUrl:
        cardRecord.PHOTO_URL || '',
      verifiedAt: verifiedAt
    };

  }

  // ---------------------------------------------------------
  // VALID CARD
  // ---------------------------------------------------------

  return {
    success: true,
    verificationStatus: 'VALID',
    verificationMessage:
      'This is a valid KEF Global Digital Membership ID.',
    memberName:
      cardRecord.CARDHOLDER_NAME || '',
    kefgId:
      cardRecord.KEFG_ID || '',
    cardId:
      storedCardId,
    membershipType:
      cardRecord.MEMBERSHIP_TYPE || '',
    membershipYear:
      membershipYear,
    validUntil:
      formattedValidUntil,
    photoUrl:
      cardRecord.PHOTO_URL || '',
    verifiedAt: verifiedAt
  };

}

function KGMIS_TestMembershipVerification() {

  const result =
    KGMIS_GetMembershipVerificationData_(
      'KEFG00003504',
      '95517C447B934947A087FABCBECB6664'
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
