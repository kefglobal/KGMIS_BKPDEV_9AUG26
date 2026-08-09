/**
 * ============================================================
 * SECTION 1 - CONFIGURATION
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

const KGMIS_DIGITAL_CARD_DATABASE_CONFIG =
Object.freeze({

  MEMBER_CARDS_SHEET:

    'KEFG_MEMBER_CARDS'

});


/**
 * ============================================================
 * SECTION 2 - SHEET CONTEXT
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_GetCardDatabaseContext_() {

  const spreadsheet =

    SpreadsheetApp.getActiveSpreadsheet();

  const sheet =

    spreadsheet.getSheetByName(

      KGMIS_DIGITAL_CARD_DATABASE_CONFIG
        .MEMBER_CARDS_SHEET

    );

  if (!sheet) {

    throw new Error(

      'Sheet not found: ' +

      KGMIS_DIGITAL_CARD_DATABASE_CONFIG
        .MEMBER_CARDS_SHEET

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
      .getDisplayValues()[0];

  const headerMap = {};

  headers.forEach(

    function(header,index){

      headerMap[
        String(header).trim()
      ] = index;

    }

  );

  return {

    spreadsheet:
      spreadsheet,

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
 * SECTION 3.1 - READ ONE CARD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_ReadCardById_(
  cardId
) {

  if (!cardId) {
    return null;
  }

  const context =
    KGMIS_GetCardDatabaseContext_();

  const sheet =
    context.sheet;

  const map =
    context.headerMap;

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {
    return null;
  }

  const values =
    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
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

    if (

      String(
        row[
          map.CARD_ID
        ] || ''
      )
        .trim()
        .toUpperCase()

      !==

      String(cardId)
        .trim()
        .toUpperCase()

    ) {

      continue;

    }

    return KGMIS_RowToCardRecord_(

      row,

      context.headers

    );

  }

  return null;

}

/**
 * ============================================================
 * SECTION 3.2 - READ FAMILY CARDS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_ReadFamilyCards_(
  familyId
) {

  const context =
    KGMIS_GetCardDatabaseContext_();

  const sheet =
    context.sheet;

  const map =
    context.headerMap;

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {

    return [];

  }

  const values =

    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        context.headers.length
      )
      .getValues();

  const cards = [];

  values.forEach(

    function(row){

      if (

        String(
          row[
            map.FAMILY_ID
          ] || ''
        )
          .trim()
          .toUpperCase()

        !==

        String(familyId)
          .trim()
          .toUpperCase()

      ) {

        return;

      }

      cards.push(

        KGMIS_RowToCardRecord_(

          row,

          context.headers

        )

      );

    }

  );

  return cards;

}

/**
 * ============================================================
 * SECTION 3.3 - READ ALL CARDS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_ReadAllCards_() {

  const context =

    KGMIS_GetCardDatabaseContext_();

  const sheet =
    context.sheet;

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {

    return [];

  }

  const values =

    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        context.headers.length
      )
      .getValues();

  return values.map(

    function(row){

      return KGMIS_RowToCardRecord_(

        row,

        context.headers

      );

    }

  );

}

/**
 * ============================================================
 * SECTION 3.4 - ROW TO CARD RECORD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_RowToCardRecord_(
  row,
  headers
) {

  const record = {};

  headers.forEach(

    function(header,index){

      record[
        String(header).trim()
      ] = row[index];

    }

  );

  return record;

}

/**
 * ============================================================
 * Section 3 - TEST - READ FUNCTIONS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestReadFunctions() {

  const result = {

    card:

      KGMIS_ReadCardById_(

        'KEFG0003501'

      ),

    family:

      KGMIS_ReadFamilyCards_(

        'FAM00035'

      ).length,

    total:

      KGMIS_ReadAllCards_().length

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

/**
 * ============================================================
 * SECTION 4.1 - INSERT ONE CARD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_InsertCard_(
  cardRecord
) {

  // Validate

  if (
    !cardRecord ||
    typeof cardRecord !== 'object'
  ) {
    throw new Error(
      'A valid Card Record is required.'
    );
  }

  const context =
    KGMIS_GetCardDatabaseContext_();

  const row = [];

  context.headers.forEach(

    function(header){

      row.push(

        Object.prototype.hasOwnProperty.call(
          cardRecord,
          header
        )

        ?

        cardRecord[header]

        :

        ""

      );

    }

  );

  context.sheet.appendRow(
    row
  );

  return {

    success:
      true,

    action:
      "INSERT",

    cardId:
      cardRecord.CARD_ID

  };

}

/**
 * ============================================================
 * TEST - INSERT ONE CARD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestInsertCard() {

  const card = {

    CARD_ID:
      "TEST000001",

    FAMILY_ID:
      "TESTFAMILY",

    KEFG_ID:
      "TESTMEMBER",

    CARDHOLDER_TYPE:
      "PRIMARY MEMBER",

    RELATION_SEQUENCE:
      "01",

    CARDHOLDER_NAME:
      "TEST MEMBER",

    MEMBERSHIP_TYPE:
      "FAMILY",

    MEMBERSHIP_YEAR:
      "2099-00",

    MEMBERSHIP_STATUS:
      "CURRENT",

    ISSUE_DATE:
      new Date(),

    VALID_UNTIL:
      new Date(),

    CARD_STATUS:
      "ACTIVE",

    CARD_STATE:
      "CURRENT",

    MEMBER_MOBILE:
      "",

    MEMBER_EMAIL:
      "",

    PHOTO_FILE_ID:
      "",

    PHOTO_URL:
      "",

    QR_TOKEN:
      "TESTTOKEN",

    CARD_PDF_FILE_ID:
      "",

    CARD_PDF_FILE_URL:
      "",

    CARD_IMAGE_FILE_ID:
      "",

    CARD_IMAGE_FILE_URL:
      "",

    CREATED_ON:
      new Date(),

    CREATED_BY:
      "TEST",

    UPDATED_ON:
      new Date(),

    UPDATED_BY:
      "TEST",

    CARD_VERSION:
      "1.0",

    LAST_VERIFIED_ON:
      "",

    REMARKS:
      "TEST RECORD"

  };

  const result =

    KGMIS_InsertCard_(

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
 * SECTION 4.2 - INSERT CARD BATCH
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_InsertCardBatch_(
  cardRecords
) {

  // Validate

  if (!Array.isArray(cardRecords)) {

    throw new Error(
      'Card Records must be provided as an array.'
    );

  }

  const result = {

    success: true,

    inserted: 0,

    failed: 0,

    cardIds: [],

    errors: []

  };

  cardRecords.forEach(

    function(cardRecord) {

      try {

        KGMIS_InsertCard_(

          cardRecord

        );

        result.inserted++;

        result.cardIds.push(

          cardRecord.CARD_ID

        );

      }

      catch(error) {

        result.failed++;

        result.success = false;

        result.errors.push({

          cardId:

            cardRecord.CARD_ID ||

            '',

          message:

            error.message ||

            String(error)

        });

      }

    }

  );

  return result;

}


/**
 * ============================================================
 * TEST - INSERT CARD BATCH
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestInsertCardBatch() {

  const now =
    new Date();

  const validUntil =
    new Date(
      2099,
      2,
      31
    );

  const cards = [

    {

      CARD_ID:
        'TESTBATCH001',

      FAMILY_ID:
        'TESTFAMILY',

      KEFG_ID:
        'TESTMEMBER1',

      CARDHOLDER_TYPE:
        'PRIMARY MEMBER',

      RELATION_SEQUENCE:
        '01',

      CARDHOLDER_NAME:
        'TEST PRIMARY MEMBER',

      MEMBERSHIP_TYPE:
        'FAMILY',

      MEMBERSHIP_YEAR:
        '2098-99',

      MEMBERSHIP_STATUS:
        'CURRENT',

      ISSUE_DATE:
        now,

      VALID_UNTIL:
        validUntil,

      CARD_STATUS:
        'ACTIVE',

      CARD_STATE:
        'CURRENT',

      MEMBER_MOBILE:
        '9000000001',

      MEMBER_EMAIL:
        'testprimary@example.com',

      PHOTO_FILE_ID:
        '',

      PHOTO_URL:
        '',

      QR_TOKEN:
        'KGMIS-TESTBATCHTOKEN000000000000001',

      CARD_PDF_FILE_ID:
        '',

      CARD_PDF_FILE_URL:
        '',

      CARD_IMAGE_FILE_ID:
        '',

      CARD_IMAGE_FILE_URL:
        '',

      CREATED_ON:
        now,

      CREATED_BY:
        'TEST',

      UPDATED_ON:
        now,

      UPDATED_BY:
        'TEST',

      CARD_VERSION:
        '1.0',

      LAST_VERIFIED_ON:
        '',

      REMARKS:
        'Batch insert test — primary member'

    },

    {

      CARD_ID:
        'TESTBATCH002',

      FAMILY_ID:
        'TESTFAMILY',

      KEFG_ID:
        '',

      CARDHOLDER_TYPE:
        'FAMILY',

      RELATION_SEQUENCE:
        '03',

      CARDHOLDER_NAME:
        'TEST DEPENDANT',

      MEMBERSHIP_TYPE:
        'FAMILY',

      MEMBERSHIP_YEAR:
        '2098-99',

      MEMBERSHIP_STATUS:
        'CURRENT',

      ISSUE_DATE:
        now,

      VALID_UNTIL:
        validUntil,

      CARD_STATUS:
        'ACTIVE',

      CARD_STATE:
        'CURRENT',

      MEMBER_MOBILE:
        '',

      MEMBER_EMAIL:
        '',

      PHOTO_FILE_ID:
        '',

      PHOTO_URL:
        '',

      QR_TOKEN:
        'KGMIS-TESTBATCHTOKEN000000000000002',

      CARD_PDF_FILE_ID:
        '',

      CARD_PDF_FILE_URL:
        '',

      CARD_IMAGE_FILE_ID:
        '',

      CARD_IMAGE_FILE_URL:
        '',

      CREATED_ON:
        now,

      CREATED_BY:
        'TEST',

      UPDATED_ON:
        now,

      UPDATED_BY:
        'TEST',

      CARD_VERSION:
        '1.0',

      LAST_VERIFIED_ON:
        '',

      REMARKS:
        'Batch insert test — dependant'

    }

  ];

  const result =
    KGMIS_InsertCardBatch_(
      cards
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
 * SECTION 5.1 - UPDATE ONE CARD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_UpdateCard_(
  cardRecord
) {

  // Validate

  if (
    !cardRecord ||
    typeof cardRecord !== 'object'
  ) {

    throw new Error(
      'A valid Card Record is required.'
    );

  }

  if (
    !cardRecord.CARD_ID
  ) {

    throw new Error(
      'CARD_ID is required.'
    );

  }

  const context =

    KGMIS_GetCardDatabaseContext_();

  const sheet =
    context.sheet;

  const map =
    context.headerMap;

  const lastRow =
    sheet.getLastRow();

  if (lastRow < 2) {

    throw new Error(
      'No card records exist.'
    );

  }

  const values =

    sheet
      .getRange(
        2,
        1,
        lastRow - 1,
        context.headers.length
      )
      .getValues();

  let rowNumber = 0;

  for (

    let i = 0;

    i < values.length;

    i++

  ) {

    if (

      String(

        values[i][
          map.CARD_ID
        ] || ''

      )
        .trim()
        .toUpperCase()

      ===

      String(
        cardRecord.CARD_ID
      )
        .trim()
        .toUpperCase()

    ) {

      rowNumber =
        i + 2;

      break;

    }

  }

  if (!rowNumber) {

    throw new Error(

      'CARD_ID not found : ' +

      cardRecord.CARD_ID

    );

  }

  const row = [];

  context.headers.forEach(

    function(header){

      row.push(

        Object.prototype.hasOwnProperty.call(

          cardRecord,

          header

        )

        ?

        cardRecord[
          header
        ]

        :

        ""

      );

    }

  );

  sheet
    .getRange(

      rowNumber,

      1,

      1,

      row.length

    )
    .setValues([

      row

    ]);

  return {

    success:
      true,

    action:
      "UPDATE",

    cardId:
      cardRecord.CARD_ID,

    row:
      rowNumber

  };

}

/**
 * ============================================================
 * TEST - UPDATE ONE CARD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestUpdateCard() {

  const card =

    KGMIS_ReadCardById_(

      "TEST000001"

    );

  if (!card) {

    throw new Error(

      "Test card not found."

    );

  }

  card.REMARKS =

    "Updated " +

    new Date();

  const result =

    KGMIS_UpdateCard_(

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
 * SECTION 5.2 - UPDATE BATCH
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_UpdateCardBatch_(
  cardRecords
) {

  if (!Array.isArray(cardRecords)) {

    throw new Error(
      "An array of Card Records is required."
    );

  }

  const results = [];

  let successCount = 0;
  let failureCount = 0;

  cardRecords.forEach(function (cardRecord) {

    try {

      const result =
        KGMIS_UpdateCard_(
          cardRecord
        );

      results.push(result);

      successCount++;

    } catch (error) {

      results.push({

        success: false,

        action: "UPDATE",

        cardId:
          cardRecord &&
          cardRecord.CARD_ID
            ? cardRecord.CARD_ID
            : "",

        error:
          error.message

      });

      failureCount++;

    }

  });

  return {

    success:
      failureCount === 0,

    total:
      cardRecords.length,

    updated:
      successCount,

    failed:
      failureCount,

    results:
      results

  };

}

/**
 * ============================================================
 * TEST - UPDATE BATCH
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestUpdateCardBatch() {

  const cards =
    KGMIS_ReadAllCards_();

  if (!cards || cards.length === 0) {

    throw new Error(
      "No card records found."
    );

  }

  cards.forEach(function (card) {

    card.REMARKS =
      "Batch Updated : " +
      new Date();

    card.UPDATED_ON =
      new Date();

    card.UPDATED_BY =
      "SYSTEM";

  });

  const result =
    KGMIS_UpdateCardBatch_(
      cards
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
 * SECTION 6.1 - DEACTIVATE ONE CARD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_DeactivateCard_(
  cardId,
  remarks
) {

  return KGMIS_SetCardStatus_(

    cardId,

    "INACTIVE",

    remarks

  );

}


/**
 * ============================================================
 * TEST - DEACTIVATE ONE CARD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestDeactivateCard() {

  const result =
    KGMIS_DeactivateCard_(

      "TEST000001",

      "Deactivated for testing."

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
 * SECTION 6.2 - DEACTIVATE CARD BATCH
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_DeactivateCardBatch_(
  cardIds,
  remarks
) {

  if (!Array.isArray(cardIds)) {

    throw new Error(
      "An array of CARD_IDs is required."
    );

  }

  const results = [];

  let successCount = 0;
  let failureCount = 0;

  cardIds.forEach(function (cardId) {

    try {

      const result =
        KGMIS_DeactivateCard_(
          cardId,
          remarks
        );

      results.push(result);

      successCount++;

    } catch (error) {

      results.push({

        success: false,

        action: "DEACTIVATE",

        cardId: cardId,

        error: error.message

      });

      failureCount++;

    }

  });

  return {

    success:
      failureCount === 0,

    total:
      cardIds.length,

    deactivated:
      successCount,

    failed:
      failureCount,

    results:
      results

  };

}


/**
 * ============================================================
 * TEST - DEACTIVATE CARD BATCH
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestDeactivateCardBatch() {

  const result =
    KGMIS_DeactivateCardBatch_(

      [

        "TESTBATCH001",
        "TESTBATCH002",
        "TEST000001"

      ],

      "Batch deactivation test."

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
 * SECTION 6.3 - SET CARD STATUS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_SetCardStatus_(
  cardId,
  cardStatus,
  remarks
) {

  const card =
    KGMIS_ReadCardById_(cardId);

  if (!card) {

    throw new Error(
      "Card not found : " + cardId
    );

  }

  card.CARD_STATUS =
    cardStatus;

  card.UPDATED_ON =
    new Date();

  card.UPDATED_BY =
    "SYSTEM";

  if (remarks) {

    card.REMARKS =
      remarks;

  }

  return KGMIS_UpdateCard_(card);

}


/**
 * ============================================================
 * SECTION 6.4 - REACTIVATE ONE CARD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_ReactivateCard_(
  cardId,
  remarks
) {

  return KGMIS_SetCardStatus_(

    cardId,

    "ACTIVE",

    remarks

  );

}


/**
 * ============================================================
 * TEST - REACTIVATE ONE CARD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestReactivateCard() {

  const result =
    KGMIS_ReactivateCard_(

      "TEST000001",

      "Reactivated for testing."

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
 * SECTION 7.0 - LOOKUP ENGINE
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_FindCardsByField_(
  fieldName,
  fieldValue
) {

  if (!fieldName) {

    throw new Error(
      "Field name is required."
    );

  }

  const normalizedValue =

    String(fieldValue || "")
      .trim()
      .toUpperCase();

  const cards =
    KGMIS_ReadAllCards_();

  return cards.filter(

    function(card){

      return String(

        card[fieldName] || ""

      )
      .trim()
      .toUpperCase()

      ===

      normalizedValue;

    }

  );

}


/**
 * ============================================================
 * SECTION 7.1 - LOOKUP BY CARD ID
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_LookupCardByCardId_(
  cardId
) {

  return KGMIS_ReadCardById_(
    cardId
  );

}



/**
 * ============================================================
 * TEST - LOOKUP BY CARD ID
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestLookupCardByCardId() {

  const card =

    KGMIS_LookupCardByCardId_(

      "TEST000001"

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
 * SECTION 7.2 - LOOKUP BY KEFG ID
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_LookupCardsByKefgId_(
  kefgId
) {

  return KGMIS_FindCardsByField_(

    "KEFG_ID",

    kefgId

  );

}


/**
 * ============================================================
 * TEST - LOOKUP BY KEFG ID
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestLookupCardsByKefgId() {

  const cards =

    KGMIS_LookupCardsByKefgId_(

      "KEFG1001"

    );

  Logger.log(

    JSON.stringify(

      cards,

      null,

      2

    )

  );

  return cards;

}


/**
 * ============================================================
 * SECTION 7.3 - LOOKUP BY FAMILY ID
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_LookupCardsByFamilyId_(
  familyId
) {

  return KGMIS_FindCardsByField_(

    "FAMILY_ID",

    familyId

  );

}


/**
 * ============================================================
 * TEST - LOOKUP BY FAMILY ID
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestLookupCardsByFamilyId() {

  const cards =

    KGMIS_LookupCardsByFamilyId_(

      "TESTFAMILY"

    );

  Logger.log(

    JSON.stringify(

      cards,

      null,

      2

    )

  );

  Logger.log(

    "Records found : " +

    cards.length

  );

  return cards;

}

/**
 * ============================================================
 * TEST - LOOKUP FUNCTIONS 7.1 TO 7.3
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestLookupFunctions_7_1_To_7_3() {

  const cardByCardId =
    KGMIS_LookupCardByCardId_(
      "TEST000001"
    );

  const cardsByKefgId =
    KGMIS_LookupCardsByKefgId_(
      "KEFG1001"
    );

  const cardsByFamilyId =
    KGMIS_LookupCardsByFamilyId_(
      "FAM00001"
    );

  const result = {

    cardIdLookup: {

      found:
        Boolean(cardByCardId),

      card:
        cardByCardId

    },

    kefgIdLookup: {

      count:
        cardsByKefgId.length,

      cards:
        cardsByKefgId

    },

    familyIdLookup: {

      count:
        cardsByFamilyId.length,

      cards:
        cardsByFamilyId

    }

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


/**
 * ============================================================
 * SECTION 7.4 - LOOKUP BY QR TOKEN
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_LookupCardByQrToken_(
  qrToken
) {

  const matches =

    KGMIS_FindCardsByField_(

      "QR_TOKEN",

      qrToken

    );

  if (

    matches.length === 0

  ) {

    return null;

  }

  if (

    matches.length > 1

  ) {

    throw new Error(

      "Duplicate QR_TOKEN found."

    );

  }

  return matches[0];

}


/**
 * ============================================================
 * TEST - LOOKUP BY TESTTOKEN
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestLookupCardByQrToken() {

  const card =
    KGMIS_LookupCardByQrToken_(
      "95517C447B934947A087FABCBECB6664"
    );

  Logger.log(
    JSON.stringify(
      card,
      null,
      2
    )
  );

  if (!card) {

    throw new Error(
      "Card not found for QR_TOKEN."
    );

  }

  Logger.log(
    "Card found : " +
    card.CARD_ID
  );

  return card;

}

/**
 * ============================================================
 * SECTION 7.5 - LOOKUP BY CARD_STATUS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_LookupCardsByCardStatus_(
  cardStatus
) {

  return KGMIS_FindCardsByField_(

    "CARD_STATUS",

    cardStatus

  );

}

/**
 * ============================================================
 * SECTION 7.6 - LOOKUP BY MEMBERSHIP_YEAR
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_LookupCardsByMembershipYear_(
  membershipYear
) {

  return KGMIS_FindCardsByField_(

    "MEMBERSHIP_YEAR",

    membershipYear

  );

}


/**
 * ============================================================
 * SECTION 8 - VALIDATION FUNCTIONS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */


