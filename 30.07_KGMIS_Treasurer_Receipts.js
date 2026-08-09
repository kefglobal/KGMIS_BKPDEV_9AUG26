/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Treasurer Portal — Receipt Bridge
 *
 * File:
 * 30.07_KGMIS_Treasurer_Receipts.gs
 * ============================================================
 *
 * Purpose:
 * - Supply Receive Payment form configuration
 * - Search KGMIS families through the existing Treasurer service
 * - Create a receipt transaction through the core Receipt Engine
 * - Derive the internal payment category from payment purpose
 * - Generate the official receipt PDF
 * - Return one clean response to the Treasurer Portal
 *
 * Important:
 * - Receipt business rules remain in 09_KGMIS_Receipt_Service.gs
 * - Receipt PDF rules remain in 10_KGMIS_Receipt_PDF_Service.gs
 * - This file is only the Treasurer Portal bridge
 */


/**
 * ============================================================
 * Receive Payment Setup
 * ============================================================
 *
 * Returns the configuration required by
 * KGMIS_Receive_Payment.html.
 */
function KGMIS_Treasurer_GetReceivePaymentSetup(
  sessionToken
) {

  const user =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'TREASURER',
      'VIEW'
    );

  const yearRecord =
    KGMIS_GetCurrentFinancialYear();

  const options =
    KGMIS_Treasurer_GetReceiptOptions_();

  return {
    success: true,

    financialYear:
      yearRecord.financialYear,

    financialYearStatus:
      yearRecord.status,

    membershipFee:
      Number(
        yearRecord.membershipFee || 0
      ),

    paymentPurposes:
      options.paymentPurposes,

    paymentModes:
      options.paymentModes,

    payerRelations:
      options.payerRelations,

    currentUser: {
      email:
        user.email,

      userName:
        user.userName,

      role:
        user.role
    },

    permissions: {
      canView:
        true,

      canCreateReceipt:
        KGMIS_UserCanAccessModule_(
          user.role,
          KGMIS_TREASURER_CONFIG.MODULE_NAME,
          KGMIS_TREASURER_CONFIG.UPDATE_ACTION
        )
    }
  };
}


/**
 * ============================================================
 * Family Search for Receive Payment
 * ============================================================
 *
 * Reuses the existing Treasurer family-search service.
 */
function KGMIS_Treasurer_SearchPaymentFamilies(
  sessionToken,
  searchText
) {

  KGMIS_OTP_RequireSessionAccess_(
    sessionToken,
    'TREASURER',
    'VIEW'
  );

  const query =
    KGMIS_Treasurer_CleanReceiptValue_(
      searchText
    );

  if (!query) {
    return [];
  }

  const results =
    searchFamilies(
      query
    ) || [];

  return results.map(
    function (family) {

      return {
        familyId:
          family.familyId || '',

        kefgId:
          family.kefgId ||
          family.memberKefgId ||
          '',

        zone:
          family.zone || '',

        memberName:
          family.memberName || '',

        memberMobile:
          family.memberMobile || '',

        spouseName:
          family.spouseName || '',

        spouseMobile:
          family.spouseMobile || '',

        alumniAssociation:
          family.alumniAssociation || '',

        branch:
          family.branch || '',

        batchYear:
          family.batchYear ||
          family.yearBatch ||
          '',

        subscriptionStatus:
          family.subscriptionStatus ||
          family.membershipStatus ||
          family.paymentStatus ||
          '',

        paymentDateDisplay:
          family.paymentDateDisplay ||
          family.lastPaymentDateDisplay ||
          ''
      };
    }
  );
}


/**
 * ============================================================
 * Save Receipt and Generate PDF
 * ============================================================
 *
 * Creates the receipt transaction through the core Receipt
 * Service and immediately generates or returns its PDF.
 */
function KGMIS_Treasurer_SaveReceiptAndGeneratePdf(
  sessionToken,
  request
) {

  const authorisedUser =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'TREASURER',
      'UPDATE'
    );

  const data =
    KGMIS_Treasurer_NormalizeReceiptRequest_(
      request
    );

  const transaction =
    KGMIS_CreateReceiptTransaction(
      data
    );

  const lookupValue =
    KGMIS_Treasurer_GetReceiptLookupValue_(
      transaction
    );

  if (!lookupValue) {
    throw new Error(
      'The receipt transaction was saved, but no ' +
      'Transaction ID or Receipt Number was returned.'
    );
  }

  const pdf =
    KGMIS_GenerateReceiptPdf(
      lookupValue
    );

  return {
    success:
      true,

    transactionId:
      pdf.transactionId ||
      transaction.transactionId ||
      transaction.transactionID ||
      '',

    receiptNumber:
      pdf.receiptNumber ||
      transaction.receiptNumber ||
      '',

    fileId:
      pdf.fileId || '',

    fileName:
      pdf.fileName || '',

    fileUrl:
      pdf.fileUrl || '',

    alreadyGenerated:
      Boolean(
        pdf.alreadyGenerated
      ),

    generatedOn:
      pdf.generatedOn || '',

    paymentPurpose:
      data.paymentPurpose,

    paymentCategory:
      data.paymentCategory,

    amount:
      data.amount,

    createdBy: {
      email:
        authorisedUser.email,

      userName:
        authorisedUser.userName,

      role:
        authorisedUser.role
    },

    message:
      'Payment recorded and receipt generated successfully.'
  };
}


