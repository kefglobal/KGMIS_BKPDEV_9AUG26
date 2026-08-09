/**
 * ============================================================
 * KEF Global Membership Information System (KGMIS)
 * Digital Membership Card Renderer
 *
 * File: 34.01_KGMIS_Digital_Card_Renderer.gs
 * Developed by: JJA Global Systems
 * ============================================================
 *
 * PART 1
 *
 * Responsibilities:
 * - Load a digital-card record securely
 * - Confirm that the card belongs to the signed-in user's family
 * - Prepare premium card template data
 * - Render the HTML card template
 * - Return front/back card HTML for browser preview
 *
 * Later parts will add:
 * - QR image generation
 * - Drive image utilities
 * - PDF generation
 * - PNG generation
 * - Saving generated file IDs and URLs
 */


/**
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

const KGMIS_DIGITAL_CARD_RENDERER_CONFIG =
  Object.freeze({

    MEMBER_CARDS_SHEET:
      'KEFG_MEMBER_CARDS',

    TEMPLATE_FILE:
      'KGMIS_Digital_Card_Template',

    DEFAULT_WEBSITE:
      'www.kefglobal.org',

    DEFAULT_CARD_VERSION:
      '1.0',

    VALID_CARD_STATUSES:
      Object.freeze([
        'ACTIVE',
        'EXTENDED',
        'REVOKED'
      ]),

    CARD_HEADERS:
      Object.freeze([
        'CARD_ID',
        'FAMILY_ID',
        'KEFG_ID',
        'CARDHOLDER_TYPE',
        'RELATION_SEQUENCE',
        'CARDHOLDER_NAME',
        'MEMBERSHIP_TYPE',
        'MEMBERSHIP_YEAR',
        'MEMBERSHIP_STATUS',
        'ISSUE_DATE',
        'VALID_UNTIL',
        'CARD_STATUS',
        'MEMBER_MOBILE',
        'MEMBER_EMAIL',
        'PHOTO_FILE_ID',
        'PHOTO_URL',
        'QR_TOKEN',
        'CARD_PDF_FILE_ID',
        'CARD_PDF_FILE_URL',
        'CARD_IMAGE_FILE_ID',
        'CARD_IMAGE_FILE_URL',
        'CREATED_ON',
        'CREATED_BY',
        'UPDATED_ON',
        'UPDATED_BY',
        'CARD_VERSION',
        'REMARKS'
      ])
  });


/**
 * ============================================================
 * PUBLIC API: GET LIVE PREVIEW DATA
 * ============================================================
 *
 * Returns structured card data for use by the browser.
 *
 * This does not yet generate PNG or PDF.
 */

function KGMIS_DigitalCardRenderer_GetPreviewData(
  sessionToken,
  cardId
) {

  const context =
    KGMIS_DigitalCardRenderer_GetOwnCardContext_(
      sessionToken,
      cardId
    );

  return {
    success:
      true,

    card:
      KGMIS_DigitalCardRenderer_BuildCardViewModel_(
        context
      )
  };
}


/**
 * ============================================================
 * PUBLIC API: RENDER FULL PREMIUM TEMPLATE
 * ============================================================
 *
 * Returns the rendered HTML content of:
 *
 * KGMIS_Digital_Card_Template.html
 *
 * This can be displayed inside a dialog, modal or browser panel.
 */

function KGMIS_DigitalCardRenderer_RenderPreview(
  sessionToken,
  cardId
) {

  const context =
    KGMIS_DigitalCardRenderer_GetOwnCardContext_(
      sessionToken,
      cardId
    );

  const templateData =
    KGMIS_DigitalCardRenderer_BuildCardViewModel_(
      context
    );

  return {
    success:
      true,

    cardId:
      templateData.cardId,

    cardStatus:
      templateData.cardStatus,

    html:
      KGMIS_DigitalCardRenderer_RenderTemplate_(
        templateData
      )
  };
}


/**
 * ============================================================
 * PUBLIC API: GET OWN FAMILY CARDS
 * ============================================================
 *
 * Returns all cards belonging to the signed-in user's family.
 */

function KGMIS_DigitalCardRenderer_GetOwnFamilyCards(
  sessionToken
) {

  const user =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'DIRECTORY',
      'VIEW'
    );

  const directoryContext =
    KGMIS_Directory_GetMasterContext_();

  const subscriptionYear =
    KGMIS_Directory_GetCurrentYearLabel_();

  const membershipStatusMap =
    KGMIS_Directory_GetCurrentMembershipStatusMap_(
      subscriptionYear
    );

  const directory =
    KGMIS_Directory_BuildFamilyDirectory_(
      directoryContext,
      membershipStatusMap,
      subscriptionYear
    );

  const profile =
    KGMIS_Directory_FindProfileByLoginEmail_(
      directory,
      user.email
    );

  if (!profile) {
    throw new Error(
      'No family profile is linked to your signed-in email.'
    );
  }

  const familyId =
    KGMIS_DigitalCardRenderer_Clean_(
      profile.familyId
    ).toUpperCase();

  if (!familyId) {
    throw new Error(
      'The linked family profile has no Family ID.'
    );
  }

  const cards =
    KGMIS_DigitalCardRenderer_ReadCardsByFamily_(
      familyId
    );

  return {
    success:
      true,

    familyId:
      familyId,

    cards:
      cards.map(
        KGMIS_DigitalCardRenderer_CreateCardResponse_
      )
  };
}


/**
 * ============================================================
 * SECURITY CONTEXT
 * ============================================================
 *
 * Loads the card and verifies that:
 *
 * 1. The user has a valid OTP session.
 * 2. The signed-in user has a linked family profile.
 * 3. The requested card belongs to that family.
 */

function KGMIS_DigitalCardRenderer_GetOwnCardContext_(
  sessionToken,
  cardId
) {

  const user =
    KGMIS_OTP_RequireSessionAccess_(
      sessionToken,
      'DIRECTORY',
      'VIEW'
    );

  const cleanCardId =
    KGMIS_DigitalCardRenderer_Clean_(
      cardId
    ).toUpperCase();

  if (!cleanCardId) {
    throw new Error(
      'Card ID is required.'
    );
  }

  const directoryContext =
    KGMIS_Directory_GetMasterContext_();

  const subscriptionYear =
    KGMIS_Directory_GetCurrentYearLabel_();

  const membershipStatusMap =
    KGMIS_Directory_GetCurrentMembershipStatusMap_(
      subscriptionYear
    );

  const directory =
    KGMIS_Directory_BuildFamilyDirectory_(
      directoryContext,
      membershipStatusMap,
      subscriptionYear
    );

  const profile =
    KGMIS_Directory_FindProfileByLoginEmail_(
      directory,
      user.email
    );

  if (!profile) {
    throw new Error(
      'No family profile is linked to your signed-in email.'
    );
  }

  const familyId =
    KGMIS_DigitalCardRenderer_Clean_(
      profile.familyId
    ).toUpperCase();

  if (!familyId) {
    throw new Error(
      'The linked family profile has no Family ID.'
    );
  }

  const card =
    KGMIS_DigitalCardRenderer_ReadCardById_(
      cleanCardId
    );

  if (!card) {
    throw new Error(
      'The requested digital card was not found.'
    );
  }

  const cardFamilyId =
    KGMIS_DigitalCardRenderer_Clean_(
      card.FAMILY_ID
    ).toUpperCase();

  if (cardFamilyId !== familyId) {
    throw new Error(
      'You are not authorised to view this digital card.'
    );
  }

  return {
    user:
      user,

    profile:
      profile,

    familyId:
      familyId,

    card:
      card
  };
}


/**
 * ============================================================
 * TEMPLATE DATA
 * ============================================================
 *
 * Converts the raw sheet record into the data expected by:
 *
 * window.KGMIS_DIGITAL_CARD_TEMPLATE.render(data)
 */

function KGMIS_DigitalCardRenderer_CreateTemplateData_(
  card
) {

  const status =
    KGMIS_DigitalCardRenderer_NormaliseCardStatus_(
      card.CARD_STATUS
    );

  return {
    cardId:
      card.CARD_ID || '',

    familyId:
      card.FAMILY_ID || '',

    kefgId:
      card.KEFG_ID || '',

    cardholderName:
      card.CARDHOLDER_NAME || '',

    cardholderType:
      card.CARDHOLDER_TYPE || '',

    relationSequence:
      card.RELATION_SEQUENCE || '',

    membershipType:
      card.MEMBERSHIP_TYPE || '',

    membershipYear:
      card.MEMBERSHIP_YEAR || '',

    membershipStatus:
      card.MEMBERSHIP_STATUS || '',

    issueDate:
      KGMIS_DigitalCardRenderer_FormatOutputDate_(
        card.ISSUE_DATE
      ),

    validUntil:
      KGMIS_DigitalCardRenderer_FormatOutputDate_(
        card.VALID_UNTIL
      ),

    cardStatus:
      status,

    memberMobile:
      card.MEMBER_MOBILE || '',

    memberEmail:
      card.MEMBER_EMAIL || '',

    photoFileId:
      card.PHOTO_FILE_ID || '',

    photoUrl:
      card.PHOTO_URL || '',

    qrToken:
      card.QR_TOKEN || '',

    qrImageUrl:
      '',

    cardPdfFileId:
      card.CARD_PDF_FILE_ID || '',

    cardPdfUrl:
      card.CARD_PDF_FILE_URL || '',

    cardImageFileId:
      card.CARD_IMAGE_FILE_ID || '',

    cardImageUrl:
      card.CARD_IMAGE_FILE_URL || '',

    cardVersion:
      card.CARD_VERSION ||
      KGMIS_DIGITAL_CARD_RENDERER_CONFIG
        .DEFAULT_CARD_VERSION,

    website:
      KGMIS_DIGITAL_CARD_RENDERER_CONFIG
        .DEFAULT_WEBSITE,

    remarks:
      card.REMARKS || ''
  };
}