/**
 * ============================================================
 * SECTION 8.1 - VALIDATE CARD RECORD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_ValidateCardRecord_(
  cardRecord
) {

  const errors = [];
  const warnings = [];

  if (
    !cardRecord ||
    typeof cardRecord !== "object" ||
    Array.isArray(cardRecord)
  ) {

    return {

      valid: false,

      errors: [
        "A valid Card Record is required."
      ],

      warnings: []

    };

  }

  const requiredFields = [

    "CARD_ID",
    "FAMILY_ID",
    "CARDHOLDER_TYPE",
    "RELATION_SEQUENCE",
    "CARDHOLDER_NAME",
    "MEMBERSHIP_TYPE",
    "MEMBERSHIP_YEAR",
    "MEMBERSHIP_STATUS",
    "ISSUE_DATE",
    "VALID_UNTIL",
    "CARD_STATUS",
    "CARD_STATE",
    "QR_TOKEN",
    "CREATED_ON",
    "CREATED_BY",
    "UPDATED_ON",
    "UPDATED_BY",
    "CARD_VERSION"

  ];

  requiredFields.forEach(
    function(fieldName) {

      const value =
        cardRecord[fieldName];

      if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
      ) {

        errors.push(
          fieldName + " is required."
        );

      }

    }
  );

  const allowedCardStatuses = [

    "ACTIVE",
    "INACTIVE",
    "EXPIRED",
    "REVOKED",
    "ARCHIVED"

  ];

  const cardStatus =
    String(
      cardRecord.CARD_STATUS || ""
    )
      .trim()
      .toUpperCase();

  if (
    cardStatus &&
    !allowedCardStatuses.includes(cardStatus)
  ) {

    errors.push(
      "Invalid CARD_STATUS : " +
      cardRecord.CARD_STATUS
    );

  }

  const allowedCardStates = [

    "CURRENT",
    "REPLACED",
    "SUPERSEDED",
    "LOST",
    "DAMAGED"

  ];

  const cardState =
    String(
      cardRecord.CARD_STATE || ""
    )
      .trim()
      .toUpperCase();

  if (
    cardState &&
    !allowedCardStates.includes(cardState)
  ) {

    errors.push(
      "Invalid CARD_STATE : " +
      cardRecord.CARD_STATE
    );

  }

  const relationSequence =
    Number(
      cardRecord.RELATION_SEQUENCE
    );

  if (
    cardRecord.RELATION_SEQUENCE !== "" &&
    (
      !Number.isInteger(relationSequence) ||
      relationSequence < 1
    )
  ) {

    errors.push(
      "RELATION_SEQUENCE must be a positive whole number."
    );

  }

  const cardVersion =
    Number(
      cardRecord.CARD_VERSION
    );

  if (
    cardRecord.CARD_VERSION !== "" &&
    (
      !Number.isInteger(cardVersion) ||
      cardVersion < 1
    )
  ) {

    errors.push(
      "CARD_VERSION must be a positive whole number."
    );

  }

  const issueDate =
    new Date(
      cardRecord.ISSUE_DATE
    );

  const validUntil =
    new Date(
      cardRecord.VALID_UNTIL
    );

  if (
    cardRecord.ISSUE_DATE &&
    isNaN(issueDate.getTime())
  ) {

    errors.push(
      "ISSUE_DATE is invalid."
    );

  }

  if (
    cardRecord.VALID_UNTIL &&
    isNaN(validUntil.getTime())
  ) {

    errors.push(
      "VALID_UNTIL is invalid."
    );

  }

  if (
    !isNaN(issueDate.getTime()) &&
    !isNaN(validUntil.getTime()) &&
    validUntil < issueDate
  ) {

    errors.push(
      "VALID_UNTIL cannot be earlier than ISSUE_DATE."
    );

  }

  if (
    !cardRecord.KEFG_ID &&
    String(
      cardRecord.CARDHOLDER_TYPE || ""
    )
      .trim()
      .toUpperCase() !== "FAMILY"
  ) {

    warnings.push(
      "KEFG_ID is blank."
    );

  }

  return {

    valid:
      errors.length === 0,

    errors:
      errors,

    warnings:
      warnings

  };

}


/**
 * ============================================================
 * TEST - VALIDATE CARD RECORD
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestValidateCardRecord() {

  const card =
    KGMIS_ReadCardById_(
      "TEST000001"
    );

  if (!card) {

    throw new Error(
      "Test card not found."
    );

  }

  const result =
    KGMIS_ValidateCardRecord_(
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
 * SECTION 8.2 - VALIDATE CARD ID
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_ValidateCardId_(
  cardId
) {

  const errors = [];

  const normalizedCardId =
    String(
      cardId || ""
    )
      .trim()
      .toUpperCase();

  if (!normalizedCardId) {

    errors.push(
      "CARD_ID is required."
    );

    return errors;

  }

  if (
    normalizedCardId.length < 4
  ) {

    errors.push(
      "CARD_ID is too short."
    );

  }

  if (
    normalizedCardId.length > 50
  ) {

    errors.push(
      "CARD_ID is too long."
    );

  }

  if (
    !/^[A-Z0-9_-]+$/.test(
      normalizedCardId
    )
  ) {

    errors.push(
      "CARD_ID may contain only letters, numbers, hyphens, and underscores."
    );

  }

  return errors;

}


/**
 * ============================================================
 * TEST - VALIDATE CARD ID
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestValidateCardId() {

  const tests = [

    "TEST000001",
    "CARD-2026-001",
    "",
    "AB",
    "INVALID CARD ID",
    "CARD@001"

  ];

  const results =
    tests.map(
      function(cardId) {

        const errors =
          KGMIS_ValidateCardId_(
            cardId
          );

        return {

          cardId:
            cardId,

          valid:
            errors.length === 0,

          errors:
            errors

        };

      }
    );

  Logger.log(
    JSON.stringify(
      results,
      null,
      2
    )
  );

  return results;

}

/**
 * ============================================================
 * SECTION 8.3 - VALIDATE QR TOKEN
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_ValidateQrToken_(
  qrToken
) {

  const errors = [];

  const normalizedQrToken =
    String(
      qrToken || ""
    )
      .trim();

  if (!normalizedQrToken) {

    errors.push(
      "QR_TOKEN is required."
    );

    return errors;

  }

  if (
    normalizedQrToken.length < 8
  ) {

    errors.push(
      "QR_TOKEN is too short."
    );

  }

  if (
    normalizedQrToken.length > 200
  ) {

    errors.push(
      "QR_TOKEN is too long."
    );

  }

  if (
    /\s/.test(
      normalizedQrToken
    )
  ) {

    errors.push(
      "QR_TOKEN must not contain spaces."
    );

  }

  if (
    !/^[A-Za-z0-9_-]+$/.test(
      normalizedQrToken
    )
  ) {

    errors.push(
      "QR_TOKEN may contain only letters, numbers, hyphens, and underscores."
    );

  }

  return errors;

}


/**
 * ============================================================
 * TEST - VALIDATE QR TOKEN
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestValidateQrToken() {

  const tests = [

    "TESTTOKEN",
    "QR_TOKEN_2026_001",
    "QR-TOKEN-001",
    "",
    "SHORT",
    "TOKEN WITH SPACE",
    "TOKEN@001"

  ];

  const results =
    tests.map(
      function(qrToken) {

        const errors =
          KGMIS_ValidateQrToken_(
            qrToken
          );

        return {

          qrToken:
            qrToken,

          valid:
            errors.length === 0,

          errors:
            errors

        };

      }
    );

  Logger.log(
    JSON.stringify(
      results,
      null,
      2
    )
  );

  return results;

}


/**
 * ============================================================
 * SECTION 8.4 - VALIDATE MEMBERSHIP YEAR
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_ValidateMembershipYear_(
  membershipYear
) {

  const errors = [];

  const year =
    String(
      membershipYear || ""
    )
      .trim();

  if (!year) {

    errors.push(
      "MEMBERSHIP_YEAR is required."
    );

    return errors;

  }

  // Expected format: YYYY-YY

  if (
    !/^\d{4}-\d{2}$/.test(year)
  ) {

    errors.push(
      "MEMBERSHIP_YEAR must be in YYYY-YY format."
    );

    return errors;

  }

  const startYear =
    Number(
      year.substring(0, 4)
    );

  const endYear =
    Number(
      year.substring(5, 7)
    );

  if (
    endYear !==
    (startYear + 1) % 100
  ) {

    errors.push(
      "MEMBERSHIP_YEAR is not a valid financial year."
    );

  }

  return errors;

}


/**
 * ============================================================
 * TEST - VALIDATE MEMBERSHIP YEAR
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestValidateMembershipYear() {

  const tests = [

    "2026-27",
    "2025-26",
    "2099-00",
    "",
    "2026",
    "26-27",
    "2026-28",
    "202A-27"

  ];

  const results =

    tests.map(

      function(year){

        const errors =

          KGMIS_ValidateMembershipYear_(

            year

          );

        return {

          membershipYear:

            year,

          valid:

            errors.length === 0,

          errors:

            errors

        };

      }

    );

  Logger.log(

    JSON.stringify(

      results,

      null,

      2

    )

  );

  return results;

}


/**
 * ============================================================
 * SECTION 8.5 - VALIDATE CARD STATUS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_ValidateCardStatus_(
  cardStatus
) {

  const errors = [];

  const status =
    String(
      cardStatus || ""
    )
      .trim()
      .toUpperCase();

  if (!status) {

    errors.push(
      "CARD_STATUS is required."
    );

    return errors;

  }

  const allowedStatuses = [

    "ACTIVE",
    "INACTIVE",
    "EXPIRED",
    "REVOKED",
    "ARCHIVED"

  ];

  if (
    !allowedStatuses.includes(status)
  ) {

    errors.push(
      "Invalid CARD_STATUS : " +
      cardStatus
    );

  }

  return errors;

}


/**
 * ============================================================
 * TEST - VALIDATE CARD STATUS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestValidateCardStatus() {

  const tests = [

    "ACTIVE",
    "INACTIVE",
    "EXPIRED",
    "REVOKED",
    "ARCHIVED",

    "",
    "CURRENT",
    "SUSPENDED",
    "INVALID"

  ];

  const results =

    tests.map(

      function(status){

        const errors =

          KGMIS_ValidateCardStatus_(

            status

          );

        return {

          cardStatus:

            status,

          valid:

            errors.length === 0,

          errors:

            errors

        };

      }

    );

  Logger.log(

    JSON.stringify(

      results,

      null,

      2

    )

  );

  return results;

}


/**
 * ============================================================
 * SECTION 8.6 - VALIDATE REQUIRED FIELDS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_ValidateRequiredFields_(
  cardRecord,
  requiredFields
) {

  const errors = [];

  if (
    !cardRecord ||
    typeof cardRecord !== "object" ||
    Array.isArray(cardRecord)
  ) {

    errors.push(
      "A valid Card Record is required."
    );

    return errors;

  }

  if (
    !Array.isArray(requiredFields)
  ) {

    errors.push(
      "An array of required fields is required."
    );

    return errors;

  }

  requiredFields.forEach(
    function(fieldName) {

      const value =
        cardRecord[fieldName];

      if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
      ) {

        errors.push(
          fieldName + " is required."
        );

      }

    }
  );

  return errors;

}


/**
 * ============================================================
 * TEST - VALIDATE REQUIRED FIELDS
 * Designed & Developed by James Joseph Alenchery
 * ============================================================
 */

function KGMIS_TestValidateRequiredFields() {

  const cardRecord = {

    CARD_ID:
      "TEST000001",

    FAMILY_ID:
      "TESTFAMILY",

    CARDHOLDER_NAME:
      "TEST MEMBER",

    MEMBERSHIP_YEAR:
      "2099-00",

    CARD_STATUS:
      "ACTIVE",

    QR_TOKEN:
      ""

  };

  const requiredFields = [

    "CARD_ID",
    "FAMILY_ID",
    "CARDHOLDER_NAME",
    "MEMBERSHIP_YEAR",
    "CARD_STATUS",
    "QR_TOKEN",
    "UPDATED_BY"

  ];

  const errors =
    KGMIS_ValidateRequiredFields_(

      cardRecord,

      requiredFields

    );

  const result = {

    valid:
      errors.length === 0,

    errors:
      errors

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