/**
 * ============================================================
 * Normalize Receipt Request
 * ============================================================
 *
 * Validates and normalizes portal input before passing it to
 * the core KGMIS Receipt Service.
 */
function KGMIS_Treasurer_NormalizeReceiptRequest_(
  request
) {

  const input =
    request || {};

  const payerType =
    KGMIS_Treasurer_UpperReceiptValue_(
      input.payerType || 'MEMBER'
    );

  if (
    payerType !== 'MEMBER' &&
    payerType !== 'EXTERNAL'
  ) {
    throw new Error(
      'Payer type must be MEMBER or EXTERNAL.'
    );
  }

  const familyId =
    KGMIS_Treasurer_CleanReceiptValue_(
      input.familyId
    );

  const transactionDate =
    KGMIS_Treasurer_CleanReceiptValue_(
      input.transactionDate ||
      input.receiptDate
    );

  const paymentPurpose =
    KGMIS_Treasurer_UpperReceiptValue_(
      input.paymentPurpose
    );

  const paymentMode =
    KGMIS_Treasurer_UpperReceiptValue_(
      input.paymentMode
    );

  const amount =
    Number(
      input.amount
    );

  const externalPartyType =
    KGMIS_Treasurer_UpperReceiptValue_(
      input.externalPartyType
    );

  const organisationName =
    KGMIS_Treasurer_CleanReceiptValue_(
      input.organisationName
    );

  const contactName =
    KGMIS_Treasurer_CleanReceiptValue_(
      input.payerName
    );

  const payerName =
    payerType === 'EXTERNAL'
      ? (
          organisationName ||
          contactName
        )
      : contactName;

  if (
    payerType === 'MEMBER' &&
    !familyId
  ) {
    throw new Error(
      'Family ID is required for a member-family receipt.'
    );
  }

  if (
    payerType === 'EXTERNAL' &&
    !externalPartyType
  ) {
    throw new Error(
      'External party type is required.'
    );
  }

  if (!payerName) {
    throw new Error(
      'Payer name is required.'
    );
  }

  if (!transactionDate) {
    throw new Error(
      'Receipt date is required.'
    );
  }

  if (!paymentPurpose) {
    throw new Error(
      'Payment purpose is required.'
    );
  }

  if (!paymentMode) {
    throw new Error(
      'Payment mode is required.'
    );
  }

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      'Enter a valid receipt amount greater than zero.'
    );
  }

  if (
    payerType === 'MEMBER' &&
    typeof KGMIS_ValidateFamilyIdExists_ ===
      'function'
  ) {
    KGMIS_ValidateFamilyIdExists_(
      familyId
    );
  }

  const externalDescription =
    payerType === 'EXTERNAL'
      ? [
          organisationName
            ? 'Organisation: ' + organisationName
            : '',

          contactName
            ? 'Contact Person: ' + contactName
            : '',

          input.payerMobile
            ? 'Mobile: ' +
              KGMIS_Treasurer_CleanReceiptValue_(
                input.payerMobile
              )
            : '',

          input.payerEmail
            ? 'Email: ' +
              KGMIS_Treasurer_CleanReceiptValue_(
                input.payerEmail
              )
            : '',

          input.payerCity
            ? 'City / District: ' +
              KGMIS_Treasurer_CleanReceiptValue_(
                input.payerCity
              )
            : '',

          input.payerAddress
            ? 'Address: ' +
              KGMIS_Treasurer_CleanReceiptValue_(
                input.payerAddress
              )
            : ''
        ]
          .filter(Boolean)
          .join('\n')
      : '';

  const userDescription =
    KGMIS_Treasurer_CleanReceiptValue_(
      input.description
    );

  return {
    payerType:
      payerType,

    externalPartyType:
      externalPartyType,

    financialYear:
      KGMIS_Treasurer_CleanReceiptValue_(
        input.financialYear
      ),

    transactionDate:
      transactionDate,

    receiptDate:
      transactionDate,

    familyId:
      payerType === 'MEMBER'
        ? familyId
        : '',

    kefgId:
      payerType === 'MEMBER'
        ? KGMIS_Treasurer_CleanReceiptValue_(
            input.kefgId
          )
        : '',

    paymentPurpose:
      paymentPurpose,

    paymentCategory:
      KGMIS_Treasurer_GetReceiptCategoryFromPurpose_(
        paymentPurpose
      ),

    amount:
      amount,

    paymentMode:
      paymentMode,

    transactionReference:
      KGMIS_Treasurer_CleanReceiptValue_(
        input.transactionReference
      ),

    payerName:
      payerName,

    payerRelation:
      payerType === 'EXTERNAL'
        ? externalPartyType
        : KGMIS_Treasurer_UpperReceiptValue_(
            input.payerRelation
          ),

    paymentStatus:
      'SUCCESSFUL',

    description:
      [
        userDescription,
        externalDescription
      ]
        .filter(Boolean)
        .join('\n\n'),

    eventCode:
      KGMIS_Treasurer_UpperReceiptValue_(
        input.eventCode
      ),

    eventProject:
      KGMIS_Treasurer_CleanReceiptValue_(
        input.eventProject
      ),

    restrictedFund:
      KGMIS_Treasurer_UpperReceiptValue_(
        input.restrictedFund || 'NO'
      )
  };
}