/**
 * ============================================================
 * TEMPLATE RENDERER
 * ============================================================
 *
 * The template file contains:
 *
 * window.KGMIS_DIGITAL_CARD_TEMPLATE.render(data)
 *
 * To make a server-rendered preview, the template is returned
 * together with a small bootstrap script containing the card data.
 */

function KGMIS_DigitalCardRenderer_RenderTemplate_(
  templateData
) {

  let templateHtml;

  try {

   const template =
  HtmlService.createTemplateFromFile(
    KGMIS_DIGITAL_CARD_RENDERER_CONFIG
      .TEMPLATE_FILE
  );

template.card =
  templateData;

templateHtml =
  template
    .evaluate()
    .getContent();

  } catch (error) {

    throw new Error(
      'The digital card template could not be loaded: ' +
      KGMIS_DigitalCardRenderer_GetErrorMessage_(
        error
      )
    );
  }

  const bootstrapScript =
    KGMIS_DigitalCardRenderer_CreateBootstrapScript_(
      templateData
    );

  return (
    templateHtml +
    bootstrapScript
  );
}


/**
 * ============================================================
 * BOOTSTRAP SCRIPT
 * ============================================================
 *
 * Safely embeds card data into the rendered HTML.
 */

/**
 * ============================================================
 * BOOTSTRAP SCRIPT
 * ============================================================
 *
 * Safely embeds the card data, renders the card and activates
 * the PNG-generation controls when available.
 */
function KGMIS_DigitalCardRenderer_CreateBootstrapScript_(
  templateData
) {

  const json =
    JSON.stringify(
      templateData || {}
    )
      .replace(
        /</g,
        '\\u003c'
      )
      .replace(
        />/g,
        '\\u003e'
      )
      .replace(
        /&/g,
        '\\u0026'
      )
      .replace(
        /\u2028/g,
        '\\u2028'
      )
      .replace(
        /\u2029/g,
        '\\u2029'
      );

  return (
    '<script>' +
      '(function(){' +

        'var cardData=' +
          json +
        ';' +

        'function renderCard(){' +

          'var cardTemplate=' +
            'window.KGMIS_DIGITAL_CARD_TEMPLATE;' +

          'if(' +
            'cardTemplate&&' +
            'typeof cardTemplate.render==="function"' +
          '){' +

            'cardTemplate.render(cardData);' +

            'if(' +
              'typeof cardTemplate.enablePngGeneration==="function"' +
            '){' +
              'cardTemplate.enablePngGeneration();' +
            '}' +
            'else{' +
              'console.error(' +
                '"enablePngGeneration is unavailable in the card template."' +
              ');' +
            '}' +

          '}' +
          'else{' +
            'console.error(' +
              '"KGMIS digital-card template is unavailable."' +
            ');' +
          '}' +

        '}' +

        'if(document.readyState==="loading"){' +
          'document.addEventListener(' +
            '"DOMContentLoaded",' +
            'renderCard' +
          ');' +
        '}' +
        'else{' +
          'renderCard();' +
        '}' +

      '})();' +
    '</script>'
  );
}

/**
 * ============================================================
 * CARD SHEET CONTEXT
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_GetSheetContext_() {

  const spreadsheet =
    SpreadsheetApp
      .getActiveSpreadsheet();

  const sheet =
    spreadsheet.getSheetByName(
      KGMIS_DIGITAL_CARD_RENDERER_CONFIG
        .MEMBER_CARDS_SHEET
    );

  if (!sheet) {
    throw new Error(
      KGMIS_DIGITAL_CARD_RENDERER_CONFIG
        .MEMBER_CARDS_SHEET +
      ' was not found.'
    );
  }

  const lastColumn =
    sheet.getLastColumn();

  if (lastColumn < 1) {
    throw new Error(
      'KEFG_MEMBER_CARDS has no headers.'
    );
  }

  const headers =
    sheet
      .getRange(
        1,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0]
      .map(
        function (header) {
          return KGMIS_DigitalCardRenderer_Clean_(
            header
          ).toUpperCase();
        }
      );

  const missingHeaders =
    KGMIS_DIGITAL_CARD_RENDERER_CONFIG
      .CARD_HEADERS
      .filter(
        function (header) {
          return (
            headers.indexOf(
              header
            ) === -1
          );
        }
      );

  if (missingHeaders.length) {
    throw new Error(
      'KEFG_MEMBER_CARDS is missing headers: ' +
      missingHeaders.join(', ')
    );
  }

  return {
    sheet:
      sheet,

    headers:
      headers
  };
}


/**
 * ============================================================
 * READ ONE CARD
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_ReadCardById_(
  cardId
) {

  const context =
    KGMIS_DigitalCardRenderer_GetSheetContext_();

  const lastRow =
    context.sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const cardIdIndex =
    context.headers.indexOf(
      'CARD_ID'
    );

  const values =
    context.sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        context.headers.length
      )
      .getValues();

  for (
    let index = 0;
    index < values.length;
    index += 1
  ) {

    const rowCardId =
      KGMIS_DigitalCardRenderer_Clean_(
        values[index][cardIdIndex]
      ).toUpperCase();

    if (rowCardId === cardId) {
      return KGMIS_DigitalCardRenderer_RowToObject_(
        values[index],
        context.headers
      );
    }
  }

  return null;
}


/**
 * ============================================================
 * READ CARDS BY FAMILY
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_ReadCardsByFamily_(
  familyId
) {

  const context =
    KGMIS_DigitalCardRenderer_GetSheetContext_();

  const lastRow =
    context.sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  const familyIdIndex =
    context.headers.indexOf(
      'FAMILY_ID'
    );

  const values =
    context.sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        context.headers.length
      )
      .getValues();

  return values
    .filter(
      function (row) {
        return (
          KGMIS_DigitalCardRenderer_Clean_(
            row[familyIdIndex]
          ).toUpperCase() ===
          familyId
        );
      }
    )
    .map(
      function (row) {
        return KGMIS_DigitalCardRenderer_RowToObject_(
          row,
          context.headers
        );
      }
    );
}


/**
 * ============================================================
 * RESPONSE MAPPER
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_CreateCardResponse_(
  card
) {

  return {
    cardId:
      card.CARD_ID || '',

    familyId:
      card.FAMILY_ID || '',

    kefgId:
      card.KEFG_ID || '',

    cardholderName:
      card.CARDHOLDER_NAME || '',

    cardholderType:
      card.CARDHOLDER_TYPE || '',

    relationSequence:
      card.RELATION_SEQUENCE || '',

    membershipType:
      card.MEMBERSHIP_TYPE || '',

    membershipYear:
      card.MEMBERSHIP_YEAR || '',

    membershipStatus:
      card.MEMBERSHIP_STATUS || '',

    issueDate:
      KGMIS_DigitalCardRenderer_FormatOutputDate_(
        card.ISSUE_DATE
      ),

    validUntil:
      KGMIS_DigitalCardRenderer_FormatOutputDate_(
        card.VALID_UNTIL
      ),

    cardStatus:
      KGMIS_DigitalCardRenderer_NormaliseCardStatus_(
        card.CARD_STATUS
      ),

    photoUrl:
      card.PHOTO_URL || '',

    cardPdfUrl:
      card.CARD_PDF_FILE_URL || '',

    cardImageUrl:
      card.CARD_IMAGE_FILE_URL || '',

    cardVersion:
      card.CARD_VERSION || ''
  };
}


/**
 * ============================================================
 * CARD STATUS
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_NormaliseCardStatus_(
  value
) {

  const status =
    KGMIS_DigitalCardRenderer_Clean_(
      value
    ).toUpperCase();

  if (
    KGMIS_DIGITAL_CARD_RENDERER_CONFIG
      .VALID_CARD_STATUSES
      .indexOf(
        status
      ) !== -1
  ) {
    return status;
  }

  return 'ACTIVE';
}


/**
 * ============================================================
 * ROW MAPPER
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_RowToObject_(
  row,
  headers
) {

  const record =
    {};

  headers.forEach(
    function (header, index) {
      record[header] =
        row[index];
    }
  );

  return record;
}


/**
 * ============================================================
 * DATE FORMATTER
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_FormatOutputDate_(
  value
) {

  if (!value) {
    return '';
  }

  if (
    Object.prototype.toString.call(
      value
    ) === '[object Date]'
  ) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone() ||
        'Asia/Kolkata',
      'yyyy-MM-dd'
    );
  }

  return KGMIS_DigitalCardRenderer_Clean_(
    value
  );
}


/**
 * ============================================================
 * CLEANER
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_Clean_(
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
  )
    .trim()
    .replace(
      /\s+/g,
      ' '
    );
}


/**
 * ============================================================
 * ERROR MESSAGE
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_GetErrorMessage_(
  error
) {

  if (
    error &&
    error.message
  ) {
    return error.message;
  }

  return String(
    error ||
    'An unexpected error occurred.'
  );
}


/**
 * ============================================================
 * SAFE TEST: SHEET AND TEMPLATE
 * ============================================================
 */

function KGMIS_TestDigitalCardRendererSetup() {

  const result = {
    success:
      true,

    sheet:
      null,

    template:
      null
  };

  try {

    const context =
      KGMIS_DigitalCardRenderer_GetSheetContext_();

    result.sheet = {
      found:
        true,

      name:
        context.sheet.getName(),

      headerCount:
        context.headers.length,

      lastRow:
        context.sheet.getLastRow()
    };

  } catch (error) {

    result.success =
      false;

    result.sheet = {
      found:
        false,

      error:
        KGMIS_DigitalCardRenderer_GetErrorMessage_(
          error
        )
    };
  }

  try {

    const html =
      HtmlService
        .createTemplateFromFile(
          KGMIS_DIGITAL_CARD_RENDERER_CONFIG
            .TEMPLATE_FILE
        )
        .evaluate()
        .getContent();

    result.template = {
      found:
        true,

      length:
        html.length
    };

  } catch (error) {

    result.success =
      false;

    result.template = {
      found:
        false,

      error:
        KGMIS_DigitalCardRenderer_GetErrorMessage_(
          error
        )
    };
  }

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
 * SAFE TEST: SAMPLE TEMPLATE DATA
 * ============================================================
 *
 * This test does not modify any sheet.
 */

function KGMIS_TestDigitalCardTemplateData() {

  const sampleCard = {
    CARD_ID:
      'KEFG00003501',

    FAMILY_ID:
      'FAM00035',

    KEFG_ID:
      'KEFG1007',

    CARDHOLDER_TYPE:
      'PRIMARY_MEMBER',

    RELATION_SEQUENCE:
      '01',

    CARDHOLDER_NAME:
      'James Joseph Alenchery',

    MEMBERSHIP_TYPE:
      'ANNUAL',

    MEMBERSHIP_YEAR:
      '2026-27',

    MEMBERSHIP_STATUS:
      'PAID',

    ISSUE_DATE:
      '2026-07-17',

    VALID_UNTIL:
      '2027-03-31',

    CARD_STATUS:
      'ACTIVE',

    MEMBER_MOBILE:
      '',

    MEMBER_EMAIL:
      '',

    PHOTO_FILE_ID:
      '',

    PHOTO_URL:
      '',

    QR_TOKEN:
      'TEST_QR_TOKEN',

    CARD_PDF_FILE_ID:
      '',

    CARD_PDF_FILE_URL:
      '',

    CARD_IMAGE_FILE_ID:
      '',

    CARD_IMAGE_FILE_URL:
      '',

    CREATED_ON:
      '',

    CREATED_BY:
      '',

    UPDATED_ON:
      '',

    UPDATED_BY:
      '',

    CARD_VERSION:
      '1.0',

    REMARKS:
      'Renderer test'
  };

  const result =
    KGMIS_DigitalCardRenderer_CreateTemplateData_(
      sampleCard
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
 * PART 2
 * LIVE MEMBER DATA, PHOTO AND CARD VIEW MODEL
 * ============================================================
 *
 * This section:
 *
 * 1. Reads the current member record from the Master Database.
 * 2. Merges the member record with the card record.
 * 3. Reads the PHOTO column as a Google Drive File ID.
 * 4. Converts the image into a Base64 data URL.
 * 5. Prepares a future QR verification payload.
 *
 * No sheet is modified by this section.
 */


/**
 * ============================================================
 * PART 2 CONFIGURATION
 * ============================================================
 */

const KGMIS_DIGITAL_CARD_RENDERER_PART2_CONFIG =
  Object.freeze({

    MASTER_DATABASE_SHEET:
      'KGMIS_MASTER_DATABASE_v1.0',

    MAX_PHOTO_SIZE_BYTES:
      5 * 1024 * 1024,

    ALLOWED_PHOTO_MIME_TYPES:
      Object.freeze([
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp'
      ]),

    MASTER_REQUIRED_HEADERS:
      Object.freeze([
        'KEFG_ID',
        'FAMILY_ID',
        'MEMBER_NAME'
      ]),

    PHOTO_HEADER:
      'PHOTO',

    MEMBERSHIP_TYPE_HEADER:
      'TYPE_OF_MEMBERSHIP',

    MEMBER_MOBILE_HEADER:
      'MEMBER_MOBILE',

    MEMBER_EMAIL_HEADER:
      'MEMBER_EMAIL',

    RECORD_STATUS_HEADER:
      'RECORD_STATUS',

    DEFAULT_RECORD_STATUS:
      'ACTIVE'
  });


/**
 * ============================================================
 * PART 2C
 * BUILD DIGITAL CARD VIEW MODEL
 * ============================================================
 *
 * Combines:
 *
 * 1. KEFG_MEMBER_CARDS
 * 2. KGMIS_MEMBERSHIP_YEAR
 * 3. KGMIS_MASTER_DATABASE_v1.0
 * 4. KGMIS_FINANCIAL_YEAR
 *
 * The HTML template receives only the returned View Model.
 *
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_BuildCardViewModel_(
  cardContext
) {

  if (
    !cardContext ||
    !cardContext.card
  ) {

    throw new Error(
      "A valid Digital Card context is required."
    );

  }

  const card =
    cardContext.card;

  // ----------------------------------------------------------
  // CARD IDENTITY
  // ----------------------------------------------------------

  const cardId =
    KGMIS_DigitalCardRenderer_Clean_(
      card.CARD_ID
    ).toUpperCase();

  const familyId =
    KGMIS_DigitalCardRenderer_Clean_(
      card.FAMILY_ID
    ).toUpperCase();

  const kefgId =
  KGMIS_DigitalCardRenderer_Clean_(
    card.KEFG_ID
  ).toUpperCase();

const cardholderType =
  KGMIS_DigitalCardRenderer_Clean_(
    card.CARDHOLDER_TYPE
  ).toUpperCase();

const isDependent =
  cardholderType === "DEPENDENT";

const membershipYear =
  KGMIS_DigitalCardRenderer_Clean_(
    card.MEMBERSHIP_YEAR
  );

  if (!cardId) {

    throw new Error(
      "The Digital Card record has no CARD_ID."
    );

  }

  if (!familyId) {

    throw new Error(
      "The Digital Card record has no FAMILY_ID."
    );

  }

  if (!isDependent && !kefgId) {

  throw new Error(
    "The Digital Card record has no KEFG_ID."
  );

}

  if (!membershipYear) {

    throw new Error(
      "The Digital Card record has no MEMBERSHIP_YEAR."
    );

  }

  // ----------------------------------------------------------
  // MEMBERSHIP ELIGIBILITY
  // ----------------------------------------------------------

  const eligibleMembership =
    KGMIS_DigitalCardRenderer_ReadEligibleMembership_(
      familyId,
      membershipYear
    );

  if (!eligibleMembership) {

    throw new Error(
      "This family does not have an eligible paid membership " +
      "record for Financial Year " +
      membershipYear +
      "."
    );

  }

// ----------------------------------------------------------
// CARDHOLDER RECORD
// ----------------------------------------------------------

let member;

if (isDependent) {

  const dependentName =
    KGMIS_DigitalCardRenderer_Clean_(
      card.CARDHOLDER_NAME
    );

  if (!dependentName) {
    throw new Error(
      "The Family Member card has no CARDHOLDER_NAME."
    );
  }

  member = {
    kefgId:
      "",

    familyId:
      familyId,

    memberName:
      dependentName,

    bloodGroup:
      "",

    membershipType:
      KGMIS_DigitalCardRenderer_Clean_(
        card.MEMBERSHIP_TYPE
      ),

    memberMobile:
      KGMIS_DigitalCardRenderer_Clean_(
        card.MEMBER_MOBILE
      ),

    memberEmail:
      KGMIS_DigitalCardRenderer_Clean_(
        card.MEMBER_EMAIL
      ),

    photo:
      KGMIS_DigitalCardRenderer_FirstNonEmpty_(
        card.PHOTO_FILE_ID,
        card.PHOTO_URL
      ),

    recordStatus:
      "ACTIVE"
  };

} else {

  member =
    KGMIS_DigitalCardRenderer_ReadMemberByKefgId_(
      kefgId
    );

  if (!member) {
    throw new Error(
      "No eligible Master Database record was found for " +
      kefgId +
      "."
    );
  }

  const memberFamilyId =
    KGMIS_DigitalCardRenderer_Clean_(
      member.familyId
    ).toUpperCase();

  if (
    memberFamilyId &&
    memberFamilyId !== familyId
  ) {
    throw new Error(
      "The card Family ID does not match the Master Database."
    );
  }

}

  // ----------------------------------------------------------
  // FINANCIAL YEAR RECORD
  // ----------------------------------------------------------

  const financialYear =
    KGMIS_DigitalCardRenderer_ReadFinancialYear_(
      membershipYear
    );

  if (!financialYear) {

    throw new Error(
      "Financial Year record was not found for " +
      membershipYear +
      "."
    );

  }

  // ----------------------------------------------------------
  // PHOTO
  // ----------------------------------------------------------

  const photoFileId =
    KGMIS_DigitalCardRenderer_ExtractDriveFileId_(

      KGMIS_DigitalCardRenderer_FirstNonEmpty_(
        member.photo,
        card.PHOTO_FILE_ID,
        card.PHOTO_URL
      )

    );

  const photoResult =
    KGMIS_DigitalCardRenderer_LoadPhotoDataUrl_(
      photoFileId
    );

  // A missing photograph must never prevent card generation.

  const photoAvailable =
    Boolean(
      photoResult &&
      photoResult.success &&
      photoResult.dataUrl
    );

  // ----------------------------------------------------------
  // CARD STATUS AND VALIDITY LABEL
  // ----------------------------------------------------------

  const cardStatus =
    KGMIS_DigitalCardRenderer_Clean_(
      card.CARD_STATUS
    ).toUpperCase();

  const validityLabel =
    KGMIS_DigitalCardRenderer_GetValidityLabel_(
      cardStatus
    );

  // VALID_UNTIL must come from the Card Registry.

  const validUntil =
    KGMIS_DigitalCardRenderer_FormatOutputDate_(
      card.VALID_UNTIL
    );

  if (!validUntil) {

    throw new Error(
      "VALID_UNTIL is blank for Card ID " +
      cardId +
      "."
    );

  }

  // ----------------------------------------------------------
  // QR PAYLOAD
  // ----------------------------------------------------------

  const qrPayload =
    KGMIS_DigitalCardRenderer_CreateQrPayload_(
      card
    );

  if (!qrPayload) {

    throw new Error(
      "QR payload could not be created for Card ID " +
      cardId +
      "."
    );

  }

  // ----------------------------------------------------------
  // MEMBERSHIP STATUS
  // ----------------------------------------------------------

  const membershipStatus =
    KGMIS_DigitalCardRenderer_Clean_(
      eligibleMembership.MEMBERSHIP_STATUS
    ).toUpperCase();

  const paymentStatus =
    KGMIS_DigitalCardRenderer_Clean_(
      eligibleMembership.PAYMENT_STATUS
    ).toUpperCase();

  // ----------------------------------------------------------
  // RETURN FINAL VIEW MODEL
  // ----------------------------------------------------------

  return {

    // Organisation

    organisationName:
      "KEF Global",

    cardTitle:
      "Membership Card",

    organisationTagline:
      "Connecting Engineers • Strengthening Fellowship • Serving Community",

    website:
      KGMIS_DIGITAL_CARD_RENDERER_CONFIG
        .DEFAULT_WEBSITE,

    // Card identity

    cardId:
      cardId,

    familyId:
      familyId,

    kefgId:
      kefgId,
    
    relationSequence:
    String(
    KGMIS_DigitalCardRenderer_Clean_(
      card.RELATION_SEQUENCE
    )
  ).padStart(2, "0"),

    // Member information

    cardholderName:
      KGMIS_DigitalCardRenderer_FirstNonEmpty_(
        member.memberName,
        card.CARDHOLDER_NAME,
        "Member"
      ),

    cardholderType:
      KGMIS_DigitalCardRenderer_FormatCardholderType_(
        card.CARDHOLDER_TYPE
      ),

    bloodGroup:
      KGMIS_DigitalCardRenderer_Clean_(
        member.bloodGroup
      ),

    MEMBER_MOBILE:
      KGMIS_DigitalCardRenderer_FirstNonEmpty_(
        member.memberMobile,
        card.MEMBER_MOBILE
      ),

    memberEmail:
      KGMIS_DigitalCardRenderer_FirstNonEmpty_(
        member.memberEmail,
        card.MEMBER_EMAIL
      ),

    // Version 1.0 policy:
    // all issued cards use one Founder Member design.

    membershipDisplay:
      card.CARDHOLDER_TYPE,

    membershipType:
      card.MEMBERSHIP_TYPE,

    membershipYear:
      membershipYear,

    membershipStatus:
      membershipStatus,

    paymentStatus:
      paymentStatus,

    // Dates

    issueDate:
      KGMIS_DigitalCardRenderer_FormatOutputDate_(
        card.ISSUE_DATE
      ),

    validityLabel:
      validityLabel,

    validUntil:
      validUntil,

    // Internal card status

    cardStatus:
      cardStatus,

    cardState:
      KGMIS_DigitalCardRenderer_Clean_(
        card.CARD_STATE
      ).toUpperCase(),

    // Photograph

    photoFileId:
      photoFileId,

    photoUrl:
      photoAvailable
        ? photoResult.dataUrl
        : "",

    photoAvailable:
      photoAvailable,

    usePhotoPlaceholder:
      !photoAvailable,

    photoMessage:
      photoAvailable
        ? ""
        : KGMIS_DigitalCardRenderer_FirstNonEmpty_(
            photoResult.message,
            "Member photograph is not yet available."
          ),

    // QR

    qrToken:
      KGMIS_DigitalCardRenderer_Clean_(
        card.QR_TOKEN
      ),

    qrPayload:
      qrPayload,

    /*
     * The browser template will generate the actual QR image
     * in the next implementation phase.
     */

    qrImageUrl:
      "",

    // Generated files

    cardPdfFileId:
      KGMIS_DigitalCardRenderer_Clean_(
        card.CARD_PDF_FILE_ID
      ),

    cardPdfUrl:
      KGMIS_DigitalCardRenderer_Clean_(
        card.CARD_PDF_FILE_URL
      ),

    cardImageFileId:
      KGMIS_DigitalCardRenderer_Clean_(
        card.CARD_IMAGE_FILE_ID
      ),

    cardImageUrl:
      KGMIS_DigitalCardRenderer_Clean_(
        card.CARD_IMAGE_FILE_URL
      ),

    // Version

    cardVersion:
      KGMIS_DigitalCardRenderer_FormatCardVersion_(
        financialYear.cardVersion ||
        card.CARD_VERSION ||
        KGMIS_CONFIG.CARD_VERSION
      ),

    remarks:
      KGMIS_DigitalCardRenderer_Clean_(
        card.REMARKS
      )

  };

}

/**
 * ============================================================
 * VALIDITY LABEL
 * ============================================================
 *
 * CURRENT / ACTIVE:
 * Valid Until
 *
 * EXTENDED:
 * Extended Until
 */

function KGMIS_DigitalCardRenderer_GetValidityLabel_(
  cardStatus
) {

  const status =
    KGMIS_DigitalCardRenderer_Clean_(
      cardStatus
    ).toUpperCase();

  if (status === "EXTENDED") {

    return "Extended Until";

  }

  return "Valid Until";

}

/**
 * ============================================================
 * FORMAT CARDHOLDER TYPE
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_FormatCardholderType_(
  value
) {

  const type =
    KGMIS_DigitalCardRenderer_Clean_(
      value
    )
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  switch (type) {

    case "PRIMARY_MEMBER":
      return "Primary Member";

    case "DEPENDENT":
      return "Family Member";

    default:
      return KGMIS_DigitalCardRenderer_Clean_(
        value
      );

  }

}

/**
 * ============================================================
 * FORMAT CARD VERSION
 * ============================================================
 *
 * Examples:
 *
 * 1     -> 1.0
 * 1.0   -> 1.0
 * 1.5   -> 1.5
 * "2"   -> 2.0
 */

function KGMIS_DigitalCardRenderer_FormatCardVersion_(
  value
) {

  const cleanValue =
    KGMIS_DigitalCardRenderer_Clean_(
      value
    );

  if (!cleanValue) {

    return "1.0";

  }

  const numericValue =
    Number(
      cleanValue.replace(",", ".")
    );

  if (!isNaN(numericValue)) {

    return numericValue.toFixed(1);

  }

  return cleanValue;

}

/**
 * ============================================================
 * SAFE TEST: DIGITAL CARD VIEW MODEL
 * ============================================================
 */

function KGMIS_TestDigitalCardViewModel() {

  const testCardId =
    "KEFG00003504";

  const card =
    KGMIS_DigitalCardRenderer_ReadCardById_(
      testCardId
    );

  if (!card) {

    throw new Error(
      "Test card was not found: " +
      testCardId
    );

  }

  const result =
    KGMIS_DigitalCardRenderer_BuildCardViewModel_({

      card:
        card

    });

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
 * READ ELIGIBLE MEMBERSHIP RECORD
 * ============================================================
 *
 * Returns the matching eligible annual membership record.
 *
 * Returns null when:
 *
 * - the family is absent;
 * - PAYMENT_STATUS is not PAID;
 * - MEMBERSHIP_STATUS is not CURRENT;
 * - RECORD_STATUS is not ACTIVE.
 *
 * @param {string} familyId
 * @param {string} financialYear
 * @return {Object|null}
 */

/**
 * ============================================================
 * MEMBERSHIP YEAR CONTEXT
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_GetMembershipYearContext_() {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    spreadsheet.getSheetByName(
      KGMIS_CONFIG.MEMBERSHIP_YEAR_SHEET
    );

  if (!sheet) {

    throw new Error(
      'Membership Year sheet "' +
      KGMIS_CONFIG.MEMBERSHIP_YEAR_SHEET +
      '" was not found.'
    );

  }

  const lastColumn =
    sheet.getLastColumn();

  if (lastColumn < 1) {

    throw new Error(
      "Membership Year sheet has no headers."
    );

  }

  const headers =
    sheet
      .getRange(
        KGMIS_CONFIG.HEADER_ROW,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0]
      .map(function(header){

        return String(header || "")
          .trim()
          .toUpperCase();

      });

  const headerMap = {};

  headers.forEach(function(header,index){

    headerMap[header] = index;

  });

  const requiredHeaders = [

    "FAMILY_ID",

    "FINANCIAL_YEAR",

    "PAYMENT_STATUS",

    "MEMBERSHIP_STATUS",

    "RECORD_STATUS"

  ];

  const missingHeaders =
    requiredHeaders.filter(function(header){

      return !(header in headerMap);

    });

  if (missingHeaders.length > 0) {

    throw new Error(

      "Membership Year sheet missing header(s): " +

      missingHeaders.join(", ")

    );

  }

  return {

    sheet: sheet,

    headers: headers,

    headerMap: headerMap

  };

}

function KGMIS_DigitalCardRenderer_ReadEligibleMembership_(
  familyId,
  financialYear
) {

  const cleanFamilyId =
    KGMIS_DigitalCardRenderer_Clean_(
      familyId
    ).toUpperCase();

  const cleanFinancialYear =
    KGMIS_DigitalCardRenderer_Clean_(
      financialYear
    );

  if (!cleanFamilyId) {

    throw new Error(
      "Family ID is required for membership eligibility."
    );

  }

  if (!cleanFinancialYear) {

    throw new Error(
      "Financial Year is required for membership eligibility."
    );

  }

  const context =
    KGMIS_DigitalCardRenderer_GetMembershipYearContext_();

  const lastRow =
    context.sheet.getLastRow();

  if (
    lastRow <
    KGMIS_CONFIG.FIRST_DATA_ROW
  ) {

    return null;

  }

  const values =
    context.sheet
      .getRange(
        KGMIS_CONFIG.FIRST_DATA_ROW,
        1,
        lastRow -
          KGMIS_CONFIG.FIRST_DATA_ROW +
          1,
        context.headers.length
      )
      .getValues();

  const map =
    context.headerMap;

  for (
    let rowIndex = 0;
    rowIndex < values.length;
    rowIndex += 1
  ) {

    const row =
      values[rowIndex];

    const rowFamilyId =
      KGMIS_DigitalCardRenderer_Clean_(
        row[map.FAMILY_ID]
      ).toUpperCase();

    const rowFinancialYear =
      KGMIS_DigitalCardRenderer_Clean_(
        row[map.FINANCIAL_YEAR]
      );

    if (
      rowFamilyId !== cleanFamilyId ||
      rowFinancialYear !== cleanFinancialYear
    ) {

      continue;

    }

    const membershipStatus =
      KGMIS_DigitalCardRenderer_Clean_(
        row[map.MEMBERSHIP_STATUS]
      ).toUpperCase();

    const paymentStatus =
      KGMIS_DigitalCardRenderer_Clean_(
        row[map.PAYMENT_STATUS]
      ).toUpperCase();

    const recordStatus =
      KGMIS_DigitalCardRenderer_Clean_(
        row[map.RECORD_STATUS]
      ).toUpperCase();

    if (
      membershipStatus !== "CURRENT" ||

      paymentStatus !== "PAID" ||

      recordStatus !== "ACTIVE"
    ) {

      return null;

    }

    return KGMIS_DigitalCardRenderer_RowToObject_(
      row,
      context.headers
    );

  }

  return null;

}

/**
 * ============================================================
 * SAFE TEST: MEMBERSHIP ELIGIBILITY
 * ============================================================
 */

function KGMIS_TestDigitalCardMembershipEligibility() {

  const result =
    KGMIS_DigitalCardRenderer_ReadEligibleMembership_(
      "FAM00001",
      "2026-27"
    );

  const output = {

    eligible:
      Boolean(result),

    record:
      result

  };

  Logger.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );

  return output;

}

/**
 * ============================================================
 * PART 2A
 * MASTER DATABASE CONTEXT
 * ============================================================
 *
 * Reads the Master Database once and provides:
 *
 * - Sheet
 * - Headers
 * - Header Index Map
 *
 * This context is reused by the renderer.
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_GetMasterContext_() {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    spreadsheet.getSheetByName(
      KGMIS_CONFIG.MASTER_SHEET
    );

  if (!sheet) {

    throw new Error(
      'Master Database sheet "' +
      KGMIS_CONFIG.MASTER_SHEET +
      '" was not found.'
    );

  }

  const lastColumn =
    sheet.getLastColumn();

  if (lastColumn < 1) {

    throw new Error(
      'Master Database has no headers.'
    );

  }

  const headers =
    sheet
      .getRange(
        KGMIS_CONFIG.HEADER_ROW,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0]
      .map(function(header){

        return KGMIS_DigitalCardRenderer_Clean_(
          header
        ).toUpperCase();

      });

  const headerMap =
    {};

  headers.forEach(function(header,index){

    headerMap[header] = index;

  });

  /*
   * Validate minimum required headers.
   */

  const requiredHeaders = [

    "KEFG_ID",

    "FAMILY_ID",

    "MEMBER_NAME",

    "PHOTO",

    "MEMBER_MOBILE",

    "MEMBER_EMAIL",

    "BLOOD_GROUP",

    "TYPE_OF_MEMBERSHIP",

    "RECORD_STATUS"

  ];

  const missingHeaders =

    requiredHeaders.filter(function(header){

      return !(header in headerMap);

    });

  if (missingHeaders.length > 0) {

    throw new Error(

      "Master Database missing header(s): " +

      missingHeaders.join(", ")

    );

  }

  return {

    sheet:

      sheet,

    headers:

      headers,

    headerMap:

      headerMap

  };

}