/**
 * ============================================================
 * Payment Category Derivation
 * ============================================================
 *
 * Payment Category remains an internal database field.
 * The Treasurer selects only Payment Purpose.
 */
function KGMIS_Treasurer_GetReceiptCategoryFromPurpose_(
  paymentPurpose
) {

  const purpose =
    KGMIS_Treasurer_UpperReceiptValue_(
      paymentPurpose
    );

  const categoryMap = {
    'MEMBERSHIP FEE':
      'MEMBERSHIP',

    'MEMBERSHIP SUBSCRIPTION':
      'MEMBERSHIP',

    'EVENT REGISTRATION':
      'EVENT',

    'EVENT COLLECTION':
      'EVENT',

    'DONATION':
      'DONATION',

    'SPONSORSHIP':
      'SPONSORSHIP',

    'CHARITY':
      'CHARITY',

    'WELFARE FUND':
      'WELFARE',

    'ADVERTISEMENT':
      'ADVERTISEMENT',

    'OTHER':
      'OTHER'
  };

  return (
    categoryMap[purpose] ||
    'OTHER'
  );
}


/**
 * ============================================================
 * Receipt Lookup Identifier
 * ============================================================
 */
function KGMIS_Treasurer_GetReceiptLookupValue_(
  transaction
) {

  const result =
    transaction || {};

  return KGMIS_Treasurer_CleanReceiptValue_(
    result.transactionId ||
    result.transactionID ||
    result.receiptNumber ||
    result.id
  );
}


/**
 * ============================================================
 * Receipt Form Options
 * ============================================================
 */
function KGMIS_Treasurer_GetReceiptOptions_() {

  const fallback = {
    paymentPurposes: [
      'MEMBERSHIP FEE',
      'EVENT REGISTRATION',
      'DONATION',
      'SPONSORSHIP',
      'CHARITY',
      'WELFARE FUND',
      'ADVERTISEMENT',
      'OTHER'
    ],

    paymentModes: [
      'CASH',
      'UPI',
      'BANK TRANSFER',
      'CHEQUE',
      'CARD',
      'ONLINE PAYMENT',
      'OTHER'
    ],

    payerRelations: [
      'MEMBER',
      'SPOUSE',
      'FAMILY MEMBER',
      'DONOR',
      'SPONSOR',
      'ORGANISATION',
      'ADVERTISER',
      'NON-MEMBER',
      'OTHER'
    ]
  };

  if (
    typeof KGMIS_RECEIPT_OPTIONS ===
    'undefined'
  ) {
    return fallback;
  }

  return {
    paymentPurposes:
      KGMIS_Treasurer_CopyOptionArray_(
        KGMIS_RECEIPT_OPTIONS
          .PAYMENT_PURPOSES,
        fallback.paymentPurposes
      ),

    paymentModes:
      KGMIS_Treasurer_CopyOptionArray_(
        KGMIS_RECEIPT_OPTIONS
          .PAYMENT_MODES,
        fallback.paymentModes
      ),

    payerRelations:
      KGMIS_Treasurer_CopyOptionArray_(
        KGMIS_RECEIPT_OPTIONS
          .PAYER_RELATIONS,
        fallback.payerRelations
      )
  };
}


/**
 * ============================================================
 * Option Array Utility
 * ============================================================
 */
function KGMIS_Treasurer_CopyOptionArray_(
  value,
  fallback
) {

  return (
    Array.isArray(value) &&
    value.length
  )
    ? value.slice()
    : fallback.slice();
}


/**
 * ============================================================
 * Text Utilities
 * ============================================================
 */
function KGMIS_Treasurer_CleanReceiptValue_(
  value
) {

  if (
    value === null ||
    value === undefined
  ) {
    return '';
  }

  return String(
    value
  ).trim();
}


function KGMIS_Treasurer_UpperReceiptValue_(
  value
) {

  return KGMIS_Treasurer_CleanReceiptValue_(
    value
  ).toUpperCase();
}


/**
 * ============================================================
 * Safe Bridge Test
 * ============================================================
 */
function KGMIS_TestTreasurerReceiptBridge() {

  const result =
    KGMIS_Treasurer_GetReceivePaymentSetup();

  Logger.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}