/**
 * ============================================================
 * READ ONE MEMBER
 * ============================================================
 *
 * Reads one ACTIVE member using KEFG_ID.
 *
 * Returns:
 *
 * null
 *
 * when the member does not exist.
 *
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_ReadMemberByKefgId_(

  kefgId

) {

  const cleanKefgId =

    KGMIS_DigitalCardRenderer_Clean_(

      kefgId

    ).toUpperCase();

  if (!cleanKefgId) {

    return null;

  }

  const context =

    KGMIS_DigitalCardRenderer_GetMasterContext_();

  const sheet =

    context.sheet;

  const map =

    context.headerMap;

  const lastRow =

    sheet.getLastRow();

  if (lastRow < KGMIS_CONFIG.FIRST_DATA_ROW) {

    return null;

  }

  const values =

    sheet
      .getRange(

        KGMIS_CONFIG.FIRST_DATA_ROW,

        1,

        lastRow -
        KGMIS_CONFIG.FIRST_DATA_ROW + 1,

        context.headers.length

      )
      .getValues();

  for (

    let rowIndex = 0;

    rowIndex < values.length;

    rowIndex++

  ) {

    const row =

      values[rowIndex];

    const rowKefgId =

      KGMIS_DigitalCardRenderer_Clean_(

        row[
          map["KEFG_ID"]
        ]

      ).toUpperCase();

    if (

      rowKefgId !== cleanKefgId

    ) {

      continue;

    }

    const recordStatus =

      KGMIS_DigitalCardRenderer_Clean_(

        row[
          map["RECORD_STATUS"]
        ]

      ).toUpperCase();

    if (

      recordStatus &&
      recordStatus !== "ACTIVE"

    ) {

      return null;

    }

    return {

      kefgId:

        row[
          map["KEFG_ID"]
        ],

      familyId:

        row[
          map["FAMILY_ID"]
        ],

      memberName:

        row[
          map["MEMBER_NAME"]
        ],

      bloodGroup:

        row[
          map["BLOOD_GROUP"]
        ],

      membershipType:

        row[
          map["TYPE_OF_MEMBERSHIP"]
        ],

      memberMobile:

        row[
          map["MEMBER_MOBILE"]
        ],

      memberEmail:

        row[
          map["MEMBER_EMAIL"]
        ],

      photo:

        row[
          map["PHOTO"]
        ],

      recordStatus:

        row[
          map["RECORD_STATUS"]
        ]

    };

  }

  return null;

}

/**
 * ============================================================
 * SAFE TEST
 * MASTER MEMBER
 * ============================================================
 */

function KGMIS_TestReadMember() {

  const result =

    KGMIS_DigitalCardRenderer_ReadMemberByKefgId_(

      "KEFG1001"

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
 * LIVE MEMBERSHIP STATUS
 * ============================================================
 *
 * Converts a membership year such as:
 *
 * 2026-27
 *
 * into the Master Database header:
 *
 * SUBSCRIPTION_STATUS_2026_2027
 */

function KGMIS_DigitalCardRenderer_GetLiveMembershipStatus_(
  masterMember,
  membershipYear,
  cardFallbackStatus
) {

  const statusHeader =
    KGMIS_DigitalCardRenderer_CreateSubscriptionHeader_(
      membershipYear
    );

  if (
    statusHeader &&
    Object.prototype.hasOwnProperty.call(
      masterMember,
      statusHeader
    )
  ) {

    const liveStatus =
      KGMIS_DigitalCardRenderer_Clean_(
        masterMember[statusHeader]
      ).toUpperCase();

    if (liveStatus) {
      return liveStatus;
    }
  }

  return KGMIS_DigitalCardRenderer_Clean_(
    cardFallbackStatus
  ).toUpperCase();
}


/**
 * ============================================================
 * CREATE SUBSCRIPTION HEADER
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_CreateSubscriptionHeader_(
  membershipYear
) {

  const value =
    KGMIS_DigitalCardRenderer_Clean_(
      membershipYear
    );

  if (!value) {
    return '';
  }

  const match =
    value.match(
      /^(\d{4})\s*[-/]\s*(\d{2}|\d{4})$/
    );

  if (!match) {
    return '';
  }

  const startYear =
    match[1];

  let endYear =
    match[2];

  if (endYear.length === 2) {
    endYear =
      startYear.substring(
        0,
        2
      ) +
      endYear;
  }

  return (
    'SUBSCRIPTION_STATUS_' +
    startYear +
    '_' +
    endYear
  );
}


/**
 * ============================================================
 * GET PHOTO FILE ID
 * ============================================================
 *
 * Priority:
 *
 * 1. Master Database PHOTO
 * 2. KEFG_MEMBER_CARDS PHOTO_FILE_ID
 */

function KGMIS_DigitalCardRenderer_GetPhotoFileId_(
  masterMember,
  card
) {

  const masterPhoto =
    KGMIS_DigitalCardRenderer_ExtractDriveFileId_(
      masterMember[
        KGMIS_DIGITAL_CARD_RENDERER_PART2_CONFIG
          .PHOTO_HEADER
      ]
    );

  if (masterPhoto) {
    return masterPhoto;
  }

  return KGMIS_DigitalCardRenderer_ExtractDriveFileId_(
    card.PHOTO_FILE_ID
  );
}


/**
 * ============================================================
 * EXTRACT DRIVE FILE ID
 * ============================================================
 *
 * Although the PHOTO column should contain a File ID, this
 * function also safely extracts an ID from common Drive URLs.
 */

function KGMIS_DigitalCardRenderer_ExtractDriveFileId_(
  value
) {

  const text =
    KGMIS_DigitalCardRenderer_Clean_(
      value
    );

  if (!text) {
    return '';
  }

  /*
   * A plain Drive File ID.
   */
  if (
    /^[a-zA-Z0-9_-]{20,}$/.test(
      text
    )
  ) {
    return text;
  }

  /*
   * Example:
   * https://drive.google.com/file/d/FILE_ID/view
   */
  let match =
    text.match(
      /\/d\/([a-zA-Z0-9_-]{20,})/
    );

  if (
    match &&
    match[1]
  ) {
    return match[1];
  }

  /*
   * Example:
   * https://drive.google.com/open?id=FILE_ID
   */
  match =
    text.match(
      /[?&]id=([a-zA-Z0-9_-]{20,})/
    );

  if (
    match &&
    match[1]
  ) {
    return match[1];
  }

  return '';
}


/**
 * ============================================================
 * LOAD PHOTO AS BASE64 DATA URL
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_LoadPhotoDataUrl_(
  fileId
) {

  const cleanFileId =
    KGMIS_DigitalCardRenderer_Clean_(
      fileId
    );

  if (!cleanFileId) {
    return {
      success:
        false,

      dataUrl:
        '',

      message:
        'No member photo is available.'
    };
  }

  try {

    const file =
      DriveApp.getFileById(
        cleanFileId
      );

    const blob =
      file.getBlob();

    const mimeType =
      KGMIS_DigitalCardRenderer_Clean_(
        blob.getContentType()
      ).toLowerCase();

    if (
      KGMIS_DIGITAL_CARD_RENDERER_PART2_CONFIG
        .ALLOWED_PHOTO_MIME_TYPES
        .indexOf(
          mimeType
        ) === -1
    ) {
      return {
        success:
          false,

        dataUrl:
          '',

        message:
          'The member photo has an unsupported file type.'
      };
    }

    const bytes =
      blob.getBytes();

    if (
      bytes.length >
      KGMIS_DIGITAL_CARD_RENDERER_PART2_CONFIG
        .MAX_PHOTO_SIZE_BYTES
    ) {
      return {
        success:
          false,

        dataUrl:
          '',

        message:
          'The member photo exceeds the 5 MB limit.'
      };
    }

    const base64 =
      Utilities.base64Encode(
        bytes
      );

    return {
      success:
        true,

      dataUrl:
        'data:' +
        mimeType +
        ';base64,' +
        base64,

      message:
        ''
    };

  } catch (error) {

    return {
      success:
        false,

      dataUrl:
        '',

      message:
        'The member photo could not be loaded: ' +
        KGMIS_DigitalCardRenderer_GetErrorMessage_(
          error
        )
    };
  }
}


/**
 * ============================================================
 * QR PAYLOAD
 * ============================================================
 *
 * For now, the QR payload does not depend on a public website.
 *
 * Priority:
 *
 * 1. QR_TOKEN
 * 2. CARD_ID
 *
 * Part 3 will convert this payload into an actual QR image in
 * the browser.
 */

function KGMIS_DigitalCardRenderer_CreateQrPayload_(
  card
) {

  const qrToken =
    KGMIS_DigitalCardRenderer_Clean_(
      card.QR_TOKEN
    );

  const cardholderType =
  KGMIS_DigitalCardRenderer_Clean_(
    card.CARDHOLDER_TYPE
  ).toUpperCase();

const kefgId =
  KGMIS_DigitalCardRenderer_Clean_(
    card.KEFG_ID
  ).toUpperCase();

if (
  cardholderType !== "DEPENDENT" &&
  !kefgId
) {
  return '';
}

// xxxxxxxxxx

// PASTE THIS REPLACEMENT BLOCK INSTEAD:
// 1. Generate the raw URL string from your original logic
var rawVerificationUrl = 'https://script.google.com/macros/s/' + 'AKfycbyn9GPjSmsR9xLpd1Oairy9FRKlroAqokZKGiQG1msw7JBg0zgnP8g016gz91lMADcE/exec' + '?module=verify' + '&id=' + encodeURIComponent(card.CARD_ID) + '&token=' + encodeURIComponent(qrToken);

// 2. Safety Net: Strip out any session parameters like /u/3/ or /s/3 if Google forces them in
var cleanVerificationUrl = rawVerificationUrl.replace(/\/u\/\d+\//g, "/").replace(/\/s\/\d+\//g, "/s/");

// 3. Return the sanitized URL to your QR Code generator
return cleanVerificationUrl;

// xxxxxxxxxx

//return (
//  'https://script.google.com/macros/s/' +
//'AKfycbyn9GPjSmsR9xLpd1Oairy9FRKlroAqokZKGiQG1msw7JBg0zgnP8g016gz91lMADcE/exec' +
//'?module=verify' +
// '&id=' +
// encodeURIComponent(
//  card.CARD_ID
//) +
//  '&token=' +
//  encodeURIComponent(qrToken)
//);

}


/**
 * ============================================================
 * FIRST NON-EMPTY VALUE
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_FirstNonEmpty_() {

  for (
    let index = 0;
    index < arguments.length;
    index += 1
  ) {

    const value =
      KGMIS_DigitalCardRenderer_Clean_(
        arguments[index]
      );

    if (value) {
      return value;
    }
  }

  return '';
}


/**
 * ============================================================
 * SAFE TEST: SUBSCRIPTION HEADER
 * ============================================================
 */

function KGMIS_TestDigitalCardSubscriptionHeader() {

  const tests = [
    {
      input:
        '2026-27',

      expected:
        'SUBSCRIPTION_STATUS_2026_2027'
    },
    {
      input:
        '2025-2026',

      expected:
        'SUBSCRIPTION_STATUS_2025_2026'
    },
    {
      input:
        '2024/25',

      expected:
        'SUBSCRIPTION_STATUS_2024_2025'
    }
  ];

  const results =
    tests.map(
      function (test) {

        const actual =
          KGMIS_DigitalCardRenderer_CreateSubscriptionHeader_(
            test.input
          );

        return {
          input:
            test.input,

          expected:
            test.expected,

          actual:
            actual,

          passed:
            actual === test.expected
        };
      }
    );

  const output = {
    success:
      results.every(
        function (result) {
          return result.passed;
        }
      ),

    results:
      results
  };

  Logger.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );

  return output;
}

/**
 * ============================================================
 * PART 3.1
 * Build View Model
 * ============================================================
 *
 * Converts raw database records into the object
 * consumed by KGMIS_Digital_Card_Template.html
 */

function KGMIS_BuildDigitalCardViewModel_(
  cardRecord,
  memberRecord,
  financialYearRecord
) {

  return {

    //--------------------------------------------------
    // Identity
    //--------------------------------------------------

    cardNumber:
      cardRecord.cardId || "",

    familyId:
      cardRecord.familyId || "",

    kefgId:
      cardRecord.kefgId || "",

    //--------------------------------------------------
    // Member
    //--------------------------------------------------

    memberName:
      cardRecord.cardholderName || "",

    memberType:
      KGMIS_FormatMemberType_(
        cardRecord.cardholderType
      ),

    relationSequence:
      cardRecord.relationSequence || "",

    bloodGroup:
      memberRecord.bloodGroup || "",

    //--------------------------------------------------
    // Membership
    //--------------------------------------------------

    membershipType:
      KGMIS_FormatMembershipType_(
        cardRecord.membershipType
      ),

    membershipYear:
      cardRecord.membershipYear || "",

    membershipStatus:
      cardRecord.membershipStatus || "",

    //--------------------------------------------------
    // Card Status
    //--------------------------------------------------

    cardStatus:
      KGMIS_GetCardStatus_(
        financialYearRecord
      ),

    //--------------------------------------------------
    // Dates
    //--------------------------------------------------

    issueDate:
      KGMIS_FormatDate_(
        cardRecord.issueDate
      ),

    validUntil:
      KGMIS_FormatDate_(
        financialYearRecord.gracePeriodEnd
      ),

    //--------------------------------------------------
    // Contact
    //--------------------------------------------------

    mobile:
      memberRecord.memberMobile || "",

    email:
      memberRecord.memberEmail || "",

    //--------------------------------------------------
    // Images
    //--------------------------------------------------

    photoUrl:
      KGMIS_GetMemberPhotoUrl_(
        memberRecord.photoFileId
      ),

    qrImageUrl:
      KGMIS_GetQrImageUrl_(
        cardRecord
      ),

    //--------------------------------------------------
    // Branding
    //--------------------------------------------------

    organisation:
      "KEF Global",

    website:
      "www.kefglobal.org",

    mission:
      "Connecting Engineers • Strengthening Fellowship • Serving Community",

    //--------------------------------------------------
    // Version
    //--------------------------------------------------

    cardVersion:
      financialYearRecord.cardVersion || "1.0"

  };

}

/**
 * ============================================================
 * HELPER FUNCTIONS
 * ============================================================
 */

function KGMIS_FormatMemberType_(value){

  switch(String(value || "").toUpperCase()){

    case "PRIMARY_MEMBER":
      return "Primary Member";

    case "SPOUSE":
      return "Spouse";

    case "CHILD":
      return "Child";

    default:
      return value || "";
  }

}

function KGMIS_FormatMembershipType_(value){

  switch(String(value || "").toUpperCase()){

    case "ANNUAL":
      return "Annual Membership";

    case "LIFE":
      return "Life Membership";

    default:
      return value || "";
  }

}

function KGMIS_FormatDate_(value){

  if(!value) return "";

  const d = new Date(value);

  if(isNaN(d.getTime())) return "";

  return Utilities.formatDate(
    d,
    Session.getScriptTimeZone(),
    "dd MMM yyyy"
  );

}

function KGMIS_GetLogoUrl_(){

  return "";

}

/**
 * Returns the current card status.
 * (Temporary stub)
 */
function KGMIS_GetCardStatus_(financialYearRecord) {

  return "ACTIVE";

}


/**
 * Returns the member photo URL.
 * (Temporary stub)
 */
function KGMIS_GetMemberPhotoUrl_(fileId) {

  return "";

}


/**
 * Returns the QR image URL.
 * (Temporary stub)
 */
function KGMIS_GetQrImageUrl_(cardRecord) {

  return "";

}

/**
 * ============================================================
 * PART 3.2
 * Render Premium Digital Card HTML
 * ============================================================
 *
 * Reads:
 *   1. Card Record
 *   2. Member Record
 *   3. Financial Year
 *
 * Builds the ViewModel and injects it into
 * KGMIS_Digital_Card_Template.html
 * const card = data
 * Debug version - 22-JUL-2026 4:44PM
 */

function KGMIS_RenderDigitalCard(cardId) {

  Logger.log("STEP 1 : cardId = " + cardId);

  const cardRecord =
    KGMIS_GetCardRecord_(cardId);

  Logger.log("STEP 2 : cardRecord");
  Logger.log(JSON.stringify(cardRecord));

  if (!cardRecord) {
    throw new Error(
      "Card not found : " + cardId
    );
  }

  Logger.log("STEP 3 : Loading member");

  const memberRecord =
    KGMIS_GetMemberRecord_(
      cardRecord.kefgId
    );

  Logger.log("STEP 4 : memberRecord");
  Logger.log(JSON.stringify(memberRecord));

  Logger.log("STEP 5 : Loading financial year");

  const financialYearRecord =
    KGMIS_GetFinancialYearRecord_(
      cardRecord.membershipYear
    );

  Logger.log("STEP 6 : financialYearRecord");
  Logger.log(JSON.stringify(financialYearRecord));

  Logger.log("STEP 7 : Building ViewModel");

  const card =
    KGMIS_BuildDigitalCardViewModel_(
      cardRecord,
      memberRecord,
      financialYearRecord
    );

  Logger.log("STEP 8 : ViewModel built");

  const template =
    HtmlService.createTemplateFromFile(
      "KGMIS_Digital_Card_Template"
    );

  Logger.log("STEP 9 : Template loaded");

  template.card = card;

  Logger.log(
      "FINAL CARD VIEWMODEL:\n" +
      JSON.stringify(card, null, 2)
    );

  Logger.log("STEP 10 : Returning HTML");

  return template
    .evaluate()
    .setTitle(
      "KEF Global Digital Membership Card"
    )
    .addMetaTag(
      "viewport",
      "width=device-width, initial-scale=1"
    )
    .setXFrameOptionsMode(
      HtmlService.XFrameOptionsMode.DEFAULT
    );

}

/**
 * Loads one digital card record.
 */
function KGMIS_GetCardRecord_(cardId) {

  return KGMIS_ReadCardRecord_(
    cardId
  );

}


/**
 * Loads one member record.
 */
function KGMIS_GetMemberRecord_(
  kefgId
) {

  return KGMIS_DB_GetMemberByKEFGID(
    kefgId
  );

}

function KGMIS_GetFinancialYearRecord_(
  membershipYear
) {

  return KGMIS_GetFinancialYear(
    membershipYear
  );

}

/**
 * ============================================================
 * Reads one Digital Card record
 * Sheet : KEFG_MEMBER_CARDS
 * ============================================================
 */

function KGMIS_ReadCardRecord_(cardId) {

  if (!cardId) {
    return null;
  }

  const ss =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    ss.getSheetByName("KEFG_MEMBER_CARDS");

  if (!sheet) {
    throw new Error(
      "Sheet not found : KEFG_MEMBER_CARDS"
    );
  }

  const values =
    sheet.getDataRange().getValues();

  if (values.length < 2) {
    return null;
  }

  const headers = values[0];

  const map = {};

  headers.forEach(function(header, index){

    map[String(header).trim()] = index;

  });

  const idColumn = map["CARD_ID"];

  if (idColumn === undefined) {
    throw new Error(
      "CARD_ID column not found."
    );
  }

  for (let r = 1; r < values.length; r++) {

    if (String(values[r][idColumn]).trim() !== String(cardId).trim()) {
      continue;
    }

    return {

      cardId:
        values[r][map["CARD_ID"]],

      familyId:
        values[r][map["FAMILY_ID"]],

      kefgId:
        values[r][map["KEFG_ID"]],

      cardholderType:
        values[r][map["CARDHOLDER_TYPE"]],

      relationSequence:
        values[r][map["RELATION_SEQUENCE"]],

      cardholderName:
        values[r][map["CARDHOLDER_NAME"]],

      membershipType:
        values[r][map["MEMBERSHIP_TYPE"]],

      membershipYear:
        values[r][map["MEMBERSHIP_YEAR"]],

      membershipStatus:
        values[r][map["MEMBERSHIP_STATUS"]],

      issueDate:
        values[r][map["ISSUE_DATE"]],

      validUntil:
        values[r][map["VALID_UNTIL"]],

      cardStatus:
        values[r][map["CARD_STATUS"]],

      memberMobile:
        values[r][map["MEMBER_MOBILE"]],

      memberEmail:
        values[r][map["MEMBER_EMAIL"]],

      photoFileId:
        values[r][map["PHOTO_FILE_ID"]],

      photoUrl:
        values[r][map["PHOTO_URL"]],

      qrToken:
        values[r][map["QR_TOKEN"]],

      cardPdfFileId:
        values[r][map["CARD_PDF_FILE_ID"]],

      cardPdfUrl:
        values[r][map["CARD_PDF_FILE_URL"]],

      cardImageFileId:
        values[r][map["CARD_IMAGE_FILE_ID"]],

      cardImageUrl:
        values[r][map["CARD_IMAGE_FILE_URL"]],

      cardVersion:
        values[r][map["CARD_VERSION"]],

      remarks:
        values[r][map["REMARKS"]]

    };

  }

  return null;

}

/**
 * ============================================================
 * SAFE TEST
 * Read Card Record
 * ============================================================
 */

function KGMIS_TestReadCardRecord() {

  const result =
    KGMIS_ReadCardRecord_("KEFG00003501");

  Logger.log(result);

  return result;

}

/**
 * ============================================================
 * SAFE TEST: QR PAYLOAD
 * ============================================================
 */

function KGMIS_TestDigitalCardQrPayload() {

  const withToken =
    KGMIS_DigitalCardRenderer_CreateQrPayload_({
      CARD_ID:
        'KEFG00003501',

      QR_TOKEN:
        'TEST_QR_TOKEN'
    });

  const withoutToken =
    KGMIS_DigitalCardRenderer_CreateQrPayload_({
      CARD_ID:
        'KEFG00003501',

      QR_TOKEN:
        ''
    });

  const output = {
    success:
      (
        withToken ===
          'KGMIS:TEST_QR_TOKEN'
      ) &&
      (
        withoutToken ===
          'KGMIS-CARD:KEFG00003504'
      ),

    withToken:
      withToken,

    withoutToken:
      withoutToken
  };

  Logger.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );

  return output;
}


/**
 * ============================================================
 * SAFE TEST: MASTER DATABASE SETUP
 * ============================================================
 */

function KGMIS_TestDigitalCardMasterSetup() {

  const output = {
    success:
      false
  };

  try {

    const context =
      KGMIS_DigitalCardRenderer_GetMasterContext_();

    output.success =
      true;

    output.sheetName =
      context.sheet.getName();

    output.headerCount =
      context.headers.length;

    output.lastRow =
      context.sheet.getLastRow();

    output.photoHeaderFound =
      context.headers.indexOf(
        'PHOTO'
      ) !== -1;

    output.membershipTypeHeaderFound =
      context.headers.indexOf(
        'TYPE_OF_MEMBERSHIP'
      ) !== -1;

    output.memberMobileHeaderFound =
      context.headers.indexOf(
        'MEMBER_MOBILE'
      ) !== -1;

    output.memberEmailHeaderFound =
      context.headers.indexOf(
        'MEMBER_EMAIL'
      ) !== -1;

  } catch (error) {

    output.error =
      KGMIS_DigitalCardRenderer_GetErrorMessage_(
        error
      );
  }

  Logger.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );

  return output;
}


/**
 * ============================================================
 * SAFE TEST: PHOTO FILE ID EXTRACTION
 * ============================================================
 */

function KGMIS_TestDigitalCardPhotoFileIdExtraction() {

  const sampleFileId =
    '1AbCdEfGhIjKlMnOpQrStUvWxYz123456';

  const tests = [
    {
      input:
        sampleFileId,

      expected:
        sampleFileId
    },
    {
      input:
        'https://drive.google.com/file/d/' +
        sampleFileId +
        '/view',

      expected:
        sampleFileId
    },
    {
      input:
        'https://drive.google.com/open?id=' +
        sampleFileId,

      expected:
        sampleFileId
    },
    {
      input:
        '',

      expected:
        ''
    }
  ];

  const results =
    tests.map(
      function (test) {

        const actual =
          KGMIS_DigitalCardRenderer_ExtractDriveFileId_(
            test.input
          );

        return {
          expected:
            test.expected,

          actual:
            actual,

          passed:
            actual === test.expected
        };
      }
    );

  const output = {
    success:
      results.every(
        function (result) {
          return result.passed;
        }
      ),

    results:
      results
  };

  Logger.log(
    JSON.stringify(
      output,
      null,
      2
    )
  );

  return output;
}

/**
 * ============================================================
 * PART 2B
 * FINANCIAL YEAR CONTEXT
 * ============================================================
 *
 * Reads the Financial Year policy table.
 *
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_GetFinancialYearContext_() {

  const spreadsheet =
    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =
    spreadsheet.getSheetByName(
      KGMIS_CONFIG.FINANCIAL_YEAR_SHEET
    );

  if (!sheet) {

    throw new Error(
      'Financial Year sheet "' +
      KGMIS_CONFIG.FINANCIAL_YEAR_SHEET +
      '" was not found.'
    );

  }

  const lastColumn =
    sheet.getLastColumn();

  if (lastColumn < 1) {

    throw new Error(
      "Financial Year sheet has no headers."
    );

  }

  const headers =
    sheet
      .getRange(
        KGMIS_CONFIG.HEADER_ROW,
        1,
        1,
        lastColumn
      )
      .getDisplayValues()[0]
      .map(function(header){

        return KGMIS_DigitalCardRenderer_Clean_(
          header
        ).toUpperCase();

      });

  const headerMap = {};

  headers.forEach(function(header,index){

    headerMap[header] = index;

  });

  const requiredHeaders = [

    "FINANCIAL_YEAR",

    "END_DATE",

    "GRACE_PERIOD_END",

    "CARD_VERSION"

  ];

  const missingHeaders =
    requiredHeaders.filter(function(header){

      return !(header in headerMap);

    });

  if (missingHeaders.length > 0) {

    throw new Error(

      "Financial Year sheet missing header(s): " +

      missingHeaders.join(", ")

    );

  }

  return {

    sheet:
      sheet,

    headers:
      headers,

    headerMap:
      headerMap

  };

}

/**
 * ============================================================
 * READ FINANCIAL YEAR
 * ============================================================
 *
 * Reads one Financial Year record.
 *
 * Returns:
 *
 * null
 *
 * if not found.
 *
 * ============================================================
 */

function KGMIS_DigitalCardRenderer_ReadFinancialYear_(

  financialYear

) {

  const cleanFinancialYear =

    KGMIS_DigitalCardRenderer_Clean_(

      financialYear

    );

  if (!cleanFinancialYear) {

    return null;

  }

  const context =

    KGMIS_DigitalCardRenderer_GetFinancialYearContext_();

  const sheet =

    context.sheet;

  const map =

    context.headerMap;

  const lastRow =

    sheet.getLastRow();

  if (

    lastRow <
    KGMIS_CONFIG.FIRST_DATA_ROW

  ) {

    return null;

  }

  const values =

    sheet
      .getRange(

        KGMIS_CONFIG.FIRST_DATA_ROW,

        1,

        lastRow -
        KGMIS_CONFIG.FIRST_DATA_ROW + 1,

        context.headers.length

      )
      .getValues();

  for (

    let rowIndex = 0;

    rowIndex < values.length;

    rowIndex++

  ) {

    const row =

      values[rowIndex];

    const rowFinancialYear =

      KGMIS_DigitalCardRenderer_Clean_(

        row[
          map["FINANCIAL_YEAR"]
        ]

      );

    if (

      rowFinancialYear !==
      cleanFinancialYear

    ) {

      continue;

    }

    return {

      financialYear:

        row[
          map["FINANCIAL_YEAR"]
        ],

      endDate:

        row[
          map["END_DATE"]
        ],

      gracePeriodEnd:

        row[
          map["GRACE_PERIOD_END"]
        ],

      cardVersion:

        row[
          map["CARD_VERSION"]
        ]

    };

  }

  return null;

}

/**
 * ============================================================
 * SAFE TEST
 * FINANCIAL YEAR
 * ============================================================
 */

function KGMIS_TestReadFinancialYear() {

  const result =

    KGMIS_DigitalCardRenderer_ReadFinancialYear_(

      "2026-27"

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
 * TEST: Render One Digital Card and Enable PNG Generation
 * ============================================================
 */
function KGMIS_TestRenderDigitalCard() {

  const cardId =
    "KEFG0003501";

  const card =
    KGMIS_DigitalCardRenderer_ReadCardById_(
      cardId
    );

  if (!card) {
    throw new Error(
      "Card not found: " +
      cardId
    );
  }

  const viewModel =
    KGMIS_DigitalCardRenderer_BuildCardViewModel_({
      card:
        card
    });

  const html =
    KGMIS_DigitalCardRenderer_RenderTemplate_(
      viewModel
    );

  return HtmlService
    .createHtmlOutput(
      html
    )
    .setTitle(
      "KEF Global Digital Membership Card"
    );
}

function KGMIS_DigitalCardRenderer_SaveGeneratedPng_test(cardId, pngDataUrl) {
  const cleanCardId = KGMIS_DigitalCardRenderer_Clean_(cardId).toUpperCase();
  if (!cleanCardId) throw new Error('CARD_ID is required.');
  const card = KGMIS_DigitalCardRenderer_ReadCardById_(cleanCardId);
  if (!card) throw new Error('Card not found: ' + cleanCardId);
  const match = String(pngDataUrl || '').trim().match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error('A valid PNG data URL was not received.');
  const bytes = Utilities.base64Decode(match[1]);
  const folder = KGMIS_DigitalCardRenderer_GetPngFolder_test();
  const fileName = cleanCardId + '_v' + String(card.CARD_VERSION || '1.0').replace(/[^0-9A-Za-z._-]/g,'_') + '.png';
  KGMIS_DigitalCardRenderer_TrashExistingPng_(card.CARD_IMAGE_FILE_ID);
  const file = folder.createFile(Utilities.newBlob(bytes,'image/png',fileName));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileId = file.getId();
  const fileUrl = 'https://drive.google.com/uc?export=download&id=' + encodeURIComponent(fileId);
  KGMIS_DigitalCardRenderer_UpdatePngColumns_(cleanCardId,fileId,fileUrl);
  return {success:true,cardId:cleanCardId,fileId:fileId,fileUrl:fileUrl,message:'PNG generated and saved successfully for '+cleanCardId+'.'};
}

/**
 * ============================================================
 * GET CONFIGURED DIGITAL-CARD PNG FOLDER
 * ============================================================
 */
function KGMIS_DigitalCardRenderer_GetPngFolder_() {

  const folderId =
    KGMIS_DigitalCardRenderer_Clean_(
      KGMIS_CONFIG.DIGITAL_CARD_FOLDER_ID
    );

  if (!folderId) {
    throw new Error(
      "DIGITAL_CARD_FOLDER_ID is missing from KGMIS_CONFIG."
    );
  }

  try {

    return DriveApp.getFolderById(
      folderId
    );

  } catch (error) {

    throw new Error(
      "The configured Digital Membership Card folder " +
      "could not be opened. Check the Folder ID and permissions. " +
      KGMIS_DigitalCardRenderer_GetErrorMessage_(
        error
      )
    );
  }
}

function KGMIS_DigitalCardRenderer_UpdatePngColumns_test(cardId,fileId,fileUrl) {
  const context=KGMIS_DigitalCardRenderer_GetSheetContext_();
  const headers=context.headers;
  ['CARD_ID','CARD_IMAGE_FILE_ID','CARD_IMAGE_FILE_URL','CARD_STATE','UPDATED_ON','UPDATED_BY'].forEach(function(h){if(headers.indexOf(h)===-1)throw new Error('Required header missing: '+h);});
  const cardCol=headers.indexOf('CARD_ID')+1;
  const ids=context.sheet.getRange(2,cardCol,context.sheet.getLastRow()-1,1).getDisplayValues();
  let row=0;
  for(let i=0;i<ids.length;i++){if(String(ids[i][0]||'').trim().toUpperCase()===cardId){row=i+2;break;}}
  if(!row)throw new Error('Card row not found: '+cardId);
  const values={CARD_IMAGE_FILE_ID:fileId,CARD_IMAGE_FILE_URL:fileUrl,CARD_STATE:'IMAGE_CREATED',UPDATED_ON:new Date(),UPDATED_BY:Session.getActiveUser().getEmail()||'KGMIS_SYSTEM'};
  Object.keys(values).forEach(function(h){context.sheet.getRange(row,headers.indexOf(h)+1).setValue(values[h]);});
  SpreadsheetApp.flush();
}

function KGMIS_DigitalCardRenderer_TrashExistingPng_test(fileId) {
  const id=String(fileId||'').trim();
  if(!id)return;
  try{DriveApp.getFileById(id).setTrashed(true);}catch(e){}
}
